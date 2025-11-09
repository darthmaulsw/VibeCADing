import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadModel, type LoadedModel } from './utils/modelLoader';
import { ScaleOverlay } from '../three/overlays/ScaleOverlay';
import { RotateOverlay } from '../three/overlays/RotateOverlay';
import { ColorPicker } from './ui/ColorPicker';

interface WebXRSceneProps {
  xrSession?: XRSession | null;
}

/* =========================
   Tunables / Constants
   ========================= */
const START_MAX_SIZE_M = 1.0;   // largest dimension after import
const SCALE_MIN = 0.05;
const SCALE_MAX = 25;

// Two-hand scaling
const MIN_HAND_DISTANCE = 0.05; // 5 cm floor
const ARM_DELTA = 0.05;         // arming threshold
const DEADZONE_METERS = 0.015;  // scale jitter deadzone
const ABS_MIN_SIZE = 0.10;      // min object size (largest dim), meters
const ABS_MAX_SIZE = 5.00;      // max object size (largest dim), meters

// Right-stick rotation
const STICK_DEADZONE = 0.20;    // ignore tiny stick noise (0..1)
const ROT_GAIN_RAD_PER_M = Math.PI * 1.2; // requested
const ROT_MAX_STEP = Math.PI / 12;        // requested

// Dragging (B on right)
const DRAG_MIN_DISTANCE = 0.05; // 5 cm: keep target in front of controller
const DRAG_LERP = 0.35;         // smoothing to make motion pleasant

/* =========================
   Unit helpers (meters-first)
   ========================= */
type SourceUnits = 'meters' | 'centimeters' | 'millimeters' | 'inches';
const UNIT_TO_METERS: Record<SourceUnits, number> = {
  meters: 1,
  centimeters: 0.01,
  millimeters: 0.001,
  inches: 0.0254,
};

function convertUnitsToMeters(object: THREE.Object3D, units: SourceUnits) {
  const k = UNIT_TO_METERS[units];
  if (!k || k === 1) return;
  object.scale.multiplyScalar(k);
  object.updateMatrixWorld(true);
}

/** Wrap child in a container, recenter to origin, and scale container so largest dim == targetMaxSizeMeters. */
function centerAndFitToMax(child: THREE.Object3D, targetMaxSizeMeters: number): THREE.Group {
  const container = new THREE.Group();
  container.name = 'ModelContainer';
  container.add(child);

  container.updateMatrixWorld(true);
  child.updateMatrixWorld(true);

  const bboxW = new THREE.Box3().setFromObject(child);
  const sizeW = bboxW.getSize(new THREE.Vector3());
  const centerW = bboxW.getCenter(new THREE.Vector3());
  const centerLocal = container.worldToLocal(centerW.clone());
  child.position.sub(centerLocal);

  container.updateMatrixWorld(true);

  const maxDim = Math.max(sizeW.x, sizeW.y, sizeW.z) || 1e-6;
  const s = targetMaxSizeMeters / maxDim;
  container.scale.setScalar(s);
  container.updateMatrixWorld(true);
  return container;
}

/* =========================
   Scene Component
   ========================= */
export const WebXRScene: React.FC<WebXRSceneProps> = ({ xrSession }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controllerModelFactoryRef = useRef<XRControllerModelFactory | null>(null);
  const loadedModelsRef = useRef<LoadedModel[]>([]);

  // The node we scale/rotate/drag (ALWAYS the fitted container)
  const objectRef = useRef<THREE.Object3D | null>(null);
  const initialMaxDimRef = useRef<number>(1.0); // for absolute size clamp

  // Controllers
  type ControllerState = {
    object: THREE.XRTargetRaySpace;
    inputSource?: XRInputSource;
    gamepad?: Gamepad;
    prevButtons: boolean[];
    handedness?: XRHandedness;
  };
  const controllersStateRef = useRef<ControllerState[]>([]);
  const leftCtrlRef = useRef<THREE.Object3D | null>(null);
  const rightCtrlRef = useRef<THREE.Object3D | null>(null);
  const rightGamepadRef = useRef<Gamepad | null>(null);
  const leftGamepadRef = useRef<Gamepad | null>(null);

  // --- Two-hand scaling state (idle → pending → active) ---
  type ScaleState = 'idle' | 'pending' | 'active';
  const scaleStateRef = useRef<ScaleState>('idle');
  const pendingDistanceRef = useRef<number | null>(null);
  const baseDistanceRef = useRef<number | null>(null);
  const baseScaleRef = useRef<number | null>(null);

  // Right-stick timing
  const lastTimeRef = useRef<number | null>(null);

  // --- Dragging state (B on right) ---
  const draggingRef = useRef(false);
  const dragDistanceRef = useRef<number>(0.5); // distance along controller forward
  const laserLineRef = useRef<THREE.Line | null>(null);
  const laserDotRef = useRef<THREE.Mesh | null>(null);

  // --- Scale overlay ---
  const scaleOverlayRef = useRef<ScaleOverlay | null>(null);
  
  // --- Rotate overlay ---
  const rotateOverlayRef = useRef<RotateOverlay | null>(null);
  const rotationStartRef = useRef<THREE.Euler | null>(null);
  const isRotatingRef = useRef(false);

  // --- UI State ---
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorPickerPos, setColorPickerPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const menuOpenRef = useRef(false);
  const menuPosRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  
  // --- 3D Menu in AR ---
  const menuPlaneRef = useRef<THREE.Mesh | null>(null);
  const menuCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const menuTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const menuSelectedIndexRef = useRef<number | null>(null);
  const prevStickClickRef = useRef<boolean>(false);
  const prevYPressedRef = useRef<boolean>(false);
  
  // --- 3D Color Picker in AR ---
  const colorPickerPlaneRef = useRef<THREE.Mesh | null>(null);
  const colorPickerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const colorPickerTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const colorPickerStateRef = useRef({ hue: 200, saturation: 80, lightness: 60, rotation: 0 });

  // Helpers
  const setUniformScale = (obj: THREE.Object3D, s: number) => {
    obj.scale.setScalar(Math.max(SCALE_MIN, Math.min(SCALE_MAX, s)));
  };
  const getUniformScale = (obj: THREE.Object3D) => obj.scale.x;
  const worldPos = (obj: THREE.Object3D) => new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld);
  const worldDir = (obj: THREE.Object3D) => {
    const d = new THREE.Vector3(0, 0, -1);
    return d.applyQuaternion(obj.getWorldQuaternion(new THREE.Quaternion())).normalize();
  };

  // Menu items - must match in both renderMenuToCanvas and navigation code
  const MENU_ITEMS = ['Color', 'Rotate', 'Scale'];
  
  // Render menu to canvas
  const renderMenuToCanvas = (canvas: HTMLCanvasElement, isOpen: boolean, selectedIndex: number | null = null) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!isOpen) return;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const innerRadius = 80;
    const outerRadius = 184;
    const items = MENU_ITEMS;
    const segmentAngle = (2 * Math.PI) / items.length;
    
    // Draw menu items
    items.forEach((item, i) => {
      const startAngle = i * segmentAngle - Math.PI / 2;
      const endAngle = (i + 1) * segmentAngle - Math.PI / 2;
      const isSelected = selectedIndex === i;
      
      // Draw arc segment
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      
      // Highlight selected item
      if (isSelected) {
        ctx.fillStyle = 'rgba(130, 209, 255, 0.15)';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
      } else {
        ctx.fillStyle = 'rgba(14, 18, 36, 0.7)';
        ctx.fill();
        ctx.strokeStyle = '#00D4FF';
        ctx.lineWidth = 2;
      }
      ctx.stroke();
      
      // Draw text
      const textAngle = startAngle + segmentAngle / 2;
      const textRadius = (innerRadius + outerRadius) / 2;
      const textX = centerX + Math.cos(textAngle) * textRadius;
      const textY = centerY + Math.sin(textAngle) * textRadius;
      
      ctx.fillStyle = isSelected ? '#FFFFFF' : '#00D4FF';
      ctx.font = isSelected ? 'bold 18px monospace' : 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Add glow effect for selected item
      if (isSelected) {
        ctx.shadowColor = '#00D4FF';
        ctx.shadowBlur = 10;
      } else {
        ctx.shadowBlur = 0;
      }
      
      ctx.fillText(item, textX, textY);
      ctx.shadowBlur = 0;
    });
    
    // Draw decorative circles
    ctx.strokeStyle = '#00D4FF';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius + 20, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  };

  // Render color picker to canvas
  const renderColorPickerToCanvas = (
    canvas: HTMLCanvasElement,
    isOpen: boolean,
    hue: number,
    saturation: number,
    lightness: number,
    rotation: number
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!isOpen) return;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 140;
    const spectrumSegments = 36;
    const innerR = 62;
    const outerR = 90;
    
    // Draw decorative rotating circles
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, radius - 10, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((-rotation * 1.5 * Math.PI) / 180);
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, radius - 25, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
    
    // Draw decorative lines
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.15)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < spectrumSegments; i++) {
      const angle = (i / spectrumSegments) * 360;
      const rad = (angle * Math.PI) / 180;
      const x1 = centerX + Math.cos(rad) * 35;
      const y1 = centerY + Math.sin(rad) * 35;
      const x2 = centerX + Math.cos(rad) * 90;
      const y2 = centerY + Math.sin(rad) * 90;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    
    // Draw color spectrum segments
    for (let i = 0; i < spectrumSegments; i++) {
      const segmentHue = (i / spectrumSegments) * 360;
      const startAngle = ((i / spectrumSegments) * 360 - 90) * (Math.PI / 180);
      const endAngle = (((i + 1) / spectrumSegments) * 360 - 90) * (Math.PI / 180);
      
      const x1 = centerX + Math.cos(startAngle) * innerR;
      const y1 = centerY + Math.sin(startAngle) * innerR;
      const x2 = centerX + Math.cos(startAngle) * outerR;
      const y2 = centerY + Math.sin(startAngle) * outerR;
      const x4 = centerX + Math.cos(endAngle) * innerR;
      const y4 = centerY + Math.sin(endAngle) * innerR;
      
      const color = `hsl(${segmentHue}, 80%, 60%)`;
      const isSelected = Math.abs(hue - segmentHue) < 10;
      
      // Draw segment
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.arc(centerX, centerY, outerR, startAngle, endAngle);
      ctx.lineTo(x4, y4);
      ctx.arc(centerX, centerY, innerR, endAngle, startAngle, true);
      ctx.closePath();
      
      // Fill with color
      ctx.fillStyle = color;
      ctx.fill();
      
      // Stroke
      if (isSelected) {
        ctx.strokeStyle = '#00D4FF';
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = 'rgba(130, 209, 255, 0.2)';
        ctx.lineWidth = 0.5;
      }
      ctx.stroke();
    }
    
    // Draw center button
    const centerColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    ctx.fillStyle = centerColor;
    ctx.strokeStyle = 'rgba(130, 209, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 32, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    
    // Draw X in center
    ctx.strokeStyle = lightness > 50 ? '#0E1224' : '#00D4FF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - 8, centerY - 8);
    ctx.lineTo(centerX + 8, centerY + 8);
    ctx.moveTo(centerX + 8, centerY - 8);
    ctx.lineTo(centerX - 8, centerY + 8);
    ctx.stroke();
    
    // Draw label
    ctx.fillStyle = '#00D4FF';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.globalAlpha = 0.5;
    ctx.fillText('COLOR SPECTRUM', centerX, centerY + radius + 8);
    ctx.globalAlpha = 1.0;
  };

  // "Grab" = trigger (0) OR grip/squeeze (1)
  const isGrabPressed = (gp?: Gamepad) => !!(gp && (gp.buttons?.[0]?.pressed || gp.buttons?.[1]?.pressed));
  // Right B button (xr-standard puts X/A on 4, Y/B on 5). We only treat B on right.
  const isBPressedRight = (gp?: Gamepad) => !!(gp && gp.buttons?.[5]?.pressed);
  /** Safely read whether any of these button indices are pressed */
  function anyPressed(gp: Gamepad | null | undefined, idx: number[]): boolean {
    if (!gp || !gp.buttons) return false;
    for (const i of idx) if (gp.buttons[i]?.pressed) return true;
    return false;
  }

  /** xr-standard mapping on Quest: thumbstick click is typically index 3 */
  function isThumbstickClick(gp?: Gamepad | null) {
    // 3 is standard; include a couple fallbacks
    return !!(gp?.buttons?.[3]?.pressed || gp?.buttons?.[11]?.pressed || gp?.buttons?.[9]?.pressed);
  }

  /** Stick axes with fallbacks (Quest: left [0,1], right [2,3]) */
  function readStick(gp: Gamepad | null | undefined, hand: 'left' | 'right'): { x: number; y: number } {
    if (!gp || !gp.axes) return { x: 0, y: 0 };
    if (hand === 'left') {
      const x = gp.axes[0] ?? gp.axes[2] ?? 0;
      const y = gp.axes[1] ?? gp.axes[3] ?? 0;
      return { x, y };
    } else {
      const x = gp.axes[2] ?? gp.axes[0] ?? 0;
      const y = gp.axes[3] ?? gp.axes[1] ?? 0;
      return { x, y };
    }
  }

  /** Prefer [2,3], fallback to [0,1]; small DZ only for fallback check */
  function getLeftStickLegacy(gp: Gamepad | null | undefined) {
    let x = 0, y = 0;
    if (gp?.axes && gp.axes.length > 3) {
      x = gp.axes[2] ?? 0;
      y = gp.axes[3] ?? 0;
    }
    // If that looks centered, try [0,1]
    if (Math.abs(x) < 0.05 && Math.abs(y) < 0.05 && gp?.axes && gp.axes.length > 1) {
      x = gp.axes[0] ?? 0;
      y = gp.axes[1] ?? 0;
    }
    return { x, y };
  }

  /** Convert stick to menu index; top wedge is index 0 */
  function stickToMenuIndex(lx: number, ly: number, itemCount: number, startAtTop = true) {
    // right=0, up=-PI/2
    const angle = Math.atan2(-ly, lx);
    const offset = startAtTop ? -Math.PI / 2 : 0;
    let a = angle - offset;
    a = (a % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const seg = (2 * Math.PI) / itemCount;
    let idx = Math.floor(a / seg);
    if (idx >= itemCount) idx = itemCount - 1;
    return idx;
  }

  /** Y button on left controller (buttons 4 or 5) */
  function isYPressedLeft(gp?: Gamepad | null) {
    // On many Quest profiles Y is button index 4 or 5; include both
    return anyPressed(gp, [4, 5]);
  }

  // Laser setup/teardown
  const ensureLaser = (scene: THREE.Scene) => {
    if (!laserLineRef.current) {
      const geom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const mat = new THREE.LineBasicMaterial({ color: 0x00ff00 });
      const line = new THREE.Line(geom, mat);
      line.frustumCulled = false;
      scene.add(line);
      laserLineRef.current = line;
    }
    if (!laserDotRef.current) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.01, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
      );
      dot.frustumCulled = false;
      scene.add(dot);
      laserDotRef.current = dot;
    }
    laserLineRef.current!.visible = true;
    laserDotRef.current!.visible = true;
  };
  const hideLaser = () => {
    if (laserLineRef.current) laserLineRef.current.visible = false;
    if (laserDotRef.current) laserDotRef.current.visible = false;
  };
  const updateLaser = (start: THREE.Vector3, end: THREE.Vector3) => {
    const line = laserLineRef.current;
    const dot = laserDotRef.current;
    if (!line || !dot) return;
    const posAttr = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    posAttr.setXYZ(0, start.x, start.y, start.z);
    posAttr.setXYZ(1, end.x, end.y, end.z);
    posAttr.needsUpdate = true;
    dot.position.copy(end);
  };

  useEffect(() => {
    if (!mountRef.current) return;

    /* ---------- Scene / Camera ---------- */
    const scene = new THREE.Scene();
    scene.background = null; // AR transparent
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 0);
    cameraRef.current = camera;

    /* ---------- Renderer ---------- */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    renderer.xr.enabled = true;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    /* ---------- Lights ---------- */
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 0.5);
    dir.position.set(0, 10, 0);
    scene.add(dir);

    /* ---------- Optional reference point ---------- */
    const refPoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfcba03 })
    );
    refPoint.position.set(0, 1.6, -2);
    scene.add(refPoint);

    /* ---------- Scale overlay ---------- */
    const scaleOverlay = new ScaleOverlay(scene);
    scaleOverlayRef.current = scaleOverlay;

    /* ---------- Rotate overlay ---------- */
    const rotateOverlay = new RotateOverlay(scene);
    rotateOverlayRef.current = rotateOverlay;

    /* ---------- 3D Menu Plane for AR ---------- */
    const menuCanvas = document.createElement('canvas');
    menuCanvas.width = 600;
    menuCanvas.height = 600;
    menuCanvasRef.current = menuCanvas;
    
    const menuTexture = new THREE.CanvasTexture(menuCanvas);
    menuTexture.needsUpdate = true;
    // Enable texture updates
    menuTexture.minFilter = THREE.LinearFilter;
    menuTexture.magFilter = THREE.LinearFilter;
    menuTextureRef.current = menuTexture;
    
    const menuPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.6),
      new THREE.MeshBasicMaterial({
        map: menuTexture,
        transparent: true,
        side: THREE.DoubleSide,
        alphaTest: 0.01,
        depthWrite: false,
      })
    );
    menuPlane.visible = false;
    menuPlane.name = 'MenuPlane';
    scene.add(menuPlane);
    menuPlaneRef.current = menuPlane;

    /* ---------- 3D Color Picker Plane for AR ---------- */
    const colorPickerCanvas = document.createElement('canvas');
    colorPickerCanvas.width = 600;
    colorPickerCanvas.height = 600;
    colorPickerCanvasRef.current = colorPickerCanvas;
    
    const colorPickerTexture = new THREE.CanvasTexture(colorPickerCanvas);
    colorPickerTexture.needsUpdate = true;
    colorPickerTexture.minFilter = THREE.LinearFilter;
    colorPickerTexture.magFilter = THREE.LinearFilter;
    colorPickerTextureRef.current = colorPickerTexture;
    
    const colorPickerPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.6),
      new THREE.MeshBasicMaterial({
        map: colorPickerTexture,
        transparent: true,
        side: THREE.DoubleSide,
        alphaTest: 0.01,
        depthWrite: false,
      })
    );
    colorPickerPlane.visible = false;
    colorPickerPlane.name = 'ColorPickerPlane';
    scene.add(colorPickerPlane);
    colorPickerPlaneRef.current = colorPickerPlane;

    /* ---------- Load model (meters) ---------- */
    const loadModelMeters = async () => {
      try {
        const url = new URL('../assets/objects/generated-model.stl', import.meta.url);
        const loaded = await loadModel(url.href);

        // STL likely in mm → convert to meters
        convertUnitsToMeters(loaded.model, 'millimeters');

        const container = centerAndFitToMax(loaded.model, START_MAX_SIZE_M);
        container.position.set(0, 1.6, -1.5);
        container.traverse((c: any) => (c.visible = true));
        scene.add(container);

        objectRef.current = container;
        loadedModelsRef.current.push(loaded);

        const bbox = new THREE.Box3().setFromObject(container);
        const size = bbox.getSize(new THREE.Vector3());
        initialMaxDimRef.current = Math.max(size.x, size.y, size.z);
      } catch (e) {
        console.error('Model load failed, using cube', e);
        const cube = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.2, 0.2),
          new THREE.MeshStandardMaterial({ color: 0xff0000 })
        );
        const container = centerAndFitToMax(cube, START_MAX_SIZE_M);
        container.position.set(0, 1.6, -1.5);
        scene.add(container);
        objectRef.current = container;

        const bbox = new THREE.Box3().setFromObject(container);
        const size = bbox.getSize(new THREE.Vector3());
        initialMaxDimRef.current = Math.max(size.x, size.y, size.z);
      }
    };
    loadModelMeters();

    /* ---------- Controller visuals ---------- */
    const loader = new GLTFLoader();
    const controllerModelFactory = new XRControllerModelFactory();
    controllerModelFactory.gltfLoader = loader;
    controllerModelFactory.path = '/';
    controllerModelFactoryRef.current = controllerModelFactory;

    const controllers: THREE.XRTargetRaySpace[] = [];

    const makeController = (index: number) => {
      const c = renderer.xr.getController(index);
      const state: ControllerState = { object: c, prevButtons: [] };
      controllersStateRef.current.push(state);

      c.addEventListener('connected', (event: any) => {
        try {
          const model = controllerModelFactory.createControllerModel(c);
          if (model) c.add(model);
        } catch {}
        state.inputSource = event.data as XRInputSource;
        state.handedness = state.inputSource?.handedness;
        state.gamepad = state.inputSource?.gamepad;
        state.prevButtons = new Array(state.gamepad?.buttons?.length || 0).fill(false);

        if (state.handedness === 'left') {
          leftCtrlRef.current = c;
          leftGamepadRef.current = state.gamepad ?? null;
        }
        if (state.handedness === 'right') {
          rightCtrlRef.current = c;
          rightGamepadRef.current = state.gamepad ?? null;
        }
      });

      c.addEventListener('disconnected', () => {
        if (state.handedness === 'left') {
          leftCtrlRef.current = null;
          leftGamepadRef.current = null;
        }
        if (state.handedness === 'right') {
          rightCtrlRef.current = null;
          rightGamepadRef.current = null;
        }
        state.inputSource = undefined;
        state.gamepad = undefined;
        state.prevButtons = [];
        state.handedness = undefined;
      });

      scene.add(c);
      controllers.push(c);
    };
    makeController(0);
    makeController(1);

    /* ---------- Animation loop: scaling + right-stick rotation + B-drag ---------- */
    const animate = (time: number) => {
      // dt in seconds
      const dt =
        lastTimeRef.current == null ? 0 : Math.max(0, (time - lastTimeRef.current) / 1000);
      lastTimeRef.current = time;

      // Poll controllers: determine grabs, right B, left Y, keep gamepads fresh
      let leftGrab = false;
      let rightGrab = false;
      let rightB = false;
      let prevRightB = false;
      let leftY = false;
      let prevLeftY = false;

      controllersStateRef.current.forEach((cs) => {
        const gp = cs.gamepad;
        if (!gp) return;

        if (cs.prevButtons.length !== gp.buttons.length) {
          cs.prevButtons = new Array(gp.buttons.length).fill(false);
        }

        const grab = isGrabPressed(gp);
        if (cs.handedness === 'left') {
          leftGrab = grab;
          leftGamepadRef.current = gp; // refresh each frame
          const yPressed = isYPressedLeft(gp);
          leftY = yPressed || leftY;
          prevLeftY = cs.prevButtons[5] || prevLeftY;
        }
        if (cs.handedness === 'right') {
          rightGrab = grab;
          rightGamepadRef.current = gp; // refresh ref per frame
          const bPressed = isBPressedRight(gp);
          rightB = bPressed || rightB;
          prevRightB = cs.prevButtons[5] || prevRightB;
        }

        for (let i = 0; i < gp.buttons.length; i++) {
          cs.prevButtons[i] = !!gp.buttons[i]?.pressed;
        }
      });

      // Handle Y button to toggle menu
      if (leftGamepadRef.current) {
        const yNow = isYPressedLeft(leftGamepadRef.current);
        if (yNow && !prevYPressedRef.current) {
          menuOpenRef.current = !menuOpenRef.current;
          if (menuPlaneRef.current) {
            menuPlaneRef.current.visible = menuOpenRef.current;
          }
          if (menuOpenRef.current) {
            // Position menu in front of controller
            if (menuPlaneRef.current && leftCtrlRef.current && cameraRef.current) {
              const ctrlPos = worldPos(leftCtrlRef.current);
              const ctrlDir = worldDir(leftCtrlRef.current);
              const menuDistance = 0.4;
              
              menuPlaneRef.current.position.copy(ctrlPos);
              menuPlaneRef.current.position.add(ctrlDir.multiplyScalar(menuDistance));
              menuPlaneRef.current.lookAt(cameraRef.current.position);
            }
            
            menuSelectedIndexRef.current = 0; // default to top wedge
            if (menuCanvasRef.current && menuTextureRef.current) {
              renderMenuToCanvas(menuCanvasRef.current, true, 0);
              menuTextureRef.current.needsUpdate = true;
            }
            
            // Project controller position to screen coordinates (for color picker positioning)
            if (leftCtrlRef.current && cameraRef.current) {
              const ctrlPos = worldPos(leftCtrlRef.current);
              const vector = new THREE.Vector3();
              vector.copy(ctrlPos);
              vector.project(cameraRef.current);
              
              const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
              const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;
              menuPosRef.current = { x, y };
            }
          } else {
            // Close color picker if menu closes
            setColorPickerOpen(false);
          }
        }
        prevYPressedRef.current = yNow;
      }

      // Update radial menu frame with adaptive deadzone and hysteresis
      function updateRadialMenuFrame() {
        if (!menuOpenRef.current || !leftGamepadRef.current || !menuCanvasRef.current || !menuTextureRef.current) return;

        const gp = leftGamepadRef.current;
        const { x: lx, y: ly } = getLeftStickLegacy(gp);
        const mag = Math.hypot(lx, ly);

        // Uncomment to verify axes values when you move the stick
        // console.log('L AXES:', (gp.axes||[]).map(v => v.toFixed(2)));

        // Adaptive deadzone
        let dz = 0.08;
        if (mag > 0.6) dz = 0.04;

        const currentIndex = menuSelectedIndexRef.current;
        const armed = mag > dz;
        const hysteresis = dz + 0.03;

        // Only change selection when clearly outside hysteresis
        if (armed || (currentIndex == null && mag > dz)) {
          if (mag > hysteresis) {
            const idx = stickToMenuIndex(lx, ly, MENU_ITEMS.length, true);
            if (idx !== currentIndex) {
              menuSelectedIndexRef.current = idx;
              renderMenuToCanvas(menuCanvasRef.current, true, idx);
              menuTextureRef.current.needsUpdate = true;
            }
          }
        } else {
          // keep current highlight, optionally re-render
          if (currentIndex != null) {
            renderMenuToCanvas(menuCanvasRef.current, true, currentIndex);
            menuTextureRef.current.needsUpdate = true;
          }
        }

        // Confirm on stick click (edge)
        const clickNow = isThumbstickClick(gp);
        if (clickNow && !prevStickClickRef.current && menuSelectedIndexRef.current != null) {
          const choice = MENU_ITEMS[menuSelectedIndexRef.current];

          // Close menu plane
          menuOpenRef.current = false;
          if (menuPlaneRef.current) menuPlaneRef.current.visible = false;

          // Handle selection
          if (choice === 'Color') {
            // Show color picker plane
            if (colorPickerPlaneRef.current && leftCtrlRef.current && colorPickerCanvasRef.current && colorPickerTextureRef.current && cameraRef.current) {
              const ctrlPos = worldPos(leftCtrlRef.current);
              const ctrlDir = worldDir(leftCtrlRef.current);
              const pickerDistance = 0.4;
              
              colorPickerPlaneRef.current.position.copy(ctrlPos);
              colorPickerPlaneRef.current.position.add(ctrlDir.multiplyScalar(pickerDistance));
              colorPickerPlaneRef.current.lookAt(cameraRef.current.position);
              colorPickerPlaneRef.current.visible = true;
              
              colorPickerStateRef.current = { hue: 200, saturation: 80, lightness: 60, rotation: 0 };
              
              renderColorPickerToCanvas(
                colorPickerCanvasRef.current,
                true,
                colorPickerStateRef.current.hue,
                colorPickerStateRef.current.saturation,
                colorPickerStateRef.current.lightness,
                colorPickerStateRef.current.rotation
              );
              colorPickerTextureRef.current.needsUpdate = true;
            }
            setColorPickerOpen(true);
            setColorPickerPos(menuPosRef.current);
          } else if (choice === 'Rotate') {
            // Optional: prime rotate overlay or state if you want
            setColorPickerOpen(false);
          } else if (choice === 'Scale') {
            setColorPickerOpen(false);
          }
        }
        prevStickClickRef.current = clickNow;
      }
      
      // Call updateRadialMenuFrame when menu is open
      if (menuOpenRef.current) {
        // Position menu plane in front of controller
        if (menuPlaneRef.current && leftCtrlRef.current && cameraRef.current) {
          const ctrlPos = worldPos(leftCtrlRef.current);
          const ctrlDir = worldDir(leftCtrlRef.current);
          const menuDistance = 0.4;
          
          menuPlaneRef.current.position.copy(ctrlPos);
          menuPlaneRef.current.position.add(ctrlDir.multiplyScalar(menuDistance));
          menuPlaneRef.current.lookAt(cameraRef.current.position);
        }
        
        updateRadialMenuFrame();
      } else {
        // Menu closed - keep edge detector in sync
        prevStickClickRef.current = isThumbstickClick(leftGamepadRef.current ?? undefined);
      }
      
      // Handle color picker interaction with adaptive deadzone and hysteresis
      if (colorPickerOpen && leftGamepadRef.current && colorPickerCanvasRef.current && colorPickerTextureRef.current) {
        const gp = leftGamepadRef.current;
        
        // Get joystick input using legacy method (same as menu)
        const { x: lx, y: ly } = getLeftStickLegacy(gp);
        const mag = Math.hypot(lx, ly);
        
        // Adaptive deadzone (same as menu)
        let dz = 0.08;
        if (mag > 0.6) dz = 0.04;
        
        const currentHue = colorPickerStateRef.current.hue;
        const armed = mag > dz;
        const hysteresis = dz + 0.03;
        
        // Update hue based on joystick angle (only when clearly outside hysteresis)
        if (armed && mag > hysteresis) {
          // Angle in radians: right = 0, up = -PI/2, CCW positive
          const angle = Math.atan2(-ly, lx);
          // Normalize to [0, 2PI)
          let normalizedAngle = angle;
          if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
          
          // Convert to hue (0-360)
          const newHue = Math.floor((normalizedAngle / (Math.PI * 2)) * 360);
          
          // Only update if changed significantly (hysteresis for hue)
          const hueDiff = Math.min(
            Math.abs(currentHue - newHue),
            Math.abs(currentHue - newHue + 360),
            Math.abs(currentHue - newHue - 360)
          );
          
          if (hueDiff > 3) {
            colorPickerStateRef.current.hue = newHue;
            
            // Update color immediately
            const color = `hsl(${newHue}, ${colorPickerStateRef.current.saturation}%, ${colorPickerStateRef.current.lightness}%)`;
            handleColorSelect(color);
          }
        }
        
        // Update rotation for animation
        colorPickerStateRef.current.rotation = (colorPickerStateRef.current.rotation + 0.4) % 360;
        
        // Continuously update color picker texture
        renderColorPickerToCanvas(
          colorPickerCanvasRef.current,
          true,
          colorPickerStateRef.current.hue,
          colorPickerStateRef.current.saturation,
          colorPickerStateRef.current.lightness,
          colorPickerStateRef.current.rotation
        );
        colorPickerTextureRef.current.needsUpdate = true;
        
        // Handle joystick click to close
        const clickNow = isThumbstickClick(gp);
        if (clickNow && !prevStickClickRef.current) {
          // Close color picker
          setColorPickerOpen(false);
          if (colorPickerPlaneRef.current) {
            colorPickerPlaneRef.current.visible = false;
          }
        }
        prevStickClickRef.current = clickNow;
      }
      
      // Update 3D color picker position to follow controller
      if (colorPickerOpen && colorPickerPlaneRef.current && leftCtrlRef.current && cameraRef.current) {
        const ctrlPos = worldPos(leftCtrlRef.current);
        const ctrlDir = worldDir(leftCtrlRef.current);
        const pickerDistance = 0.4;
        
        colorPickerPlaneRef.current.position.copy(ctrlPos);
        colorPickerPlaneRef.current.position.add(ctrlDir.multiplyScalar(pickerDistance));
        colorPickerPlaneRef.current.lookAt(cameraRef.current.position);
      }
      
      // Update 3D menu position to follow controller
      if (menuOpenRef.current && menuPlaneRef.current && leftCtrlRef.current && cameraRef.current) {
        const ctrlPos = worldPos(leftCtrlRef.current);
        const ctrlDir = worldDir(leftCtrlRef.current);
        const menuDistance = 0.4;
        
        menuPlaneRef.current.position.copy(ctrlPos);
        menuPlaneRef.current.position.add(ctrlDir.multiplyScalar(menuDistance));
        menuPlaneRef.current.lookAt(cameraRef.current.position);
        
        // Continuously update menu texture to ensure it's visible
        if (menuCanvasRef.current && menuTextureRef.current && menuSelectedIndexRef.current !== null && menuSelectedIndexRef.current >= 0) {
          // Re-render menu with current selection to ensure texture is up to date
          renderMenuToCanvas(menuCanvasRef.current, true, menuSelectedIndexRef.current);
          menuTextureRef.current.needsUpdate = true;
        }
      }

      const scene = sceneRef.current!;
      const obj = objectRef.current;
      const left = leftCtrlRef.current;
      const right = rightCtrlRef.current;

      if (obj && left && right) {
        /* ===== 1) DRAGGING (highest priority) ===== */
        if (rightB) {
          // entering drag
          if (!draggingRef.current) {
            draggingRef.current = true;

            // Compute initial distance along controller forward to current object position
            const ctrlPos = worldPos(right);
            const ctrlDir = worldDir(right);
            const toObj = worldPos(obj).sub(ctrlPos);
            let dist = toObj.dot(ctrlDir); // signed distance along forward
            if (!Number.isFinite(dist) || dist < DRAG_MIN_DISTANCE) dist = DRAG_MIN_DISTANCE;
            dragDistanceRef.current = dist;

            ensureLaser(scene);
          }

          // Update target along controller ray
          const origin = worldPos(right);
          const dir = worldDir(right);
          const target = origin.clone().add(dir.multiplyScalar(Math.max(dragDistanceRef.current, DRAG_MIN_DISTANCE)));

          // Smooth follow
          obj.position.lerp(target, DRAG_LERP);
          obj.updateMatrixWorld(true);

          // Laser visuals
          updateLaser(origin, target);

          // When dragging, disable scaling and rotation states
          if (scaleStateRef.current === 'active' && scaleOverlayRef.current) {
            scaleOverlayRef.current.hide();
          }
          if (isRotatingRef.current && rotateOverlayRef.current) {
            rotateOverlayRef.current.hide();
            isRotatingRef.current = false;
            rotationStartRef.current = null;
          }
          scaleStateRef.current = 'idle';
          pendingDistanceRef.current = null;
          baseDistanceRef.current = null;
          baseScaleRef.current = null;
        } else {
          // exiting drag
          if (draggingRef.current) {
            draggingRef.current = false;
            hideLaser();
          }

          /* ===== 2) TWO-HAND SCALING ===== */
          if (leftGrab && rightGrab) {
            const pL = worldPos(left);
            const pR = worldPos(right);
            const dist = Math.max(pL.distanceTo(pR), MIN_HAND_DISTANCE);

            if (scaleStateRef.current === 'idle') {
              scaleStateRef.current = 'pending';
              pendingDistanceRef.current = dist;
            } else if (scaleStateRef.current === 'pending') {
              const join = pendingDistanceRef.current ?? dist;
              if (Math.abs(dist - join) >= ARM_DELTA) {
                baseDistanceRef.current = join;
                const currentScale = getUniformScale(obj);
                baseScaleRef.current = currentScale * (join / dist); // compensate so no jump
                scaleStateRef.current = 'active';
                
                // Show scale overlay when scaling becomes active
                if (scaleOverlayRef.current) {
                  const objPos = worldPos(obj);
                  const currentScaleValue = getUniformScale(obj);
                  scaleOverlayRef.current.show(objPos, currentScaleValue);
                }
              }
            } else if (scaleStateRef.current === 'active') {
              const baseDist = baseDistanceRef.current!;
              const baseScale = baseScaleRef.current!;
              const delta = dist - baseDist;

              if (Math.abs(delta) > DEADZONE_METERS) {
                let desired = baseScale * (dist / baseDist);

                // Absolute size clamp
                const initMax = Math.max(initialMaxDimRef.current, 1e-6);
                const minS = ABS_MIN_SIZE / initMax;
                const maxS = ABS_MAX_SIZE / initMax;
                desired = Math.min(maxS, Math.max(minS, desired));
                setUniformScale(obj, desired);
                
                // Update scale overlay
                if (scaleOverlayRef.current) {
                  const objPos = worldPos(obj);
                  scaleOverlayRef.current.update(objPos, desired);
                }
              }
            }
          }
          /* ===== 3) RIGHT-STICK ROTATION (only when not dragging & not scaling) ===== */
          else {
            // Hide scale overlay when scaling ends
            if (scaleStateRef.current === 'active' && scaleOverlayRef.current) {
              scaleOverlayRef.current.hide();
            }
            
            scaleStateRef.current = 'idle';
            pendingDistanceRef.current = null;
            baseDistanceRef.current = null;
            baseScaleRef.current = null;

            const { x: axX, y: axY } = readStick(rightGamepadRef.current, 'right');

            const sx = Math.abs(axX) > STICK_DEADZONE ? axX : 0;
            const sy = Math.abs(axY) > STICK_DEADZONE ? axY : 0;

            if (sx !== 0 || sy !== 0) {
              // Start rotation tracking if not already rotating
              if (!isRotatingRef.current) {
                isRotatingRef.current = true;
                rotationStartRef.current = obj.rotation.clone();
                
                // Show rotate overlay
                if (rotateOverlayRef.current) {
                  const objPos = worldPos(obj);
                  const currentScale = getUniformScale(obj);
                  rotateOverlayRef.current.show(objPos, currentScale);
                }
              }

              const yawDelta   = THREE.MathUtils.clamp(sx * ROT_GAIN_RAD_PER_M * dt, -ROT_MAX_STEP, ROT_MAX_STEP);
              const pitchDelta = THREE.MathUtils.clamp(-sy * ROT_GAIN_RAD_PER_M * dt, -ROT_MAX_STEP, ROT_MAX_STEP);
              if (yawDelta)   obj.rotateOnAxis(new THREE.Vector3(0, 1, 0), yawDelta);
              if (pitchDelta) obj.rotateOnAxis(new THREE.Vector3(1, 0, 0), pitchDelta);

              // Update rotate overlay with total rotation
              if (rotateOverlayRef.current && rotationStartRef.current) {
                const totalRotation = obj.rotation.y - rotationStartRef.current.y;
                const degrees = ((totalRotation * 180 / Math.PI) % 360 + 360) % 360;
                const objPos = worldPos(obj);
                const currentScale = getUniformScale(obj);
                rotateOverlayRef.current.update(degrees, objPos, currentScale);
              }
            } else {
              // Stop rotation tracking
              if (isRotatingRef.current) {
                isRotatingRef.current = false;
                rotationStartRef.current = null;
                
                // Hide rotate overlay
                if (rotateOverlayRef.current) {
                  rotateOverlayRef.current.hide();
                }
              }
            }
          }
        }
      }

      // Render overlays
      if (scaleOverlayRef.current) {
        scaleOverlayRef.current.render(camera);
      }
      if (rotateOverlayRef.current) {
        rotateOverlayRef.current.render(camera);
      }

      renderer.render(scene, camera);
    };

    renderer.setAnimationLoop(animate);

    /* ---------- Resize ---------- */
    const onResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    /* ---------- Cleanup ---------- */
    return () => {
      window.removeEventListener('resize', onResize);
      renderer.setAnimationLoop(null);

      // remove laser from scene
      if (laserLineRef.current) {
        scene.remove(laserLineRef.current);
        (laserLineRef.current.material as THREE.Material).dispose();
        laserLineRef.current.geometry.dispose();
        laserLineRef.current = null;
      }
      if (laserDotRef.current) {
        scene.remove(laserDotRef.current);
        (laserDotRef.current.material as THREE.Material).dispose();
        (laserDotRef.current.geometry as THREE.BufferGeometry).dispose();
        laserDotRef.current = null;
      }

      // Dispose overlays
      if (scaleOverlayRef.current) {
        scaleOverlayRef.current.dispose();
        scaleOverlayRef.current = null;
      }
      if (rotateOverlayRef.current) {
        rotateOverlayRef.current.dispose();
        rotateOverlayRef.current = null;
      }
      
      // Dispose menu plane
      if (menuPlaneRef.current) {
        scene.remove(menuPlaneRef.current);
        if (menuPlaneRef.current.material instanceof THREE.Material) {
          menuPlaneRef.current.material.dispose();
        }
        menuPlaneRef.current.geometry.dispose();
        menuPlaneRef.current = null;
      }
      if (menuTextureRef.current) {
        menuTextureRef.current.dispose();
        menuTextureRef.current = null;
      }
      
      // Dispose color picker plane
      if (colorPickerPlaneRef.current) {
        scene.remove(colorPickerPlaneRef.current);
        if (colorPickerPlaneRef.current.material instanceof THREE.Material) {
          colorPickerPlaneRef.current.material.dispose();
        }
        colorPickerPlaneRef.current.geometry.dispose();
        colorPickerPlaneRef.current = null;
      }
      if (colorPickerTextureRef.current) {
        colorPickerTextureRef.current.dispose();
        colorPickerTextureRef.current = null;
      }

      loadedModelsRef.current.forEach((lm) => {
        scene.remove(lm.model);
        lm.model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
            else child.material.dispose();
          }
        });
      });
      loadedModelsRef.current = [];

      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Keep WebXR session in sync
  useEffect(() => {
    if (rendererRef.current) {
      if (xrSession) rendererRef.current.xr.setSession(xrSession);
      else rendererRef.current.xr.setSession(null);
    }
  }, [xrSession]);


  // Handle color selection
  const handleColorSelect = (color: string) => {
    if (objectRef.current) {
      // Apply color to all meshes in the object
      objectRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((mat) => {
                if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshBasicMaterial) {
                  mat.color.set(color);
                }
              });
            } else {
              const mat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
              if (mat.color) {
                mat.color.set(color);
              }
            }
          }
        }
      });
    }
  };

  return (
    <>
      <div ref={mountRef} style={{ width: '100%', height: '100vh', margin: 0, padding: 0 }} />
      <ColorPicker
        isOpen={colorPickerOpen}
        x={colorPickerPos.x}
        y={colorPickerPos.y}
        onSelect={handleColorSelect}
        onClose={() => setColorPickerOpen(false)}
      />
    </>
  );
};

export default WebXRScene;
