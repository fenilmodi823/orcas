import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TimeDock } from './TimeDock.js';
import type { SelectableObject } from '../state/selection-store.js';

const NOW = new Date('2009-02-10T16:56:00Z');

describe('TimeDock', () => {
  it('mode="time" shows the transport and scrubber, and expands into filters', () => {
    render(
      <TimeDock
        mode="time"
        playing={false}
        rate={1}
        currentTime={NOW}
        rangeStart={new Date('2009-02-10T00:00:00Z')}
        rangeEnd={new Date('2009-02-11T00:00:00Z')}
        filters={[{ orbitClass: 'leo', label: 'LEO', count: 612, active: false }]}
        onTogglePlay={vi.fn()}
        onCycleRate={vi.fn()}
        onJumpToNow={vi.fn()}
        onScrub={vi.fn()}
        onToggleFilter={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Scrub simulation time')).toBeTruthy();
    expect(screen.queryByText('LEO')).toBeNull();

    fireEvent.click(screen.getByLabelText('Expand'));
    expect(screen.getByText('LEO')).toBeTruthy();
  });

  it('mode="object" shows identity and calls onBack on Escape', () => {
    const object: SelectableObject = {
      id: '25544',
      name: 'ISS (ZARYA)',
      noradId: '25544',
      orbitClass: 'leo',
      altitudeKm: 419,
      velocityKmS: 7.66,
      inclinationDeg: 51.6,
    };
    const onBack = vi.fn();

    render(
      <TimeDock
        mode="object"
        object={object}
        detail={{ eccentricity: 0.0004, raanDeg: 1, argPericenterDeg: 1, meanAnomalyDeg: 1, epoch: NOW }}
        onBack={onBack}
      />,
    );

    expect(screen.getByText('ISS (ZARYA)')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onBack).toHaveBeenCalledOnce();
  });
});
