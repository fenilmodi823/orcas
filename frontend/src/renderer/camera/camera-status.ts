import { create } from 'zustand';

/**
 * Camera facts other subsystems need, and the one command the dev panel
 * needs to send back.
 *
 * Kept out of `CameraSystem` itself because the system is deliberately
 * headless — it owns no React and no store — and out of `camera-tunables`
 * because these are not tunables. Written only on CHANGE, never per frame
 * (Rules.md: React state must not be updated every frame).
 */
interface CameraStatus {
  /** True while a focus flight or an exit is playing. Picking is suppressed
   * for the duration (brief §D.3): the cursor is not aimed at anything
   * during a 2-second automatic move, so every pick in that window is a
   * GPU round trip whose answer is discarded. */
  flying: boolean;
  /** Bumped by "Reset view & tunables". A counter rather than a boolean so
   * a second press while already at rest still registers. */
  resetRequests: number;
  setFlying(flying: boolean): void;
  requestReset(): void;
}

export const useCameraStatus = create<CameraStatus>((set) => ({
  flying: false,
  resetRequests: 0,
  setFlying: (flying) => set((s) => (s.flying === flying ? s : { flying })),
  requestReset: () => set((s) => ({ resetRequests: s.resetRequests + 1 })),
}));
