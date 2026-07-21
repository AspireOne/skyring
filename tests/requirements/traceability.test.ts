import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const matrixPath = 'tests/REQUIREMENTS.md';

describe('requirement traceability matrix', () => {
  it('contains every in-scope game/architecture acceptance family', async () => {
    const matrix = await readFile(matrixPath, 'utf8');
    for (const id of [
      'GAME-3-TWO-PLAYER',
      'GAME-4-SOLO-SCORING',
      'GAME-4.1-CENTER-TIE',
      'GAME-5-MUTUAL-HIT',
      'GAME-6-BOUNDARY-BOUNCE',
      'GAME-7-ARCADE-FLIGHT',
      'GAME-8-SUDDEN-DEATH',
      'GAME-9-RING-TELEPORT-OCCUPANCY',
      'GAME-9-KNOCKED-INTO-RING',
      'GAME-9-DISCONNECT',
      'GAME-11-ASSETS',
      'IMPL-4.4-RECONCILIATION',
      'IMPL-7.4-INPUT-VALIDATION',
      'IMPL-12-ASSET-LICENSES',
      'HUMAN-GAME-13-RHYTHM',
    ]) {
      expect(matrix).toContain(`\`${id}\``);
    }
  });

  it('maps every automated requirement row to an executable test file', async () => {
    const matrix = await readFile(matrixPath, 'utf8');
    const automated = matrix.split('## Human-only acceptance')[0] ?? '';
    const rows = automated
      .split('\n')
      .filter(
        (line) => line.startsWith('| `GAME-') || line.startsWith('| `IMPL-'),
      );
    expect(rows.length).toBeGreaterThan(30);
    for (const row of rows) {
      expect(row).toMatch(/\.(?:test|spec)\.ts/);
    }
  });
});
