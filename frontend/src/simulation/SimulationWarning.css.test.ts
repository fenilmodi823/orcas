import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(`${__dirname}/SimulationView.css`, 'utf8');
const rule = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  return start < 0 ? '' : css.slice(start, css.indexOf('}', start));
};

describe('the close-approach warning beside the left panel', () => {
  const open = rule('.simulation[data-object-panel] .simulation__warning');
  it('stays anchored to the right edge, never pushed toward the panel', () => {
    expect(open).not.toMatch(/\bright:/);
  });
  it('keeps its left edge clear of the panel', () => {
    expect(open).toMatch(/width:\s*min\(560px,\s*calc\(100% - var\(--panel-w\) - 3 \* var\(--space-4\)\)\)/);
  });
});
