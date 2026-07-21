import type { HudModel, RingStatus } from './hud-model.js';
import type { MatchEndMessage } from '@skyring/shared';

/**
 * DOM overlay for the always-on match state (GAME.md §3, §11): scores, clock,
 * ring contest state, relocation warning, and the end-of-match result. Pure
 * presentation — it only renders a {@link HudModel} produced from authoritative
 * state.
 */
export class Hud {
  private readonly root: HTMLDivElement;
  private readonly myScore: HTMLSpanElement;
  private readonly theirScore: HTMLSpanElement;
  private readonly timer: HTMLDivElement;
  private readonly ringPill: HTMLDivElement;
  private readonly warning: HTMLDivElement;
  private readonly result: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'hud');
    this.root.dataset.testid = 'hud';

    const scoreboard = el('div', 'hud__scoreboard');
    this.myScore = el('span', 'hud__score hud__score--me');
    this.myScore.dataset.testid = 'hud-my-score';
    this.timer = el('div', 'hud__timer');
    this.timer.dataset.testid = 'hud-timer';
    this.theirScore = el('span', 'hud__score hud__score--them');
    this.theirScore.dataset.testid = 'hud-their-score';
    scoreboard.append(this.myScore, this.timer, this.theirScore);

    this.ringPill = el('div', 'hud__ring');
    this.ringPill.dataset.testid = 'hud-ring';
    this.warning = el('div', 'hud__warning');
    this.warning.dataset.testid = 'hud-warning';

    this.result = el('div', 'hud__result');
    this.result.dataset.testid = 'hud-result';
    this.result.hidden = true;

    this.root.append(scoreboard, this.ringPill, this.warning, this.result);
    parent.append(this.root);
  }

  update(model: HudModel): void {
    this.myScore.textContent = String(model.myScore);
    this.theirScore.textContent = String(model.theirScore);
    this.timer.textContent =
      model.countdown !== null ? String(model.countdown) : model.timeLabel;
    this.timer.classList.toggle('hud__timer--sudden', model.suddenDeath);

    this.ringPill.dataset.status = model.ringStatus;
    this.ringPill.textContent = RING_LABEL[model.ringStatus];
    this.ringPill.hidden = model.ringStatus === 'idle';

    this.warning.hidden = !model.warning;
    this.warning.textContent = model.warning ? '⚠ Ring relocating!' : '';
  }

  showResult(message: MatchEndMessage): void {
    this.result.hidden = false;
    this.result.dataset.outcome = message.result;
    this.result.textContent = RESULT_LABEL[message.result];
  }

  dispose(): void {
    this.root.remove();
  }
}

const RING_LABEL: Record<RingStatus, string> = {
  idle: '',
  mine: 'Scoring!',
  theirs: 'They score',
  contested: 'Contested',
};

const RESULT_LABEL = {
  win: 'YOU WIN',
  lose: 'YOU LOSE',
  draw: 'DRAW',
} as const;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
