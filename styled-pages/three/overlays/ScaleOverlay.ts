import * as THREE from 'three';

export class ScaleOverlay {
  private scene: THREE.Scene;
  private group = new THREE.Group();
  private isVisible = false;

  private brackets: THREE.Line[] = [];
  private label: HTMLDivElement;
  private baseSize = 1.0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group.visible = false;
    scene.add(this.group);

    this.createBrackets();
    this.label = this.createLabel();
  }

  private createBrackets() {
    const positions = [
      { x: 1, z: 1 },
      { x: -1, z: 1 },
      { x: -1, z: -1 },
      { x: 1, z: -1 },
    ];

    positions.forEach((pos) => {
      const points = [
        new THREE.Vector3(pos.x * 0.5, 0, pos.z * 0.4),
        new THREE.Vector3(pos.x * 0.5, 0, pos.z * 0.5),
        new THREE.Vector3(pos.x * 0.4, 0, pos.z * 0.5),
      ];

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x82D1FF,
        linewidth: 2,
        transparent: true,
        opacity: 0.8,
      });

      const bracket = new THREE.Line(geometry, material);
      this.brackets.push(bracket);
      this.group.add(bracket);
    });
  }

  private createLabel(): HTMLDivElement {
    const label = document.createElement('div');
    label.style.position = 'absolute';
    label.style.fontFamily = 'JetBrains Mono, monospace';
    label.style.fontSize = '15px';
    label.style.color = '#82D1FF';
    label.style.pointerEvents = 'none';
    label.style.display = 'none';
    label.style.background = 'rgba(14, 18, 36, 0.9)';
    label.style.padding = '5px 11px';
    label.style.borderRadius = '6px';
    label.style.border = '1px solid rgba(130, 209, 255, 0.4)';
    document.body.appendChild(label);
    return label;
  }

  public show(position: THREE.Vector3, scale: number) {
    this.isVisible = true;
    this.group.visible = true;
    this.group.position.copy(position);
    this.label.style.display = 'block';
    this.baseSize = scale;
  }

  public hide() {
    this.isVisible = false;
    setTimeout(() => {
      this.group.visible = false;
      this.label.style.display = 'none';
    }, 800);
  }

  public update(position: THREE.Vector3, scale: number) {
    if (!this.isVisible) return;

    this.group.position.copy(position);
    this.group.scale.setScalar(scale);

    const percent = (scale / this.baseSize) * 100;
    this.label.textContent = `${percent.toFixed(0)}%`;
  }

  public render(camera: THREE.Camera) {
    if (!this.isVisible) return;

    this.group.rotation.y += 0.02;

    const vector = new THREE.Vector3();
    vector.copy(this.group.position);
    vector.y += 1.0;
    vector.project(camera);

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

    this.label.style.left = `${x}px`;
    this.label.style.top = `${y}px`;
    this.label.style.transform = 'translate(-50%, -50%)';
  }

  public dispose() {
    this.brackets.forEach((bracket) => {
      bracket.geometry.dispose();
      (bracket.material as THREE.Material).dispose();
    });
    this.scene.remove(this.group);
    document.body.removeChild(this.label);
  }
}
