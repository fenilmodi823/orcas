import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CreditLine } from './CreditLine.js';

describe('CreditLine (UI audit B.30)', () => {
  const required = 'Orbital data: Space-Track.org (18th Space Defense Squadron). Stars: ESA/Gaia/DPAC.';
  const sources = ['Sun and planets: JPL DE421.', 'Lagrange points: computed, not observed.'];

  it('always shows the attributions the data terms require', () => {
    render(<CreditLine required={required} sources={sources} />);

    expect(screen.getByText(required)).toBeTruthy();
  });

  it('keeps every other credit, word for word, behind a Sources control that starts closed', () => {
    render(<CreditLine required={required} sources={sources} />);
    const details = screen.getByText('Sources').closest('details');

    expect(details?.open).toBe(false);
    for (const credit of sources) expect(details?.textContent).toContain(credit);
  });

  it('opens on the Sources control', () => {
    render(<CreditLine required={required} sources={sources} />);
    const summary = screen.getByText('Sources');

    fireEvent.click(summary);

    expect(summary.closest('details')?.open).toBe(true);
  });
});
