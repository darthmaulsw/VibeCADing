import { useState, useEffect, useRef } from 'react';
import { ThreeScene } from './components/editor/ThreeScene';
import { WebXRScene, type WebXRSceneRef } from './components/WebXRScene';
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
import { setupScene } from './three/sceneSetup';
import { X } from 'lucide-react';

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
  const [isARMode, setIsARMode] = useState(false);
  const [xrSession, setXrSession] = useState<XRSession | null>(null);
  const [xrSupported, setXrSupported] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const webXRSceneRef = useRef<WebXRSceneRef>(null);
  const interactionManagerRef = useRef<any>(null);

  // Check WebXR support
  useEffect(() => {
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
        setXrSupported(supported);
      }).catch(() => {
        setXrSupported(false);
      });
    }
  }, []);

  // Handle WebXR session
  const enterAR = async () => {
    if (!navigator.xr) {
      alert('WebXR is not supported in this browser');
      return;
    }

    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['bounded-floor', 'hand-tracking'],
      });
      setXrSession(session);
      setIsARMode(true);

      session.addEventListener('end', () => {
        setXrSession(null);
        setIsARMode(false);
      });
    } catch (error) {
      console.error('Failed to start AR session:', error);
      alert('Failed to start AR session. Make sure you have a compatible device and browser.');
    }
  };

  const exitAR = () => {
    if (xrSession) {
      xrSession.end();
    }
    setIsARMode(false);
    setXrSession(null);
  };

  useEffect(() => {
    if (!containerRef.current || screen !== 'editor' || isARMode) return;

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
  }, [screen, isARMode]);

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
    if (isARMode && webXRSceneRef.current?.setObjectColor) {
      webXRSceneRef.current.setObjectColor(color);
    } else if (interactionManagerRef.current) {
      interactionManagerRef.current.setCubeColor(color);
    }
  };

  const handlePositionChange = (pos: [number, number, number]) => {
    setPosition(pos);
    if (isARMode && webXRSceneRef.current?.setObjectTransform) {
      webXRSceneRef.current.setObjectTransform(pos, undefined, undefined);
    } else if (interactionManagerRef.current) {
      interactionManagerRef.current.setCubeTransform(pos, undefined, undefined);
    }
  };

  const handleRotationChange = (rot: [number, number, number]) => {
    setRotation(rot);
    if (isARMode && webXRSceneRef.current?.setObjectTransform) {
      webXRSceneRef.current.setObjectTransform(undefined, rot, undefined);
    } else if (interactionManagerRef.current) {
      interactionManagerRef.current.setCubeTransform(undefined, rot, undefined);
    }
  };

  const handleScaleChange = (scl: [number, number, number]) => {
    setScale(scl);
    if (isARMode && webXRSceneRef.current?.setObjectTransform) {
      webXRSceneRef.current.setObjectTransform(undefined, undefined, scl);
    } else if (interactionManagerRef.current) {
      interactionManagerRef.current.setCubeTransform(undefined, undefined, scl);
    }
  };

  const handleWebXRTransformChange = (transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  }) => {
    setPosition(transform.position);
    setRotation(transform.rotation);
    setScale(transform.scale);
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
          {/* Render appropriate scene based on AR mode */}
          {isARMode ? (
            <WebXRScene
              ref={webXRSceneRef}
              xrSession={xrSession}
              onTransformChange={handleWebXRTransformChange}
              initialTransform={{
                position,
                rotation,
                scale,
              }}
            />
          ) : (
            <div ref={containerRef} className="absolute inset-0 w-full h-full" />
          )}

          {/* All overlays remain visible in both modes */}
          <ScanLines />
          <CornerBrackets />
          {!isARMode && <TargetingReticle x={mousePos.x} y={mousePos.y} visible={showReticle} />}

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

          {/* AR Mode Toggle Button */}
          {!isARMode ? (
            <button
              onClick={enterAR}
              disabled={!xrSupported}
              className="absolute top-6 right-6 px-6 py-3 font-mono text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: xrSupported ? 'rgba(0, 212, 255, 0.2)' : 'rgba(100, 100, 100, 0.2)',
                border: `1px solid ${xrSupported ? '#00D4FF' : '#666'}`,
                color: xrSupported ? '#00D4FF' : '#666',
                borderRadius: '8px',
                boxShadow: xrSupported ? '0 0 20px rgba(0, 212, 255, 0.3)' : 'none',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs tracking-wider">
                  {xrSupported ? '[ENTER AR]' : '[AR NOT SUPPORTED]'}
                </span>
              </div>
            </button>
          ) : (
            <button
              onClick={exitAR}
              className="absolute top-6 right-6 px-6 py-3 font-mono text-sm transition-all duration-300 flex items-center gap-2"
              style={{
                background: 'rgba(255, 68, 68, 0.2)',
                border: '1px solid #FF4444',
                color: '#FF4444',
                borderRadius: '8px',
                boxShadow: '0 0 20px rgba(255, 68, 68, 0.3)',
              }}
            >
              <X className="w-4 h-4" />
              <span className="text-xs tracking-wider">[EXIT AR]</span>
            </button>
          )}

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
    </div>
  );
}

export default App;
