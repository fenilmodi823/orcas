import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { GlassSurface } from './GlassSurface.js';
import { TelemetryReadout } from './TelemetryReadout.js';
import { ObjectDetail } from './ObjectDetail.js';
import type { DetailGroup } from './object-detail-model.js';
import type { SelectableObject } from '../state/selection-store.js';
import './ObjectPanel.css';

const ORBIT_CLASS_VAR: Record<SelectableObject['orbitClass'], string> = {
  leo: 'var(--leo)',
  meo: 'var(--meo)',
  geo: 'var(--geo)',
  heo: 'var(--heo)',
  debris: 'var(--debris)',
};

export interface ObjectPanelProps {
  /** Who the object is — known from the catalogue alone. */
  object: Pick<SelectableObject, 'name' | 'noradId' | 'orbitClass'>;
  /** Live readouts, or null while its position has not been computed yet. */
  readouts: SelectableObject | null;
  groups: readonly DetailGroup[];
  onClose: () => void;
  /** Controls under the groups, e.g. the ephemeris export. */
  actions?: ReactNode;
}

/**
 * The selected object's information panel, full height on the left — NASA
 * Eyes on the Solar System's layout (B.15, Reference - NASA Eyes §4.4) with
 * ORCAS's own field groups. A full-height panel has room for everything, so
 * there is no "More information" step: identity, live readouts and every
 * group show at once. Esc closes it, as Esc closed the dock's object mode.
 */
export function ObjectPanel({ object, readouts, groups, onClose, actions }: ObjectPanelProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <GlassSurface variant="floating" elevation={3} className="object-panel">
      <header className="object-panel__header">
        <span className="object-panel__badge" style={{ background: ORBIT_CLASS_VAR[object.orbitClass] }} aria-hidden />
        <div className="object-panel__identity">
          <h2 className="object-panel__name">{object.name}</h2>
          <span className="object-panel__class">
            {object.orbitClass.toUpperCase()} · NORAD {object.noradId}
          </span>
        </div>
        <button type="button" className="object-panel__close" onClick={onClose} aria-label="Close panel (Esc)">
          <X aria-hidden size={16} />
        </button>
      </header>
      {/* aria-live announces the selection and its telemetry (Design.md §9). */}
      <div className="object-panel__body" role="region" aria-live="polite" aria-label={`Selected object: ${object.name}`}>
        {readouts ? (
          <div className="object-panel__summary">
            <TelemetryReadout label="Alt" value={readouts.altitudeKm} unit="km" precision={1} />
            <TelemetryReadout label="Vel" value={readouts.velocityKmS} unit="km/s" precision={2} />
            <TelemetryReadout label="Inc" value={readouts.inclinationDeg} unit="°" precision={2} />
          </div>
        ) : (
          <p className="object-panel__pending">Computing position…</p>
        )}
        <ObjectDetail groups={groups} />
        {actions && <div className="object-panel__actions">{actions}</div>}
      </div>
    </GlassSurface>
  );
}
