import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadModel, type LoadedModel } from './utils/modelLoader';

interface WebXRSceneProps {
  xrSession?: XRSession | null;
}

/* =========================
   Tunables / Constants
   ========================= */
const START_MAX_SIZE_M = 1.0;   // largest dimension after import
const SCALE_MIN = 0.05;
const SCALE_MAX = 10;

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

  // "Grab" = trigger (0) OR grip/squeeze (1)
  const isGrabPressed = (gp?: Gamepad) => !!(gp && (gp.buttons?.[0]?.pressed || gp.buttons?.[1]?.pressed));
  // Right B button (xr-standard puts X/A on 4, Y/B on 5). We only treat B on right.
  const isBPressedRight = (gp?: Gamepad) => !!(gp && gp.buttons?.[5]?.pressed);

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

        if (state.handedness === 'left') leftCtrlRef.current = c;
        if (state.handedness === 'right') {
          rightCtrlRef.current = c;
          rightGamepadRef.current = state.gamepad ?? null;
        }
      });

      c.addEventListener('disconnected', () => {
        if (state.handedness === 'left') leftCtrlRef.current = null;
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

      // Poll controllers: determine grabs, right B, keep right gamepad fresh
      let leftGrab = false;
      let rightGrab = false;
      let rightB = false;
      let prevRightB = false;

      controllersStateRef.current.forEach((cs) => {
        const gp = cs.gamepad;
        if (!gp) return;

        if (cs.prevButtons.length !== gp.buttons.length) {
          cs.prevButtons = new Array(gp.buttons.length).fill(false);
        }

        const grab = isGrabPressed(gp);
        if (cs.handedness === 'left') {
          leftGrab = grab;
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

          // When dragging, disable scaling state
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
              }
            }
          }
          /* ===== 3) RIGHT-STICK ROTATION (only when not dragging & not scaling) ===== */
          else {
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
              const yawDelta   = THREE.MathUtils.clamp(sx * ROT_GAIN_RAD_PER_M * dt, -ROT_MAX_STEP, ROT_MAX_STEP);
              const pitchDelta = THREE.MathUtils.clamp(-sy * ROT_GAIN_RAD_PER_M * dt, -ROT_MAX_STEP, ROT_MAX_STEP);
              if (yawDelta)   obj.rotateOnAxis(new THREE.Vector3(0, 1, 0), yawDelta);
              if (pitchDelta) obj.rotateOnAxis(new THREE.Vector3(1, 0, 0), pitchDelta);
            }
          }
        }
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

  return <div ref={mountRef} style={{ width: '100%', height: '100vh', margin: 0, padding: 0 }} />;
};

export default WebXRScene;
