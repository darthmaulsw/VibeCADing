import * as THREE from 'three';
import { InteractionManager } from './interactions';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export function setupScene(container: HTMLElement) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 1.6, 3.2);
  camera.lookAt(0, 0.5, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7);
  scene.add(directionalLight);

  const gridHelper = new THREE.GridHelper(20, 40, 0x00D4FF, 0x00D4FF);
  (gridHelper.material as THREE.Material).transparent = true;
  (gridHelper.material as THREE.Material).opacity = 0.1;
  scene.add(gridHelper);

  const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cubeMaterial = new THREE.MeshStandardMaterial({
    color: 0x00D4FF,
    roughness: 0.8,
    metalness: 0.0,
  });
  const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  cube.position.set(0, 0.5, 0);
  cube.name = 'mockCube';
  scene.add(cube);

  const interactionManager = new InteractionManager(scene, camera, renderer, cube);

  // GLB loader support
  const loader = new GLTFLoader();
  let currentModel: THREE.Object3D | null = null;

  function clearCurrentModel() {
    if (!currentModel) return;
    scene.remove(currentModel);
    currentModel.traverse((obj: THREE.Object3D) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (material) {
          if (Array.isArray(material)) material.forEach((mat) => mat.dispose());
          else material.dispose();
        }
      }
    });
    currentModel = null;
  }

  async function loadModelFromUrl(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          const mock = scene.getObjectByName('mockCube');
          if (mock) scene.remove(mock);

          clearCurrentModel();

          const root = gltf.scene || gltf.scenes?.[0];
          if (!root) {
            reject(new Error('No scene in GLTF'));
            return;
          }

          const box = new THREE.Box3().setFromObject(root);
          const size = new THREE.Vector3();
          box.getSize(size);
          const center = new THREE.Vector3();
          box.getCenter(center);

          root.position.x += -center.x;
          root.position.y += -center.y;
          root.position.z += -center.z;

          const maxAxis = Math.max(size.x, size.y, size.z) || 1;
          const targetSize = 1.5;
          const scale = targetSize / maxAxis;
          root.scale.setScalar(scale);
          root.position.y = 0.75;

          root.traverse((obj: THREE.Object3D) => {
            obj.castShadow = true;
            (obj as THREE.Mesh).receiveShadow = true;
          });

          currentModel = root;
          scene.add(root);
          resolve();
        },
        undefined,
        (err) => reject(err)
      );
    });
  }

  const handleResize = () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  window.addEventListener('resize', handleResize);

  let animationId: number;
  function animate() {
    animationId = requestAnimationFrame(animate);
    interactionManager.update();
    renderer.render(scene, camera);
  }
  animate();

  return {
    cleanup: () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      interactionManager.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      clearCurrentModel();
    },
    interactionManager,
    loadModelFromUrl,
  };
}
