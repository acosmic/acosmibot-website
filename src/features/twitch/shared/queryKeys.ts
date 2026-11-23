/**
 * TanStack Query keys (§11.6). Every Twitch key starts with `'twitch'` so a
 * sign-out can drop them all, and every channel-scoped key starts with
 * `['twitch', channelId]` so a `config.changed` feed event can refetch them.
 */
export const TWITCH_ME_KEY = ['twitch', 'me'] as const;
export const TWITCH_CHANNELS_KEY = ['twitch', 'channels'] as const;
export const TWITCH_META_KEY = ['twitch', 'meta'] as const;

/** `['twitch', channelId, ...parts]`, e.g. `tk(id, 'commands')`, `tk(id, 'settings', 'loyalty')`. */
export const tk = (channelId: string, ...parts: ReadonlyArray<string | number | boolean | null | Record<string, unknown>>) =>
  ['twitch', channelId, ...parts] as const;

export const summaryKey = (channelId: string) => tk(channelId, 'summary');
export const settingsKey = (channelId: string, section: string) => tk(channelId, 'settings', section);

/** Public pages: `['twitch-public', login, page, ...rest]`. */
export const publicKey = (login: string, page: string, ...rest: ReadonlyArray<string | number | null>) =>
  ['twitch-public', login, page, ...rest] as const;
