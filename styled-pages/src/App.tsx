import { useState, useEffect, useRef } from 'react';
import { ThreeScene } from './components/ThreeScene';
import { StatusHUD } from './components/StatusHUD';
import { Inspector } from './components/Inspector';
import { RadialMenu } from './components/RadialMenu';
import { ColorPicker } from './components/ColorPicker';
import { ScanLines } from './components/ScanLines';
import { CornerBrackets } from './components/CornerBrackets';
import { TargetingReticle } from './components/TargetingReticle';
import { DataStream } from './components/DataStream';
import { DiagnosticPanel } from './components/DiagnosticPanel';
import { CoordinateOverlay } from './components/CoordinateOverlay';
import { VoiceBot } from './components/VoiceBot';
import { setupScene } from './three/sceneSetup';

function App() {
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
  const interactionManagerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

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
  }, []);

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

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background: 'var(--bg-deep)' }}>
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
    </div>
  );
}

export default App;
