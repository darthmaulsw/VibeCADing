from flask import Flask, request, jsonify
from flask_cors import CORS
from gradio_client import Client, handle_file
import os
import re  # >>> INTENT detection
import tempfile
import shutil
from werkzeug.utils import secure_filename
from io import BytesIO
from dotenv import load_dotenv
from elevenlabs import ElevenLabs
from dedalus_labs import AsyncDedalus, DedalusRunner
import asyncio
from uuid import uuid4
from fin import get_cad
from testing import iterate_cad

load_dotenv()
currentText = ""
generation_jobs = {}

# ----------------------------- Supabase ---------------------------------
from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
print("[INFO] Supabase client initialized")

# --------------------------- External clients ---------------------------
elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
if not elevenlabs_api_key:
    print("[WARN] ELEVENLABS_API_KEY not set. /api/transcribe will return 501 until provided.")
    elevenlabs = None
else:
    elevenlabs = ElevenLabs(api_key=elevenlabs_api_key)

dedalus_api_key = os.getenv("DEDALUS_API_KEY")
if not dedalus_api_key:
    print("[WARN] DEDALUS_API_KEY not set. /api/getresponse will fall back.")
    dedalus = None
else:
    dedalus = AsyncDedalus(api_key=dedalus_api_key)

# ------------------------------- Flask ----------------------------------
app = Flask(__name__)

# CORS
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:3000").split(",")
if os.getenv("FLASK_ENV") == "production" or os.getenv("DYNO"):
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)
else:
    CORS(app, origins=cors_origins, supports_credentials=True)

# ------------------------------ Helpers ---------------------------------
UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def _audio_to_bytes(obj) -> bytes:
    if obj is None:
        return b""
    if isinstance(obj, (bytes, bytearray)):
        return bytes(obj)
    if hasattr(obj, "read") and callable(getattr(obj, "read")):
        return obj.read()
    if hasattr(obj, "__iter__"):
        parts = []
        for chunk in obj:
            if isinstance(chunk, (bytes, bytearray)):
                parts.append(bytes(chunk))
            elif isinstance(chunk, str):
                parts.append(chunk.encode("utf-8"))
            else:
                try:
                    parts.append(bytes(chunk))
                except Exception:
                    pass
        return b"".join(parts)
    raise TypeError(f"Unsupported audio object type: {type(obj)}")

def _strip_markdown_fences(code: str) -> str:
    """
    Remove markdown code fences from SCAD code.
    Handles various formats:
    - ```openscad ... ```
    - ```scad ... ```
    - ``` ... ```
    - With or without whitespace
    """
    code = code.strip()
    
    # Remove opening fence: ```openscad, ```scad, or just ```
    lines = code.split('\n')
    if lines and lines[0].strip().startswith('```'):
        lines = lines[1:]
    
    # Remove closing fence: ```
    if lines and lines[-1].strip() == '```':
        lines = lines[:-1]
    
    result = '\n'.join(lines).strip()
    return result

# CAD generation (new model)
def _generate_cad_model(prompt: str, userid: str | None = None, modelid: str | None = None):
    if not prompt:
        return None, None
    mid = modelid or str(uuid4())
    try:
        asyncio.run(get_cad(prompt))
    except RuntimeError:
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(get_cad(prompt))
        finally:
            loop.close()

    scad_code = None
    if os.path.exists("output.scad"):
        with open("output.scad", "r", encoding="utf-8") as f:
            raw = f.read()
        # Robust markdown fence removal
        scad_code = _strip_markdown_fences(raw)

    if userid and scad_code:
        try:
            import time as _time
            supabase.table("models").insert({
                "id": mid,
                "user_id": userid,
                "name": prompt,
                "created_at": _time.time(),
                "scad_code": scad_code
            }).execute()
        except Exception as db_e:
            print("[WARN] Supabase insert failed:", db_e)
    return mid, scad_code

# >>> ITERATION: iterate existing model
def _iterate_cad_model(prompt: str, userid: str, modelid: str):
    """Fetch existing scad_code by (userid, modelid), iterate with iterate_cad(prompt, old),
    write outputIterated.scad, update Supabase, return updated scad_code."""
    if not (prompt and userid and modelid):
        raise ValueError("iterate requires prompt, userid, and modelid")
    # fetch current model
    res = supabase.table("models").select("*").eq("id", modelid).eq("user_id", userid).single().execute()
    if not res.data:
        raise RuntimeError("model not found")
    old_scad = res.data["scad_code"]

    # run iterate
    try:
        asyncio.run(iterate_cad(prompt, old_scad))
    except RuntimeError:
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(iterate_cad(prompt, old_scad))
        finally:
            loop.close()

    # read output
    if not os.path.exists("outputIterated.scad"):
        raise RuntimeError("outputIterated.scad not produced by iterate_cad")
    with open("outputIterated.scad", "r", encoding="utf-8") as f:
        raw = f.read()
    scad_code = _strip_markdown_fences(raw)

    # update DB
    supabase.table("models").update({"scad_code": scad_code, "name": prompt}).eq("id", modelid).eq("user_id", userid).execute()
    return scad_code

# Status sentence + TTS
def _status_update(text: str):
    status_text = "Preparing your CAD model; generating now."
    try:
        tpl = (
            "based on ${currentText} generate one short sentence that says we are generating the CAD model now. "
            "No features, no brands, no fluff."
        )
        prompt = tpl.replace("${currentText}", text or "")
        client = AsyncDedalus() if os.getenv("DEDALUS_API_KEY") else None
        if client:
            runner = DedalusRunner(client)
            async def _run():
                return await runner.run(
                    input=prompt,
                    model=["openai/gpt-5", "gemini-2.5-flash"],
                    mcp_servers=["windsor/brave-search-mcp"],
                    stream=False,
                )
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = None
            if loop and loop.is_running():
                new_loop = asyncio.new_event_loop()
                try:
                    asyncio.set_event_loop(new_loop)
                    result = new_loop.run_until_complete(_run())
                finally:
                    new_loop.close()
                    asyncio.set_event_loop(loop)
            elif loop:
                result = loop.run_until_complete(_run())
            else:
                result = asyncio.run(_run())
            status_text = getattr(result, "final_output", None) or str(result)
    except Exception as e:
        print("[WARN] Status Dedalus failed:", e)

    audio_b64 = None
    try:
        if elevenlabs and status_text:
            audio_obj = elevenlabs.text_to_speech.convert(
                text=status_text,
                voice_id="IKne3meq5aSn9XLyUdCD",
                model_id="eleven_multilingual_v2",
                output_format="mp3_44100_128",
            )
            audio_bytes = _audio_to_bytes(audio_obj)
            import base64
            audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
            print(f"[STATUS TTS] bytes={len(audio_bytes)} b64_len={len(audio_b64)}")
        else:
            print("[STATUS TTS] Skipped (no elevenlabs or empty status_text).")
    except Exception as e:
        print("[WARN] Status TTS failed:", e)

    return status_text, audio_b64

# --------------------------- Hunyuan client -----------------------------
_client = None
def get_client():
    global _client
    if _client is not None:
        return _client
    import time as _time
    last_err = None
    hf_token = os.getenv("HUGGINGFACE_TOKEN")
    for _ in range(3):
        try:
            _c = Client("tencent/Hunyuan3D-2", hf_token=hf_token) if hf_token else Client("tencent/Hunyuan3D-2")
            _client = _c
            return _client
        except Exception as e:
            last_err = e
            _time.sleep(2)
    raise last_err

# ------------------------------- Routes ---------------------------------

@app.route("/api/hunyuan/generate", methods=["POST"])
def generate_hunyuan_model():
    import time
    start_time = time.time()
    try:
        userid = request.form.get("userid")
        if not userid:
            return jsonify({"error": "userid is required"}), 400

        caption = request.form.get("caption", "Eric Zou, a male human being, Asian ethnicity")

        if "image" not in request.files:
            return jsonify({"error": "Main image is required"}), 400

        temp_dir = tempfile.mkdtemp()
        file_paths = {}
        try:
            image_file = request.files["image"]
            if not image_file or not image_file.filename:
                return jsonify({"error": "No image file provided"}), 400
            if not allowed_file(image_file.filename):
                return jsonify({"error": f"Invalid file type. Allowed: {ALLOWED_EXTENSIONS}"}), 400

            image_path = os.path.join(temp_dir, secure_filename(image_file.filename))
            image_file.save(image_path)
            file_paths["image"] = image_path

            mv_images = {
                "mv_image_front": request.files.get("mv_image_front"),
                "mv_image_back": request.files.get("mv_image_back"),
                "mv_image_left": request.files.get("mv_image_left"),
                "mv_image_right": request.files.get("mv_image_right"),
            }
            for key, file in mv_images.items():
                if file and file.filename and allowed_file(file.filename):
                    p = os.path.join(temp_dir, secure_filename(file.filename))
                    file.save(p)
                    file_paths[key] = p

            steps = int(request.form.get("steps", 32))
            guidance_scale = float(request.form.get("guidance_scale", 5.5))
            seed = int(request.form.get("seed", 42))
            octree_resolution = int(request.form.get("octree_resolution", 256))
            check_box_rembg = request.form.get("check_box_rembg", "true").lower() == "true"
            num_chunks = int(request.form.get("num_chunks", 8000))
            randomize_seed = request.form.get("randomize_seed", "false").lower() == "true"

            client = get_client()
            result = client.predict(
                caption=caption,
                image=handle_file(file_paths["image"]),
                mv_image_front=handle_file(file_paths.get("mv_image_front", file_paths["image"])),
                mv_image_back=handle_file(file_paths.get("mv_image_back", file_paths["image"])),
                mv_image_left=handle_file(file_paths.get("mv_image_left", file_paths["image"])),
                mv_image_right=handle_file(file_paths.get("mv_image_right", file_paths["image"])),
                steps=steps,
                guidance_scale=guidance_scale,
                seed=seed,
                octree_resolution=octree_resolution,
                check_box_rembg=check_box_rembg,
                num_chunks=num_chunks,
                randomize_seed=randomize_seed,
                api_name="/shape_generation",
            )

            def extract_url(obj):
                if isinstance(obj, dict):
                    if "__type__" in obj and "value" in obj:
                        return obj["value"]
                    elif "value" in obj:
                        return obj["value"]
                return obj

            model_url = None
            if isinstance(result, (list, tuple)) and len(result) > 0:
                model_url = extract_url(result[0])
            elif result:
                model_url = extract_url(result)

            if model_url and not isinstance(model_url, str):
                model_url = str(model_url)
            if model_url and model_url.startswith("/tmp/gradio/"):
                base_url = "https://tencent-hunyuan3d-2.hf.space"
                model_url = f"{base_url}/file={model_url}"

            try:
                supabase.table("models").insert({
                    "id": str(uuid4()),
                    "user_id": userid,
                    "name": caption if caption else f"Model_{int(start_time)}",
                    "glb_file_url": model_url
                }).execute()
            except Exception as db_error:
                print("[WARN] Database save failed:", db_error)

            return jsonify({"success": True, "model_url": model_url, "result": result})
        finally:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
    except Exception as e:
        import traceback
        return jsonify({"success": False, "error": str(e), "traceback": traceback.format_exc() if app.debug else None}), 500

@app.get("/api/getresponse")
def get_response():
    if not elevenlabs:
        return jsonify({"error": "ELEVENLABS_API_KEY not configured"}), 500

    global currentText
    prompt = (
        "based on ${currentText} generate one short sentence that says we are generating the CAD model now."
        " No features, no brands, no fluff."
    ).replace("${currentText}", currentText or "")

    try:
        client = AsyncDedalus() if os.getenv("DEDALUS_API_KEY") else None
        if client:
            runner = DedalusRunner(client)
            async def _run():
                return await runner.run(
                    input=prompt,
                    model=["openai/gpt-5", "gemini-2.5-flash"],
                    mcp_servers=["windsor/brave-search-mcp"],
                    stream=False,
                )
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = None
            if loop and loop.is_running():
                new_loop = asyncio.new_event_loop()
                try:
                    asyncio.set_event_loop(new_loop)
                    result = new_loop.run_until_complete(_run())
                finally:
                    new_loop.close()
                    asyncio.set_event_loop(loop)
            elif loop:
                result = loop.run_until_complete(_run())
            else:
                result = asyncio.run(_run())
            text_out = getattr(result, "final_output", None) or str(result)
        else:
            text_out = "Your CAD model generation is starting now."
    except Exception:
        text_out = "Your CAD model generation is starting now."

    try:
        audio = elevenlabs.text_to_speech.convert(
            text=text_out,
            voice_id="IKne3meq5aSn9XLyUdCD",
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        )
        audio_bytes = _audio_to_bytes(audio)
        import base64
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        return jsonify({"text": text_out, "audio_b64": audio_b64, "format": "mp3"})
    except Exception:
        return jsonify({"error": "TTS failed", "text": text_out}), 500

@app.post("/api/generate-model-summary")
def generate_model_summary():
    """
    POST body JSON:
      - scad_code (required): The OpenSCAD code that was generated
      - user_prompt (optional): Original user request for context
    Returns: { summary: string, audio_b64: string, format: string }
    
    Generates a brief natural language summary of the generated model
    """
    if not elevenlabs:
        return jsonify({"error": "ELEVENLABS_API_KEY not configured"}), 500
    
    try:
        data = request.get_json() or {}
        scad_code = data.get("scad_code", "")
        user_prompt = data.get("user_prompt", "")
        
        if not scad_code:
            return jsonify({"error": "scad_code is required"}), 400
        
        # Build prompt for summary generation
        prompt = f"""Based on the following OpenSCAD code, generate ONE SHORT sentence (max 15 words) describing what 3D model was created. 
Be specific about the shape, dimensions if obvious, and any notable features. Do not mention OpenSCAD or technical details.
Keep it natural and conversational.

{f"User requested: {user_prompt}" if user_prompt else ""}

OpenSCAD code:
{scad_code[:500]}

Generate a brief description:"""
        
        try:
            client = AsyncDedalus() if os.getenv("DEDALUS_API_KEY") else None
            if client:
                runner = DedalusRunner(client)
                async def _run():
                    return await runner.run(
                        input=prompt,
                        model=["openai/gpt-4o-mini", "gemini-2.5-flash"],
                        stream=False,
                    )
                try:
                    loop = asyncio.get_event_loop()
                except RuntimeError:
                    loop = None
                if loop and loop.is_running():
                    new_loop = asyncio.new_event_loop()
                    try:
                        asyncio.set_event_loop(new_loop)
                        result = new_loop.run_until_complete(_run())
                    finally:
                        new_loop.close()
                        asyncio.set_event_loop(loop)
                elif loop:
                    result = loop.run_until_complete(_run())
                else:
                    result = asyncio.run(_run())
                summary = getattr(result, "final_output", None) or str(result)
                # Clean up the summary - remove quotes if wrapped
                summary = summary.strip().strip('"').strip("'")
            else:
                summary = "Your 3D model has been generated successfully."
        except Exception as e:
            print(f"[WARN] Summary generation failed: {e}")
            summary = "Your 3D model has been generated successfully."
        
        # Generate TTS audio for the summary
        try:
            audio = elevenlabs.text_to_speech.convert(
                text=summary,
                voice_id="IKne3meq5aSn9XLyUdCD",
                model_id="eleven_multilingual_v2",
                output_format="mp3_44100_128",
            )
            audio_bytes = _audio_to_bytes(audio)
            import base64
            audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
            return jsonify({"summary": summary, "audio_b64": audio_b64, "format": "mp3"})
        except Exception as tts_err:
            print(f"[WARN] TTS failed for summary: {tts_err}")
            return jsonify({"summary": summary, "audio_b64": None, "format": None})
            
    except Exception as e:
        import traceback
        print(f"[ERROR] generate-model-summary exception: {e}")
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# >>> ITERATION: Dedicated endpoint
@app.post("/api/iterate")
def iterate_endpoint():
    """
    POST body form-data or JSON:
      - userid (required)
      - modelid (required)
      - prompt (required): iteration instruction (e.g., 'make the handle thicker')
    Returns: { success, scad_code }
    """
    try:
        userid = request.form.get("userid") or (request.json or {}).get("userid")
        modelid = request.form.get("modelid") or (request.json or {}).get("modelid")
        prompt = request.form.get("prompt") or (request.json or {}).get("prompt")
        if not (userid and modelid and prompt):
            return jsonify({"error": "userid, modelid and prompt are required"}), 400

        scad = _iterate_cad_model(prompt, userid, modelid)
        return jsonify({"success": True, "scad_code": scad})
    except Exception as e:
        import traceback
        return jsonify({"success": False, "error": str(e), "traceback": traceback.format_exc() if app.debug else None}), 500

@app.post("/api/transcribe")
def transcribe_audio():
    try:
        if not elevenlabs:
            return jsonify({"error": "ELEVENLABS_API_KEY not configured"}), 501

        print("/api/transcribe content-type:", request.content_type)
        print("/api/transcribe files keys:", list(request.files.keys()))
        print("/api/transcribe form keys:", list(request.form.keys()))

        if "file" not in request.files:
            raw_len = request.content_length or 0
            return jsonify({
                "error": "no file provided",
                "hint": "Send multipart/form-data with a 'file' field",
                "content_type": request.content_type,
                "content_length": raw_len,
            }), 400

        uploaded = request.files["file"]
        payload = uploaded.read()
        print("/api/transcribe received bytes:", len(payload))
        print("/api/transcribe file name:", getattr(uploaded, "filename", None))
        print("/api/transcribe file mimetype:", getattr(uploaded, "mimetype", None))

        audio_data = BytesIO(payload)
        try:
            audio_data.name = uploaded.filename or "audio.webm"
        except Exception:
            pass

        tr = elevenlabs.speech_to_text.convert(
            file=audio_data,
            model_id="scribe_v1",
            tag_audio_events=True,
            language_code="eng",
            diarize=True,
        )

        text = ""
        if getattr(tr, "utterances", None):
            text = " ".join(u.text for u in tr.utterances if u.text).strip()
        elif getattr(tr, "text", None):
            text = tr.text.strip()

        print("[TRANSCRIPT]", text)
        global currentText
        currentText = text

        # >>> INTENT: detect "re iterate" / "reiterate" / "iterate again"
        tnorm = (text or "").lower()
        iterate_intent = bool(re.search(r"\bre[\s-]?iterate\b", tnorm) or re.search(r"\biterate again\b", tnorm))
        print("[INTENT] iterate_intent:", iterate_intent)

        # chain flags
        chain_flag = (
            request.args.get("chain_generate")
            or request.args.get("generate")
            or request.args.get("chain")
            or request.form.get("chain_generate")
            or request.form.get("generate")
            or request.form.get("chain")
        )
        do_chain = str(chain_flag).lower() in ("1", "true", "yes")
        print("[CHAIN] chain flag:", chain_flag, "=>", do_chain)

        # build prompt (fallbacks)
        prompt_from_client = (request.args.get("prompt") or request.form.get("prompt") or "").strip()
        gen_prompt = (text or "").strip() or prompt_from_client or (currentText or "").strip()
        if not gen_prompt:
            print("[CHAIN] No usable prompt (empty transcript and no 'prompt' provided).")

        model_id = None
        scad_code = None

        status_text = None
        status_audio_b64 = None

        if do_chain:
            print("[CHAIN] Producing status update (Dedalus + TTS) before CAD/iteration...")
            status_text, status_audio_b64 = _status_update(gen_prompt or text or "")

        # async switch and IDs
        async_flag = (
            request.args.get("async")
            or request.args.get("async_generate")
            or request.form.get("async")
            or request.form.get("async_generate")
        )
        do_async = str(async_flag).lower() in ("1", "true", "yes")
        userid = request.args.get("userid") or request.form.get("userid")
        modelid = request.args.get("modelid") or request.form.get("modelid")

        # If not chaining, just return transcript + optional status audio
        if not do_chain:
            return jsonify({
                "text": text,
                "raw": tr.model_dump() if hasattr(tr, "model_dump") else dict(tr),
                "status_text": status_text,
                "status_audio_b64": status_audio_b64,
                "status_audio_format": "mp3" if status_audio_b64 else None
            })

        # Chaining: decide between iterate vs generate
        if iterate_intent:
            # iteration requires userid + modelid + prompt
            if not (userid and modelid):
                return jsonify({
                    "text": text,
                    "status_text": status_text,
                    "status_audio_b64": status_audio_b64,
                    "status_audio_format": "mp3" if status_audio_b64 else None,
                    "error": "Iteration requested but userid/modelid not provided."
                }), 400

            if not gen_prompt:
                return jsonify({
                    "text": text,
                    "status_text": status_text,
                    "status_audio_b64": status_audio_b64,
                    "status_audio_format": "mp3" if status_audio_b64 else None,
                    "error": "Iteration requested but no prompt instruction captured."
                }), 400

            if do_async:
                from threading import Thread
                job_id = str(uuid4())
                generation_jobs[job_id] = {
                    "status": "pending",
                    "mode": "iterate",
                    "prompt": gen_prompt,
                    "userid": userid,
                    "modelid": modelid,
                    "scad_code": None,
                    "error": None,
                }
                def _worker():
                    generation_jobs[job_id]["status"] = "running"
                    try:
                        code = _iterate_cad_model(gen_prompt, userid, modelid)
                        generation_jobs[job_id]["scad_code"] = code
                        generation_jobs[job_id]["status"] = "done"
                    except Exception as e:
                        import traceback
                        generation_jobs[job_id]["error"] = f"{e}"
                        generation_jobs[job_id]["trace"] = traceback.format_exc()
                        generation_jobs[job_id]["status"] = "error"
                Thread(target=_worker, daemon=True).start()

                return jsonify({
                    "text": text,
                    "intent": "iterate",
                    "status_text": status_text,
                    "status_audio_b64": status_audio_b64,
                    "status_audio_format": "mp3" if status_audio_b64 else None,
                    "job_id": job_id,
                    "async": True,
                    "chained_generation": True
                })
            else:
                try:
                    scad_code = _iterate_cad_model(gen_prompt, userid, modelid)
                except Exception as e:
                    return jsonify({"error": str(e), "intent": "iterate"}), 500

                return jsonify({
                    "text": text,
                    "intent": "iterate",
                    "model_id": modelid,
                    "scad_code": scad_code,
                    "chained_generation": True,
                    "status_text": status_text,
                    "status_audio_b64": status_audio_b64,
                    "status_audio_format": "mp3" if status_audio_b64 else None
                })

        # Otherwise: GENERATE (new model)
        if not gen_prompt:
            # Return early with status audio + guidance
            return jsonify({
                "text": text,
                "raw": tr.model_dump() if hasattr(tr, "model_dump") else dict(tr),
                "model_id": None,
                "scad_code": None,
                "chained_generation": False,
                "status_text": status_text,
                "status_audio_b64": status_audio_b64,
                "status_audio_format": "mp3" if status_audio_b64 else None,
                "error": "No prompt text captured. Provide ?prompt=... or speak a description."
            }), 200

        if do_async:
            from threading import Thread
            job_id = str(uuid4())
            generation_jobs[job_id] = {
                "status": "pending",
                "mode": "generate",
                "prompt": gen_prompt,
                "userid": userid,
                "modelid": modelid,
                "scad_code": None,
                "error": None,
            }
            def _worker():
                generation_jobs[job_id]["status"] = "running"
                try:
                    mid, code = _generate_cad_model(gen_prompt, userid=userid, modelid=modelid)
                    generation_jobs[job_id]["scad_code"] = code
                    generation_jobs[job_id]["model_id"] = mid
                    generation_jobs[job_id]["status"] = "done"
                except Exception as e:
                    import traceback
                    generation_jobs[job_id]["error"] = f"{e}"
                    generation_jobs[job_id]["trace"] = traceback.format_exc()
                    generation_jobs[job_id]["status"] = "error"
            Thread(target=_worker, daemon=True).start()

            return jsonify({
                "text": text,
                "intent": "generate",
                "status_text": status_text,
                "status_audio_b64": status_audio_b64,
                "status_audio_format": "mp3" if status_audio_b64 else None,
                "job_id": job_id,
                "chained_generation": True,
                "async": True
            })
        else:
            model_id, scad_code = _generate_cad_model(gen_prompt, userid=userid, modelid=modelid)
            return jsonify({
                "text": text,
                "intent": "generate",
                "model_id": model_id,
                "scad_code": scad_code,
                "chained_generation": True,
                "status_text": status_text,
                "status_audio_b64": status_audio_b64,
                "status_audio_format": "mp3" if status_audio_b64 else None
            })

    except Exception as e:
        import traceback
        print("/api/transcribe error:", e)
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

@app.get("/api/generation/job/<job_id>")
def get_generation_job(job_id):
    job = generation_jobs.get(job_id)
    if not job:
        return jsonify({"error": "job not found"}), 404
    return jsonify(job)

# (Kept for compatibility)
@app.route("/api/claude/generate", methods=["GET"])
def generate_claude():
    import time
    p = currentText
    userid = request.form.get("userid")
    modelid = request.form.get("modelid")
    asyncio.run(get_cad(p))
    with open("output.scad", "r", encoding="utf-8") as f:
        cont = f.read()
    scad = cont.removeprefix("```openscad").removesuffix("```")
    supabase.table("models").insert({
        "id": modelid or str(uuid4()),
        "user_id": userid,
        "name": p,
        "created_at": time.time(),
        "scad_code": scad
    }).execute()
    return jsonify({"success": True, "scadcode": scad})

@app.route("/api/claude/edit", methods=["GET"])
def edit_claude():
    p = currentText
    userid = request.form.get("userid")
    modelid = request.form.get("modelid")
    response = supabase.table("models").select("*").eq("id", modelid).eq("user_id", userid).single().execute()
    if response.data:
        ret = response.data
    else:
        raise RuntimeError("no file found")
    old = ret["scad_code"]
    asyncio.run(iterate_cad(p, old))
    with open("outputIterated.scad", "r", encoding="utf-8") as f:
        cont = f.read()
    scad = cont.removeprefix("```openscad").removesuffix("```")
    supabase.table("models").update({"scad_code": scad}).eq("id", modelid).eq("user_id", userid).execute()
    return jsonify({"success": True, "scadcode": scad})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
