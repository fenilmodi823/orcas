import { ObjType, Regime, type ObjectMeta } from '../../data/catalog-types.js';
import type { OrbitClass } from '../../state/selection-store.js';
import { FLAG_VISIBLE } from './points-attributes.js';

const REGIME_TO_ORBIT_CLASS: Partial<Record<Regime, OrbitClass>> = {
  [Regime.LEO]: 'leo',
  [Regime.MEO]: 'meo',
  [Regime.GEO]: 'geo',
  [Regime.HEO]: 'heo',
};

/**
 * Maps the data layer's two-axis Regime/ObjType classification onto the
 * UI layer's already-shipped five-way OrbitClass taxonomy (FilterChip.tsx,
 * view-store.ts). Debris takes precedence over regime — it is its own
 * chip colour regardless of orbit shape. An object that is neither
 * debris nor a known regime has no matching chip: returns null, and
 * `packFilterFlags` treats null as always-visible (see its docstring).
 */
export function classifyOrbitClass(object: ObjectMeta): OrbitClass | null {
  if (object.type === ObjType.Debris) return 'debris';
  return REGIME_TO_ORBIT_CLASS[object.regime] ?? null;
}

/**
 * Builds `aFlags`: FLAG_VISIBLE for an object that should render given
 * the current filter selection, 0 otherwise. Empty `activeFilters` means
 * no restriction — every object is visible (the app's at-rest state). A
 * non-empty set narrows to only matching classes. An object with no
 * OrbitClass match (`classifyOrbitClass` returns null) is always
 * visible, since no chip exists that could be used to intentionally
 * hide it — the same "never hide data the UI has no control for"
 * principle M1.0 already applied to stale-but-valid objects.
 */
export function packFilterFlags(
  objects: readonly ObjectMeta[],
  activeFilters: ReadonlySet<OrbitClass>,
): Float32Array {
  const flags = new Float32Array(objects.length);
  for (let i = 0; i < objects.length; i++) {
    const orbitClass = classifyOrbitClass(objects[i]);
    const visible = orbitClass === null || activeFilters.size === 0 || activeFilters.has(orbitClass);
    flags[i] = visible ? FLAG_VISIBLE : 0;
  }
  return flags;
}

/** Real per-class object counts for the /points route's FilterChips —
 * an object with no OrbitClass match is not counted in any chip. */
export function countByOrbitClass(objects: readonly ObjectMeta[]): Record<OrbitClass, number> {
  const counts: Record<OrbitClass, number> = { leo: 0, meo: 0, geo: 0, heo: 0, debris: 0 };
  for (const object of objects) {
    const orbitClass = classifyOrbitClass(object);
    if (orbitClass !== null) counts[orbitClass]++;
  }
  return counts;
}
