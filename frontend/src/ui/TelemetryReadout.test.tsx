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

  it('sets a word in the text face, a measurement in mono (Design.md §4, UI audit B.30)', () => {
    render(<TelemetryReadout label="Source" value="JPL DE421" text />);
    render(<TelemetryReadout label="Altitude" value={788.6} unit="km" />);

    expect(screen.getByText('JPL DE421').classList.contains('telemetry-readout__value--text')).toBe(true);
    expect(screen.getByText('788.60', { exact: false }).classList.contains('telemetry-readout__value--text')).toBe(false);
  });
});
