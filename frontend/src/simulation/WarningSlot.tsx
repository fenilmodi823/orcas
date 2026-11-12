import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { getChromeRect, subscribeChromeRects } from '../state/chrome-rects.js';

/** The warning's slot: starts --space-2 (8 px) below the epoch block's measured bottom; CSS keeps 56px until the first measure. */
export function WarningSlot({ children }: { readonly children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const place = () => {
      const epoch = getChromeRect('epoch');
      if (epoch) ref.current?.style.setProperty('--warning-top', `${epoch.bottom + 8}px`);
    };
    place();
    return subscribeChromeRects(place);
  }, []);
  return <div ref={ref} className="simulation__warning">{children}</div>;
}
