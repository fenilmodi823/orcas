import { TelemetryReadout } from './TelemetryReadout.js';
import type { DetailGroup } from './object-detail-model.js';
import './ObjectDetail.css';

export interface ObjectDetailProps {
  groups: readonly DetailGroup[];
}

/**
 * The disclosed panel behind "More information" (Design.md §6), laid out as
 * the brief's modular field groups (§13.4.2): Identity, Kinematics, Orbit,
 * Provenance, and a Conjunction slot that stays absent until Phase 5 fills
 * it. Each group is its own block, so Phase 5 slots in without a rebuild; a
 * group with nothing to show has already been dropped by the model, so no
 * blanks are ever drawn. The element-set epoch is in Provenance, always
 * (Design.md §4, non-negotiable).
 */
export function ObjectDetail({ groups }: ObjectDetailProps) {
  return (
    <div className="object-detail">
      {groups.map((group) => (
        <section key={group.id} className="object-detail__group" aria-label={group.title}>
          <h3 className="object-detail__title">{group.title}</h3>
          <div className="object-detail__grid">
            {group.fields.map((field) => (
              <TelemetryReadout
                key={field.label}
                label={field.label}
                value={field.value}
                unit={field.unit}
                precision={field.precision}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
