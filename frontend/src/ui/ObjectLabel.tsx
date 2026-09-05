import { forwardRef, useImperativeHandle, useRef } from 'react';
import './ObjectLabel.css';

export interface ObjectLabelHandle {
  setPosition(xPx: number, yPx: number): void;
  setOpacity(alpha: number): void;
}

export interface ObjectLabelProps {
  name: string;
}

/**
 * The ambient name label for a notable object at rest (P4.D28,
 * [[Reference - NASA Eyes and LeoLabs#1.5]]: "a small hollow-circle marker
 * plus the object name in ~13px light grey"). Position and opacity are
 * imperative DOM writes only — never React state (Design.md §6; Rules.md
 * "React state updated every frame") — the same contract `ObjectTether.tsx`
 * already uses, just without a leader line or a class/altitude line.
 */
export const ObjectLabel = forwardRef<ObjectLabelHandle, ObjectLabelProps>(function ObjectLabel(
  { name },
  forwardedRef,
) {
  const rootRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(forwardedRef, () => ({
    setPosition(xPx, yPx) {
      const node = rootRef.current;
      if (!node) return;
      node.style.transform = `translate(${xPx}px, ${yPx}px)`;
    },
    setOpacity(alpha) {
      const node = rootRef.current;
      if (!node) return;
      node.style.opacity = String(alpha);
    },
  }));

  return (
    <div ref={rootRef} className="object-label" style={{ opacity: 0 }}>
      <span className="object-label__marker" aria-hidden />
      <span className="object-label__name">{name}</span>
    </div>
  );
});
