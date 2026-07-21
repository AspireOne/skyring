import {
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';

import { ArenaView } from './arena.js';
import {
  createFallbackPlane,
  disposeGroup,
  loadPlaneModel,
} from './plane-model.js';

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
 * (ARCHITECTURE §5). Aircraft are normalized presentation shells over the
 * authoritative transforms; their source geometry never affects simulation.
 */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  onFirstFrame: (() => void) | undefined;

  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly renderer: WebGLRenderer;
  private readonly arena: ArenaView;
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
  private loadedPlaneCount = 0;

  constructor(config: GameConfig) {
    this.renderer = new WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.canvas = this.renderer.domElement;
    this.canvas.dataset.testid = 'scene-canvas';
    this.canvas.dataset.modelsReady = 'loading';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute(
      'aria-label',
      'SkyRing aerial arena and two-player match view',
    );

    this.camera = new PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      0.5,
      1,
    );

    this.scene.background = new Color(0x173b5f);
    this.arena = new ArenaView(this.scene, this.camera, this.canvas, config);

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

  /** Rebuild config-dependent presentation from the server's effective config. */
  configure(config: GameConfig): void {
    this.arena.configure(config);
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
        case 'fire':
          this.spawnBurst(event.pos, SLOT_COLORS[event.slot], 90);
          break;
        case 'hit':
          this.spawnBurst(event.pos, 0xffffff, 260);
          break;
        case 'bounce':
          this.spawnBurst(event.pos, SLOT_COLORS[event.slot], 180);
          break;
        case 'ringTeleport':
          this.spawnBurst(event.center, 0xffe08a, 600);
          break;
        case 'stumble':
          this.spawnBurst(
            fromScenePosition(this.planes[event.slot].position),
            SLOT_COLORS[event.slot],
            320,
          );
          break;
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
    this.arena.dispose();
    for (const plane of Object.values(this.planes)) {
      disposeGroup(plane);
    }
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

  private buildRing(): {
    group: Group;
    fill: Mesh;
    bands: Mesh;
    marker: Mesh;
  } {
    const group = new Group();
    // Unit sphere scaled by radius each frame — clearly a 3D volume (GAME §6).
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
    const group = new Group();
    const placeholder = createFallbackPlane(SLOT_COLORS[slot]);
    group.add(placeholder);
    this.scene.add(group);

    loadPlaneModel(
      slot,
      (model) => {
        group.add(model);
        group.remove(placeholder);
        disposeGroup(placeholder);
        this.loadedPlaneCount += 1;
        if (this.loadedPlaneCount === 2) {
          this.canvas.dataset.modelsReady = 'true';
        }
      },
      (path, error) => {
        this.canvas.dataset.modelsReady = 'error';
        console.error(`Failed to load ${path}`, error);
      },
    );
    return group;
  }
}

const _forward = new Vector3();
const _desired = new Vector3();
function fromScenePosition(value: Vector3): Vec3 {
  return [value.x, value.y, value.z];
}
