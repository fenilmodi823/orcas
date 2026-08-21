import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TelemetryReadout } from './TelemetryReadout.js';

describe('TelemetryReadout', () => {
  it('renders ordinary magnitudes as plain tabular decimals with a unit', () => {
    render(<TelemetryReadout label="Altitude" value={788.6} unit="km" />);

    expect(screen.getByText('Altitude')).toBeTruthy();
    expect(screen.getByText('788.60', { exact: false })).toBeTruthy();
    expect(screen.getByText('km', { exact: false })).toBeTruthy();
  });

  it('renders small magnitudes in proper scientific notation, never e-notation', () => {
    render(<TelemetryReadout label="P_c" value={0.0042} />);

    expect(screen.getByText('4.2 × 10⁻³', { exact: false })).toBeTruthy();
  });

  it('passes through a pre-formatted string value unchanged', () => {
    render(<TelemetryReadout label="Class" value="LEO" />);

    expect(screen.getByText('LEO')).toBeTruthy();
  });
});
