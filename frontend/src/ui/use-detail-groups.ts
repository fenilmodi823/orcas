import { useMemo } from 'react';
import { satrecFromOmm } from '@orcas/physics';
import { buildDetailGroups, type DetailGroup } from './object-detail-model.js';
import type { ObjectMeta } from '../data/catalog-types.js';

/**
 * The selected object's info-panel groups. The satrec is built once per
 * selection, not per render; the groups follow the simulated clock, which the
 * caller already samples at display cadence.
 */
export function useDetailGroups(object: ObjectMeta | null, simulationMs: number, nowMs: number): DetailGroup[] {
  const satrec = useMemo(() => {
    if (!object) return null;
    try {
      return satrecFromOmm(object.record);
    } catch {
      return null; // unusable elements: the kinematics group collapses
    }
  }, [object]);

  return object ? buildDetailGroups(object, satrec, simulationMs, nowMs) : [];
}
