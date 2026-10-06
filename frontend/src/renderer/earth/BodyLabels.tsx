import type { MutableRefObject } from 'react';
import { ObjectLabel, type ObjectLabelHandle } from '../../ui/ObjectLabel.js';
import { LAGRANGE_LABELS } from './lagrange-labels.js';
import { PLANETS } from '../solar/planets.js';
import { useSelectionStore } from '../../state/selection-store.js';

export interface BodyLabelRefs {
  sun: ObjectLabelHandle | null;
  moon: ObjectLabelHandle | null;
  /** In `PLANETS` order (S4). */
  planets: (ObjectLabelHandle | null)[];
  /** In `LAGRANGE_LABELS` order (S2). */
  lagrange: (ObjectLabelHandle | null)[];
}

/** A body label is a control, as NASA's are (S5a): a click flies there, a hover highlights its orbit. */
function useBodyControls() {
  const select = useSelectionStore((s) => s.setSelectedBody);
  const hover = useSelectionStore((s) => s.setHoverBody);
  return (id: string) => ({ onSelect: () => select(id), onHover: (on: boolean) => hover(on ? id : null) });
}

/** The DOM labels for the Sun, the planets, the Moon and the Lagrange points; `EarthSunMoon` positions them each frame. */
export function BodyLabels({ labelsRef }: { readonly labelsRef: MutableRefObject<BodyLabelRefs> }) {
  const controls = useBodyControls();
  return (
    <>
      <ObjectLabel
        ref={(handle) => {
          labelsRef.current.sun = handle;
        }}
        name="Sun"
        tier="primary"
        {...controls('sun')}
      />
      {/* NASA Eyes' primary tier: the Sun and the planets (Reference §4.2). */}
      {PLANETS.map((planet, i) => (
        <ObjectLabel
          key={planet.name}
          ref={(handle) => {
            labelsRef.current.planets[i] = handle;
          }}
          name={planet.name}
          tier="primary"
          {...controls(planet.name.toLowerCase())}
        />
      ))}
      <ObjectLabel
        ref={(handle) => {
          labelsRef.current.moon = handle;
        }}
        name="Moon"
        {...controls('moon')}
      />
      {LAGRANGE_LABELS.map((l, i) => (
        <ObjectLabel
          key={l.name}
          ref={(handle) => {
            labelsRef.current.lagrange[i] = handle;
          }}
          name={l.name}
          marker={l.stability}
        />
      ))}
    </>
  );
}
