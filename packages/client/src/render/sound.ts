import { MATCH_PHASE, type GameEvent } from '@skyring/shared';

import { SOUND_ASSETS } from '../assets.js';

export interface SoundPlayer {
  dispose(): void;
  play(source: string, volume: number): Promise<void> | void;
}

/** Small event-driven sound layer; authoritative events choose cues, never state. */
export class SoundEngine {
  constructor(
    private readonly player: SoundPlayer = new WebAudioSoundBank(
      Object.values(SOUND_ASSETS),
    ),
  ) {}

  handleEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      switch (event.kind) {
        case 'fire':
          this.play(SOUND_ASSETS.fire, 0.22);
          break;
        case 'hit':
          this.play(SOUND_ASSETS.hit, 0.55);
          break;
        case 'bounce':
          this.play(SOUND_ASSETS.hit, 0.22);
          break;
        case 'ringTeleport':
          this.play(SOUND_ASSETS.teleport, 0.5);
          break;
        case 'phaseChange':
          if (event.phase === MATCH_PHASE.SuddenDeath) {
            this.play(SOUND_ASSETS.teleport, 0.65);
          }
          break;
        case 'stumble':
          break;
      }
    }
  }

  dispose(): void {
    this.player.dispose();
  }

  private play(source: string, volume: number): void {
    const result = this.player.play(source, volume);
    if (result instanceof Promise) {
      void result.catch(() => undefined);
    }
  }
}

/**
 * Fetches and decodes each clip once, then creates cheap one-shot source nodes.
 * This preserves overlapping effects without creating a pool of media elements
 * that independently request the same file.
 */
class WebAudioSoundBank implements SoundPlayer {
  private readonly context = new AudioContext();
  private readonly buffers = new Map<
    string,
    Promise<AudioBuffer | undefined>
  >();
  private readonly abortController = new AbortController();
  private disposed = false;

  constructor(sources: readonly string[]) {
    for (const source of new Set(sources)) {
      this.buffers.set(source, this.load(source));
    }
    window.addEventListener('keydown', this.unlock);
    window.addEventListener('pointerdown', this.unlock);
  }

  async play(source: string, volume: number): Promise<void> {
    const buffer = await this.buffers.get(source);
    if (!buffer || this.disposed) return;

    await this.context.resume().catch(() => undefined);
    if (this.context.state !== 'running' || this.disposed) return;

    const gain = this.context.createGain();
    gain.gain.value = volume;
    gain.connect(this.context.destination);

    const node = this.context.createBufferSource();
    node.buffer = buffer;
    node.connect(gain);
    node.addEventListener('ended', () => {
      node.disconnect();
      gain.disconnect();
    });
    node.start();
  }

  dispose(): void {
    this.disposed = true;
    window.removeEventListener('keydown', this.unlock);
    window.removeEventListener('pointerdown', this.unlock);
    this.abortController.abort();
    void this.context.close().catch(() => undefined);
    this.buffers.clear();
  }

  private readonly unlock = (): void => {
    void this.context.resume().catch(() => undefined);
  };

  private async load(source: string): Promise<AudioBuffer | undefined> {
    try {
      const response = await fetch(source, {
        signal: this.abortController.signal,
      });
      if (!response.ok) return undefined;
      return await this.context.decodeAudioData(await response.arrayBuffer());
    } catch {
      return undefined;
    }
  }
}
