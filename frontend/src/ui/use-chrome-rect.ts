import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { setChromeRect } from '../state/chrome-rects.js';

/** Registers the element's screen rectangle as chrome that labels hide under (Stage B §5.1). No React state. */
/** `layoutKey` re-measures when the element moves without resizing (nothing else would notice). */
export function useChromeRect(ref: RefObject<HTMLElement | null>, id: string, layoutKey?: unknown): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setChromeRect(id, el.getBoundingClientRect());
  }, [ref, id, layoutKey]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setChromeRect(id, el.getBoundingClientRect());
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(el);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      setChromeRect(id, null);
    };
  }, [ref, id]);
}
