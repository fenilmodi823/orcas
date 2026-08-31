/**
 * No per-object physical size exists in the ingested data: `OmmRecord`
 * (packages/orcas-physics/src/types.ts) carries no RCS_SIZE field at all —
 * verified by reading the CelesTrak OMM schema this codebase actually
 * ingests, not assumed. Rather than invent a per-object size (Rules.md
 * §7, "never invent numbers"), every object uses this one placeholder —
 * 10 metres, a plausible order of magnitude for a small satellite, not a
 * measurement. Real RCS ingestion is a Data-Strategy follow-up.
 *
 * Lives here, not in points-attributes.ts, because three subsystems need
 * it: the Tier 0 attribute packer, the camera's object-mode framing, and
 * the Tier 1 LOD band. It was duplicated across two of them before M1.7a.
 *
 * ponytail: when real sizes land, `packRadii` becomes a per-object lookup
 * and this constant becomes its fallback. The apparent-size formula and
 * the LOD band do not change.
 */
export const PLACEHOLDER_RADIUS_KM = 0.01;
