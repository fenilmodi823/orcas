import { create } from 'zustand';

export const RATE_STEPS = [1, 10, 100, 1000, 10000] as const;

interface SimulationState {
  currentTime: Date;
  rate: number;
  playing: boolean;
  play: () => void;
  pause: () => void;
  togglePlaying: () => void;
  cycleRate: () => void;
  setCurrentTime: (time: Date) => void;
  jumpToNow: () => void;
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
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  togglePlaying: () => set((state) => ({ playing: !state.playing })),
  cycleRate: () =>
    set((state) => {
      const index = RATE_STEPS.indexOf(state.rate as (typeof RATE_STEPS)[number]);
      const next = RATE_STEPS[(index + 1) % RATE_STEPS.length] ?? RATE_STEPS[0];
      return { rate: next };
    }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  jumpToNow: () => set({ currentTime: new Date(), rate: 1 }),
}));
