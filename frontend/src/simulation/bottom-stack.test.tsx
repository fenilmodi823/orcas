import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// vitest runs from frontend/; import.meta.url and ?raw both fail on CSS here (see styles/tokens.test.ts).
const css = readFileSync(resolve(process.cwd(), 'src/simulation/SimulationView.css'), 'utf8');

describe('the bottom edge is one stack (Stage B §5.1)', () => {
  it('lays out the dock and the legend in one grid', () => {
    expect(css).toMatch(/\.simulation__bottom-row\s*\{[^}]*display:\s*grid/);
  });
  it('lets the dock shrink before the legend moves', () => {
    expect(css).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/);
  });
});
