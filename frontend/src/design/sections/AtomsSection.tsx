import { useState } from 'react';
import { GlassSurface } from '../../ui/GlassSurface.js';
import { TelemetryReadout } from '../../ui/TelemetryReadout.js';
import { StatusPill } from '../../ui/StatusPill.js';
import { AlertBadge } from '../../ui/AlertBadge.js';
import { FilterChip } from '../../ui/FilterChip.js';

const EPOCH = new Date('2009-02-10T16:56:00Z');

/**
 * TelemetryReadout, StatusPill, AlertBadge, FilterChip — the atomic
 * components (Design.md §6), shown default / active / disabled where each
 * state applies. Hover and focus are real: interact with the live page.
 */
export function AtomsSection() {
  const [active, setActive] = useState<'leo' | 'meo'>('leo');

  return (
    <section className="design-section" aria-labelledby="atoms-heading">
      <h2 id="atoms-heading">Atoms</h2>

      <GlassSurface variant="floating" elevation={2} className="design-card">
        <h3>TelemetryReadout</h3>
        <div className="design-row">
          <TelemetryReadout label="Altitude" value={788.6} unit="km" precision={1} />
          <TelemetryReadout label="Mahalanobis" value={1.84} precision={2} />
          <TelemetryReadout label="P_c" value={4.2e-3} />
          <TelemetryReadout label="Class" value="LEO" />
        </div>
      </GlassSurface>

      <GlassSurface variant="floating" elevation={2} className="design-card">
        <h3>StatusPill</h3>
        <div className="design-row">
          <StatusPill epoch={EPOCH} />
          <StatusPill epoch={EPOCH} stale />
        </div>
      </GlassSurface>

      <GlassSurface variant="floating" elevation={2} className="design-card">
        <h3>AlertBadge</h3>
        <div className="design-row">
          <AlertBadge message="P_c above threshold — CRITICAL" />
        </div>
      </GlassSurface>

      <GlassSurface variant="floating" elevation={2} className="design-card">
        <h3>FilterChip</h3>
        <div className="design-row">
          <FilterChip orbitClass="leo" label="LEO" count={612} active={active === 'leo'} onToggle={() => setActive('leo')} />
          <FilterChip orbitClass="meo" label="MEO" count={54} active={active === 'meo'} onToggle={() => setActive('meo')} />
          <FilterChip orbitClass="geo" label="GEO" count={38} disabled />
        </div>
      </GlassSurface>
    </section>
  );
}
