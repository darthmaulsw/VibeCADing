import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadModel, type LoadedModel } from '../utils/modelLoader';

interface WebXRSceneProps {
  xrSession?: XRSession | null;
}

/* =========================
   Tunables / Constants
   ========================= */
const START_MAX_SIZE_M = 1.0;   // model’s largest dimension after import
const SCALE_MIN = 0.05;
const SCALE_MAX = 10;

const MIN_HAND_DISTANCE = 0.05; // 5 cm floor when measuring hand distance
const ARM_DELTA = 0.05;         // move ≥ 5 cm from initial join to arm
const DEADZONE_METERS = 0.015;  // ignore tiny jitter

// Absolute object size bounds (largest dimension), meters
const ABS_MIN_SIZE = 0.5;      // 10 cm
const ABS_MAX_SIZE = 25.00;      // 5 m

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

/** Wrap child in a container, recenter to origin, and scale container so largest dimension == targetMaxSizeMeters. */
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
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controllerModelFactoryRef = useRef<XRControllerModelFactory | null>(null);
  const loadedModelsRef = useRef<LoadedModel[]>([]);

  // We always scale this fitted container (never the rig/camera)
  const scalableObjectRef = useRef<THREE.Object3D | null>(null);
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
  const leftControllerObjRef = useRef<THREE.Object3D | null>(null);
  const rightControllerObjRef = useRef<THREE.Object3D | null>(null);

  // Two-hand scaling state machine
  type ScaleState = 'idle' | 'pending' | 'active';
  const scaleStateRef = useRef<ScaleState>('idle');
  const pendingDistanceRef = useRef<number | null>(null); // distance when both grabs first detected
  const baseDistanceRef = useRef<number | null>(null);     // fixed baseline used in active
  const baseScaleRef = useRef<number | null>(null);        // compensated baseline scale (no jump)

  const setUniformScale = (obj: THREE.Object3D, s: number) => {
    obj.scale.setScalar(Math.max(SCALE_MIN, Math.min(SCALE_MAX, s)));
  };
  const getUniformScale = (obj: THREE.Object3D) => obj.scale.x;

  // "Grab" = trigger (0) OR grip/squeeze (1)
  const isGrabPressed = (gp?: Gamepad) => !!(gp && (gp.buttons?.[0]?.pressed || gp.buttons?.[1]?.pressed));
  const worldPos = (obj: THREE.Object3D) => new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene & camera
    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    renderer.xr.enabled = true;
    rendererRef.current = renderer;
    containerRef.current.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 0.5);
    dir.position.set(0, 10, 0);
    scene.add(dir);

    // Optional reference point
    const refPoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfcba03 })
    );
    refPoint.position.set(0, 1.6, -2);
    scene.add(refPoint);

    // Load model (normalize to meters, fit to size, put in front)
    const loadModelMeters = async () => {
      try {
        const url = new URL('../assets/objects/generated-model.stl', import.meta.url);
        const loaded = await loadModel(url.href);

        // STL likely in mm → convert to meters
        convertUnitsToMeters(loaded.model, 'millimeters');

        const containerNode = centerAndFitToMax(loaded.model, START_MAX_SIZE_M);
        containerNode.position.set(0, 1.6, -1.5);
        containerNode.traverse((c: any) => (c.visible = true));
        scene.add(containerNode);

        scalableObjectRef.current = containerNode;
        loadedModelsRef.current.push(loaded);

        // cache initial max dimension
        const bbox = new THREE.Box3().setFromObject(containerNode);
        const size = bbox.getSize(new THREE.Vector3());
        initialMaxDimRef.current = Math.max(size.x, size.y, size.z);
      } catch (e) {
        console.error('Model load failed, using cube', e);
        const cube = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.2, 0.2),
          new THREE.MeshStandardMaterial({ color: 0xff0000 })
        );
        const containerNode = centerAndFitToMax(cube, START_MAX_SIZE_M);
        containerNode.position.set(0, 1.6, -1.5);
        scene.add(containerNode);
        scalableObjectRef.current = containerNode;

        const bbox = new THREE.Box3().setFromObject(containerNode);
        const size = bbox.getSize(new THREE.Vector3());
        initialMaxDimRef.current = Math.max(size.x, size.y, size.z);
      }
    };
    loadModelMeters();

    // Controller visuals
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

        if (state.handedness === 'left') leftControllerObjRef.current = c;
        if (state.handedness === 'right') rightControllerObjRef.current = c;
      });

      c.addEventListener('disconnected', () => {
        if (state.handedness === 'left') leftControllerObjRef.current = null;
        if (state.handedness === 'right') rightControllerObjRef.current = null;
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

    // Animation loop — two-hand scaling with pending→active arming (baseline compensation)
    const animate = () => {
      // Which hands are grabbing?
      let leftGrab = false;
      let rightGrab = false;

      controllersStateRef.current.forEach((cs) => {
        const gp = cs.gamepad;
        if (!gp) return;

        if (cs.prevButtons.length !== gp.buttons.length) {
          cs.prevButtons = new Array(gp.buttons.length).fill(false);
        }

        const grab = isGrabPressed(gp);
        if (cs.handedness === 'left') leftGrab = grab;
        if (cs.handedness === 'right') rightGrab = grab;

        for (let i = 0; i < gp.buttons.length; i++) {
          cs.prevButtons[i] = !!gp.buttons[i]?.pressed;
        }
      });

      const obj = scalableObjectRef.current;
      const left = leftControllerObjRef.current;
      const right = rightControllerObjRef.current;

      if (obj && left && right) {
        if (leftGrab && rightGrab) {
          const d = Math.max(
            worldPos(left).distanceTo(worldPos(right)),
            MIN_HAND_DISTANCE
          );

          if (scaleStateRef.current === 'idle') {
            // Enter pending: record initial join distance (no scaling yet)
            scaleStateRef.current = 'pending';
            pendingDistanceRef.current = d;
          } else if (scaleStateRef.current === 'pending') {
            const join = pendingDistanceRef.current ?? d;
            if (Math.abs(d - join) >= ARM_DELTA) {
              // We arm using the ORIGINAL join distance as our true baseline
              // but compensate baseScale so there is NO jump at this frame:
              // desired = baseScale * (d / baseDist) == currentScale  => baseScale = currentScale * (baseDist / d)
              baseDistanceRef.current = join;
              const currentScale = getUniformScale(obj);
              baseScaleRef.current = currentScale * (join / d);

              scaleStateRef.current = 'active';
            }
          } else if (scaleStateRef.current === 'active') {
            const baseDist = baseDistanceRef.current!;
            const baseScale = baseScaleRef.current!;
            const delta = d - baseDist;

            if (Math.abs(delta) > DEADZONE_METERS) {
              let desired = baseScale * (d / baseDist); // ratio: farther => bigger, closer => smaller

              // Absolute physical-size clamp
              const initMax = Math.max(initialMaxDimRef.current, 1e-6);
              const absMinScale = ABS_MIN_SIZE / initMax;
              const absMaxScale = ABS_MAX_SIZE / initMax;
              desired = Math.min(absMaxScale, Math.max(absMinScale, desired));

              setUniformScale(obj, desired);
            }
          }
        } else {
          // Any hand released → reset to idle
          scaleStateRef.current = 'idle';
          pendingDistanceRef.current = null;
          baseDistanceRef.current = null;
          baseScaleRef.current = null;
        }
      }

      renderer.render(scene, camera);
    };

    renderer.setAnimationLoop(animate);

    // Resize
    const onResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', onResize);
      renderer.setAnimationLoop(null);

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

      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
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

  return <div ref={containerRef} style={{ width: '100%', height: '100vh', margin: 0, padding: 0 }} />;
};

export default WebXRScene;
