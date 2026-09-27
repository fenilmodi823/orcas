import type { Conjunction, ConjunctionReport } from '../data/conjunction-client.js';
import { formatEpochUtc } from '../data/catalog-provenance.js';
import type { DetailField, DetailGroup } from './object-detail-model.js';

/** What the panel knows about the selected object's conjunctions right now. */
export type ConjunctionView =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'report'; readonly report: ConjunctionReport };

const NOT_A_WARNING = 'A labelled screening result, not an operational warning.';

function group(fields: DetailField[], note?: string): DetailGroup {
  return { id: 'conjunction', title: 'Conjunction', fields, note };
}

function status(value: string, note?: string): DetailGroup {
  return group([{ label: 'Status', value }], note);
}

function approachFields(c: Conjunction, selfNorad: string, countInWindow: number): DetailField[] {
  const other = c.primary.noradId === selfNorad ? c.secondary : c.primary;
  return [
    { label: 'Closest approach (TCA)', value: formatEpochUtc(c.tcaMs) },
    { label: 'With', value: `${other.name} (${other.noradId})` },
    { label: 'Miss distance', value: c.missDistanceKm * 1000, unit: 'm', precision: 0 },
    { label: 'Relative speed', value: c.relativeSpeedKmS, unit: 'km/s', precision: 2 },
    // A maximum, never "probability" alone; no number at all outside the 2D model.
    { label: 'Maximum P_c', value: c.maximumPc ?? 'not computed — outside 2D model validity', precision: 2 },
    { label: 'Assumed ellipse', value: `${c.aspectRatio}:1` },
    { label: 'Hard-body radius', value: c.hardBodyRadiusKm * 1000, unit: 'm', precision: 0 },
    { label: 'Dilution σ', value: c.dilutionSigmaKm * 1000, unit: 'm', precision: 0 },
    { label: 'Their element set', value: formatEpochUtc(other.elementSetEpochMs) },
    { label: 'Approaches in window', value: countInWindow, precision: 0 },
  ];
}

/**
 * The Conjunction group (brief §13.4.2) with everything RA-12 §7 requires
 * beside a maximum P_c: its aspect ratio, the hard-body radius, the dilution
 * σ, the counterpart's element-set epoch, the 2D-validity verdict and the
 * method. "Not screened" and "unreachable" are stated, never shown as a
 * clean bill of health. Shows the next approach at or after the simulated
 * time; if every screened approach is behind it, the last one, labelled so.
 */
export function buildConjunctionGroup(view: ConjunctionView, selfNorad: string, simulationMs: number): DetailGroup {
  if (view.kind === 'loading') return status('Loading…');
  if (view.kind === 'unavailable') {
    return status('Unavailable — the backend is not reachable', 'Screening results come from the backend; the scene does not need it.');
  }
  const { run, items } = view.report;
  if (run === null) {
    return status('Not screened yet', 'No screening run has completed. This is not the same as no close approaches.');
  }
  const window = `${formatEpochUtc(run.windowStartMs)} to ${formatEpochUtc(run.windowEndMs)}`;
  if (items.length === 0) {
    return status(`None within ${run.reportingDistanceKm} km`, `Screened ${window}. ${NOT_A_WARNING}`);
  }

  const next = items.find((c) => c.tcaMs >= simulationMs);
  const shown = next ?? items[items.length - 1];
  const fields = approachFields(shown, selfNorad, items.length);
  if (!next) fields[0] = { label: 'Last screened approach', value: formatEpochUtc(shown.tcaMs) };
  const validity = shown.valid2d ? '' : ` No maximum P_c: ${shown.validityReason ?? 'outside the 2D model'}.`;
  return group(fields, `${shown.method}${validity} Screened ${window}. ${NOT_A_WARNING}`);
}
