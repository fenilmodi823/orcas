import type { CSSProperties, ReactNode } from 'react';
import './GlassSurface.css';

type GlassVariant = 'floating' | 'docked' | 'modal';
type GlassElevation = 1 | 2 | 3 | 4;

export interface GlassSurfaceProps {
  variant: GlassVariant;
  elevation?: GlassElevation;
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * The base Liquid Glass surface (Design.md §2, §6): blur, saturation lift,
 * a hairline edge, elevation shadow and fill, with a `@supports` fallback for
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
  return (
    <div
      data-variant={variant}
      data-elevation={elevation}
      data-interactive={interactive ? '' : undefined}
      className={['glass-surface', className].filter(Boolean).join(' ')}
      style={style}
    >
      {children}
    </div>
  );
}
