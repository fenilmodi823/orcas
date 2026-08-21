import type { OmmRecord } from '@orcas/physics';

/**
 * Branded so a NORAD id string can't be passed where any other string is
 * wanted. NORAD_CAT_ID is always a decimal string, never a number — see
 * Rules.md's hard ban on integer norad_id and the Phase-4 brief's M0.1
 * identity fix. This deliberately diverges from the brief's own
 * core-types sketch (`NoradId = number & brand`) for exactly that reason:
 * adopting it here would silently reintroduce the bug M0.1 just closed.
 */
export type NoradId = string & { readonly __brand: 'NoradId' };

export const enum Regime {
  LEO = 0,
  MEO = 1,
  GEO = 2,
  HEO = 3,
  Unknown = 4,
}

export const enum ObjType {
  Payload = 0,
  RocketBody = 1,
  Debris = 2,
  Unknown = 3,
}

/** One catalogue entry, validated and classified. Frozen once built — see
 * buildSnapshot in catalog-snapshot.ts. */
export interface ObjectMeta {
  readonly norad: NoradId;
  readonly name: string;
  readonly objectId: string;
  readonly type: ObjType;
  readonly regime: Regime;
  readonly isActive: boolean;
  readonly sourceType: string;
  /** Element-set epoch, ms since Unix epoch (not TAI — this is a debug/UI
   * timestamp, not a propagation input). */
  readonly epochMs: number;
  /** The full canonical record, for propagation — see @orcas/physics. */
  readonly record: OmmRecord;
}

export type RejectionReason =
  | 'missing-required-field'
  | 'invalid-field-type'
  | 'duplicate-norad-id'
  | 'epoch-in-the-future'
  | 'propagation-failed';

export interface RejectedRecord {
  readonly reason: RejectionReason;
  readonly detail: string;
  readonly raw: unknown;
}

/**
 * Tier 1 per the Phase-4 brief's §A.4: deeply frozen, replaced wholesale,
 * never patched. `byNorad` is a plain frozen object rather than a Map —
 * `Object.freeze(new Map())` does not actually block `.set()`/`.delete()`
 * at runtime (a well-known JS gotcha), so a Map can't satisfy "zero
 * mutations possible." A frozen plain object genuinely can.
 */
export interface CatalogSnapshot {
  readonly version: number;
  readonly fetchedAtMs: number;
  readonly objects: readonly ObjectMeta[];
  readonly byNorad: Readonly<Record<string, number>>;
  readonly rejected: readonly RejectedRecord[];
}
