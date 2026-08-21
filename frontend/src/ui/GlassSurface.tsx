import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useRef } from 'react';
import './GlassSurface.css';

export type GlassVariant = 'floating' | 'docked' | 'modal';
export type GlassElevation = 1 | 2 | 3 | 4;

export interface GlassSurfaceProps {
  variant: GlassVariant;
  elevation?: GlassElevation;
  /** Tracks the cursor for the specular highlight. Off by default — cheap to render, not free. */
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * The base Liquid Glass surface (Design.md §2, §6): blur, saturation lift,
 * specular edge, elevation shadow and fill, with a `@supports` fallback for
 * browsers without `backdrop-filter`.
 *
 * Only render this over the live 3D scene — a glass surface with nothing
 * behind it is a lie the eye detects instantly (UI-Research §2).
 */
export function GlassSurface({
  variant,
  elevation = 2,
  interactive = false,
  className,
  style,
  children,
}: GlassSurfaceProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const mx = ((event.clientX - rect.left) / rect.width) * 100;
    const my = ((event.clientY - rect.top) / rect.height) * 100;
    // Written straight to the DOM, not React state — this fires on every
    // pointermove, and a state update here would re-render per mouse pixel.
    node.style.setProperty('--mx', `${mx}%`);
    node.style.setProperty('--my', `${my}%`);
  }

  return (
    <div
      ref={ref}
      data-variant={variant}
      data-elevation={elevation}
      data-interactive={interactive ? '' : undefined}
      className={['glass-surface', className].filter(Boolean).join(' ')}
      style={style}
      onPointerMove={interactive ? handlePointerMove : undefined}
    >
      {interactive && <div aria-hidden className="glass-surface__highlight" />}
      {children}
    </div>
  );
}
