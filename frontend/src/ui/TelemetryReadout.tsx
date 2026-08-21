import { formatTelemetryValue } from './telemetry-format.js';
import './TelemetryReadout.css';

export interface TelemetryReadoutProps {
  label: string;
  value: number | string;
  unit?: string;
  precision?: number;
}

/**
 * The atomic data component (Design.md §6): mono uppercase label, mono
 * tabular value, unit in --text-lo. Every measurement in ORCAS renders
 * through this.
 */
export function TelemetryReadout({ label, value, unit, precision = 2 }: TelemetryReadoutProps) {
  const display = typeof value === 'number' ? formatTelemetryValue(value, precision) : value;

  return (
    <div className="telemetry-readout">
      <span className="telemetry-readout__label">{label}</span>
      <span className="telemetry-readout__value">
        {display}
        {unit && <span className="telemetry-readout__unit"> {unit}</span>}
      </span>
    </div>
  );
}
