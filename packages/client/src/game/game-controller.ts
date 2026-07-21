import { DEFAULT_GAME_CONFIG } from '@skyring/shared';

import { queueRequestFromLocation, serverWsUrl } from '../config.js';
import { CONTROL_HINTS, KeyboardInput } from '../input/keyboard.js';
import { NetClient } from '../net/net-client.js';
import { Renderer } from '../render/renderer.js';

/**
 * Boots and wires the client: a continuous render loop over the interpolated
 * world, and — once matched — a fixed-rate input loop that samples the keyboard
 * and sends intent (IMPLEMENTATION §8). Owns no game logic; the server is
 * authoritative and this only predicts nothing yet (prediction lands in M5).
 */
export class GameController {
  private readonly renderer: Renderer;
  private readonly net: NetClient;
  private readonly keyboard = new KeyboardInput();
  private readonly status: HTMLDivElement;

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

    this.net = new NetClient(
      serverWsUrl(),
      queueRequestFromLocation(window.location.search),
    );
    this.net.onUpdate = () => this.onNetUpdate();
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
  }

  private onNetUpdate(): void {
    this.root.dataset.netPhase = this.net.phase;
    if (this.net.phase === 'matched' && this.net.slot) {
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
    const view = this.net.renderView();
    if (view) {
      this.renderer.update(view);
      this.root.dataset.matchPhase = view.phase;
      // Read-only diagnostic hook for automated tests (TESTING §9).
      const localPos = view[this.net.slot ?? 'a'].pos;
      window.__skyringState = { phase: view.phase, tick: view.tick, localPos };
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
