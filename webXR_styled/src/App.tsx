import { useState, useEffect, useRef } from 'react';
import { StatusHUD } from './components/ui/StatusHUD';
import { Inspector } from './components/editor/Inspector';
import { RadialMenu } from './components/editor/RadialMenu';
import { ColorPicker } from './components/ui/ColorPicker';
import { ScanLines } from './components/ui/ScanLines';
import { CornerBrackets } from './components/ui/CornerBrackets';
import { TargetingReticle } from './components/ui/TargetingReticle';
import { DataStream } from './components/ui/DataStream';
import { DiagnosticPanel } from './components/editor/DiagnosticPanel';
import { CoordinateOverlay } from './components/ui/CoordinateOverlay';
import { VoiceBot } from './components/landing/VoiceBot';
import { LandingScreen } from './components/landing/LandingScreen';
import { VoiceInteractionModule } from './components/landing/VoiceInteractionModule';
import { ModelCarousel } from './components/editor/ModelCarousel';
import { PhotoCapture } from './components/editor/PhotoCapture';
import { WebXRScene } from './components/WebXRScene';
import { setupScene } from './three/sceneSetup';

type AppScreen = 'landing' | 'photo-capture' | 'voice-interaction' | 'carousel' | 'editor';

function App() {
  const [screen, setScreen] = useState<AppScreen>('landing');
  const [models, setModels] = useState<any[]>([
    { id: '1', name: 'Model_Alpha', thumbnail: '', created_at: '2024-01-15' },
    { id: '2', name: 'Model_Beta', thumbnail: '', created_at: '2024-01-20' },
    { id: '3', name: 'Model_Gamma', thumbnail: '', created_at: '2024-01-25' },
  ]);
  const [mode, setMode] = useState('Edit');
  const [snapAngle] = useState(15);
  const [gridEnabled] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorPickerPos, setColorPickerPos] = useState({ x: 0, y: 0 });

  const [position, setPosition] = useState<[number, number, number]>([0, 0.5, 0]);
  const [rotation, setRotation] = useState<[number, number, number]>([0, 0, 0]);
  const [scale, setScale] = useState<[number, number, number]>([1, 1, 1]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showReticle, setShowReticle] = useState(false);

  // WebXR state
  const [isXRSupported, setIsXRSupported] = useState<boolean | null>(null);
  const [xrSession, setXrSession] = useState<XRSession | null>(null);
  const [isInAR, setIsInAR] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const interactionManagerRef = useRef<any>(null);

  // Check WebXR AR support
  const checkXRSupport = async () => {
    if (navigator.xr) {
      try {
        const supported = await navigator.xr.isSessionSupported('immersive-ar');
        setIsXRSupported(supported);
        return supported;
      } catch (error) {
        console.error('Error checking XR support:', error);
        setIsXRSupported(false);
        return false;
      }
    }
    setIsXRSupported(false);
    return false;
  };

  // Start AR session
  const startXRSession = async () => {
    if (!navigator.xr) {
      alert('WebXR is not supported in this browser');
      return;
    }

    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['bounded-floor', 'hand-tracking', 'light-estimation']
      });
      
      setXrSession(session);
      setIsInAR(true);
      
      session.addEventListener('end', () => {
        setXrSession(null);
        setIsInAR(false);
      });
    } catch (error) {
      console.error('Error starting AR session:', error);
      alert('Failed to start AR session. Make sure your Quest is connected and in developer mode.');
    }
  };

  // Stop XR session
  const stopXRSession = () => {
    if (xrSession) {
      xrSession.end();
    }
    setIsInAR(false);
  };

  // Check XR support when editor screen is active
  useEffect(() => {
    if (screen === 'editor') {
      checkXRSupport();
    }
  }, [screen]);

  useEffect(() => {
    if (!containerRef.current || screen !== 'editor' || isInAR) return;

    const { cleanup, interactionManager } = setupScene(containerRef.current);
    interactionManagerRef.current = interactionManager;

    interactionManager.onTransformChange = () => {
      const transform = interactionManager.getCubeTransform();
      setPosition(transform.position);
      setRotation(transform.rotation);
      setScale(transform.scale);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'm') {
        setMenuOpen(!menuOpen);
        setMenuPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseEnter = () => setShowReticle(true);
    const handleMouseLeave = () => setShowReticle(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);
    if (containerRef.current) {
      containerRef.current.addEventListener('mouseenter', handleMouseEnter);
      containerRef.current.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      cleanup();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [screen, isInAR]);

  const handleMenuSelect = (item: string) => {
    if (item === 'Color') {
      setMenuOpen(false);
      setColorPickerOpen(true);
      setColorPickerPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      return;
    }
    setMode(item);
    setMenuOpen(false);
    if (interactionManagerRef.current) {
      const modeMap: Record<string, string> = {
        Select: 'select',
        Move: 'move',
        Rotate: 'rotate',
        Scale: 'scale',
      };
      const newMode = modeMap[item] || 'select';
      interactionManagerRef.current.setMode(newMode);
    }
  };

  const handleColorSelect = (color: string) => {
    if (interactionManagerRef.current) {
      interactionManagerRef.current.setCubeColor(color);
    }
  };

  const handlePositionChange = (pos: [number, number, number]) => {
    setPosition(pos);
    if (interactionManagerRef.current) {
      interactionManagerRef.current.setCubeTransform(pos, undefined, undefined);
    }
  };

  const handleRotationChange = (rot: [number, number, number]) => {
    setRotation(rot);
    if (interactionManagerRef.current) {
      interactionManagerRef.current.setCubeTransform(undefined, rot, undefined);
    }
  };

  const handleScaleChange = (scl: [number, number, number]) => {
    setScale(scl);
    if (interactionManagerRef.current) {
      interactionManagerRef.current.setCubeTransform(undefined, undefined, scl);
    }
  };

  const handleLandingSelect = (selectedMode: 'photo' | 'agentic') => {
    if (selectedMode === 'agentic') {
      setScreen('voice-interaction');
    } else if (selectedMode === 'photo') {
      setScreen('photo-capture');
    }
  };

  const handlePhotoCapture = (imageData: string) => {
    setScreen('editor');
  };

  const handleVoiceComplete = (action: 'new' | 'edit', model?: any) => {
    if (action === 'new') {
      setScreen('editor');
    } else if (action === 'edit' && model) {
      setScreen('editor');
    }
  };

  const handleModelSelect = (model: any) => {
    setScreen('editor');
  };

  return (
    <div className="relative w-full h-screen" style={{ background: 'var(--bg-deep)', overflow: 'hidden' }}>
      {screen === 'landing' && <LandingScreen onSelectMode={handleLandingSelect} />}

      {screen === 'photo-capture' && (
        <PhotoCapture
          onPhotoCapture={handlePhotoCapture}
          onBack={() => setScreen('landing')}
        />
      )}

      {screen === 'voice-interaction' && <VoiceInteractionModule onComplete={handleVoiceComplete} models={models} />}

      {screen === 'carousel' && (
        <div
          className="absolute inset-0 flex items-center justify-center transition-opacity duration-1000"
          style={{
            opacity: screen === 'carousel' ? 1 : 0,
          }}
        >
          <ModelCarousel models={models} onSelectModel={handleModelSelect} />
        </div>
      )}

      {screen === 'editor' && (
        <>
          {isInAR ? (
            <WebXRScene xrSession={xrSession} />
          ) : (
            <div ref={containerRef} className="absolute inset-0 w-full h-full" />
          )}

          {/* Enter AR Button */}
          {!isInAR && (
            <div
              className="absolute top-6 right-6 z-50"
              style={{
                background: 'rgba(14, 18, 36, 0.92)',
                border: '1px solid rgba(130, 209, 255, 0.3)',
                borderRadius: '8px',
                padding: '12px 20px',
                boxShadow: '0 0 15px rgba(130, 209, 255, 0.1)',
              }}
            >
              <div className="font-mono text-xs mb-2" style={{ color: '#00D4FF' }}>
                <div className="text-[9px] opacity-50 tracking-widest mb-1">
                  WEBXR STATUS
                </div>
                <div className="text-[10px] opacity-70">
                  {isXRSupported === null
                    ? 'Checking...'
                    : isXRSupported
                    ? '✅ AR Supported'
                    : '❌ AR Not Supported'}
                </div>
              </div>
              <button
                onClick={startXRSession}
                disabled={!isXRSupported}
                className="font-mono text-sm transition-all duration-300"
                style={{
                  padding: '8px 16px',
                  background: isXRSupported
                    ? 'rgba(0, 212, 255, 0.2)'
                    : 'rgba(100, 100, 100, 0.2)',
                  border: `1px solid ${isXRSupported ? '#00D4FF' : 'rgba(130, 209, 255, 0.2)'}`,
                  color: isXRSupported ? '#00D4FF' : 'rgba(130, 209, 255, 0.4)',
                  borderRadius: '4px',
                  cursor: isXRSupported ? 'pointer' : 'not-allowed',
                  opacity: isXRSupported ? 1 : 0.5,
                }}
              >
                [ENTER AR]
              </button>
            </div>
          )}

          {/* Exit AR Button - Centered */}
          {isInAR && (
            <div
              className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
            >
              <div
                style={{
                  background: 'rgba(14, 18, 36, 0.92)',
                  border: '1px solid rgba(255, 68, 68, 0.3)',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  boxShadow: '0 0 15px rgba(255, 68, 68, 0.1)',
                  pointerEvents: 'auto',
                }}
              >
                <div className="font-mono text-xs mb-2" style={{ color: '#FF4444' }}>
                  <div className="text-[9px] opacity-50 tracking-widest mb-1">
                    AR SESSION ACTIVE
                  </div>
                  <div className="text-[10px] opacity-70">🟢 In AR Mode</div>
                </div>
                <button
                  onClick={stopXRSession}
                  className="font-mono text-sm transition-all duration-300"
                  style={{
                    padding: '8px 16px',
                    background: 'rgba(255, 68, 68, 0.2)',
                    border: '1px solid #FF4444',
                    color: '#FF4444',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  [EXIT AR]
                </button>
              </div>
            </div>
          )}

          {!isInAR && (
            <>
              <ScanLines />
              <CornerBrackets />
              <TargetingReticle x={mousePos.x} y={mousePos.y} visible={showReticle} />
            </>
          )}

          {!isInAR && (
            <>
              <StatusHUD mode={mode} snapAngle={snapAngle} gridEnabled={gridEnabled} />

              <Inspector
                position={position}
                rotation={rotation}
                scale={scale}
                onPositionChange={handlePositionChange}
                onRotationChange={handleRotationChange}
                onScaleChange={handleScaleChange}
              />

              <RadialMenu isOpen={menuOpen} x={menuPos.x} y={menuPos.y} onSelect={handleMenuSelect} />
              <ColorPicker
                isOpen={colorPickerOpen}
                x={colorPickerPos.x}
                y={colorPickerPos.y}
                onSelect={handleColorSelect}
                onClose={() => setColorPickerOpen(false)}
              />

              <DataStream />
              <DiagnosticPanel />
              <CoordinateOverlay position={position} />
              <VoiceBot />

              <div
                className="absolute bottom-6 left-32 px-4 py-2 font-mono text-xs"
                style={{
                  background: 'rgba(14, 18, 36, 0.92)',
                  border: '1px solid rgba(130, 209, 255, 0.3)',
                  borderRadius: '8px',
                  color: '#C1CCE8',
                  boxShadow: '0 0 15px rgba(130, 209, 255, 0.1)',
                }}
              >
                <div className="mb-2 flex items-center gap-2 opacity-80">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: '#82D1FF', boxShadow: '0 0 4px #82D1FF' }}
                  />
                  <span className="text-[10px] font-semibold tracking-wider">CONTROL SCHEMA</span>
                </div>
                <div className="space-y-0.5 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="opacity-50 w-16">Right-drag</span>
                    <span className="opacity-70">›</span>
                    <span>Orbit Camera</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="opacity-50 w-16">Wheel</span>
                    <span className="opacity-70">›</span>
                    <span>Zoom</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="opacity-50 w-16">M</span>
                    <span className="opacity-70">›</span>
                    <span>Radial Menu</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="opacity-50 w-16">R / S</span>
                    <span className="opacity-70">›</span>
                    <span>Rotate / Scale</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default App;
