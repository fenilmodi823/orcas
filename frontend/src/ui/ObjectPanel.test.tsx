import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ObjectPanel } from './ObjectPanel.js';
import type { SelectableObject } from '../state/selection-store.js';
import type { DetailGroup } from './object-detail-model.js';

const ISS: SelectableObject = {
  id: '25544',
  name: 'ISS (ZARYA)',
  noradId: '25544',
  orbitClass: 'leo',
  altitudeKm: 419,
  velocityKmS: 7.66,
  inclinationDeg: 51.6,
};

const GROUPS: DetailGroup[] = [
  { id: 'identity', title: 'Identity', fields: [{ label: 'NORAD', value: '25544' }] },
  { id: 'provenance', title: 'Provenance', fields: [{ label: 'Element-set epoch', value: '2026-09-17 04:12:15 UTC' }] },
];

describe('ObjectPanel', () => {
  it('shows the object, its live readouts and every detail group at once', () => {
    render(<ObjectPanel object={ISS} readouts={ISS} groups={GROUPS} onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'ISS (ZARYA)' })).toBeTruthy();
    expect(screen.getByText('Alt')).toBeTruthy();
    // No "More information" disclosure: a full-height panel shows everything.
    expect(screen.getByRole('region', { name: 'Identity' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Provenance' })).toBeTruthy();
    expect(screen.queryByText(/More information/)).toBeNull();
  });

  it('closes from its button and from Escape', () => {
    const onClose = vi.fn();
    render(<ObjectPanel object={ISS} readouts={ISS} groups={GROUPS} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('says the position is still being computed instead of inventing readouts', () => {
    render(<ObjectPanel object={ISS} readouts={null} groups={GROUPS} onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'ISS (ZARYA)' })).toBeTruthy();
    expect(screen.getByText(/Computing position/)).toBeTruthy();
    expect(screen.queryByText('Alt')).toBeNull();
  });

  it('renders extra actions under the groups', () => {
    render(<ObjectPanel object={ISS} readouts={ISS} groups={GROUPS} onClose={vi.fn()} actions={<button type="button">Export</button>} />);
    expect(screen.getByRole('button', { name: 'Export' })).toBeTruthy();
  });
});
