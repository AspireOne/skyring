import { describe, expect, it } from 'vitest';

import { KeyboardInput } from './keyboard.js';

describe('KeyboardInput.sample', () => {
  it('is neutral with no keys pressed', () => {
    expect(new KeyboardInput().sample()).toEqual({
      throttle: 0,
      pitch: 0,
      roll: 0,
      yaw: 0,
      fire: false,
    });
  });

  it('maps each control key to its axis', () => {
    const kb = new KeyboardInput();
    kb.press('KeyW');
    kb.press('ArrowUp');
    kb.press('ArrowRight');
    kb.press('KeyD');
    kb.press('Space');
    expect(kb.sample()).toEqual({
      throttle: 1,
      pitch: 1,
      roll: 1,
      yaw: 1,
      fire: true,
    });
  });

  it('cancels opposing keys to zero', () => {
    const kb = new KeyboardInput();
    kb.press('KeyW');
    kb.press('KeyS');
    expect(kb.sample().throttle).toBe(0);
  });

  it('releases individual and all keys', () => {
    const kb = new KeyboardInput();
    kb.press('KeyW');
    kb.press('ArrowDown');
    kb.release('KeyW');
    expect(kb.sample().throttle).toBe(0);
    expect(kb.sample().pitch).toBe(-1);
    kb.releaseAll();
    expect(kb.sample().pitch).toBe(0);
  });
});
