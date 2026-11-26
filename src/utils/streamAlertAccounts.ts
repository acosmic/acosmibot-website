/** Pure helpers for the stream alerts page: which account is shown, and how it is named. */

interface AccountLike {
  id: number;
  is_own: boolean;
  owner_username: string;
}

/** The `?account=` value as an account id, or null when it is missing or not a plain positive number. */
export function parseAccountParam(value: string | null | undefined): number | null {
  if (!value || !/^[1-9]\d{0,15}$/.test(value)) return null;
  return Number(value);
}

/**
 * The account to show. A link's `?account=` wins when the person can open that account;
 * otherwise their own account; otherwise the first one they edit.
 */
export function pickAccount<T extends { id: number }>(
  accounts: readonly T[], requested: string | null | undefined, ownAccountId: number | null,
): T | null {
  const wanted = parseAccountParam(requested);
  return accounts.find((account) => account.id === wanted)
    ?? accounts.find((account) => account.id === ownAccountId)
    ?? accounts[0]
    ?? null;
}

/** True when a link asked for an account this person cannot open, so the page shows another one. */
export function linkedAccountMissing(accounts: readonly { id: number }[], requested: string | null | undefined): boolean {
  if (!requested) return false;
  const wanted = parseAccountParam(requested);
  return !accounts.some((account) => account.id === wanted);
}

/** Your own account first, then the ones you edit by owner name. */
export function orderAccounts<T extends AccountLike>(accounts: readonly T[]): T[] {
  return [...accounts].sort((a, b) => (
    Number(b.is_own) - Number(a.is_own)
    || a.owner_username.localeCompare(b.owner_username, undefined, { sensitivity: 'base' })
    || a.id - b.id
  ));
}

export function ownerPossessive(ownerUsername: string): string {
  return `${ownerUsername.trim() || 'Someone'}'s`;
}

/** Switcher label: "Yours" or "<owner_username>'s". */
export function accountLabel(account: AccountLike): string {
  return account.is_own ? 'Yours' : ownerPossessive(account.owner_username);
}

/** A request failure in plain words, without the "Error:" prefix or the API's internal codes. */
export function plainError(error: unknown): string {
  const text = (error instanceof Error ? error.message : String(error ?? '')).trim();
  if (text === 'owner_required') return 'Only the owner of these stream alerts can do that.';
  if (text === 'Not found') return 'These stream alerts no longer exist, or you no longer have access to them.';
  if (text === 'Failed to fetch' || text === 'Load failed') return 'Could not reach Acosmibot. Check your connection and try again.';
  if (text === 'Twitch did not answer') return 'Twitch did not answer. Try again in a moment.';
  if (text === 'Twitch is not connected') return 'Twitch is not connected any more.';
  return text || 'Something went wrong.';
}

/* ---- Connect Twitch and channel point rewards ---- */

/**
 * React Query keys for what the page reads about Twitch. Each one carries the account id, so
 * an answer for one account is never shown for another.
 */
export const twitchQueryKey = (accountId: number) => ['stream-alerts', accountId, 'twitch'] as const;
export const rewardsQueryKey = (accountId: number) => ['stream-alerts', accountId, 'rewards'] as const;

export interface PageNotice {
  tone: 'ok' | 'error' | 'note';
  text: string;
}

/** The address parameter the API adds when it sends the owner back from Twitch. */
export const TWITCH_RESULT_PARAM = 'twitch';
export const TWITCH_RESULTS = ['connected', 'denied', 'missing_scopes', 'in_use', 'expired', 'error'] as const;
export type TwitchConnectResult = typeof TWITCH_RESULTS[number];

/** The `?twitch=` value as one of the known results, or null for anything else. */
export function parseTwitchResult(value: string | null | undefined): TwitchConnectResult | null {
  return (TWITCH_RESULTS as readonly string[]).includes(value ?? '') ? (value as TwitchConnectResult) : null;
}

/**
 * What the address says on the way back from Twitch: whether `?twitch=` is there at all (so it
 * can be taken out, even when its value means nothing), the result, and the account it is about.
 */
export function readTwitchReturn(search: string | URLSearchParams): {
  present: boolean; result: TwitchConnectResult | null; accountId: number | null;
} {
  const params = new URLSearchParams(search);
  return {
    present: params.has(TWITCH_RESULT_PARAM),
    result: parseTwitchResult(params.get(TWITCH_RESULT_PARAM)),
    accountId: parseAccountParam(params.get('account')),
  };
}

/** The same address parameters without `?twitch=`. Everything else, `?account=` included, stays. */
export function withoutTwitchResult(search: string | URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(search);
  next.delete(TWITCH_RESULT_PARAM);
  return next;
}

const TWITCH_RESULT_TEXT: Record<TwitchConnectResult, PageNotice> = {
  connected: { tone: 'ok', text: 'Twitch is connected. Real follows, subs, bits, raids and hype trains now play on your overlay.' },
  denied: { tone: 'note', text: 'You cancelled on Twitch, so nothing was connected. You can connect whenever you like.' },
  missing_scopes: { tone: 'error', text: 'Twitch did not give Acosmibot every permission it asked for, so nothing was connected. Try again and approve the whole list.' },
  in_use: { tone: 'error', text: "That Twitch channel is already connected to someone else's stream alerts, so nothing was connected. Sign in to Twitch as your own channel and try again." },
  expired: { tone: 'error', text: 'That took too long, or the page was opened twice, so nothing was connected. Press Connect Twitch to start again.' },
  error: { tone: 'error', text: 'Something went wrong while connecting Twitch, so nothing was connected. Try again in a moment.' },
};

/**
 * The message for a result. `linked` is what the API says now: true when Twitch is connected and
 * working, false when it is not, null while that is still loading. "Connected" is only said once
 * the API agrees, so a made-up link cannot claim it.
 */
export function twitchReturnNotice(result: TwitchConnectResult | null, linked: boolean | null): PageNotice | null {
  if (!result) return null;
  if (result !== 'connected') return TWITCH_RESULT_TEXT[result];
  if (linked === null) return null;
  return linked ? TWITCH_RESULT_TEXT.connected : { tone: 'error', text: 'Twitch did not finish connecting. Try again.' };
}

/**
 * The address the Connect Twitch link goes to, or null when the API's answer is not one this
 * page should send a browser to: it must be the connect page, for this account, over https
 * (plain http only on this computer).
 */
export function twitchConnectHref(connectUrl: string | null | undefined, accountId: number): string | null {
  if (!connectUrl) return null;
  let url: URL;
  try {
    url = new URL(connectUrl);
  } catch {
    return null;
  }
  const local = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (url.protocol !== 'https:' && !local) return null;
  if (url.pathname !== '/auth/stream-alerts/twitch/start') return null;
  if (url.searchParams.get('account') !== String(accountId)) return null;
  return url.href;
}

/** The Twitch events the API listens for, in the words the page uses for them. */
const TWITCH_EVENT_GROUPS: { label: string; types: string[] }[] = [
  { label: 'follows', types: ['channel.follow'] },
  { label: 'subs', types: ['channel.subscribe'] },
  { label: 'resubs', types: ['channel.subscription.message'] },
  { label: 'gift subs', types: ['channel.subscription.gift'] },
  { label: 'bits', types: ['channel.cheer'] },
  { label: 'raids', types: ['channel.raid'] },
  { label: 'hype trains', types: ['channel.hype_train.begin', 'channel.hype_train.end'] },
  {
    label: 'channel point rewards',
    types: ['channel.channel_points_custom_reward_redemption.add', 'channel.channel_points_custom_reward_redemption.update'],
  },
];
const OTHER_TWITCH_EVENTS = 'some other events';
const TWITCH_SUB_WORKING = 'enabled';
/** Twitch has accepted the request and is checking the address it will send events to. Seconds, normally. */
const TWITCH_SUB_SETTING_UP = 'webhook_callback_verification_pending';

export interface TwitchListening {
  listening: string[];
  settingUp: string[];
  /** Failed, switched off by Twitch, or never set up. The owner's "Fix" asks for these again. */
  failed: string[];
}

/**
 * Which kinds of Twitch event reach the overlay. A kind counts as listening only when every
 * subscription behind it is enabled; one that is missing from the list counts as failed.
 */
export function twitchListening(subscriptions: readonly { type: string; status: string }[]): TwitchListening {
  const statusOf = new Map(subscriptions.map((item) => [item.type, item.status]));
  const result: TwitchListening = { listening: [], settingUp: [], failed: [] };
  const known = new Set<string>();
  for (const group of TWITCH_EVENT_GROUPS) {
    const statuses = group.types.map((type) => statusOf.get(type));
    for (const type of group.types) known.add(type);
    if (statuses.every((status) => status === TWITCH_SUB_WORKING)) result.listening.push(group.label);
    else if (statuses.every((status) => status === TWITCH_SUB_WORKING || status === TWITCH_SUB_SETTING_UP)) result.settingUp.push(group.label);
    else result.failed.push(group.label);
  }
  // A kind this page has no word for yet still has to show up when it is broken.
  const others = subscriptions.filter((item) => !known.has(item.type) && item.status !== TWITCH_SUB_WORKING);
  if (others.some((item) => item.status !== TWITCH_SUB_SETTING_UP)) result.failed.push(OTHER_TWITCH_EVENTS);
  else if (others.length > 0) result.settingUp.push(OTHER_TWITCH_EVENTS);
  return result;
}

/** "a", "a and b", "a, b and c". */
export function listWords(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** "300 points", "1,500 points", "1 point". */
export function rewardCost(cost: number): string {
  const whole = Math.max(0, Math.round(Number(cost) || 0));
  return `${whole.toLocaleString('en-US')} ${whole === 1 ? 'point' : 'points'}`;
}

/** Why viewers cannot redeem a reward right now, or null when they can. */
export function rewardNote(reward: { is_enabled: boolean; is_paused: boolean }): string | null {
  if (!reward.is_enabled) return 'Turned off on Twitch';
  if (reward.is_paused) return 'Paused on Twitch';
  return null;
}

/** The effects no reward plays yet. The owner can create the standard reward for each of them. */
export function effectsWithoutReward<E extends { name: string }>(
  effects: readonly E[], rewards: readonly { mapping: { effect: string } | null }[],
): E[] {
  const used = new Set(rewards.map((reward) => reward.mapping?.effect));
  return effects.filter((effect) => !used.has(effect.name));
}

/** A copy of the rewards with one reward's mapping replaced. The list given is left as it was. */
export function withRewardMapping<M, R extends { id: string; mapping: M | null }>(
  rewards: readonly R[], rewardId: string, mapping: M | null,
): R[] {
  return rewards.map((reward) => (reward.id === rewardId ? { ...reward, mapping } : reward));
}

/** True when the API refused because the account has no Twitch connection (any more). */
export function isTwitchNotConnected(error: unknown): boolean {
  return error instanceof Error && error.message.trim() === 'Twitch is not connected';
}

/**
 * The subscription list after a "Fix": each answer replaces the entry of the same type, and a
 * type the list did not have is added. Works whether the API answers with every subscription or
 * only the ones it set up again.
 */
export function mergeSubscriptions<S extends { type: string }>(current: readonly S[], updated: readonly S[]): S[] {
  const fresh = new Map(updated.map((item) => [item.type, item]));
  const merged = current.map((item) => fresh.get(item.type) ?? item);
  const had = new Set(current.map((item) => item.type));
  return [...merged, ...updated.filter((item) => !had.has(item.type))];
}
