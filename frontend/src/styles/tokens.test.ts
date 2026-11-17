import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// vitest runs from frontend/; ?raw and import.meta.url both fail on CSS here.
const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');

describe('Stage B tokens (spec §4.1)', () => {
  it('keeps the identity exactly', () => {
    expect(css).toContain('--void: #04070f;');
    expect(css).toContain('--orca-cyan: #00e5ff;');
    expect(css).toContain('--leo: #4d9fff;');
  });
  it('sets text in Archivo and measurements in JetBrains Mono', () => {
    expect(css).toMatch(/--font-text:\s*"Archivo Variable"/);
    expect(css).toMatch(/--font-mono:\s*"JetBrains Mono"/);
    expect(css).not.toContain('Plus Jakarta Sans');
  });
  it('has one label style: the text face, 12px, sentence case, untracked', () => {
    expect(css).toContain('--t-label: 500 12px/16px var(--font-text);');
    expect(css).not.toContain('--t-tel-label');
  });
  it('drops the second accent and the cursor-tracked glass', () => {
    for (const gone of ['--abyss-teal', '--glass-highlight', '--glass-specular', '--glass-underline', '--glass-edge-hover']) {
      expect(css).not.toContain(gone);
    }
  });
  it('has one radius per nesting level', () => {
    expect(css).toContain('--radius-control: 6px;');
    expect(css).toContain('--radius-cell: 10px;');
    expect(css).toContain('--radius-panel: 14px;');
  });
  it('has the correct glass edge value', () => {
    expect(css).toContain('--glass-edge: rgba(234, 240, 250, 0.14);');
  });
});
