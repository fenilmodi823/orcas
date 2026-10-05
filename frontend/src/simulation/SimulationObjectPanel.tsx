import { useCallback } from 'react';
import type { ObjectMeta } from '../data/catalog-types.js';
import type { CatalogProvenance } from '../data/catalog-provenance.js';
import type { LiveSceneState } from '../renderer/live/use-live-scene.js';
import { resolveSelectableObject } from '../renderer/points/points-selection-resolve.js';
import { classifyOrbitClass } from '../renderer/points/points-filters.js';
import { ObjectPanel } from '../ui/ObjectPanel.js';
import { ExportEphemerisButton } from '../ui/ExportEphemerisButton.js';
import { useDetailGroups } from '../ui/use-detail-groups.js';
import { useSelectionStore } from '../state/selection-store.js';
import { useSimulationClock } from './use-simulation-clock.js';

interface SimulationObjectPanelProps {
  readonly scene: LiveSceneState;
  readonly meta: ObjectMeta;
  readonly provenance: CatalogProvenance;
}

/**
 * The left panel's live half (B.15). It owns its own slow clock, so its 4 Hz
 * re-renders stay inside the panel and only run while something is selected.
 * The summary re-resolves from the frame state on that tick, not from
 * `scene.resolvedSelected`, which froze while an object sat selected
 * (memory 2026-09-26).
 */
export function SimulationObjectPanel({ scene, meta, provenance }: SimulationObjectPanelProps) {
  const currentTime = useSimulationClock(scene.loop.frameStateRef, provenance.nowMs);
  const groups = useDetailGroups(meta, currentTime.getTime(), provenance.nowMs);
  const setSelected = useSelectionStore((s) => s.setSelected);
  const close = useCallback(() => setSelected(null), [setSelected]);
  // Null until the loop has computed a position (a cold start can take
  // seconds); the panel says so rather than showing invented numbers.
  const live = resolveSelectableObject(meta.norad, scene.objects, scene.byNorad, scene.loop.frameStateRef.current);
  const identity = { name: meta.name, noradId: meta.norad, orbitClass: classifyOrbitClass(meta) ?? 'debris' };

  return (
    <ObjectPanel
      object={identity}
      readouts={live}
      groups={groups}
      onClose={close}
      actions={<ExportEphemerisButton object={meta} startMs={currentTime.getTime()} />}
    />
  );
}
