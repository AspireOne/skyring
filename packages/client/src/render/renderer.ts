import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  Color,
  ConeGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  GridHelper,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';

import type { RingStatus } from '../hud/hud-model.js';
import type { RenderView } from '../net/snapshot-buffer.js';
import type {
  GameConfig,
  GameEvent,
  PlayerSlot,
  RingState,
  Vec3,
} from '@skyring/shared';

const SLOT_COLORS: Record<PlayerSlot, number> = {
  a: 0x4cc9f0, // cyan
  b: 0xf6546a, // coral
};

/** Ring tint by contest state (GAME.md §11). */
const RING_COLORS: Record<RingStatus, number> = {
  idle: 0x8fd0ff,
  mine: 0x59f5a6,
  theirs: 0xff6b7d,
  contested: 0xffd166,
};

/** Chase-camera geometry (distance behind, height above, look-ahead). */
const CAM_BACK = 46;
const CAM_UP = 16;
const CAM_LOOK_AHEAD = 30;
const CAM_SMOOTH = 0.12;

/**
 * Owns the three.js scene and a chase camera behind the local plane. It reads a
 * {@link RenderView} and applies transforms; it holds zero game logic
 * (IMPLEMENTATION §8.3). Plane models are placeholder darts until Milestone 6.
 */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  onFirstFrame: (() => void) | undefined;

  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly renderer: WebGLRenderer;
  private readonly planes: Record<PlayerSlot, Group>;
  private readonly ring: Group;
  private readonly ringFill: Mesh;
  private readonly ringBands: Mesh;
  private readonly ringMarker: Mesh;
  private readonly bulletGeometry = new SphereGeometry(1.4, 8, 6);
  private readonly bulletMaterials: Record<PlayerSlot, MeshBasicMaterial>;
  private readonly bulletMeshes = new Map<number, Mesh>();
  private readonly effectGeometry = new SphereGeometry(1, 10, 8);
  private readonly effects: Array<{
    mesh: Mesh;
    bornAt: number;
    expiresAt: number;
  }> = [];
  private readonly camTarget = new Vector3();
  private localSlot: PlayerSlot = 'a';
  private firstFrameDone = false;
  private cameraInitialized = false;

  constructor(config: GameConfig) {
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.canvas = this.renderer.domElement;
    this.canvas.dataset.testid = 'scene-canvas';

    this.camera = new PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      0.5,
      config.DOME_RADIUS * 4,
    );

    this.scene.background = new Color(0x0a1626);
    this.scene.fog = new Fog(
      0x0a1626,
      config.DOME_RADIUS * 0.8,
      config.DOME_RADIUS * 2.4,
    );
    this.buildArena(config);

    this.planes = {
      a: this.addPlane('a'),
      b: this.addPlane('b'),
    };
    this.bulletMaterials = {
      a: new MeshBasicMaterial({ color: SLOT_COLORS.a }),
      b: new MeshBasicMaterial({ color: SLOT_COLORS.b }),
    };

    const ring = this.buildRing();
    this.ring = ring.group;
    this.ringFill = ring.fill;
    this.ringBands = ring.bands;
    this.ringMarker = ring.marker;
  }

  setLocalSlot(slot: PlayerSlot): void {
    this.localSlot = slot;
  }

  update(view: RenderView): void {
    for (const slot of ['a', 'b'] as const) {
      const group = this.planes[slot];
      const { pos, rot } = view[slot];
      group.position.set(pos[0], pos[1], pos[2]);
      group.quaternion.set(rot[0], rot[1], rot[2], rot[3]);
    }
    this.syncBullets(view);
    this.updateCamera();
  }

  handleEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      switch (event.kind) {
        case 'hit':
          this.spawnBurst(event.pos, 0xffffff, 260);
          break;
        case 'bounce':
          this.spawnBurst(event.pos, SLOT_COLORS[event.slot], 180);
          break;
        case 'ringTeleport':
        case 'stumble':
        case 'phaseChange':
          break;
      }
    }
  }

  updateRing(ring: RingState, status: RingStatus, warning: boolean): void {
    this.ring.position.set(ring.center[0], ring.center[1], ring.center[2]);
    this.ring.scale.setScalar(ring.radius);

    const color = RING_COLORS[status];
    (this.ringFill.material as MeshBasicMaterial).color.setHex(color);
    (this.ringBands.material as MeshBasicMaterial).color.setHex(color);
    // Pulse the fill opacity during the relocation warning.
    const fill = this.ringFill.material as MeshBasicMaterial;
    fill.opacity = warning
      ? 0.1 + 0.08 * (1 + Math.sin(performance.now() / 120))
      : 0.12;

    if (warning && ring.nextCenter) {
      this.ringMarker.visible = true;
      this.ringMarker.position.set(...ring.nextCenter);
      this.ringMarker.scale.setScalar(ring.radius);
    } else {
      this.ringMarker.visible = false;
    }
  }

  render(): void {
    this.updateEffects();
    this.renderer.render(this.scene, this.camera);
    if (!this.firstFrameDone) {
      this.firstFrameDone = true;
      this.onFirstFrame?.();
    }
  }

  resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose(): void {
    for (const mesh of this.bulletMeshes.values()) {
      this.scene.remove(mesh);
    }
    for (const effect of this.effects) {
      this.scene.remove(effect.mesh);
      (effect.mesh.material as MeshBasicMaterial).dispose();
    }
    this.bulletGeometry.dispose();
    this.effectGeometry.dispose();
    this.bulletMaterials.a.dispose();
    this.bulletMaterials.b.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }

  private syncBullets(view: RenderView): void {
    const live = new Set<number>();
    for (const bullet of view.bullets) {
      live.add(bullet.id);
      let mesh = this.bulletMeshes.get(bullet.id);
      if (!mesh) {
        mesh = new Mesh(
          this.bulletGeometry,
          this.bulletMaterials[bullet.owner],
        );
        this.bulletMeshes.set(bullet.id, mesh);
        this.scene.add(mesh);
        this.spawnBurst(bullet.pos, SLOT_COLORS[bullet.owner], 90);
      }
      mesh.position.set(...bullet.pos);
    }

    for (const [id, mesh] of this.bulletMeshes) {
      if (!live.has(id)) {
        this.scene.remove(mesh);
        this.bulletMeshes.delete(id);
      }
    }
  }

  private spawnBurst(pos: Vec3, color: number, lifetimeMs: number): void {
    const material = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const mesh = new Mesh(this.effectGeometry, material);
    mesh.position.set(...pos);
    this.scene.add(mesh);
    const bornAt = performance.now();
    this.effects.push({ mesh, bornAt, expiresAt: bornAt + lifetimeMs });
  }

  private updateEffects(): void {
    const now = performance.now();
    let kept = 0;
    for (const effect of this.effects) {
      if (now >= effect.expiresAt) {
        this.scene.remove(effect.mesh);
        (effect.mesh.material as MeshBasicMaterial).dispose();
        continue;
      }
      const progress =
        (now - effect.bornAt) / (effect.expiresAt - effect.bornAt);
      effect.mesh.scale.setScalar(1 + progress * 5);
      (effect.mesh.material as MeshBasicMaterial).opacity = 1 - progress;
      this.effects[kept] = effect;
      kept += 1;
    }
    this.effects.length = kept;
  }

  private updateCamera(): void {
    const local = this.planes[this.localSlot];
    const forward = _forward.set(0, 0, -1).applyQuaternion(local.quaternion);
    const desired = _desired
      .copy(local.position)
      .addScaledVector(forward, -CAM_BACK);
    desired.y += CAM_UP;

    if (this.cameraInitialized) {
      this.camera.position.lerp(desired, CAM_SMOOTH);
    } else {
      this.camera.position.copy(desired);
      this.cameraInitialized = true;
    }
    this.camTarget
      .copy(local.position)
      .addScaledVector(forward, CAM_LOOK_AHEAD);
    this.camera.lookAt(this.camTarget);
  }

  private buildArena(config: GameConfig): void {
    const ground = new Mesh(
      new BoxGeometry(config.DOME_RADIUS * 4, 1, config.DOME_RADIUS * 4),
      new MeshStandardMaterial({ color: 0x13233a }),
    );
    ground.position.y = config.GROUND_Y - 0.5;
    this.scene.add(ground);

    const grid = new GridHelper(config.DOME_RADIUS * 2, 40, 0x2a4a6a, 0x1b3350);
    grid.position.y = config.GROUND_Y + 0.05;
    this.scene.add(grid);

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
    this.scene.add(dome);

    this.scene.add(new AmbientLight(0x8098b0, 1.1));
    const sun = new DirectionalLight(0xffffff, 2.2);
    sun.position.set(1, 2, 1);
    this.scene.add(sun);
  }

  private buildRing(): {
    group: Group;
    fill: Mesh;
    bands: Mesh;
    marker: Mesh;
  } {
    const group = new Group();
    // Unit sphere scaled by radius each frame — clearly a 3D volume (D009).
    const fill = new Mesh(
      new SphereGeometry(1, 24, 16),
      new MeshBasicMaterial({
        color: 0x8fd0ff,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    const bands = new Mesh(
      new SphereGeometry(1, 24, 12),
      new MeshBasicMaterial({
        color: 0x8fd0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.35,
      }),
    );
    group.add(fill, bands);

    const marker = new Mesh(
      new SphereGeometry(1, 16, 10),
      new MeshBasicMaterial({
        color: 0xffe08a,
        wireframe: true,
        transparent: true,
        opacity: 0.4,
      }),
    );
    marker.visible = false;

    this.scene.add(group, marker);
    return { group, fill, bands, marker };
  }

  private addPlane(slot: PlayerSlot): Group {
    const color = SLOT_COLORS[slot];
    const material = new MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.25,
      metalness: 0.2,
      roughness: 0.5,
    });

    const group = new Group();
    const fuselage = new Mesh(new ConeGeometry(3, 18, 12), material);
    fuselage.rotation.x = -Math.PI / 2; // point the cone tip along -Z (nose)
    group.add(fuselage);

    const wing = new Mesh(new BoxGeometry(26, 1, 6), material);
    wing.position.z = 1;
    group.add(wing);

    const tail = new Mesh(new BoxGeometry(8, 1, 4), material);
    tail.position.z = 7;
    group.add(tail);

    const fin = new Mesh(new BoxGeometry(1, 5, 5), material);
    fin.position.z = 7;
    fin.position.y = 2;
    group.add(fin);

    this.scene.add(group);
    return group;
  }
}

const _forward = new Vector3();
const _desired = new Vector3();
