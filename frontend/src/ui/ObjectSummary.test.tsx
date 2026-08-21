import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ObjectSummary } from './ObjectSummary.js';
import type { SelectableObject } from '../state/selection-store.js';

const ISS: SelectableObject = {
  id: '25544',
  name: 'ISS (ZARYA)',
  noradId: '25544',
  orbitClass: 'leo',
  altitudeKm: 419.0,
  velocityKmS: 7.66,
  inclinationDeg: 51.6,
};

describe('ObjectSummary', () => {
  it('renders identity, class, and a telemetry grid', () => {
    render(<ObjectSummary object={ISS} detailOpen={false} onToggleDetail={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText('ISS (ZARYA)')).toBeTruthy();
    expect(screen.getByText('LEO')).toBeTruthy();
    expect(screen.getByText('419.0', { exact: false })).toBeTruthy();
  });

  it('calls onBack and onToggleDetail from their controls', () => {
    const onBack = vi.fn();
    const onToggleDetail = vi.fn();
    render(<ObjectSummary object={ISS} detailOpen={false} onToggleDetail={onToggleDetail} onBack={onBack} />);

    fireEvent.click(screen.getByText('Esc · back'));
    fireEvent.click(screen.getByText(/More information/));

    expect(onBack).toHaveBeenCalledOnce();
    expect(onToggleDetail).toHaveBeenCalledOnce();
  });
});
