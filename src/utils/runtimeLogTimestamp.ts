const LEGACY_NAIVE_UTC = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}$/;

export function parseRuntimeLogTimestamp(value: string): Date | null {
  const timestamp = value.trim();
  if (!timestamp) return null;

  const normalized = LEGACY_NAIVE_UTC.test(timestamp)
    ? `${timestamp.replace(' ', 'T').replace(',', '.')}Z`
    : timestamp;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
