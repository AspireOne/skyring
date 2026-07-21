import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PLANE_ASSETS,
  SOUND_ASSETS,
} from '../../packages/client/src/assets.js';

const publicRoot = resolve('packages/client/public');
const creditsPath = resolve(publicRoot, 'assets/CREDITS.md');

describe('production asset manifest and licensing', () => {
  it('loads valid, lean binary glTF aircraft files', async () => {
    let totalBytes = 0;
    for (const asset of Object.values(PLANE_ASSETS)) {
      const path = publicPath(asset.path);
      const [data, metadata] = await Promise.all([readFile(path), stat(path)]);
      totalBytes += metadata.size;
      expect(data.subarray(0, 4).toString('ascii')).toBe('glTF');
      expect(data.readUInt32LE(4)).toBe(2);
      expect(data.readUInt32LE(8)).toBe(metadata.size);
      expect(metadata.size).toBeGreaterThan(1024);
    }
    expect(totalBytes).toBeLessThan(2 * 1024 * 1024);
  });

  it('loads Ogg audio and credits every production asset with source and license', async () => {
    const credits = await readFile(creditsPath, 'utf8');
    for (const path of Object.values(SOUND_ASSETS)) {
      const data = await readFile(publicPath(path));
      expect(data.subarray(0, 4).toString('ascii')).toBe('OggS');
      expect(credits).toContain(path.split('/').at(-1));
    }
    for (const { path } of Object.values(PLANE_ASSETS)) {
      expect(credits).toContain(path.split('/').at(-1));
    }
    expect(credits).toContain('CC BY 3.0');
    expect(credits).toContain('CC0 1.0');
    expect(credits).toContain('https://poly.pizza/');
    expect(credits).toContain('https://kenney.nl/');
  });
});

function publicPath(urlPath: string): string {
  return resolve(publicRoot, urlPath.replace(/^\//, ''));
}
