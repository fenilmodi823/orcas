import { TelemetryReadout } from './TelemetryReadout.js';
import type { SelectableObject } from '../state/selection-store.js';
import './ObjectSummary.css';

const ORBIT_CLASS_VAR: Record<SelectableObject['orbitClass'], string> = {
  leo: 'var(--leo)',
  meo: 'var(--meo)',
  geo: 'var(--geo)',
  heo: 'var(--heo)',
  debris: 'var(--debris)',
};

export interface ObjectSummaryProps {
  object: SelectableObject;
  detailOpen: boolean;
  onToggleDetail: () => void;
  onBack: () => void;
}

/** mode="object" identity row (Design.md §6, D5). Esc goes back — wired in TimeDock. */
export function ObjectSummary({ object, detailOpen, onToggleDetail, onBack }: ObjectSummaryProps) {
  return (
    <div className="object-summary">
      <div className="object-summary__header">
        <span className="object-summary__badge" style={{ background: ORBIT_CLASS_VAR[object.orbitClass] }} aria-hidden />
        <span className="object-summary__name">{object.name}</span>
        <span className="object-summary__class">{object.orbitClass.toUpperCase()}</span>
        <button type="button" className="object-summary__back" onClick={onBack}>
          Esc · back
        </button>
      </div>
      <div className="object-summary__grid">
        <TelemetryReadout label="Alt" value={object.altitudeKm} unit="km" precision={1} />
        <TelemetryReadout label="Vel" value={object.velocityKmS} unit="km/s" precision={2} />
        <TelemetryReadout label="Inc" value={object.inclinationDeg} unit="°" precision={2} />
      </div>
      <button type="button" className="object-summary__more" onClick={onToggleDetail} aria-expanded={detailOpen}>
        More information {detailOpen ? '⌃' : '⌄'}
      </button>
    </div>
  );
}
