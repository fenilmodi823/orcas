import type { MutableRefObject } from 'react';
import { ObjectLabel, type ObjectLabelHandle } from '../../ui/ObjectLabel.js';
import { LAGRANGE_LABELS } from './lagrange-labels.js';

export interface BodyLabelRefs {
  sun: ObjectLabelHandle | null;
  moon: ObjectLabelHandle | null;
  /** In `LAGRANGE_LABELS` order (S2). */
  lagrange: (ObjectLabelHandle | null)[];
}

/** The DOM labels for the Sun, the Moon and the Lagrange points; `EarthSunMoon` positions them each frame. */
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
