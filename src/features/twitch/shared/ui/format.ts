/** Small display formatters shared by Twitch pages. Pure functions. */

const UNIT_SECONDS = { d: 86_400, h: 3_600, m: 60, s: 1 } as const;

/** `5400` → "1h 30m"; `45` → "45s"; `0` → "0s". At most `parts` units. */
export function formatDuration(totalSeconds: number, parts = 2): string {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  if (seconds === 0) return '0s';
  const out: string[] = [];
  let rest = seconds;
  for (const [unit, size] of Object.entries(UNIT_SECONDS)) {
    if (out.length >= parts) break;
    const count = Math.floor(rest / size);
    if (count > 0) {
      out.push(`${count}${unit}`);
      rest -= count * size;
    }
  }
  return out.join(' ');
}

/** Long form for sentences: `300` → "5 minutes". */
export function describeDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
  if (seconds % 86_400 === 0 && seconds >= 86_400) return plural(seconds / 86_400, 'day');
  if (seconds % 3_600 === 0 && seconds >= 3_600) return plural(seconds / 3_600, 'hour');
  if (seconds % 60 === 0 && seconds >= 60) return plural(seconds / 60, 'minute');
  return plural(seconds, 'second');
}

const toDate = (value: string | number | Date | null | undefined): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Locale date and time, or an em dash. */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

/** "just now", "5 minutes ago", "in 2 hours"; falls back to the date after a week. */
export function formatRelative(value: string | number | Date | null | undefined, now: number = Date.now()): string {
  const date = toDate(value);
  if (!date) return '—';
  const diff = date.getTime() - now;
  const abs = Math.abs(diff);
  if (abs < 45_000) return 'just now';
  if (abs > 7 * 86_400_000) return formatDateTime(date);
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (abs < 3_600_000) return format.format(Math.round(diff / 60_000), 'minute');
  if (abs < 86_400_000) return format.format(Math.round(diff / 3_600_000), 'hour');
  return format.format(Math.round(diff / 86_400_000), 'day');
}

/** Grouped integer, e.g. `12345` → "12,345". */
export function formatNumber(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '—';
}
