import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ObjectDetail } from './ObjectDetail.js';

describe('ObjectDetail', () => {
  it('renders the orbital element grid and the element-set epoch', () => {
    render(
      <ObjectDetail
        detail={{
          eccentricity: 0.0004,
          raanDeg: 247.46,
          argPericenterDeg: 130.5,
          meanAnomalyDeg: 325.0,
          epoch: new Date('2009-02-10T16:56:00Z'),
        }}
      />,
    );

    expect(screen.getByText('RAAN')).toBeTruthy();
    expect(screen.getByText('16:56:00Z')).toBeTruthy();
  });

  it('renders P_c in scientific notation when present, omits it when absent', () => {
    const { rerender } = render(
      <ObjectDetail
        detail={{
          eccentricity: 0.0004,
          raanDeg: 247.46,
          argPericenterDeg: 130.5,
          meanAnomalyDeg: 325.0,
          epoch: new Date('2009-02-10T16:56:00Z'),
          probabilityOfCollision: 0.0042,
        }}
      />,
    );
    expect(screen.getByText('4.2 × 10⁻³', { exact: false })).toBeTruthy();

    rerender(
      <ObjectDetail
        detail={{
          eccentricity: 0.0004,
          raanDeg: 247.46,
          argPericenterDeg: 130.5,
          meanAnomalyDeg: 325.0,
          epoch: new Date('2009-02-10T16:56:00Z'),
        }}
      />,
    );
    expect(screen.queryByText('P_c')).toBeNull();
  });
});
