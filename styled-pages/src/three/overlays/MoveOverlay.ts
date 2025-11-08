import * as THREE from 'three';

export class MoveOverlay {
  private scene: THREE.Scene;
  private group = new THREE.Group();
  private isVisible = false;

  private line: THREE.Line;
  private arrow: THREE.Mesh;
  private label: HTMLDivElement;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group.visible = false;
    scene.add(this.group);

    const lineGeometry = new THREE.BufferGeometry();
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x00D4FF,
      linewidth: 2,
      transparent: true,
      opacity: 0.8,
    });
    this.line = new THREE.Line(lineGeometry, lineMaterial);
    this.group.add(this.line);

    const arrowGeometry = new THREE.ConeGeometry(0.08, 0.2, 8);
    const arrowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00D4FF,
      transparent: true,
      opacity: 0.8,
    });
    this.arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    this.group.add(this.arrow);

    this.label = this.createLabel();
  }

  private createLabel(): HTMLDivElement {
    const label = document.createElement('div');
    label.style.position = 'absolute';
    label.style.fontFamily = 'Space Mono, monospace';
    label.style.fontSize = '14px';
    label.style.color = '#00D4FF';
    label.style.pointerEvents = 'none';
    label.style.display = 'none';
    label.style.background = '#000';
    label.style.padding = '4px 10px';
    label.style.border = '1px solid rgba(0, 212, 255, 0.4)';
    document.body.appendChild(label);
    return label;
  }

  public show(start: THREE.Vector3) {
    this.isVisible = true;
    this.group.visible = true;
    this.label.style.display = 'block';
  }

  public hide() {
    this.isVisible = false;
    setTimeout(() => {
      this.group.visible = false;
      this.label.style.display = 'none';
    }, 700);
  }

  public update(start: THREE.Vector3, end: THREE.Vector3) {
    if (!this.isVisible) return;

    const points = [start.clone(), end.clone()];
    this.line.geometry.dispose();
    this.line.geometry = new THREE.BufferGeometry().setFromPoints(points);

    const direction = new THREE.Vector3().subVectors(end, start);
    const distance = direction.length();

    if (distance > 0.01) {
      direction.normalize();
      this.arrow.position.copy(end);
      this.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      this.arrow.visible = true;
    } else {
      this.arrow.visible = false;
    }

    this.label.textContent = `${distance.toFixed(2)} units`;
  }

  public render(camera: THREE.Camera) {
    if (!this.isVisible || !this.arrow.visible) return;

    this.arrow.rotation.y += 0.03;

    const vector = new THREE.Vector3();
    vector.copy(this.arrow.position);
    vector.project(camera);

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

    this.label.style.left = `${x + 20}px`;
    this.label.style.top = `${y}px`;
  }

  public dispose() {
    this.line.geometry.dispose();
    (this.line.material as THREE.Material).dispose();
    this.arrow.geometry.dispose();
    (this.arrow.material as THREE.Material).dispose();
    this.scene.remove(this.group);
    document.body.removeChild(this.label);
  }
}
