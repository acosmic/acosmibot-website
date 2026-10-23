export const MAX_SAVED_STREAMERS = 5;

/** Selecting a new entry replaces an existing selection when slots are full. */
export function selectStreamer<T extends { enabled: boolean }>(
  streamers: T[], index: number, limit: number,
): T[] {
  if (!streamers[index] || limit <= 0) return streamers;
  let remaining = limit - 1;
  return streamers.map((streamer, position) => {
    if (position === index) return { ...streamer, enabled: true };
    const enabled = streamer.enabled && remaining > 0;
    if (enabled) remaining -= 1;
    return { ...streamer, enabled };
  });
}
