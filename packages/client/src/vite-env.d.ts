/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  /** Read-only diagnostic snapshot for automated tests (TESTING §9). */
  __skyringState?: {
    phase: string;
    tick: number;
    localPos: [number, number, number];
    localAmmo: number;
    localStumbleTicks: number;
    bulletCount: number;
    scores: { a: number; b: number };
    ringWarning: boolean;
    eventCounts: Record<
      'hit' | 'bounce' | 'ringTeleport' | 'stumble' | 'phaseChange',
      number
    >;
  };
}
