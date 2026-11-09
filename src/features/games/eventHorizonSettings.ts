/** A stored Discord channel snowflake as a string, or null when absent or malformed. */
export function channelIdOrNull(value: unknown): string | null {
  const text = typeof value === 'number' || typeof value === 'string' ? String(value).trim() : '';
  return /^\d{17,20}$/.test(text) ? text : null;
}
