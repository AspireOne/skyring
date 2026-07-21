import type { HudModel, MatchResultModel, RingStatus } from './hud-model.js';

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
  private readonly ammo: HTMLDivElement;
  private readonly ammoValue: HTMLSpanElement;
  private readonly ammoFill: HTMLDivElement;
  private readonly result: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'hud');
    this.root.dataset.testid = 'hud';

    const scoreboard = el('div', 'hud__scoreboard');
    scoreboard.setAttribute('aria-label', 'Score and match timer');
    this.myScore = el('span', 'hud__score hud__score--me');
    this.myScore.dataset.testid = 'hud-my-score';
    this.timer = el('div', 'hud__timer');
    this.timer.dataset.testid = 'hud-timer';
    this.theirScore = el('span', 'hud__score hud__score--them');
    this.theirScore.dataset.testid = 'hud-their-score';
    scoreboard.append(this.myScore, this.timer, this.theirScore);

    this.ringPill = el('div', 'hud__ring');
    this.ringPill.dataset.testid = 'hud-ring';
    this.ringPill.setAttribute('aria-live', 'polite');
    this.warning = el('div', 'hud__warning');
    this.warning.dataset.testid = 'hud-warning';
    this.warning.setAttribute('role', 'status');

    this.ammo = el('div', 'hud__ammo');
    this.ammo.dataset.testid = 'hud-ammo';
    this.ammo.setAttribute('role', 'meter');
    this.ammo.setAttribute('aria-label', 'Bonk energy');
    const ammoLabel = el('div', 'hud__ammo-label');
    this.ammoValue = el('span', 'hud__ammo-value');
    ammoLabel.append('BONK ENERGY', this.ammoValue);
    const ammoTrack = el('div', 'hud__ammo-track');
    this.ammoFill = el('div', 'hud__ammo-fill');
    ammoTrack.append(this.ammoFill);
    this.ammo.append(ammoLabel, ammoTrack);

    this.result = el('div', 'hud__result');
    this.result.dataset.testid = 'hud-result';
    this.result.setAttribute('role', 'alert');
    this.result.hidden = true;

    this.root.append(
      scoreboard,
      this.ringPill,
      this.warning,
      this.ammo,
      this.result,
    );
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

    this.ammoValue.textContent = `${Math.floor(model.ammo)} / ${model.ammoMax}`;
    this.ammoFill.style.transform = `scaleX(${model.ammoFraction})`;
    this.ammo.setAttribute('aria-valuenow', String(Math.floor(model.ammo)));
    this.ammo.setAttribute('aria-valuemax', String(model.ammoMax));
  }

  showResult(model: MatchResultModel): void {
    const title = el('div', 'hud__result-title');
    title.dataset.testid = 'hud-result-title';
    title.textContent = model.label;

    const score = el('div', 'hud__result-score');
    score.dataset.testid = 'hud-result-score';
    score.textContent = `${model.myScore} – ${model.theirScore}`;

    this.result.hidden = false;
    this.result.dataset.outcome = model.outcome;
    this.result.replaceChildren(title, score);
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

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
