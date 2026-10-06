import { bodyById, type Body } from '../renderer/solar/bodies.js';
import { useSelectionStore } from '../state/selection-store.js';

/** The selected body, if any, resolved from the store's id (S5a). */
export function useSelectedBody(): Body | null {
  const id = useSelectionStore((s) => s.selectedBody);
  return id === null ? null : (bodyById(id) ?? null);
}
