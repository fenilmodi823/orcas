import type { ScreeningRun } from '../data/conjunction-client.js';
import { formatEpochUtc } from '../data/catalog-provenance.js';
import { formatTelemetryValue } from './telemetry-format.js';
import type { WarningPick } from './conjunction-warning.js';

export const HEADLINE = 'Close approach';
/** Fenil's B.1.5 (b): the maximum adds no information beyond the distance. */
export const DERIVATION = 'Without real uncertainty data, this maximum comes from the miss distance alone.';
export const DISCLAIMER = 'A screening result, not an operational warning.';
const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Whole seconds as mm:ss, h:mm:ss past an hour, "N d hh:mm:ss" past a day. Sign dropped. */
export function formatCountdown(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000);
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d} d ${pad(h)}:${pad(m)}:${pad(s)}`;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

/** Every piece of the message (spec §3.4). Numbers are separate so the view can set them in mono. */
export interface WarningText {
  readonly countdown: string;
  readonly pair: string;
  readonly miss: string;
  readonly speed: string;
  readonly maximumPc: string;
  readonly aspectRatio: string;
  readonly hardBodyRadius: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  /** The older element set's age at closest approach. */
  readonly recordAge: string;
  /** Read once per new pass by the polite live region; no countdown in it. */
  readonly announcement: string;
}

export function warningText(pick: WarningPick, run: ScreeningRun, nowMs: number): WarningText {
  const c = pick.conjunction;
  if (c.maximumPc === null) throw new Error('warningText: a warning needs a maximum P_c (warningCandidates drops nulls)');
  const toTca = c.tcaMs - nowMs;
  const pair = `${c.primary.name} and ${c.secondary.name}`;
  const miss = `${formatTelemetryValue(c.missDistanceKm * 1000, 0)} m`;
  const maximumPc = formatTelemetryValue(c.maximumPc, 2);
  const ageDays = (c.tcaMs - Math.min(c.primary.elementSetEpochMs, c.secondary.elementSetEpochMs)) / DAY_MS;
  return {
    countdown: pick.phase === 'upcoming' ? `in ${formatCountdown(toTca)}` : `passed ${formatCountdown(toTca)} ago`,
    pair,
    miss,
    speed: `${formatTelemetryValue(c.relativeSpeedKmS, 2)} km/s`,
    maximumPc,
    aspectRatio: `${c.aspectRatio}:1`,
    hardBodyRadius: `${formatTelemetryValue(c.hardBodyRadiusKm * 1000, 0)} m`,
    windowStart: formatEpochUtc(run.windowStartMs),
    windowEnd: formatEpochUtc(run.windowEndMs),
    recordAge: `${formatTelemetryValue(ageDays, 2)} days`,
    announcement: `${HEADLINE}: ${pair}, ${miss} apart, maximum P_c ${maximumPc}.`,
  };
}

/** The slot's state when no message is showing (spec §3.3). */
export type QuietState =
  | { readonly kind: 'not-screened' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'idle'; readonly run: ScreeningRun; readonly simulationMs: number };

export interface QuietLine {
  readonly text: string;
  readonly goThere: boolean;
}

function screenedAgo(completedAtMs: number, wallNowMs: number): string {
  const days = Math.floor((wallNowMs - completedAtMs) / DAY_MS);
  if (days < 1) return 'less than a day ago';
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

/** "Not screened" and "unreachable" are stated, never shown as all clear. */
export function quietLine(state: QuietState, wallNowMs: number): QuietLine {
  if (state.kind === 'not-screened') return { text: 'No screening run yet', goThere: false };
  if (state.kind === 'unavailable') {
    return { text: 'Close-approach warnings unavailable: the backend is not reachable', goThere: false };
  }
  const { run, simulationMs } = state;
  const window = `${formatEpochUtc(run.windowStartMs)} → ${formatEpochUtc(run.windowEndMs)}`;
  if (simulationMs >= run.windowStartMs && simulationMs <= run.windowEndMs) {
    return { text: `Close-approach warnings: none due · screened ${window}`, goThere: false };
  }
  return {
    text: `Close-approach warnings cover ${window} (screened ${screenedAgo(run.completedAtMs, wallNowMs)})`,
    goThere: true,
  };
}
