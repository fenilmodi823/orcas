import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/simulation/CreditLine.css'), 'utf8');
const rule = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  return start < 0 ? '' : css.slice(start, css.indexOf('}', start));
};

describe('the credit line at narrow widths (live check, 1024 px with a panel)', () => {
  it('lets the attribution wrap at every width instead of clipping', () => {
    expect(rule('.credit-line__required')).not.toMatch(/white-space:\s*nowrap/);
  });
  it('never wraps or shrinks Sources and About inside themselves', () => {
    expect(rule('.credit-line__sources,\n.credit-line__link')).toMatch(/flex:\s*none/);
    expect(rule('.credit-line__toggle,\n.credit-line__link')).toMatch(/white-space:\s*nowrap/);
  });
});
