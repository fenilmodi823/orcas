import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { OrbitClass } from '../state/selection-store.js';
import './ObjectTether.css';

const ORBIT_CLASS_VAR: Record<OrbitClass, string> = {
  leo: 'var(--leo)',
  meo: 'var(--meo)',
  geo: 'var(--geo)',
  heo: 'var(--heo)',
  debris: 'var(--debris)',
};

export interface ObjectTetherHandle {
  setPosition(xPx: number, yPx: number): void;
  setVisible(visible: boolean): void;
}

export interface ObjectTetherProps {
  name: string;
  orbitClass: OrbitClass;
  altitudeKm: number;
}

/**
 * The hover chip: leader line + name + class + altitude. Position is
 * imperative — the caller's per-frame projection writes through
 * `setPosition` straight to the DOM, never through React state
 * (Design.md §6; Rules.md "React state updated every frame").
 */
export const ObjectTether = forwardRef<ObjectTetherHandle, ObjectTetherProps>(function ObjectTether(
  { name, orbitClass, altitudeKm },
  forwardedRef,
) {
  const rootRef = useRef<HTMLDivElement>(null);

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
  }));

  return (
    <div ref={rootRef} className="object-tether" style={{ opacity: 0 }}>
      <span className="object-tether__lead" aria-hidden />
      <div className="object-tether__chip">
        <span className="object-tether__dot" style={{ background: ORBIT_CLASS_VAR[orbitClass] }} aria-hidden />
        <span className="object-tether__name">{name}</span>
        <span className="object-tether__meta">
          {orbitClass.toUpperCase()} · {altitudeKm.toFixed(1)} km
        </span>
      </div>
    </div>
  );
});
