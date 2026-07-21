import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  DirectionalLight,
  Fog,
  GridHelper,
  Group,
  HemisphereLight,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  type PerspectiveCamera,
  type Scene,
  SphereGeometry,
} from 'three';

import type { GameConfig } from '@skyring/shared';

/** Config-dependent arena shell owned entirely by the renderer. */
export class ArenaView {
  private readonly group = new Group();

  constructor(
    private readonly scene: Scene,
    private readonly camera: PerspectiveCamera,
    private readonly canvas: HTMLCanvasElement,
    config: GameConfig,
  ) {
    scene.add(this.group);
    addLights(scene);
    this.configure(config);
  }

  configure(config: GameConfig): void {
    this.camera.far = config.DOME_RADIUS * 4;
    this.camera.updateProjectionMatrix();
    this.scene.fog = new Fog(
      0x173b5f,
      config.DOME_RADIUS * 0.8,
      config.DOME_RADIUS * 2.4,
    );

    disposeRenderGroup(this.group);
    this.group.clear();
    buildArena(this.group, config);
    this.canvas.dataset.domeRadius = String(config.DOME_RADIUS);
    this.canvas.dataset.groundY = String(config.GROUND_Y);
  }

  dispose(): void {
    disposeRenderGroup(this.group);
    this.group.removeFromParent();
  }
}

function buildArena(group: Group, config: GameConfig): void {
  const ground = new Mesh(
    new BoxGeometry(config.DOME_RADIUS * 4, 1, config.DOME_RADIUS * 4),
    new MeshStandardMaterial({ color: 0x294962 }),
  );
  ground.position.y = config.GROUND_Y - 0.5;
  group.add(ground);

  const grid = new GridHelper(config.DOME_RADIUS * 2, 40, 0x2a4a6a, 0x1b3350);
  grid.position.y = config.GROUND_Y + 0.05;
  group.add(grid);

  const dome = new Mesh(
    new SphereGeometry(
      config.DOME_RADIUS,
      32,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    ),
    new MeshStandardMaterial({
      color: 0x2b5a8c,
      transparent: true,
      opacity: 0.06,
      side: BackSide,
      wireframe: true,
    }),
  );
  group.add(dome);
}

function addLights(scene: Scene): void {
  scene.add(new AmbientLight(0xb8d8f0, 1.5));
  scene.add(new HemisphereLight(0xbfe7ff, 0x31465b, 2));
  const sun = new DirectionalLight(0xffffff, 3);
  sun.position.set(1, 2, 1);
  scene.add(sun);
}

function disposeRenderGroup(group: Group): void {
  group.traverse((object) => {
    if (!(object instanceof Mesh || object instanceof LineSegments)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) material.dispose();
  });
}
