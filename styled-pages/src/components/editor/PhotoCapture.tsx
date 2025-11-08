import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Download, Loader2 } from 'lucide-react';

interface PhotoCaptureProps {
  onPhotoCapture?: (imageData: string) => void;
  onBack: () => void;
}

type ViewType = 'front' | 'back' | 'left' | 'right';

export function PhotoCapture({ onBack }: PhotoCaptureProps) {
  const [captureMode, setCaptureMode] = useState<'select' | 'camera' | 'upload'>('select');
  const [currentView, setCurrentView] = useState<ViewType>('front');
  const [preview, setPreview] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Multi-view photos state
  const [capturedViews, setCapturedViews] = useState<{
    front?: string;
    back?: string;
    left?: string;
    right?: string;
  }>({});
  
  // Background removal processing state
  const [processingBgRemoval, setProcessingBgRemoval] = useState<boolean>(false);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [processedPreview, setProcessedPreview] = useState<string | null>(null);
  
  // Hunyuan 3D Model Generation State
  const [generating, setGenerating] = useState<boolean>(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [modelUrl, setModelUrl] = useState<string | null>(null);

  useEffect(() => {
    if (stream && videoRef.current && captureMode === 'camera') {
      videoRef.current.srcObject = stream;
    }
  }, [stream, captureMode]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 }
      });
      setStream(mediaStream);
      setCaptureMode('camera');
    } catch (error) {
      console.error('Camera access error:', error);
      alert('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      setStream(null);
    }
    setCaptureMode('select');
  };

  const capturePhoto = async () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg');
        setOriginalPreview(imageData);
        setPreview(imageData);
        stopCamera();
        // Start background removal processing
        await processBackgroundRemoval(imageData);
      }
    }
  };

  const handleFileUpload = async (e: { target?: { files?: FileList | null } }, view?: ViewType) => {
    const file = e.target?.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const imageData = event.target?.result as string;
        if (view) {
          setCurrentView(view);
        }
        setOriginalPreview(imageData);
        setPreview(imageData);
        setCaptureMode('upload');
        // Start background removal processing
        await processBackgroundRemoval(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  // Process background removal with futuristic overlay
  const processBackgroundRemoval = async (imageData: string) => {
    setProcessingBgRemoval(true);
    setProcessedPreview(null);

    // Add a small delay to show the animation
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      // Create an image element to load the image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = imageData;
      });

      // Create canvas for processing
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Get image data for processing
      const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageDataObj.data;

      // Simple background removal using edge detection and color analysis
      // This is a basic implementation - for production, use a proper ML model
      const processedData = new Uint8ClampedArray(data);
      
      // Calculate average color of corners (likely background)
      const cornerSize = Math.min(canvas.width, canvas.height) * 0.1;
      const corners = [
        { x: 0, y: 0, w: cornerSize, h: cornerSize },
        { x: canvas.width - cornerSize, y: 0, w: cornerSize, h: cornerSize },
        { x: 0, y: canvas.height - cornerSize, w: cornerSize, h: cornerSize },
        { x: canvas.width - cornerSize, y: canvas.height - cornerSize, w: cornerSize, h: cornerSize },
      ];

      let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
      
      for (const corner of corners) {
        for (let y = corner.y; y < corner.y + corner.h; y++) {
          for (let x = corner.x; x < corner.x + corner.w; x++) {
            const idx = (y * canvas.width + x) * 4;
            bgR += data[idx];
            bgG += data[idx + 1];
            bgB += data[idx + 2];
            bgCount++;
          }
        }
      }

      bgR = Math.floor(bgR / bgCount);
      bgG = Math.floor(bgG / bgCount);
      bgB = Math.floor(bgB / bgCount);

      // Remove background pixels (similar to corner colors)
      const threshold = 40; // Color difference threshold
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
        
        if (diff < threshold) {
          // Make transparent
          processedData[i + 3] = 0;
        }
      }

      // Apply processed data
      const processedImageData = new ImageData(processedData, canvas.width, canvas.height);
      ctx.putImageData(processedImageData, 0, 0);

      // Convert to data URL
      const processedDataUrl = canvas.toDataURL('image/png');
      setProcessedPreview(processedDataUrl);
      setPreview(processedDataUrl);
      
      // Save the processed version
      setCapturedViews(prev => ({ ...prev, [currentView]: processedDataUrl }));
      
    } catch (error) {
      console.error('Background removal error:', error);
      // If processing fails, just use the original
      setProcessedPreview(null);
      setPreview(imageData);
      setCapturedViews(prev => ({ ...prev, [currentView]: imageData }));
    } finally {
      setProcessingBgRemoval(false);
    }
  };


  // Convert base64 data URL to File
  const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  // Generate 3D model from captured photos
  const generate3DModel = async () => {
    if (!hasMinimumViews()) {
      alert('Please capture at least the front image before generating a 3D model.');
      return;
    }

    setGenerating(true);
    setGenerationStatus('');
    setModelUrl(null);

    const updateStatus = (message: string) => {
      const timestamp = new Date().toLocaleTimeString();
      setGenerationStatus((prev: string) => prev ? `${prev}\n[${timestamp}] ${message}` : `[${timestamp}] ${message}`);
      console.log(`[Hunyuan] ${message}`);
    };

    try {
      updateStatus('🚀 Starting 3D model generation...');
      updateStatus('📤 Preparing images for upload...');

      // Convert base64 images to Files
      // Front is the main image
      const imageFile = dataURLtoFile(capturedViews.front!, 'front-photo.jpg');
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('mv_image_front', imageFile); // Front is also the front multi-view
      formData.append('caption', ''); // Optional caption
      updateStatus('✅ Added front view image (main)');
      if (capturedViews.back) {
        const backFile = dataURLtoFile(capturedViews.back, 'back-photo.jpg');
        formData.append('mv_image_back', backFile);
        updateStatus('✅ Added back view image');
      }
      if (capturedViews.left) {
        const leftFile = dataURLtoFile(capturedViews.left, 'left-photo.jpg');
        formData.append('mv_image_left', leftFile);
        updateStatus('✅ Added left view image');
      }
      if (capturedViews.right) {
        const rightFile = dataURLtoFile(capturedViews.right, 'right-photo.jpg');
        formData.append('mv_image_right', rightFile);
        updateStatus('✅ Added right view image');
      }

      // Enhanced parameters for better quality
      formData.append('steps', '64'); // Increased from 32
      formData.append('guidance_scale', '7.0'); // Increased from 5.5
      formData.append('octree_resolution', '512'); // Increased from 256
      formData.append('num_chunks', '12000'); // Increased from 8000
      formData.append('check_box_rembg', 'true');
      formData.append('seed', '42');
      formData.append('randomize_seed', 'false');
      
      updateStatus('⚙️ Using enhanced parameters: steps=64, resolution=512, chunks=12000');

      updateStatus('📡 Sending request to backend server...');
      updateStatus('⏳ Waiting for server response (this may take several minutes)...');

      const startTime = Date.now();
      const res = await fetch('http://localhost:8000/api/hunyuan/generate', {
        method: 'POST',
        body: formData,
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      updateStatus(`📥 Received response after ${elapsed} seconds`);
      updateStatus(`📊 Response status: ${res.status}`);

      updateStatus('📝 Reading response data...');
      const text = await res.text();
      
      updateStatus('🔍 Parsing response...');
      let data;
      if (!text) {
        data = { error: 'Empty response from server', status: res.status };
        updateStatus('⚠️ Warning: Empty response received');
      } else {
        try {
          data = JSON.parse(text);
          updateStatus('✅ Successfully parsed JSON response');
        } catch {
          data = { error: 'Invalid JSON response', raw: text.substring(0, 500), status: res.status };
          updateStatus('⚠️ Warning: Could not parse JSON, showing raw response');
        }
      }

      // Extract model URL - handle Gradio response format
      const extractModelUrl = (obj: unknown): string | null => {
        if (!obj) return null;
        
        if (typeof obj === 'string') {
          if (obj.startsWith('/tmp/gradio/')) {
            return `https://tencent-hunyuan3d-2.hf.space/file=${obj}`;
          }
          return obj;
        }
        
        if (typeof obj === 'object' && obj !== null) {
          if ('__type__' in obj && 'value' in obj) {
            const url = obj.value;
            if (typeof url === 'string') {
              if (url.startsWith('/tmp/gradio/')) {
                return `https://tencent-hunyuan3d-2.hf.space/file=${url}`;
              }
              return url;
            }
          } else if ('value' in obj) {
            const url = obj.value;
            if (typeof url === 'string') {
              if (url.startsWith('/tmp/gradio/')) {
                return `https://tencent-hunyuan3d-2.hf.space/file=${url}`;
              }
              return url;
            }
          }
        }
        
        return null;
      };
      
      let extractedModelUrl: string | null = null;
      if (data.model_url) {
        extractedModelUrl = extractModelUrl(data.model_url);
      }
      
      if (!extractedModelUrl && data.result && Array.isArray(data.result) && data.result.length > 0) {
        extractedModelUrl = extractModelUrl(data.result[0]);
      }
      
      if (data.success && extractedModelUrl) {
        updateStatus('🎉 3D model generation completed successfully!');
        updateStatus(`📦 GLB model URL: ${extractedModelUrl}`);
        setModelUrl(extractedModelUrl);
      } else if (data.error) {
        updateStatus(`❌ Error: ${data.error}`);
        setModelUrl(null);
      } else {
        updateStatus('⚠️ Response received but no model URL found');
        setModelUrl(null);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateStatus(`❌ Request failed: ${errorMessage}`);
      setModelUrl(null);
    } finally {
      setGenerating(false);
      updateStatus('🏁 Request completed');
    }
  };

  const resetCapture = () => {
    setPreview(null);
    setOriginalPreview(null);
    setProcessedPreview(null);
    setProcessingBgRemoval(false);
    setCaptureMode('select');
  };

  const resetAllViews = () => {
    setCapturedViews({});
    setPreview(null);
    setOriginalPreview(null);
    setProcessedPreview(null);
    setProcessingBgRemoval(false);
    setCurrentView('front');
    setCaptureMode('select');
  };

  const selectView = (view: ViewType) => {
    setCurrentView(view);
    setPreview(capturedViews[view] || null);
    if (capturedViews[view]) {
      setCaptureMode('upload');
    } else {
      setCaptureMode('select');
    }
  };

  const hasAllViews = () => {
    return capturedViews.front && capturedViews.back && 
           capturedViews.left && capturedViews.right;
  };

  const hasMinimumViews = () => {
    return !!capturedViews.front;
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-auto" style={{ background: '#000' }}>
      <button
        onClick={onBack}
        className="absolute top-8 left-8 p-3 transition-all duration-300"
        style={{
          background: '#000',
          border: '1px solid #00D4FF',
          color: '#00D4FF',
        }}
      >
        <X className="w-5 h-5" />
      </button>

      {captureMode === 'select' && !preview && (
        <div className="flex flex-col items-center gap-12">
          <div className="font-mono text-center" style={{ color: '#00D4FF' }}>
            <div className="text-2xl tracking-wider mb-3">
              {'>'} capture_object
            </div>
            <div className="text-xs tracking-widest opacity-60">
              [SELECT VIEW: {currentView.toUpperCase()}]
            </div>
            <div className="text-[10px] tracking-widest opacity-40 mt-2">
              Capture multiple angles for better accuracy
            </div>
          </div>

          {/* View Selection Buttons */}
          <div className="flex gap-4 flex-wrap justify-center">
            {(['front', 'back', 'left', 'right'] as ViewType[]).map((view) => (
              <button
                key={view}
                onClick={() => selectView(view)}
                className="font-mono transition-all duration-300"
                style={{
                  padding: '12px 24px',
                  background: currentView === view ? 'rgba(0, 212, 255, 0.2)' : '#000',
                  border: `1px solid ${capturedViews[view] ? '#00FF00' : '#00D4FF'}`,
                  color: capturedViews[view] ? '#00FF00' : '#00D4FF',
                  opacity: currentView === view ? 1 : 0.7,
                }}
              >
                <div className="text-sm tracking-wider">
                  {view.toUpperCase()} {capturedViews[view] ? '✓' : ''}
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-8">
            <button
              onClick={startCamera}
              className="group relative font-mono overflow-hidden transition-all duration-300"
              style={{
                padding: '48px 64px',
                background: '#000',
                border: '1px solid #00D4FF',
                color: '#00D4FF',
              }}
            >
              <div className="relative z-10 flex flex-col items-center gap-4">
                <Camera className="w-16 h-16" />
                <div className="text-xl tracking-wider">[1] USE CAMERA</div>
                <div className="text-[10px] tracking-widest opacity-60">LIVE CAPTURE</div>
              </div>

              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: 'rgba(0, 212, 255, 0.1)',
                }}
              />
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="group relative font-mono overflow-hidden transition-all duration-300"
              style={{
                padding: '48px 64px',
                background: '#000',
                border: '1px solid #00D4FF',
                color: '#00D4FF',
              }}
            >
              <div className="relative z-10 flex flex-col items-center gap-4">
                <Upload className="w-16 h-16" />
                <div className="text-xl tracking-wider">[2] UPLOAD PHOTO</div>
                <div className="text-[10px] tracking-widest opacity-60">SELECT FROM DEVICE</div>
              </div>

              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: 'rgba(0, 212, 255, 0.1)',
                }}
              />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e, currentView)}
              className="hidden"
            />
          </div>

          {/* Progress indicator */}
          <div className="font-mono text-xs" style={{ color: '#00D4FF', opacity: 0.6 }}>
            Progress: {Object.keys(capturedViews).length}/4 views captured
            {hasAllViews() && <span className="ml-2" style={{ color: '#00FF00' }}>✓ READY</span>}
          </div>
        </div>
      )}

      {captureMode === 'camera' && !preview && (
        <div className="relative">
          <div className="font-mono text-center mb-6" style={{ color: '#00D4FF' }}>
            <div className="text-xl tracking-wider">{'>'} camera_active</div>
            <div className="text-[10px] tracking-widest opacity-60 mt-2">
              [POSITION OBJECT IN FRAME]
            </div>
          </div>

          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="rounded-lg"
              style={{
                width: '800px',
                height: '600px',
                objectFit: 'cover',
                border: '1px solid #00D4FF',
              }}
            />

            {[0, 90, 180, 270].map((angle) => {
              const size = 40;
              let x = '0%';
              let y = '0%';
              let transform = '';

              if (angle === 0) {
                x = '100%';
                y = '0%';
                transform = 'translate(-100%, 0)';
              } else if (angle === 90) {
                x = '100%';
                y = '100%';
                transform = 'translate(-100%, -100%)';
              } else if (angle === 180) {
                x = '0%';
                y = '100%';
                transform = 'translate(0, -100%)';
              } else {
                x = '0%';
                y = '0%';
              }

              return (
                <div
                  key={angle}
                  className="absolute pointer-events-none"
                  style={{
                    left: x,
                    top: y,
                    width: `${size}px`,
                    height: `${size}px`,
                    transform,
                  }}
                >
                  <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <line
                      x1={angle === 0 || angle === 90 ? size : 0}
                      y1={angle === 90 || angle === 180 ? size : 0}
                      x2={angle === 0 || angle === 90 ? size - 12 : 12}
                      y2={angle === 90 || angle === 180 ? size : 0}
                      stroke="#00D4FF"
                      strokeWidth="2"
                    />
                    <line
                      x1={angle === 0 || angle === 90 ? size : 0}
                      y1={angle === 90 || angle === 180 ? size : 0}
                      x2={angle === 0 || angle === 90 ? size : 0}
                      y2={angle === 90 || angle === 180 ? size - 12 : 12}
                      stroke="#00D4FF"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              );
            })}

            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                width: '400px',
                height: '400px',
                border: '1px dashed #00D4FF',
              }}
            />
          </div>

          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={capturePhoto}
              className="font-mono transition-all duration-300"
              style={{
                padding: '16px 48px',
                background: 'rgba(0, 212, 255, 0.2)',
                border: '1px solid #00D4FF',
                color: '#00D4FF',
              }}
            >
              <div className="text-lg tracking-wider">[CAPTURE]</div>
            </button>

            <button
              onClick={stopCamera}
              className="font-mono transition-all duration-300"
              style={{
                padding: '16px 48px',
                background: '#000',
                border: '1px solid #00D4FF',
                color: '#00D4FF',
              }}
            >
              <div className="text-lg tracking-wider">[CANCEL]</div>
            </button>
          </div>
        </div>
      )}

      {preview && (
        <div className="relative">
          <div className="font-mono text-center mb-6" style={{ color: '#00D4FF' }}>
            <div className="text-xl tracking-wider">{'>'} image_captured [{currentView.toUpperCase()}]</div>
            <div className="text-[10px] tracking-widest opacity-60 mt-2">
              {processingBgRemoval ? '[PROCESSING BACKGROUND REMOVAL...]' : '[CONFIRM, RETAKE, OR SELECT ANOTHER VIEW]'}
            </div>
            <div className="text-[10px] tracking-widest opacity-40 mt-1">
              {Object.keys(capturedViews).length}/4 views captured
            </div>
          </div>

          <div className="relative" style={{ position: 'relative', display: 'inline-block' }}>
            <img
              src={processedPreview || preview}
              alt="Captured"
              style={{
                maxWidth: '800px',
                maxHeight: '600px',
                objectFit: 'contain',
                border: '1px solid #00D4FF',
                backgroundColor: '#000',
              }}
            />
            
            {/* Futuristic Grid Overlay Animation */}
            {processingBgRemoval && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `
                    linear-gradient(rgba(0, 212, 255, 0.1) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0, 212, 255, 0.1) 1px, transparent 1px)
                  `,
                  backgroundSize: '20px 20px',
                  animation: 'gridScan 2s linear infinite',
                  border: '2px solid rgba(0, 212, 255, 0.5)',
                  boxShadow: '0 0 20px rgba(0, 212, 255, 0.5), inset 0 0 20px rgba(0, 212, 255, 0.3)',
                }}
              >
                <style>{`
                  @keyframes gridScan {
                    0% {
                      backgroundPosition: 0 0;
                      opacity: 0.3;
                    }
                    50% {
                      opacity: 0.7;
                    }
                    100% {
                      backgroundPosition: 20px 20px;
                      opacity: 0.3;
                    }
                  }
                `}</style>
                {/* Scanning lines effect */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: 'linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.8), transparent)',
                    animation: 'scanLine 1.5s linear infinite',
                  }}
                />
                <style>{`
                  @keyframes scanLine {
                    0% { top: 0; }
                    100% { top: 100%; }
                  }
                `}</style>
                {/* Corner brackets */}
                {[0, 90, 180, 270].map((angle, idx) => {
                  const size = 30;
                  let x = '0%';
                  let y = '0%';
                  let transform = '';
                  
                  if (angle === 0) {
                    x = '100%';
                    y = '0%';
                    transform = 'translate(-100%, 0)';
                  } else if (angle === 90) {
                    x = '100%';
                    y = '100%';
                    transform = 'translate(-100%, -100%)';
                  } else if (angle === 180) {
                    x = '0%';
                    y = '100%';
                    transform = 'translate(0, -100%)';
                  }
                  
                  return (
                    <div
                      key={idx}
                      className="absolute"
                      style={{
                        left: x,
                        top: y,
                        width: `${size}px`,
                        height: `${size}px`,
                        transform,
                        borderColor: '#00D4FF',
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        borderRight: angle === 0 || angle === 270 ? 'none' : '2px solid #00D4FF',
                        borderBottom: angle === 0 || angle === 90 ? 'none' : '2px solid #00D4FF',
                        animation: 'pulse 1s ease-in-out infinite',
                      }}
                    />
                  );
                })}
                <style>{`
                  @keyframes pulse {
                    0%, 100% { opacity: 0.5; }
                    50% { opacity: 1; }
                  }
                `}</style>
              </div>
            )}
            
            {/* Original photo in corner */}
            {originalPreview && (
              <div
                className="absolute"
                style={{
                  bottom: '16px',
                  right: '16px',
                  width: '120px',
                  height: '120px',
                  border: '2px solid #00D4FF',
                  background: '#000',
                  padding: '4px',
                  boxShadow: '0 0 10px rgba(0, 212, 255, 0.5)',
                }}
              >
                <img
                  src={originalPreview}
                  alt="Original"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                <div
                  className="absolute top-0 left-0 font-mono text-[8px]"
                  style={{
                    background: 'rgba(0, 212, 255, 0.8)',
                    color: '#000',
                    padding: '2px 4px',
                  }}
                >
                  ORIGINAL
                </div>
              </div>
            )}

            {[0, 90, 180, 270].map((angle) => {
              const size = 40;
              let x = '0%';
              let y = '0%';
              let transform = '';

              if (angle === 0) {
                x = '100%';
                y = '0%';
                transform = 'translate(-100%, 0)';
              } else if (angle === 90) {
                x = '100%';
                y = '100%';
                transform = 'translate(-100%, -100%)';
              } else if (angle === 180) {
                x = '0%';
                y = '100%';
                transform = 'translate(0, -100%)';
              } else {
                x = '0%';
                y = '0%';
              }

              return (
                <div
                  key={angle}
                  className="absolute pointer-events-none"
                  style={{
                    left: x,
                    top: y,
                    width: `${size}px`,
                    height: `${size}px`,
                    transform,
                  }}
                >
                  <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <line
                      x1={angle === 0 || angle === 90 ? size : 0}
                      y1={angle === 90 || angle === 180 ? size : 0}
                      x2={angle === 0 || angle === 90 ? size - 12 : 12}
                      y2={angle === 90 || angle === 180 ? size : 0}
                      stroke="#00D4FF"
                      strokeWidth="2"
                    />
                    <line
                      x1={angle === 0 || angle === 90 ? size : 0}
                      y1={angle === 90 || angle === 180 ? size : 0}
                      x2={angle === 0 || angle === 90 ? size : 0}
                      y2={angle === 90 || angle === 180 ? size - 12 : 12}
                      stroke="#00D4FF"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-4 mt-6">
            <div className="flex justify-center gap-4 flex-wrap">
              <button
                onClick={() => {
                  setCapturedViews(prev => ({ ...prev, [currentView]: preview }));
                  setPreview(null);
                  setCaptureMode('select');
                }}
                className="font-mono transition-all duration-300"
                style={{
                  padding: '16px 48px',
                  background: 'rgba(0, 212, 255, 0.2)',
                  border: '1px solid #00D4FF',
                  color: '#00D4FF',
                }}
              >
                <div className="text-lg tracking-wider">[SAVE VIEW]</div>
              </button>

              <button
                onClick={resetCapture}
                className="font-mono transition-all duration-300"
                style={{
                  padding: '16px 48px',
                  background: '#000',
                  border: '1px solid #00D4FF',
                  color: '#00D4FF',
                }}
              >
                <div className="text-lg tracking-wider">[RETAKE]</div>
              </button>

              <button
                onClick={() => {
                  setPreview(null);
                  setCaptureMode('select');
                }}
                className="font-mono transition-all duration-300"
                style={{
                  padding: '16px 48px',
                  background: '#000',
                  border: '1px solid #00D4FF',
                  color: '#00D4FF',
                }}
              >
                <div className="text-lg tracking-wider">[SELECT VIEW]</div>
              </button>

              {Object.keys(capturedViews).length > 0 && (
                <button
                  onClick={resetAllViews}
                  className="font-mono transition-all duration-300"
                  style={{
                    padding: '16px 48px',
                    background: '#000',
                    border: '1px solid #FF4444',
                    color: '#FF4444',
                  }}
                >
                  <div className="text-lg tracking-wider">[RESET ALL]</div>
                </button>
              )}
            </div>

            <button
              onClick={generate3DModel}
              disabled={generating}
              className="font-mono transition-all duration-300 flex items-center gap-3"
              style={{
                padding: '16px 48px',
                background: generating ? 'rgba(0, 212, 255, 0.1)' : 'rgba(0, 212, 255, 0.2)',
                border: '1px solid #00D4FF',
                color: '#00D4FF',
                opacity: generating ? 0.6 : 1,
                cursor: generating ? 'not-allowed' : 'pointer',
              }}
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <div className="text-lg tracking-wider">[GENERATING...]</div>
                </>
              ) : (
                <div className="text-lg tracking-wider">[GENERATE 3D MODEL]</div>
              )}
            </button>

            {generationStatus && (
              <div
                className="font-mono text-xs mt-4 p-4 overflow-y-auto"
                style={{
                  maxWidth: '800px',
                  maxHeight: '200px',
                  background: '#000',
                  border: '1px solid #00D4FF',
                  color: '#00D4FF',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {generationStatus}
              </div>
            )}

            {modelUrl && (
              <div
                className="font-mono mt-4 p-4 flex flex-col items-center gap-3"
                style={{
                  background: 'rgba(0, 212, 255, 0.1)',
                  border: '1px solid #00D4FF',
                  color: '#00D4FF',
                }}
              >
                <div className="text-sm tracking-wider">📥 3D MODEL READY</div>
                <a
                  href={modelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 transition-all duration-300 hover:opacity-70"
                  style={{
                    padding: '12px 24px',
                    background: 'rgba(0, 212, 255, 0.2)',
                    border: '1px solid #00D4FF',
                    color: '#00D4FF',
                    textDecoration: 'none',
                  }}
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm tracking-wider">DOWNLOAD GLB FILE</span>
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
