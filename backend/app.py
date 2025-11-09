from flask import Flask, request, jsonify
from flask_cors import CORS
from gradio_client import Client, handle_file
import os
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

load_dotenv()
currentText = ""

from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
print("[INFO] Supabase client initialized")

elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
if not elevenlabs_api_key:
    print("[WARN] ELEVENLABS_API_KEY not set. /api/transcribe will return 501 until provided.")
    elevenlabs = None
else:
    elevenlabs = ElevenLabs(api_key=elevenlabs_api_key)

dedalus_api_key = os.getenv("DEDALUS_API_KEY")
if not dedalus_api_key:
    print("[WARN] DEDALUS_API_KEY not set. /api/getresponse will return 501 until provided.")
    dedalus = None
else:
    dedalus = AsyncDedalus(api_key=dedalus_api_key)

app = Flask(__name__)

# CORS configuration - allow localhost for development and all origins for production
# For production, you can restrict this to specific domains
cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://localhost:5174,http://localhost:3000').split(',')

# In production, allow all origins (you can restrict this later)
if os.getenv('FLASK_ENV') == 'production' or os.getenv('DYNO'):  # DYNO is set by Heroku
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)
else:
    CORS(app, origins=cors_origins, supports_credentials=True)

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Utility: normalize various ElevenLabs audio return types (bytes, file-like, generator of chunks)
def _audio_to_bytes(obj):
    if obj is None:
        return b""
    if isinstance(obj, (bytes, bytearray)):
        return bytes(obj)
    if hasattr(obj, 'read') and callable(getattr(obj, 'read')):
        return obj.read()
    if hasattr(obj, '__iter__'):
        parts = []
        for chunk in obj:
            if isinstance(chunk, (bytes, bytearray)):
                parts.append(bytes(chunk))
            elif isinstance(chunk, str):
                parts.append(chunk.encode('utf-8'))
            else:
                try:
                    parts.append(bytes(chunk))
                except Exception:
                    pass
        return b''.join(parts)
    raise TypeError(f"Unsupported audio object type: {type(obj)}")

# Lazy-initialize Gradio client with simple retries
_client = None

def get_client():
    global _client
    if _client is not None:
        return _client
    import time as _time
    last_err = None
    hf_token = os.getenv('HUGGINGFACE_TOKEN')
    for _ in range(3):
        try:
            if hf_token:
                _c = Client("tencent/Hunyuan3D-2", hf_token=hf_token)
            else:
                _c = Client("tencent/Hunyuan3D-2")
            _client = _c
            return _client
        except Exception as e:  # noqa: BLE001
            last_err = e
            _time.sleep(2)
    # If still failing, raise the last error
    raise last_err

@app.route('/api/hunyuan/generate', methods=['POST'])
def generate_hunyuan_model():
    import time
    start_time = time.time()
    print(f"[{time.strftime('%H:%M:%S')}] === Hunyuan 3D Model Generation Request Started ===")
    
    try:
        userid = request.form.get('userid')
        if not userid:
            print(f"[{time.strftime('%H:%M:%S')}] ERROR: No userid provided")
            return jsonify({'error': 'userid is required'}), 400
        
        print(f"[{time.strftime('%H:%M:%S')}] User ID: {userid}")
        
        # Get caption from form data
        caption = request.form.get('caption', 'Eric Zou, a male human being, Asian ethnicity')
        print(f"[{time.strftime('%H:%M:%S')}] Caption: {caption}")
        
        # Get main image
        if 'image' not in request.files:
            print(f"[{time.strftime('%H:%M:%S')}] ERROR: No image in request")
            return jsonify({'error': 'Main image is required'}), 400
        
        # Save uploaded files temporarily
        temp_dir = tempfile.mkdtemp()
        print(f"[{time.strftime('%H:%M:%S')}] Created temp directory: {temp_dir}")
        file_paths = {}
        
        try:
            # Handle main image
            image_file = request.files['image']
            if not image_file or not image_file.filename:
                print(f"[{time.strftime('%H:%M:%S')}] ERROR: No image file provided")
                return jsonify({'error': 'No image file provided'}), 400
            
            if not allowed_file(image_file.filename):
                print(f"[{time.strftime('%H:%M:%S')}] ERROR: Invalid file type: {image_file.filename}")
                return jsonify({'error': f'Invalid file type. Allowed: {ALLOWED_EXTENSIONS}'}), 400
            
            image_path = os.path.join(temp_dir, secure_filename(image_file.filename))
            image_file.save(image_path)
            file_paths['image'] = image_path
            print(f"[{time.strftime('%H:%M:%S')}] Saved main image: {image_path} ({os.path.getsize(image_path)} bytes)")
            
            # Handle multi-view images (optional)
            mv_images = {
                'mv_image_front': request.files.get('mv_image_front'),
                'mv_image_back': request.files.get('mv_image_back'),
                'mv_image_left': request.files.get('mv_image_left'),
                'mv_image_right': request.files.get('mv_image_right'),
            }
            
            for key, file in mv_images.items():
                if file and file.filename and allowed_file(file.filename):
                    file_path = os.path.join(temp_dir, secure_filename(file.filename))
                    file.save(file_path)
                    file_paths[key] = file_path
                    print(f"[{time.strftime('%H:%M:%S')}] Saved {key}: {file_path} ({os.path.getsize(file_path)} bytes)")
            
            # Get optional parameters
            steps = int(request.form.get('steps', 32))
            guidance_scale = float(request.form.get('guidance_scale', 5.5))
            seed = int(request.form.get('seed', 42))
            octree_resolution = int(request.form.get('octree_resolution', 256))
            check_box_rembg = request.form.get('check_box_rembg', 'true').lower() == 'true'
            num_chunks = int(request.form.get('num_chunks', 8000))
            randomize_seed = request.form.get('randomize_seed', 'false').lower() == 'true'
            
            print(f"[{time.strftime('%H:%M:%S')}] Parameters: steps={steps}, guidance_scale={guidance_scale}, seed={seed}, octree_resolution={octree_resolution}")
            print(f"[{time.strftime('%H:%M:%S')}] Preparing to call Gradio API...")
            
            # Initialize client lazily here (handles slow /config)
            client = get_client()
            
            # Call Gradio API with handle_file for each image
            # Use main image as fallback for missing multi-view images
            main_image_handle = handle_file(file_paths['image'])
            print(f"[{time.strftime('%H:%M:%S')}] Calling client.predict() - this may take several minutes...")
            predict_start = time.time()
            result = client.predict(
                caption=caption,
                image=main_image_handle,
                mv_image_front=handle_file(file_paths.get('mv_image_front', file_paths['image'])),
                mv_image_back=handle_file(file_paths.get('mv_image_back', file_paths['image'])),
                mv_image_left=handle_file(file_paths.get('mv_image_left', file_paths['image'])),
                mv_image_right=handle_file(file_paths.get('mv_image_right', file_paths['image'])),
                steps=steps,
                guidance_scale=guidance_scale,
                seed=seed,
                octree_resolution=octree_resolution,
                check_box_rembg=check_box_rembg,
                num_chunks=num_chunks,
                randomize_seed=randomize_seed,
                api_name="/shape_generation"
            )
            predict_elapsed = time.time() - predict_start
            print(f"[{time.strftime('%H:%M:%S')}] ✅ Gradio API call completed in {predict_elapsed:.1f} seconds")
            print(f"[{time.strftime('%H:%M:%S')}] Result type: {type(result)}, Result: {result}")
            
            # The result should contain the GLB file URL
            # Gradio returns a tuple/list, and the first element is typically the model file
            # It may be wrapped in a dict with __type__ and value keys
            def extract_url(obj):
                """Extract URL from Gradio response format"""
                if isinstance(obj, dict):
                    if '__type__' in obj and 'value' in obj:
                        return obj['value']
                    elif 'value' in obj:
                        return obj['value']
                return obj
            
            model_url = None
            if isinstance(result, (list, tuple)) and len(result) > 0:
                # First element is usually the GLB file path/URL
                first_item = result[0]
                model_url = extract_url(first_item)
                print(f"[{time.strftime('%H:%M:%S')}] Extracted model URL from result[0]: {model_url}")
            elif result:
                model_url = extract_url(result)
                print(f"[{time.strftime('%H:%M:%S')}] Using result as model URL: {model_url}")
            
            # Convert model_url to string if it's not already
            if model_url and not isinstance(model_url, str):
                model_url = str(model_url)
            
            # Convert relative paths to full URLs if needed
            if model_url and model_url.startswith('/tmp/gradio/'):
                # This is a local path on the Gradio server, we need the full URL
                base_url = "https://tencent-hunyuan3d-2.hf.space"
                # Gradio serves files from /file= path
                model_url = f"{base_url}/file={model_url}"
                print(f"[{time.strftime('%H:%M:%S')}] Converted to full URL: {model_url}")
            
            total_elapsed = time.time() - start_time
            print(f"[{time.strftime('%H:%M:%S')}] === Request completed successfully in {total_elapsed:.1f} seconds ===")
            
            # Save model to database
            try:
                print(f"[{time.strftime('%H:%M:%S')}] Saving model to database for user {userid}...")
                response = supabase.table("models").insert({
                    "id": str(uuid4()),
                    "user_id": userid,
                    "name": caption if caption else f"Model_{int(start_time)}",
                    "glb_file_url": model_url
                }).execute()
                print(f"[{time.strftime('%H:%M:%S')}] Model saved to database successfully")
            except Exception as db_error:
                print(f"[{time.strftime('%H:%M:%S')}] Database save failed: {db_error}")
                # Continue anyway - model generation was successful
            
            return jsonify({
                'success': True,
                'model_url': model_url,
                'result': result  # Send the full result for debugging
            })
            
        finally:
            # Clean up temporary files
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
                
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        total_elapsed = time.time() - start_time
        print(f"[{time.strftime('%H:%M:%S')}] ❌ ERROR in generate_hunyuan_model after {total_elapsed:.1f} seconds: {str(e)}")
        print(f"[{time.strftime('%H:%M:%S')}] Traceback: {error_trace}")
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': error_trace if app.debug else None
        }), 500


@app.get("/api/getresponse")
def get_response():
    """Generate a concise CAD progress sentence via Dedalus (async under the hood),
    synthesize with ElevenLabs, and return JSON with text and base64 audio.
    Implemented as a sync view to avoid requiring Flask's async extra.
    """
    if not elevenlabs:
        return jsonify({"error": "ELEVENLABS_API_KEY not configured"}), 500

    # Build the prompt using the same template, substituting currentText
    global currentText
    prompt_template = (
        """ 
                RIGHT AWAY, HANDOFF THE TASK TO GEMINI. GEMINI WILL DO THE FOLLOWING:
               
                based on ${currentText} generate a quick response about what CAD model you are going to generate
                this response should be about a sentence long, this response basically informs the user that the model is in fact being
                generated and they should wait until it is done being finalized.

                THE RESPONSE NEEDS TO BE SNAPPY, DONT ADD ANY UNNECESSARY FLUFF, JUST SAY WHAT YOU ARE GENERATING AND
                DO NOT MENTION ANY FEATURES THE MODEL WILL HAVE.

                DO NOT MENTION ANY BRANDS UNLESS THE USER HAS ASKED FOR A SPECIFIC BRAND ITEM. KEEP EVERYTHING GENERIC.

                DO NOT MENTION THAT YOU CANNOT CREATE THIS MODEL. DO NOT SAY "HERE IS A PROMPT YOU CAN USE"
                STRICTLY JUST MAKE A RESPONSE AS IF YOU ARE ACTUALLY IN THE MIDDLE OF GENERATING THIS CAD MODEL
        """
    )
    prompt = prompt_template.replace("${currentText}", currentText or "")

    # Run Dedalus's asyync call from a sync context
    try:
        client = AsyncDedalus()
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
            # If a loop is somehow already running, use a dedicated one
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
    except Exception as e:
        import traceback
        print("/api/getresponse Dedalus error:", e)
        print(traceback.format_exc())
        text_out = "Your CAD model generation is underway. Please hold on while we set things up."

    # Synthesize with ElevenLabs and return base64
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
    except Exception as e:
        import traceback
        print("/api/getresponse TTS error:", e)
        print(traceback.format_exc())
        return jsonify({"error": "TTS failed", "text": text_out}), 500
    


@app.post("/api/transcribe")
def transcribe_audio():
    try:
        # Debug info
        print("/api/transcribe content-type:", request.content_type)
        print("/api/transcribe files keys:", list(request.files.keys()))
        print("/api/transcribe form keys:", list(request.form.keys()))

        if "file" not in request.files:
            # Fallback: if frontend sent raw body by mistake
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
        # Help HTTP client set a meaningful filename/content-type upstream
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

        print(text)
        global currentText
        currentText = text

        # Force JSON content-type
        return jsonify({
            "text": text,
            "raw": tr.model_dump() if hasattr(tr, "model_dump") else dict(tr)
        })
    

    except Exception as e:
        # Always JSON on errors
        import traceback
        print("/api/transcribe error:", e)
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

@app.route('/api/claude/generate', methods=['GET'])
def generate_claude():
    import time
    startTime = time.time()
    p = request.form.get("prompt")
    userid = request.form.get("userid")
    asyncio.run(get_cad(p))
    with open("output.scad", "r", encoding="utf-8") as shamalama:
        cont = shamalama.read()
    shit = cont.removeprefix("```openscad").removesuffix("```")
    response = supabase.table("models").insert({
        "id": str(uuid4()),
        "user_id": userid,
        "name": p,
        "created_at": time.time(),
        "scad_code": shit
    }).execute()
    return jsonify({
        'success': True,
        'scadcode': shit
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
