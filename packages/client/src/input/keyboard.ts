export interface InputAxes {
  throttle: number;
  pitch: number;
  roll: number;
  yaw: number;
  fire: boolean;
}

/**
 * Control scheme (arcade-friendly; tuned in Milestone 6). Kept as data so the
 * mapping is testable and the on-screen hint stays in sync.
 */
export const CONTROL_HINTS: readonly string[] = [
  'W/S throttle',
  '↑/↓ pitch',
  '←/→ roll',
  'A/D yaw',
  'Space fire',
];

/**
 * Maps the currently-held keys to control axes. The set of pressed key codes is
 * the only state, so the mapping is pure and unit-testable; DOM listeners only
 * mutate that set. `blur` releases everything so a plane never "sticks"
 * (TESTING §8).
 */
export class KeyboardInput {
  private readonly pressed = new Set<string>();

  press(code: string): void {
    this.pressed.add(code);
  }

  release(code: string): void {
    this.pressed.delete(code);
  }

  releaseAll(): void {
    this.pressed.clear();
  }

  sample(): InputAxes {
    const axis = (negative: string, positive: string): number =>
      (this.pressed.has(positive) ? 1 : 0) -
      (this.pressed.has(negative) ? 1 : 0);

    return {
      throttle: axis('KeyS', 'KeyW'),
      pitch: axis('ArrowDown', 'ArrowUp'),
      roll: axis('ArrowLeft', 'ArrowRight'),
      yaw: axis('KeyA', 'KeyD'),
      fire: this.pressed.has('Space'),
    };
  }

  /** Attach DOM listeners; returns a disposer that detaches them. */
  attach(target: Window): () => void {
    const onDown = (event: KeyboardEvent): void => {
      if (RELEVANT_CODES.has(event.code)) {
        event.preventDefault();
        this.press(event.code);
      }
    };
    const onUp = (event: KeyboardEvent): void => this.release(event.code);
    const onBlur = (): void => this.releaseAll();

    target.addEventListener('keydown', onDown);
    target.addEventListener('keyup', onUp);
    target.addEventListener('blur', onBlur);
    return () => {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      target.removeEventListener('blur', onBlur);
    };
  }
}

const RELEVANT_CODES = new Set<string>([
  'KeyW',
  'KeyS',
  'KeyA',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
]);
