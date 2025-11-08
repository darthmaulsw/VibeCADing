import * as THREE from 'three';

export class RotateOverlay {
  private scene: THREE.Scene;
  private group = new THREE.Group();
  private isVisible = false;
  private ringRadius = 0.3; // Reduced by 75% (was 1.2, now 0.3)
  private spinSpeed = 0.015;
  private baseScale = 1.0;

  private ring: THREE.Line;
  private ticks: THREE.Line[] = [];
  private sweepArc: THREE.Line;
  private label: HTMLDivElement;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group.visible = false;
    scene.add(this.group);

    this.ring = this.createRing();
    this.group.add(this.ring);

    this.createTicks();

    this.sweepArc = this.createSweepArc();
    this.group.add(this.sweepArc);

    this.label = this.createLabel();
  }

  private createRing(): THREE.Line {
    const points: THREE.Vector3[] = [];
    const segments = 120;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * this.ringRadius,
          0,
          Math.sin(angle) * this.ringRadius
        )
      );
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x00D4FF,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.6,
    });

    return new THREE.Line(geometry, material);
  }

  private createTicks() {
    for (let i = 0; i < 72; i++) {
      const angle = (i / 72) * Math.PI * 2;
      const isLongTick = i % 3 === 0;
      const innerRadius = this.ringRadius * 0.95;
      const outerRadius = isLongTick ? this.ringRadius * 1.08 : this.ringRadius * 1.04;

      const points = [
        new THREE.Vector3(Math.cos(angle) * innerRadius, 0, Math.sin(angle) * innerRadius),
        new THREE.Vector3(Math.cos(angle) * outerRadius, 0, Math.sin(angle) * outerRadius),
      ];

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x00D4FF,
        linewidth: 1.5,
        transparent: true,
        opacity: isLongTick ? 0.8 : 0.4,
      });

      const tick = new THREE.Line(geometry, material);
      this.ticks.push(tick);
      this.group.add(tick);
    }
  }

  private createSweepArc(): THREE.Line {
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({
      color: 0x00D4FF,
      linewidth: 2.5,
      transparent: true,
      opacity: 0.7,
    });

    return new THREE.Line(geometry, material);
  }

  private createLabel(): HTMLDivElement {
    const label = document.createElement('div');
    label.style.position = 'absolute';
    label.style.fontFamily = 'Space Mono, monospace';
    label.style.fontSize = '16px';
    label.style.color = '#00D4FF';
    label.style.pointerEvents = 'none';
    label.style.display = 'none';
    label.style.background = '#000';
    label.style.padding = '6px 12px';
    label.style.border = '1px solid rgba(0, 212, 255, 0.4)';
    document.body.appendChild(label);
    return label;
  }

  public show(position: THREE.Vector3, scale: number = 1.0) {
    this.isVisible = true;
    this.group.visible = true;
    this.group.position.copy(position);
    this.baseScale = scale;
    this.group.scale.setScalar(scale);
    this.label.style.display = 'block';
  }

  public hide() {
    this.isVisible = false;
    setTimeout(() => {
      this.group.visible = false;
      this.label.style.display = 'none';
    }, 900);
  }

  public update(degrees: number, position?: THREE.Vector3, scale?: number) {
    if (!this.isVisible) return;

    if (position) {
      this.group.position.copy(position);
    }
    if (scale !== undefined) {
      this.group.scale.setScalar(scale);
    }

    const points: THREE.Vector3[] = [];
    const segments = 60;
    const endAngle = (degrees * Math.PI) / 180;

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * endAngle;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * this.ringRadius,
          0,
          Math.sin(angle) * this.ringRadius
        )
      );
    }

    this.sweepArc.geometry.dispose();
    this.sweepArc.geometry = new THREE.BufferGeometry().setFromPoints(points);

    this.label.textContent = `${degrees.toFixed(1)}°`;
  }

  public render(camera: THREE.Camera) {
    if (!this.isVisible) return;

    this.group.rotation.y += this.spinSpeed;

    const vector = new THREE.Vector3();
    vector.copy(this.group.position);
    vector.y += this.ringRadius * 1.5;
    vector.project(camera);

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

    this.label.style.left = `${x}px`;
    this.label.style.top = `${y}px`;
    this.label.style.transform = 'translate(-50%, -50%)';
  }

  public dispose() {
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    this.ticks.forEach((tick) => {
      tick.geometry.dispose();
      (tick.material as THREE.Material).dispose();
    });
    this.sweepArc.geometry.dispose();
    (this.sweepArc.material as THREE.Material).dispose();
    this.scene.remove(this.group);
    document.body.removeChild(this.label);
  }
}
