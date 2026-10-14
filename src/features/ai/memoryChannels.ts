// Memory extraction can be switched off per channel. Recall is server-wide, so
// facts learned in a private channel can come up anywhere in the server.

export interface MemoryChannel {
  id: string;
  name: string;
  is_private?: boolean;
}

/** Unique Discord snowflake strings — must mirror acosmibot-core ai_personalities. */
export function normalizeMemoryExcludedChannels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const raw of value) {
    const id = String(raw ?? '').trim();
    if (/^\d+$/.test(id) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function toggleMemoryChannel(excluded: string[], channelId: string): string[] {
  return excluded.includes(channelId)
    ? excluded.filter(id => id !== channelId)
    : [...excluded, channelId];
}

/** Private channels where memory is still being learned. */
export function privateChannelsStillLearning<T extends MemoryChannel>(
  channels: T[],
  excluded: string[],
): T[] {
  return channels.filter(channel => channel.is_private && !excluded.includes(channel.id));
}

export function excludePrivateChannels(channels: MemoryChannel[], excluded: string[]): string[] {
  return [
    ...excluded,
    ...privateChannelsStillLearning(channels, excluded).map(channel => channel.id),
  ];
}
