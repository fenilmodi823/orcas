import type { MutableRefObject } from 'react';
import { ObjectLabel, type ObjectLabelHandle } from '../../ui/ObjectLabel.js';
import { LAGRANGE_LABELS } from './lagrange-labels.js';
import { PLANETS } from '../solar/planets.js';

export interface BodyLabelRefs {
  sun: ObjectLabelHandle | null;
  moon: ObjectLabelHandle | null;
  /** In `PLANETS` order (S4). */
  planets: (ObjectLabelHandle | null)[];
  /** In `LAGRANGE_LABELS` order (S2). */
  lagrange: (ObjectLabelHandle | null)[];
}

/** The DOM labels for the Sun, the planets, the Moon and the Lagrange points; `EarthSunMoon` positions them each frame. */
export function BodyLabels({ labelsRef }: { readonly labelsRef: MutableRefObject<BodyLabelRefs> }) {
  return (
    <>
      <ObjectLabel
        ref={(handle) => {
          labelsRef.current.sun = handle;
        }}
        name="Sun"
        tier="primary"
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
        />
      ))}
      <ObjectLabel
        ref={(handle) => {
          labelsRef.current.moon = handle;
        }}
        name="Moon"
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
