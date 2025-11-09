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
import { setupScene } from './three/sceneSetup';
import { getUserModels } from './lib/quickStorage';
import type { Model } from './lib/types';

type AppScreen = 'landing' | 'photo-capture' | 'voice-interaction' | 'carousel' | 'editor';

// interface Toast {
//   id: string;
//   message: string;
//   type: 'success' | 'error' | 'loading';
// }

function App() {
  const [screen, setScreen] = useState<AppScreen>('landing');
  const [models, setModels] = useState<Model[]>([]);
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

  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const interactionManagerRef = useRef<any>(null);

  // Load models from database on mount and when screen changes
  useEffect(() => {
    async function loadModels() {
      const userId = localStorage.getItem('3d_system_user_id');
      if (userId) {
        console.log('Loading models for user:', userId);
        const userModels = await getUserModels(userId);
        setModels(userModels);
        console.log('Loaded', userModels.length, 'models');
      } else {
        console.log('No user ID found');
      }
    }

    loadModels();

    // Listen for new model saves
    const handleModelSaved = () => {
      console.log('Model saved event received, reloading models...');
      loadModels();
    };

    window.addEventListener('model-saved', handleModelSaved);

    return () => {
      window.removeEventListener('model-saved', handleModelSaved);
    };
  }, [screen]); // Reload when screen changes

  useEffect(() => {
    if (!containerRef.current || screen !== 'editor') return;

    const { cleanup, interactionManager } = setupScene(containerRef.current);
    interactionManagerRef.current = interactionManager;

    interactionManager.onTransformChange = () => {
      const transform = interactionManager.getObjectTransform();
      setPosition(transform.position);
      setRotation(transform.rotation);
      setScale(transform.scale);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'm') {
        setMenuOpen(prev => !prev);
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
  }, [screen]);

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
      interactionManagerRef.current.setObjectColor(color);
    }
  };

  const handlePositionChange = (pos: [number, number, number]) => {
    setPosition(pos);
    if (interactionManagerRef.current) {
      interactionManagerRef.current.setObjectTransform(pos, undefined, undefined);
    }
  };

  const handleRotationChange = (rot: [number, number, number]) => {
    setRotation(rot);
    if (interactionManagerRef.current) {
      interactionManagerRef.current.setObjectTransform(undefined, rot, undefined);
    }
  };

  const handleScaleChange = (scl: [number, number, number]) => {
    setScale(scl);
    if (interactionManagerRef.current) {
      interactionManagerRef.current.setObjectTransform(undefined, undefined, scl);
    }
  };

  const handleLandingSelect = (selectedMode: 'photo' | 'agentic') => {
    if (selectedMode === 'agentic') {
      setScreen('voice-interaction');
    } else if (selectedMode === 'photo') {
      setScreen('photo-capture');
    }
  };

  const handlePhotoCapture = () => {
    setScreen('editor');
  };

  const handleVoiceComplete = (action: 'new' | 'edit') => {
    if (action === 'new') {
      setScreen('editor');
    } else if (action === 'edit') {
      setScreen('editor');
    }
  };

  const handleModelSelect = (model: Model) => {
    console.log('Loading model:', model);
    // Set the GLB URL globally so the editor can load it
    if (model.glb_file_url) {
      (window as unknown as { VIBECAD_LAST_GLB_URL?: string }).VIBECAD_LAST_GLB_URL = model.glb_file_url;
    }
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
          <div ref={containerRef} className="absolute inset-0 w-full h-full" />

          <ScanLines />
          <CornerBrackets />
          <TargetingReticle x={mousePos.x} y={mousePos.y} visible={showReticle} />

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

      {/* <ToastContainer toasts={toasts} onRemove={removeToast} /> */}
    </div>
  );
}

export default App;
