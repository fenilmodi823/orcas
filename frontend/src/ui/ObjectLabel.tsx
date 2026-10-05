import { forwardRef, useImperativeHandle, useRef } from 'react';
import './ObjectLabel.css';

export interface ObjectLabelHandle {
  setPosition(xPx: number, yPx: number): void;
  setOpacity(alpha: number): void;
}

export interface ObjectLabelProps {
  name: string;
  /** NASA Eyes' two label tiers: bodies (`primary`) read above spacecraft. */
  tier?: 'primary' | 'secondary';
  /** The selected object's label reads at full strength, as on hover. */
  emphasised?: boolean;
  /** A computed point rather than an object: its marker shows its stability (RA5.D8). */
  marker?: 'saddle' | 'stable';
  /** Makes the label a control that selects its object. */
  onSelect?: () => void;
  onHover?: (hovered: boolean) => void;
}

/** Below this a label is treated as gone: no clicks, no hover. */
const HIDDEN_BELOW = 0.05;

/**
 * The ambient name label for a notable object at rest (P4.D28,
 * [[Reference - NASA Eyes and LeoLabs#1.5]]: "a small hollow-circle marker
 * plus the object name in ~13px light grey"). Position and opacity are
 * imperative DOM writes only — never React state (Design.md §6; Rules.md
 * "React state updated every frame") — the same contract `ObjectTether.tsx`
 * already uses, just without a leader line or a class/altitude line.
 *
 * S1: a label fades in over 0.25 s and out over 0.75 s, as NASA Eyes does
 * (Reference §4.2), and with `onSelect` it is a button that selects its
 * object — "click any label" (§4.4).
 */
export const ObjectLabel = forwardRef<ObjectLabelHandle, ObjectLabelProps>(function ObjectLabel(
  { name, tier = 'secondary', emphasised = false, marker, onSelect, onHover },
  forwardedRef,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const opacityRef = useRef(0);

  useImperativeHandle(forwardedRef, () => ({
    setPosition(xPx, yPx) {
      const node = rootRef.current;
      if (!node) return;
      node.style.transform = `translate(${xPx}px, ${yPx}px)`;
    },
    setOpacity(alpha) {
      const node = rootRef.current;
      if (!node) return;
      // Direction picks the transition (ObjectLabel.css): slow out, quick in.
      if (alpha < opacityRef.current) node.dataset.fadingOut = '';
      else if (alpha > opacityRef.current) delete node.dataset.fadingOut;
      if (alpha < HIDDEN_BELOW) {
        node.dataset.hidden = '';
        node.setAttribute('aria-hidden', 'true');
      } else {
        delete node.dataset.hidden;
        node.removeAttribute('aria-hidden');
      }
      opacityRef.current = alpha;
      node.style.opacity = String(alpha);
    },
  }));

  const content = (
    <>
      <span className="object-label__marker" aria-hidden />
      <span className="object-label__name">{name}</span>
    </>
  );

  return (
    <div
      ref={rootRef}
      className="object-label"
      data-tier={tier}
      data-emphasised={emphasised ? '' : undefined}
      data-marker={marker}
      data-hidden=""
      aria-hidden
      style={{ opacity: 0 }}
    >
      {onSelect ? (
        <button
          type="button"
          className="object-label__hit"
          aria-label={`Select ${name}`}
          // The search panel is the keyboard path; labels move every frame.
          tabIndex={-1}
          // The scene selects whatever is hovered on pointer-up, and picks the
          // hover on pointer-move; neither may see a label's pointer, or it
          // would act on the point under the label instead.
          onPointerMove={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={onSelect}
          onPointerEnter={() => onHover?.(true)}
          onPointerLeave={() => onHover?.(false)}
        >
          {content}
        </button>
      ) : (
        content
      )}
    </div>
  );
});
