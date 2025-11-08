import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadModel, type LoadedModel } from './utils/modelLoader';
import { ScaleOverlay } from '../three/overlays/ScaleOverlay';
import { RotateOverlay } from '../three/overlays/RotateOverlay';
import { RadialMenu } from './editor/RadialMenu';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorPickerPos, setColorPickerPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const menuOpenRef = useRef(false);
  
  // --- 3D Menu in AR ---
  const menuPlaneRef = useRef<THREE.Mesh | null>(null);
  const menuCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const menuTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const menuSelectedIndexRef = useRef<number | null>(null);

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
    const items = ['Select', 'Move', 'Rotate', 'Scale', 'Color', 'Subdivide', 'Material', 'Export'];
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

  // "Grab" = trigger (0) OR grip/squeeze (1)
  const isGrabPressed = (gp?: Gamepad) => !!(gp && (gp.buttons?.[0]?.pressed || gp.buttons?.[1]?.pressed));
  // Right B button (xr-standard puts X/A on 4, Y/B on 5). We only treat B on right.
  const isBPressedRight = (gp?: Gamepad) => !!(gp && gp.buttons?.[5]?.pressed);
  // Left Y button (button 5 on left controller)
  const isYPressedLeft = (gp?: Gamepad) => !!(gp && gp.buttons?.[5]?.pressed);

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
      let leftStickClick = false;
      let prevLeftStickClick = false;

      controllersStateRef.current.forEach((cs) => {
        const gp = cs.gamepad;
        if (!gp) return;

        if (cs.prevButtons.length !== gp.buttons.length) {
          cs.prevButtons = new Array(gp.buttons.length).fill(false);
        }

        const grab = isGrabPressed(gp);
        if (cs.handedness === 'left') {
          leftGrab = grab;
          leftGamepadRef.current = gp; // refresh ref per frame
          const yPressed = isYPressedLeft(gp);
          leftY = yPressed || leftY;
          prevLeftY = cs.prevButtons[5] || prevLeftY;
          
          // Check joystick click - try multiple button indices
          // Quest controllers: button 11 might be stick click, button 0 is trigger
          let stickClick = false;
          if (gp.buttons) {
            if (gp.buttons[11]?.pressed) {
              stickClick = true;
            } else if (gp.buttons[0]?.pressed && !grab) {
              // Use trigger as stick click if not grabbing
              stickClick = true;
            }
          }
          leftStickClick = stickClick || leftStickClick;
          prevLeftStickClick = (cs.prevButtons[11] || cs.prevButtons[0]) || prevLeftStickClick;
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

      // Handle left Y button press to toggle radial menu
      if (leftY && !prevLeftY && leftCtrlRef.current && cameraRef.current) {
        // Toggle menu
        const newMenuOpen = !menuOpenRef.current;
        menuOpenRef.current = newMenuOpen;
        setMenuOpen(newMenuOpen);
        
        if (newMenuOpen) {
          // Position 3D menu in front of controller
          if (menuPlaneRef.current && leftCtrlRef.current && menuCanvasRef.current && menuTextureRef.current) {
            const ctrlPos = worldPos(leftCtrlRef.current);
            const ctrlDir = worldDir(leftCtrlRef.current);
            const menuDistance = 0.4; // 40cm in front of controller
            
            menuPlaneRef.current.position.copy(ctrlPos);
            menuPlaneRef.current.position.add(ctrlDir.multiplyScalar(menuDistance));
            
            // Make menu face camera
            menuPlaneRef.current.lookAt(cameraRef.current.position);
            menuPlaneRef.current.visible = true;
            
            // Reset selection when opening menu
            menuSelectedIndexRef.current = null;
            
            // Render menu to canvas and update texture
            renderMenuToCanvas(menuCanvasRef.current, true, null);
            menuTextureRef.current.needsUpdate = true;
          }
          
          // Project controller position to screen coordinates (for 2D fallback)
          const ctrlPos = worldPos(leftCtrlRef.current);
          const vector = new THREE.Vector3();
          vector.copy(ctrlPos);
          vector.project(cameraRef.current);
          
          const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
          const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;
          setMenuPos({ x, y });
        } else {
          // Hide 3D menu
          if (menuPlaneRef.current) {
            menuPlaneRef.current.visible = false;
          }
          // Close color picker if menu closes
          setColorPickerOpen(false);
        }
      }
      
      // Handle menu navigation with left joystick
      if (menuOpenRef.current && leftGamepadRef.current && menuCanvasRef.current && menuTextureRef.current) {
        const gp = leftGamepadRef.current;
        const items = ['Select', 'Move', 'Rotate', 'Scale', 'Color', 'Subdivide', 'Material', 'Export'];
        
        // Get joystick input - try different axis indices (Quest controllers use 2 and 3 for left stick)
        // axes 0,1 might be thumbstick, axes 2,3 might be touchpad or different mapping
        let stickX = 0;
        let stickY = 0;
        
        // Try axes 2 and 3 first (common for Quest controllers)
        if (gp.axes && gp.axes.length > 3) {
          stickX = gp.axes[2] ?? 0;
          stickY = gp.axes[3] ?? 0;
        }
        // Fallback to axes 0 and 1
        if (Math.abs(stickX) < 0.1 && Math.abs(stickY) < 0.1 && gp.axes && gp.axes.length > 1) {
          stickX = gp.axes[0] ?? 0;
          stickY = gp.axes[1] ?? 0;
        }
        
        const stickDeadzone = 0.2; // Lower deadzone for better sensitivity
        
        // Calculate angle from joystick input
        if (Math.abs(stickX) > stickDeadzone || Math.abs(stickY) > stickDeadzone) {
          // Calculate angle from joystick
          // Joystick coordinates: right=+X, up=-Y (inverted Y in gamepad API)
          // We need to account for the coordinate system difference
          const angle = Math.atan2(stickY, stickX); // Standard atan2
          // Rotate by 180 degrees to fix the inversion
          const rotatedAngle = (angle + Math.PI) % (Math.PI * 2);
          const normalizedAngle = (rotatedAngle + Math.PI * 2) % (Math.PI * 2);
          
          // Convert angle to menu item index (menu starts at -90 degrees / top)
          // Menu items are arranged clockwise starting from top (index 0 = Select at top)
          const menuStartAngle = -Math.PI / 2; // Top position
          let itemAngle = (normalizedAngle - menuStartAngle + Math.PI * 2) % (Math.PI * 2);
          const segmentAngle = (2 * Math.PI) / items.length;
          let selectedIndex = Math.floor(itemAngle / segmentAngle);
          
          // Clamp to valid range
          if (selectedIndex >= items.length) selectedIndex = items.length - 1;
          if (selectedIndex < 0) selectedIndex = 0;
          
          if (menuSelectedIndexRef.current !== selectedIndex) {
            menuSelectedIndexRef.current = selectedIndex;
            renderMenuToCanvas(menuCanvasRef.current, true, selectedIndex);
            menuTextureRef.current.needsUpdate = true;
          }
        } else {
          // If joystick is in deadzone but we have a selection, keep it visible
          if (menuSelectedIndexRef.current !== null) {
            renderMenuToCanvas(menuCanvasRef.current, true, menuSelectedIndexRef.current);
            menuTextureRef.current.needsUpdate = true;
          }
        }
        
        // Handle joystick click to select - try multiple button indices
        // Quest controllers: button 11 might be stick click, but could also be 0 (trigger) or others
        let stickClickDetected = false;
        if (gp.buttons) {
          // Try button 11 (common stick click index)
          if (gp.buttons[11]?.pressed) stickClickDetected = true;
          // Also try button 0 (trigger) as fallback
          else if (gp.buttons[0]?.pressed && !leftGrab) stickClickDetected = true;
        }
        
        if (stickClickDetected && !prevLeftStickClick && menuSelectedIndexRef.current !== null) {
          const selectedItem = items[menuSelectedIndexRef.current];
          // Close menu and handle selection
          menuOpenRef.current = false;
          setMenuOpen(false);
          if (menuPlaneRef.current) {
            menuPlaneRef.current.visible = false;
          }
          
          // Handle menu selection
          if (selectedItem === 'Color') {
            setColorPickerOpen(true);
            setColorPickerPos(menuPos);
          } else {
            // Handle other menu items if needed
            setColorPickerOpen(false);
          }
        }
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
        if (menuCanvasRef.current && menuTextureRef.current) {
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

            const gp = rightGamepadRef.current;
            const axX = gp?.axes?.[2] ?? 0; // yaw
            const axY = gp?.axes?.[3] ?? 0; // pitch

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

  // Handle menu selection
  const handleMenuSelect = (item: string) => {
    if (item === 'Color') {
      menuOpenRef.current = false;
      setMenuOpen(false);
      setColorPickerOpen(true);
      // Position color picker at menu position
      setColorPickerPos(menuPos);
      return;
    }
    // Handle other menu items if needed
    menuOpenRef.current = false;
    setMenuOpen(false);
  };

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
      <RadialMenu isOpen={menuOpen} x={menuPos.x} y={menuPos.y} onSelect={handleMenuSelect} />
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
