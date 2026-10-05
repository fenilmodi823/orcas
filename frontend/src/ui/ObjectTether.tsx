import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import type { FilterClass } from '../state/selection-store.js';
import './ObjectTether.css';

const FILTER_CLASS_VAR: Record<FilterClass, string> = {
  leo: 'var(--leo)',
  meo: 'var(--meo)',
  geo: 'var(--geo)',
  heo: 'var(--heo)',
  debris: 'var(--debris)',
};

export interface ObjectTetherHandle {
  setPosition(xPx: number, yPx: number): void;
  setVisible(visible: boolean): void;
  /** The live altitude, written per frame by the same projection that
   * moves the chip; the prop alone froze while an object sat selected. */
  setAltitude(altitudeKm: number): void;
}

export interface ObjectTetherProps {
  name: string;
  orbitClass: FilterClass;
  altitudeKm: number;
  /** The persistent chip on the SELECTED object, as opposed to the
   * transient hover one. Styled quieter so it labels the target during a
   * fly-to without competing with the hover chip (brief §D.6). */
  selected?: boolean;
}

/**
 * The hover chip: leader line + name + class + altitude. Position is
 * imperative — the caller's per-frame projection writes through
 * `setPosition` straight to the DOM, never through React state
 * (Design.md §6; Rules.md "React state updated every frame").
 */
export const ObjectTether = forwardRef<ObjectTetherHandle, ObjectTetherProps>(function ObjectTether(
  { name, orbitClass, altitudeKm, selected = false },
  forwardedRef,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  // React renders this span empty and never touches its text, so the
  // per-frame writes below cannot be undone by a re-render.
  const altitudeRef = useRef<HTMLSpanElement>(null);
  const writeAltitude = (km: number) => {
    const node = altitudeRef.current;
    const text = km.toFixed(1);
    if (node && node.textContent !== text) node.textContent = text;
  };
  useLayoutEffect(() => writeAltitude(altitudeKm), [altitudeKm]);

  useImperativeHandle(forwardedRef, () => ({
    setPosition(xPx, yPx) {
      const node = rootRef.current;
      if (!node) return;
      node.style.transform = `translate(${xPx}px, ${yPx}px)`;
    },
    setVisible(visible) {
      const node = rootRef.current;
      if (!node) return;
      node.style.opacity = visible ? '1' : '0';
    },
    setAltitude: writeAltitude,
  }));

  return (
    // aria-hidden: a visual label only. The selected object is announced by
    // the dock's live region; while hidden (opacity 0) this chip still sits
    // in the tree, and was being read out as e.g. "DEBRIS · 0.0 km".
    <div
      ref={rootRef}
      className="object-tether"
      data-selected={selected ? '' : undefined}
      style={{ opacity: 0 }}
      aria-hidden
    >
      <span className="object-tether__lead" />
      <div className="object-tether__chip">
        <span className="object-tether__dot" style={{ background: FILTER_CLASS_VAR[orbitClass] }} />
        <span className="object-tether__name">{name}</span>
        <span className="object-tether__meta">
          {orbitClass.toUpperCase()} · <span ref={altitudeRef} /> km
        </span>
      </div>
    </div>
  );
});
