import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X } from 'lucide-react';

interface PhotoCaptureProps {
  onPhotoCapture: (imageData: string) => void;
  onBack: () => void;
}

export function PhotoCapture({ onPhotoCapture, onBack }: PhotoCaptureProps) {
  const [captureMode, setCaptureMode] = useState<'select' | 'camera' | 'upload'>('select');
  const [preview, setPreview] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCaptureMode('select');
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg');
        setPreview(imageData);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target?.result as string;
        setPreview(imageData);
        setCaptureMode('upload');
      };
      reader.readAsDataURL(file);
    }
  };

  const confirmPhoto = () => {
    if (preview) {
      onPhotoCapture(preview);
    }
  };

  const resetCapture = () => {
    setPreview(null);
    setCaptureMode('select');
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
              [SELECT INPUT METHOD]
            </div>
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
              onChange={handleFileUpload}
              className="hidden"
            />
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
            <div className="text-xl tracking-wider">{'>'} image_captured</div>
            <div className="text-[10px] tracking-widest opacity-60 mt-2">
              [CONFIRM OR RETAKE]
            </div>
          </div>

          <div className="relative">
            <img
              src={preview}
              alt="Captured"
              style={{
                maxWidth: '800px',
                maxHeight: '600px',
                objectFit: 'contain',
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
          </div>

          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={confirmPhoto}
              className="font-mono transition-all duration-300"
              style={{
                padding: '16px 48px',
                background: 'rgba(0, 212, 255, 0.2)',
                border: '1px solid #00D4FF',
                color: '#00D4FF',
              }}
            >
              <div className="text-lg tracking-wider">[CONFIRM]</div>
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
          </div>
        </div>
      )}
    </div>
  );
}
