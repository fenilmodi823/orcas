import { create } from 'zustand';

interface WarningState {
  /** Close-approach warnings the user dismissed (`warningKey`). In memory only: gone on reload (spec §3.2), kept across a replay remount. */
  dismissed: ReadonlySet<string>;
  dismiss: (key: string) => void;
}

export const useWarningStore = create<WarningState>((set) => ({
  dismissed: new Set(),
  dismiss: (key) => set((s) => ({ dismissed: new Set(s.dismissed).add(key) })),
}));
