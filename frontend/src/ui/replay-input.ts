const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/**
 * A `<input type="datetime-local">` value read as **UTC**, not the browser's
 * time zone — the control is labelled UTC, like every other time ORCAS shows.
 * Returns epoch ms, or null for an empty or malformed value.
 */
export function parseUtcDateTimeLocal(value: string): number | null {
  if (!DATETIME_LOCAL.test(value)) return null;
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const ms = Date.parse(`${withSeconds}Z`);
  if (!Number.isFinite(ms)) return null;
  // Date.parse rolls invalid fields over (month 13 -> next year); reject that.
  return new Date(ms).toISOString().slice(0, withSeconds.length) === withSeconds ? ms : null;
}

/** Epoch ms -> the `datetime-local` value for that UTC instant, to the minute. */
export function toUtcDateTimeLocal(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16);
}
