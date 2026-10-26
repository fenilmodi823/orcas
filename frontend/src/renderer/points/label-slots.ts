import { FEATURED_OBJECT_IDS } from '../paths/featured-norads.js';

/** Exported so PointsDebug.tsx renders exactly this many DOM `<ObjectLabel>`
 * elements — one per slot this component writes into. */
export const LABEL_SLOT_COUNT = FEATURED_OBJECT_IDS.size + 2;
/** The current selection, if it isn't already featured. */
export const SELECTION_SLOT = FEATURED_OBJECT_IDS.size;
/** Watch's counterpart, if it is neither featured nor selected. */
export const PIN_SLOT = FEATURED_OBJECT_IDS.size + 1;
