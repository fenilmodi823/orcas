import { useEffect, useSyncExternalStore } from 'react';
import { useViewStore } from './view-store.js';

const QUERY = '(prefers-reduced-motion: reduce)';

/** Missing in some test and embedded environments: "no preference", never a crash. */
function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function subscribe(onChange: () => void): () => void {
  if (!hasMatchMedia()) return () => {};
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return hasMatchMedia() && window.matchMedia(QUERY).matches;
}

/**
 * The app's single source for reduced motion: the in-app override when the
 * user has set one, the OS preference otherwise.
 *
 * Read in JS rather than only in CSS, because the preference has to reach the
 * camera state machine and the landing sequence, not just a stylesheet
 * (brief §6.5 note 2).
 *
 * `useSyncExternalStore` is React's primitive for exactly this: it reads the
 * OS value synchronously on the first render — the landing sequence decides
 * its whole behaviour from that render, so a value arriving one effect later
 * would give a reduced-motion user the full cinematic — and it resubscribes
 * without the tearing an effect-plus-setState version is prone to. The OS
 * setting can change mid-session (note 1), and this follows it.
 *
 * The view store keeps a copy for readers that are not React components.
 */
export function useReducedMotion(): boolean {
  const override = useViewStore((s) => s.reducedMotionOverride);
  const setOsPrefersReducedMotion = useViewStore((s) => s.setOsPrefersReducedMotion);
  const osPreference = useSyncExternalStore(subscribe, getSnapshot, () => false);

  useEffect(() => {
    setOsPrefersReducedMotion(osPreference);
  }, [osPreference, setOsPrefersReducedMotion]);

  return override ?? osPreference;
}
