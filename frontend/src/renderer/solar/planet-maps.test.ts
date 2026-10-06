import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLANET_MAPS } from './planet-maps.js';

// Vitest runs from frontend/ (see star-sky.test.ts for why not import.meta.url).
const textures = resolve(process.cwd(), 'public/textures');
const assets = readFileSync(resolve(textures, 'ASSETS.md'), 'utf8');

describe('PLANET_MAPS (S5b)', () => {
  it.each(Object.entries(PLANET_MAPS))('ships %s’s map and records its source in ASSETS.md', (_, map) => {
    const file = map.url.replace('/textures/', '');
    expect(existsSync(resolve(textures, file))).toBe(true);
    expect(assets).toContain(`\`${file}\``);
  });

  it('records the ring profiles too', () => {
    for (const file of ['saturn-rings-albedo.png', 'saturn-rings-transmission.png']) {
      expect(existsSync(resolve(textures, file))).toBe(true);
      expect(assets).toContain(`\`${file}\``);
    }
  });
});
