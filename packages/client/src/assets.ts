import type { PlayerSlot } from '@skyring/shared';

export interface PlaneAsset {
  readonly path: string;
  /** Longest model dimension after runtime normalization, in world units. */
  readonly targetSize: number;
  /** Source-model correction so the visible nose aligns with local -Z. */
  readonly yaw: number;
}

export const PLANE_ASSETS: Readonly<Record<PlayerSlot, PlaneAsset>> =
  Object.freeze({
    a: Object.freeze({
      path: '/assets/models/aeroplane.glb',
      targetSize: 24,
      yaw: Math.PI,
    }),
    b: Object.freeze({
      path: '/assets/models/airco-dh2.glb',
      targetSize: 24,
      yaw: Math.PI,
    }),
  });

export const SOUND_ASSETS = Object.freeze({
  fire: '/assets/audio/fire.ogg',
  hit: '/assets/audio/hit.ogg',
  teleport: '/assets/audio/teleport.ogg',
});
