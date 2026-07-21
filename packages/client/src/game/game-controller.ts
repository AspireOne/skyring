import {
  DEFAULT_GAME_CONFIG,
  type GameConfig,
  type GameEventKind,
} from '@skyring/shared';

import { queueRequestFromLocation, serverWsUrl } from '../config.js';
import {
  projectHud,
  projectMatchResult,
  ringStatus,
} from '../hud/hud-model.js';
import { Hud } from '../hud/hud.js';
import { CONTROL_HINTS, KeyboardInput } from '../input/keyboard.js';
import { NetClient } from '../net/net-client.js';
import { Renderer } from '../render/renderer.js';
import { SoundEngine } from '../render/sound.js';

/**
 * Boots and wires the client: a continuous render loop over the interpolated
 * world, and — once matched — a fixed-rate input loop that samples the keyboard
 * and sends intent (ARCHITECTURE §5). Owns no game logic; the server is
 * authoritative; the net layer predicts only the local plane and reconciles it
 * from recipient-specific snapshots.
 */
export class GameController {
  private readonly renderer: Renderer;
  private readonly net: NetClient;
  private readonly keyboard = new KeyboardInput();
  private readonly status: HTMLDivElement;
  private readonly hud: Hud;
  private readonly sound = new SoundEngine();
  private config: GameConfig = DEFAULT_GAME_CONFIG;
  private readonly eventCounts: Record<GameEventKind, number> = {
    fire: 0,
    hit: 0,
    bounce: 0,
    ringTeleport: 0,
    stumble: 0,
    phaseChange: 0,
  };

  private detachKeyboard: (() => void) | undefined;
  private inputTimer: number | undefined;
  private rafHandle = 0;
  private inputStarted = false;

  constructor(private readonly root: HTMLElement) {
    this.renderer = new Renderer(DEFAULT_GAME_CONFIG);
    this.renderer.onFirstFrame = () => {
      this.root.dataset.renderStatus = 'ready';
    };
    root.append(this.renderer.canvas);

    this.status = document.createElement('div');
    this.status.dataset.testid = 'net-status';
    this.status.className = 'net-status';
    root.append(this.status);

    this.hud = new Hud(root);

    this.net = new NetClient(
      serverWsUrl(),
      queueRequestFromLocation(window.location.search),
    );
    this.net.onUpdate = () => this.onNetUpdate();
    this.net.onEvent = (message) => {
      this.renderer.handleEvents(message.events);
      this.sound.handleEvents(message.events);
      for (const event of message.events) {
        this.eventCounts[event.kind] += 1;
      }
    };
    this.net.onMatchEnd = (message) => {
      if (this.net.slot) {
        this.hud.showResult(
          projectMatchResult(message, this.net.slot, this.config),
        );
      }
    };
  }

  start(): void {
    this.root.dataset.simHz = String(DEFAULT_GAME_CONFIG.SIM_HZ);
    this.root.dataset.netPhase = 'connecting';
    this.onNetUpdate();
    this.net.connect();
    window.addEventListener('resize', this.onResize);
    this.renderLoop();
  }

  dispose(): void {
    cancelAnimationFrame(this.rafHandle);
    if (this.inputTimer !== undefined) {
      clearInterval(this.inputTimer);
    }
    this.detachKeyboard?.();
    window.removeEventListener('resize', this.onResize);
    this.net.dispose();
    this.renderer.dispose();
    this.sound.dispose();
    this.hud.dispose();
  }

  private onNetUpdate(): void {
    this.root.dataset.netPhase = this.net.phase;
    if (this.net.phase === 'matched' && this.net.slot) {
      if (this.net.constants) {
        this.config = this.net.constants;
      }
      this.renderer.setLocalSlot(this.net.slot);
      this.startInput();
    }
    this.status.textContent = this.describeStatus();
  }

  private startInput(): void {
    if (this.inputStarted) {
      return;
    }
    this.inputStarted = true;
    this.detachKeyboard = this.keyboard.attach(window);
    const stepMs = 1000 / DEFAULT_GAME_CONFIG.SIM_HZ;
    this.inputTimer = window.setInterval(() => {
      if (this.net.phase === 'matched') {
        this.net.sendInput(this.keyboard.sample());
      }
    }, stepMs);
  }

  private renderLoop = (): void => {
    const slot = this.net.slot ?? 'a';
    const view = this.net.renderView();
    if (view) {
      this.renderer.update(view);
      this.root.dataset.matchPhase = view.phase;
      // Read-only diagnostic hook for automated tests (TESTING §9).
      window.__skyringState = {
        phase: view.phase,
        tick: view.tick,
        localPos: view[slot].pos,
        localAmmo:
          this.net.latestSnapshot?.state.planes[slot].ammo ??
          this.config.AMMO_MAX,
        localStumbleTicks:
          this.net.latestSnapshot?.state.planes[slot].stumbleTicksRemaining ??
          0,
        bulletCount: view.bullets.length,
        scores: this.net.latestSnapshot?.state.scores ?? { a: 0, b: 0 },
        ringWarning: this.net.latestSnapshot?.state.ring.warning ?? false,
        eventCounts: { ...this.eventCounts },
      };
    }
    const snapshot = this.net.latestSnapshot;
    if (snapshot) {
      const { state } = snapshot;
      this.renderer.updateRing(
        state.ring,
        ringStatus(state, slot),
        state.ring.warning,
      );
      this.hud.update(projectHud(state, slot, this.config));
    }
    this.renderer.render();
    this.rafHandle = requestAnimationFrame(this.renderLoop);
  };

  private onResize = (): void => this.renderer.resize();

  private describeStatus(): string {
    switch (this.net.phase) {
      case 'connecting':
        return 'Connecting…';
      case 'connected':
        return 'Connected — finding a match…';
      case 'queued':
        return 'Waiting for an opponent…';
      case 'matched':
        return `You are ${this.net.slot?.toUpperCase() ?? '?'} · ${CONTROL_HINTS.join('  ·  ')}`;
      case 'ended':
        return 'Match over';
      case 'rejected':
        return 'Server rejected the connection';
      case 'closed':
        return 'Disconnected';
    }
  }
}
