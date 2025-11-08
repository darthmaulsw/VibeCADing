import * as THREE from 'three';
import { RotateOverlay } from './overlays/RotateOverlay';
import { MoveOverlay } from './overlays/MoveOverlay';
import { ScaleOverlay } from './overlays/ScaleOverlay';

export type InteractionMode = 'select' | 'move' | 'rotate' | 'scale';

export class InteractionManager {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;
  private cube: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  private mode: InteractionMode = 'select';
  private isDragging = false;
  private dragStart = new THREE.Vector3();
  private dragStartMouse = new THREE.Vector2();
  private cubeStartPos = new THREE.Vector3();
  private cubeStartRot = new THREE.Euler();
  private cubeStartScale = new THREE.Vector3();

  private rotateOverlay: RotateOverlay;
  private moveOverlay: MoveOverlay;
  private scaleOverlay: ScaleOverlay;

  private orbitEnabled = true;
  private lastMousePos = new THREE.Vector2();
  private cameraTarget = new THREE.Vector3(0, 0.5, 0);
  private cameraDistance = 3.5;
  private cameraPolar = Math.PI / 3;
  private cameraAzimuth = 0;

  public onTransformChange?: () => void;

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    cube: THREE.Mesh
  ) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.cube = cube;

    this.rotateOverlay = new RotateOverlay(scene);
    this.moveOverlay = new MoveOverlay(scene);
    this.scaleOverlay = new ScaleOverlay(scene);

    this.setupEventListeners();
  }

  private setupEventListeners() {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('wheel', this.onWheel);
    window.addEventListener('keydown', this.onKeyDown);
  }

  private onMouseDown = (e: MouseEvent) => {
    this.updateMouse(e);

    if (e.button === 2) {
      this.orbitEnabled = true;
      this.lastMousePos.set(e.clientX, e.clientY);
      e.preventDefault();
      return;
    }

    if (e.button === 1) {
      e.preventDefault();
      return;
    }

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.cube);

    if (intersects.length > 0) {
      if (this.mode === 'select') {
        this.mode = 'move';
      }

      this.isDragging = true;
      this.dragStart.copy(intersects[0].point);
      this.dragStartMouse.copy(this.mouse);
      this.cubeStartPos.copy(this.cube.position);
      this.cubeStartRot.copy(this.cube.rotation);
      this.cubeStartScale.copy(this.cube.scale);

      if (this.mode === 'rotate') {
        this.rotateOverlay.show(this.cube.position);
      } else if (this.mode === 'move') {
        this.moveOverlay.show(this.cubeStartPos);
      } else if (this.mode === 'scale') {
        this.scaleOverlay.show(this.cube.position, 1);
      }
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    if (e.buttons === 2 && this.orbitEnabled) {
      const deltaX = e.clientX - this.lastMousePos.x;
      const deltaY = e.clientY - this.lastMousePos.y;

      this.cameraAzimuth -= deltaX * 0.005;
      this.cameraPolar = Math.max(0.1, Math.min(Math.PI - 0.1, this.cameraPolar + deltaY * 0.005));

      this.updateCameraPosition();
      this.lastMousePos.set(e.clientX, e.clientY);
      return;
    }

    if (!this.isDragging) return;

    this.updateMouse(e);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    if (this.mode === 'move') {
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);
      const intersection = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(plane, intersection);

      if (intersection) {
        this.cube.position.copy(intersection);
        this.cube.position.y = 0.5;
        this.moveOverlay.update(this.cubeStartPos, this.cube.position);
        this.onTransformChange?.();
      }
    } else if (this.mode === 'rotate') {
      const deltaX = this.mouse.x - this.dragStartMouse.x;
      const angle = deltaX * Math.PI * 2;
      this.cube.rotation.y = this.cubeStartRot.y + angle;

      const degrees = ((angle * 180 / Math.PI) % 360 + 360) % 360;
      this.rotateOverlay.update(degrees);
      this.onTransformChange?.();
    } else if (this.mode === 'scale') {
      const deltaY = (e.clientY / window.innerHeight) * 2 - 1;
      const scaleFactor = Math.max(0.1, 1 - deltaY);
      this.cube.scale.setScalar(scaleFactor);
      this.scaleOverlay.update(this.cube.position, scaleFactor);
      this.onTransformChange?.();
    }
  };

  private onMouseUp = () => {
    if (this.isDragging) {
      this.isDragging = false;

      if (this.mode === 'rotate') {
        this.rotateOverlay.hide();
      } else if (this.mode === 'move') {
        this.moveOverlay.hide();
      } else if (this.mode === 'scale') {
        this.scaleOverlay.hide();
      }
    }
    this.orbitEnabled = false;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.cameraDistance = Math.max(1, Math.min(10, this.cameraDistance + e.deltaY * 0.01));
    this.updateCameraPosition();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (key === 'r') {
      this.mode = 'rotate';
    } else if (key === 's' && e.key !== 'S') {
      this.mode = 'scale';
    } else if (key === 'escape') {
      this.mode = 'select';
    }
  };

  private updateMouse(e: MouseEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private updateCameraPosition() {
    const x = this.cameraDistance * Math.sin(this.cameraPolar) * Math.cos(this.cameraAzimuth);
    const y = this.cameraDistance * Math.cos(this.cameraPolar);
    const z = this.cameraDistance * Math.sin(this.cameraPolar) * Math.sin(this.cameraAzimuth);

    this.camera.position.set(
      this.cameraTarget.x + x,
      this.cameraTarget.y + y,
      this.cameraTarget.z + z
    );
    this.camera.lookAt(this.cameraTarget);
  }

  public setMode(mode: InteractionMode) {
    this.mode = mode;
  }

  public getMode(): InteractionMode {
    return this.mode;
  }

  public getCubeTransform() {
    return {
      position: this.cube.position.toArray() as [number, number, number],
      rotation: [this.cube.rotation.x, this.cube.rotation.y, this.cube.rotation.z] as [number, number, number],
      scale: this.cube.scale.toArray() as [number, number, number],
    };
  }

  public setCubeTransform(
    position?: [number, number, number],
    rotation?: [number, number, number],
    scale?: [number, number, number]
  ) {
    if (position) this.cube.position.set(...position);
    if (rotation) this.cube.rotation.set(...rotation);
    if (scale) this.cube.scale.set(...scale);
  }

  public setCubeColor(color: string) {
    if (this.cube.material && 'color' in this.cube.material) {
      (this.cube.material as THREE.MeshStandardMaterial).color.set(color);
    }
  }

  public update() {
    this.rotateOverlay.render(this.camera);
    this.moveOverlay.render(this.camera);
    this.scaleOverlay.render(this.camera);
  }

  public dispose() {
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('mousedown', this.onMouseDown);
    canvas.removeEventListener('mousemove', this.onMouseMove);
    canvas.removeEventListener('mouseup', this.onMouseUp);
    canvas.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);

    this.rotateOverlay.dispose();
    this.moveOverlay.dispose();
    this.scaleOverlay.dispose();
  }
}
