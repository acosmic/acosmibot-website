// Zero is an explicit admin opt-in to a permanent full personality.
export function personalityDuration(value: unknown): number {
  if (value === 0 || value === '0') return 0;
  const minutes = Number(value);
  return value == null || value === '' || typeof value === 'boolean' || !Number.isFinite(minutes)
    ? 10 : Math.min(10080, Math.max(5, Math.trunc(minutes)));
}
