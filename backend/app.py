from flask import Flask, request, jsonify
from flask_cors import CORS
from gradio_client import Client, handle_file
import os
import tempfile
import shutil
from werkzeug.utils import secure_filename
from io import BytesIO
from dotenv import load_dotenv
import os
from elevenlabs import ElevenLabs
load_dotenv()

elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
if not elevenlabs_api_key:
    print("[WARN] ELEVENLABS_API_KEY not set. /api/transcribe will return 501 until provided.")
    elevenlabs = None
else:
    elevenlabs = ElevenLabs(api_key=elevenlabs_api_key)

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Initialize Gradio client
client = Client("tencent/Hunyuan3D-2")

@app.route('/api/hunyuan/generate', methods=['POST'])
def generate_hunyuan_model():
    import time
    start_time = time.time()
    print(f"[{time.strftime('%H:%M:%S')}] === Hunyuan 3D Model Generation Request Started ===")
    
    try:
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
