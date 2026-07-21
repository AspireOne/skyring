import { MATCH_PHASE, type GameEvent } from '@skyring/shared';
import { describe, expect, it } from 'vitest';

import { SOUND_ASSETS } from '../assets.js';
import { SoundEngine, type SoundPlayer } from './sound.js';

class FakeSoundPlayer implements SoundPlayer {
  readonly played: Array<{ source: string; volume: number }> = [];
  disposed = false;

  dispose(): void {
    this.disposed = true;
  }

  play(source: string, volume: number): void {
    this.played.push({ source, volume });
  }
}

describe('SoundEngine', () => {
  it('maps authoritative feedback events to production clips and levels', () => {
    const player = new FakeSoundPlayer();
    const sound = new SoundEngine(player);
    const events: GameEvent[] = [
      { kind: 'fire', slot: 'a', pos: [0, 0, 0] },
      {
        kind: 'hit',
        shooter: 'a',
        victim: 'b',
        pos: [0, 0, 0],
        dir: [1, 0, 0],
      },
      { kind: 'ringTeleport', center: [0, 0, 0], radius: 1 },
      { kind: 'phaseChange', phase: MATCH_PHASE.SuddenDeath },
    ];
    sound.handleEvents(events);

    expect(player.played).toEqual([
      { source: SOUND_ASSETS.fire, volume: 0.22 },
      { source: SOUND_ASSETS.hit, volume: 0.55 },
      { source: SOUND_ASSETS.teleport, volume: 0.5 },
      { source: SOUND_ASSETS.teleport, volume: 0.65 },
    ]);

    sound.dispose();
    expect(player.disposed).toBe(true);
  });

  it('swallows browser autoplay rejection instead of leaking an unhandled promise', async () => {
    const sound = new SoundEngine({
      dispose: () => undefined,
      play: () => Promise.reject(new Error('autoplay blocked')),
    });
    sound.handleEvents([{ kind: 'fire', slot: 'a', pos: [0, 0, 0] }]);
    await Promise.resolve();
  });
});
