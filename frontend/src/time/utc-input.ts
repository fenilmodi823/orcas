const UTC_INPUT = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?\s*(?:Z|UTC)?$/i;

/**
 * A typed simulation time, read strictly as UTC (A.11: UTC everywhere).
 * Accepts the clock's own "YYYY-MM-DD HH:MM:SS UTC", an ISO "…T…Z", minutes
 * without seconds, or a bare date (midnight). Returns ms since the Unix epoch,
 * or null for anything it would have to guess at: other orders, locale month
 * names, offsets, or a day that doesn't exist (2026-02-30).
 */
export function parseUtcInput(text: string): number | null {
  const match = UTC_INPUT.exec(text.trim());
  if (!match) return null;
  const [year, month, day, hour, minute, second] = [1, 2, 3, 4, 5, 6].map((i) => Number(match[i] ?? 0));
  if (hour > 23 || minute > 59 || second > 59) return null;
  const ms = Date.UTC(year, month - 1, day, hour, minute, second);
  // Date.UTC rolls 2026-02-30 over to 2026-03-02; a real date round-trips.
  const check = new Date(ms);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return ms;
}
