import { useMemo } from 'react';
import { satrecFromOmm } from '@orcas/physics';
import { buildDetailGroups, type DetailGroup } from './object-detail-model.js';
import type { ObjectMeta } from '../data/catalog-types.js';
import { buildConjunctionGroup } from './conjunction-detail.js';
import { useConjunctions } from './use-conjunctions.js';

/**
 * The selected object's info-panel groups. The satrec is built once per
 * selection, not per render; the groups follow the simulated clock, which the
 * caller already samples at display cadence. The Conjunction group is
 * appended last, from the latest screening run.
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

  const conjunctions = useConjunctions(object?.norad ?? null);

  if (!object) return [];
  const groups = buildDetailGroups(object, satrec, simulationMs, nowMs);
  return conjunctions ? [...groups, buildConjunctionGroup(conjunctions, object.norad, simulationMs)] : groups;
}
