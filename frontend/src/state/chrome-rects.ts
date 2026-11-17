/** Screen rectangles of the UI chrome, in CSS px; labels whose anchor falls inside one hide (Stage B §5.1). */
const rects = new Map<string, DOMRectReadOnly>();

const listeners = new Set<() => void>();

export function setChromeRect(id: string, rect: DOMRectReadOnly | null): void {
  if (rect) rects.set(id, rect);
  else rects.delete(id);
  listeners.forEach((l) => l());
}

export function getChromeRect(id: string): DOMRectReadOnly | undefined {
  return rects.get(id);
}

/** Calls `fn` whenever any rectangle changes (layout events only, never per frame); returns the unsubscribe. */
export function subscribeChromeRects(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// ponytail: linear scan over at most four rectangles, per label per frame; index them if chrome ever grows past a handful.
export function isUnderChrome(xPx: number, yPx: number): boolean {
  for (const r of rects.values()) if (xPx >= r.left && xPx <= r.right && yPx >= r.top && yPx <= r.bottom) return true;
  return false;
}
