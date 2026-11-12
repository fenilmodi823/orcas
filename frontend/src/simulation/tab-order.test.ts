import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Rendering SimulationView needs the WebGL scene; document order is what Tab follows, so read the source.
const tsx = readFileSync(resolve(process.cwd(), 'src/simulation/SimulationView.tsx'), 'utf8');

describe('Tab order (Stage B plan, Step 6)', () => {
  it('renders the header before the panel', () => {
    expect(tsx.indexOf('<SimulationHeader')).toBeGreaterThan(-1);
    expect(tsx.indexOf('<SimulationHeader')).toBeLessThan(tsx.indexOf('<SimulationPanels'));
  });
});
