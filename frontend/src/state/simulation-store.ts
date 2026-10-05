import { create } from 'zustand';
import { stepRate } from '../time/rate-ladder.js';

interface SimulationState {
  currentTime: Date;
  rate: number;
  playing: boolean;
  /** Time runs backwards; `rate` is the magnitude (simulated s per real s). */
  reversed: boolean;
  play: () => void;
  pause: () => void;
  togglePlaying: () => void;
  /** Anchored to now: true at start and after NOW, cleared by any hand on
   * the time or rate — NASA Eyes' LIVE (Reference §4.1). It is intent, not
   * clock lag: a throttled tab lets the clock fall behind without anyone
   * moving time. */
  live: boolean;
  /** A scrub or a typed time: the clock is no longer anchored to now. */
  leaveLive: () => void;
  /** One ▶▶ (+1) or ◀◀ (−1) press along NASA Eyes' signed ladder. */
  stepRate: (direction: 1 | -1) => void;
  /** Why the clock just stopped at the edge of the data, or null. */
  edgeNotice: string | null;
  setEdgeNotice: (notice: string | null) => void;
  setCurrentTime: (time: Date) => void;
  jumpToNow: () => void;
}

/** The signed rate the simulation loop consumes: negative runs time backwards. */
export function effectiveRate(state: Pick<SimulationState, 'rate' | 'reversed'>): number {
  return state.reversed ? -state.rate : state.rate;
}

/** Time, rate, playing — Architecture.md §5.
 *
 * Opens playing, in real time: NASA Eyes starts live (Rules.md §10 defers UX
 * to it), and the scene is the data — a paused catalogue on first load reads
 * as broken. This store is what Space and the TimeDock write to, and
 * `useLiveScene` mirrors it into the simulation loop. */
export const useSimulationStore = create<SimulationState>((set) => ({
  currentTime: new Date(),
  rate: 1,
  playing: true,
  reversed: false,
  edgeNotice: null,
  live: true,
  leaveLive: () => set({ live: false }),
  setEdgeNotice: (edgeNotice) => set({ edgeNotice }),
  play: () => set({ playing: true }),
  pause: () => set({ playing: false, live: false }),
  togglePlaying: () => set((state) => ({ playing: !state.playing, live: state.playing ? false : state.live })),
  stepRate: (direction) =>
    set((state) => {
      const next = stepRate(effectiveRate(state), direction);
      return { rate: Math.abs(next), reversed: next < 0, live: false };
    }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  // Back to the present means back to real time: forwards, at 1x.
  jumpToNow: () => set({ currentTime: new Date(), rate: 1, reversed: false, live: true }),
}));
