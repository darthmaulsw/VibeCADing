import * as THREE from 'three';
import { InteractionManager } from './interactions';

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
    },
    interactionManager,
  };
}
