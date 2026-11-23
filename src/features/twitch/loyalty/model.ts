/**
 * Types, limits and pure helpers for the Loyalty and Store pages and the public
 * leaderboard and store pages (§10.7.4, §12.4).
 *
 * No React and no `@/` imports, so Node tests can import this file directly.
 * The API is the authority; these checks only save a round trip and mirror the
 * endpoint validation (`api/blueprints/twitch_bot/loyalty.py`, `store.py`).
 */

// ── Limits ────────────────────────────────────────────────────────────────

export const LOYALTY_LIMITS = {
  pageSize: 50,
  maxBalance: 1_000_000_000_000,
  maxDelta: 1_000_000_000,
  searchMax: 25,
  publicLimit: 100,
} as const;

export const STORE_LIMITS = {
  nameMax: 60,
  descriptionMax: 200,
  costMin: 1,
  costMax: 1_000_000_000,
  stockMax: 1_000_000,
  perUserMax: 1_000,
  cooldownMax: 86_400,
  soundUrlMax: 512,
  templateMax: 500,
  pageSize: 50,
} as const;

// ── Viewers ───────────────────────────────────────────────────────────────

/** `TwitchBotViewers` row (`to_api_dict`). */
export interface Viewer {
  broadcaster_id: string;
  user_id: string;
  login: string;
  display_name: string;
  points: number;
  watch_minutes: number;
  message_count: number;
  excluded: boolean;
  first_seen_at: string | null;
  last_seen_at: string | null;
  last_message_at: string | null;
}

export interface ViewerListResponse { success: true; items: Viewer[]; total: number }
export interface ViewerResponse { success: true; viewer: Viewer; live_applied?: boolean }

export type ViewerSort = 'points' | 'watch_minutes' | 'last_seen';
export const VIEWER_SORTS: Array<{ value: ViewerSort; label: string }> = [
  { value: 'points', label: 'Most points' },
  { value: 'watch_minutes', label: 'Most watch time' },
  { value: 'last_seen', label: 'Recently seen' },
];

/** `TwitchBotPointTransactions` row. */
export interface PointTransaction {
  id: number;
  broadcaster_id: string;
  user_id: string;
  delta: number;
  balance_after: number | null;
  reason: string;
  ref: string | null;
  actor_user_id: string | null;
  created_at: string | null;
}

const LOGIN_FRAGMENT = /^[a-z0-9_]*$/;

/** Search text → the API's login-prefix query (lowercase, no `@`); null when it can never match. */
export const normalizeViewerSearch = (value: string): string | null => {
  const text = value.trim().replace(/^@/, '').toLowerCase();
  if (text.length > LOYALTY_LIMITS.searchMax || !LOGIN_FRAGMENT.test(text)) return null;
  return text;
};

/** `?q&sort&offset&limit` for `GET /channels/:id/viewers`. */
export const viewerQuery = (search: string, sort: ViewerSort, page: number): string => {
  const params = new URLSearchParams();
  const q = normalizeViewerSearch(search);
  if (q) params.set('q', q);
  params.set('sort', sort);
  params.set('offset', String(Math.max(0, page) * LOYALTY_LIMITS.pageSize));
  params.set('limit', String(LOYALTY_LIMITS.pageSize));
  return `?${params.toString()}`;
};

export type BalanceMode = 'set' | 'add';

/**
 * The PATCH body for a balance edit. "Set" sends `points` (the API applies it
 * atomically against concurrent accrual); "add" sends a signed `points_delta`.
 */
export const balancePatch = (mode: BalanceMode, raw: string): { points: number } | { points_delta: number } | { problem: string } => {
  const text = raw.trim().replace(/,/g, '');
  if (!/^[+-]?\d{1,13}$/.test(text)) return { problem: 'Enter a whole number.' };
  const value = Number(text);
  if (mode === 'set') {
    if (text.startsWith('-') || value < 0) return { problem: 'A balance cannot be negative.' };
    if (value > LOYALTY_LIMITS.maxBalance) return { problem: 'That balance is too large.' };
    return { points: value };
  }
  if (value === 0) return { problem: 'Enter an amount other than 0.' };
  if (Math.abs(value) > LOYALTY_LIMITS.maxDelta) return { problem: `Change at most ${LOYALTY_LIMITS.maxDelta.toLocaleString('en-US')} at a time.` };
  return { points_delta: value };
};

/** What a balance edit would leave (for the confirmation text); clamped like the API. */
export const previewBalance = (current: number, patch: { points: number } | { points_delta: number }): number => {
  const next = 'points' in patch ? patch.points : current + patch.points_delta;
  return Math.max(0, Math.min(next, LOYALTY_LIMITS.maxBalance));
};

const REASON_LABELS: Record<string, string> = {
  admin: 'Manual change', store: 'Store redemption', store_refund: 'Store refund', give_out: 'Gave away',
  give_in: 'Received', giveaway_ticket: 'Giveaway tickets', bonus_follow: 'Follow bonus', bonus_sub: 'Sub bonus',
  bonus_cheer: 'Cheer bonus', bonus_raid: 'Raid bonus', command_cost: 'Command cost', command_refund: 'Command refund',
  import: 'Import', reward: 'Channel point reward', reset: 'Reset',
};

/** Human label for a ledger reason (`game_*` → "Game: gamble"). */
export const reasonLabel = (reason: string): string => {
  if (REASON_LABELS[reason]) return REASON_LABELS[reason];
  if (reason.startsWith('game_')) return `Game: ${reason.slice(5)}`;
  return reason;
};

/** `125` → "2h 5m"; `0` → "0m". */
export const formatWatchMinutes = (minutes: number): string => {
  const total = Math.max(0, Math.floor(Number(minutes) || 0));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

// ── Loyalty settings (§4.2 LoyaltySettings) ──────────────────────────────

export interface LoyaltySettings {
  enabled: boolean;
  currency_name: string;
  interval_minutes: number;
  points_per_interval: number;
  active_bonus: number;
  active_window_minutes: number;
  subscriber_multiplier: number;
  vip_multiplier: number;
  include_lurkers: boolean;
  offline_accrual: boolean;
  offline_points_per_interval: number;
  starting_points: number;
  bonus_follow: number;
  bonus_sub: number;
  bonus_gift_per_sub: number;
  bonus_cheer_per_100_bits: number;
  bonus_raid_per_viewer: number;
  exclude_broadcaster: boolean;
  exclude_known_bots: boolean;
  give_enabled: boolean;
  give_min: number;
  give_tax_percent: number;
  auto_regular_watch_minutes: number;
  leaderboard_public: boolean;
}

/** Bounds of the numeric loyalty settings (pydantic `Field(ge, le)` in core settings.py). */
export const LOYALTY_NUMBER_BOUNDS: Record<string, { min: number; max: number; step?: number }> = {
  interval_minutes: { min: 1, max: 60 },
  points_per_interval: { min: 0, max: 10_000 },
  active_bonus: { min: 0, max: 10_000 },
  active_window_minutes: { min: 1, max: 120 },
  subscriber_multiplier: { min: 1, max: 10, step: 0.1 },
  vip_multiplier: { min: 1, max: 10, step: 0.1 },
  offline_points_per_interval: { min: 0, max: 10_000 },
  starting_points: { min: 0, max: 1_000_000 },
  bonus_follow: { min: 0, max: 1_000_000 },
  bonus_sub: { min: 0, max: 1_000_000 },
  bonus_gift_per_sub: { min: 0, max: 1_000_000 },
  bonus_cheer_per_100_bits: { min: 0, max: 1_000_000 },
  bonus_raid_per_viewer: { min: 0, max: 1_000 },
  give_min: { min: 1, max: 1_000_000 },
  give_tax_percent: { min: 0, max: 50 },
  auto_regular_watch_minutes: { min: 0, max: 1_000_000 },
};

export const CURRENCY_PATTERN = /^[\w ]{1,20}$/u;

/** First client-side problem in a loyalty settings draft, or null. */
export const loyaltySettingsProblem = (form: LoyaltySettings): string | null => {
  if (!CURRENCY_PATTERN.test(form.currency_name.trim())) {
    return 'The currency name needs 1 to 20 letters, numbers, spaces or underscores.';
  }
  for (const [field, bounds] of Object.entries(LOYALTY_NUMBER_BOUNDS)) {
    const value = (form as unknown as Record<string, number>)[field];
    if (typeof value !== 'number' || Number.isNaN(value) || value < bounds.min || value > bounds.max) {
      return `${fieldLabel(field)} must be between ${bounds.min} and ${bounds.max.toLocaleString('en-US')}.`;
    }
    if (!bounds.step && !Number.isInteger(value)) return `${fieldLabel(field)} must be a whole number.`;
  }
  return null;
};

const FIELD_LABELS: Record<string, string> = {
  interval_minutes: 'Award interval', points_per_interval: 'Points per interval', active_bonus: 'Active chatter bonus',
  active_window_minutes: 'Active window', subscriber_multiplier: 'Subscriber multiplier', vip_multiplier: 'VIP multiplier',
  offline_points_per_interval: 'Offline points', starting_points: 'Starting balance', bonus_follow: 'Follow bonus',
  bonus_sub: 'Sub bonus', bonus_gift_per_sub: 'Gift bonus', bonus_cheer_per_100_bits: 'Cheer bonus',
  bonus_raid_per_viewer: 'Raid bonus', give_min: 'Minimum gift', give_tax_percent: 'Gift tax',
  auto_regular_watch_minutes: 'Auto-regular watch time',
};
export const fieldLabel = (field: string): string => FIELD_LABELS[field] ?? field;

// ── Store items ───────────────────────────────────────────────────────────

export type StoreItemKind = 'generic' | 'sound' | 'message' | 'song' | 'queue';

export const ITEM_KINDS: Array<{ value: StoreItemKind; label: string; description: string }> = [
  { value: 'generic', label: 'Manual reward', description: 'Lands in the redemption queue for you or a moderator to fulfil.' },
  { value: 'sound', label: 'Sound effect', description: 'Plays a sound in the alerts overlay.' },
  { value: 'message', label: 'Chat message', description: 'Acosmibot posts your message in chat.' },
  { value: 'song', label: 'Song request', description: 'Adds the viewer’s song to the song request queue. Needs song requests turned on.' },
  { value: 'queue', label: 'Viewer queue spot', description: 'Puts the viewer in the viewer queue. Needs the viewer queue turned on.' },
];

export const kindLabel = (kind: string): string => ITEM_KINDS.find((entry) => entry.value === kind)?.label ?? kind;

/** `TwitchBotStoreItems` row. */
export interface StoreItem {
  id: number;
  broadcaster_id: string;
  name: string;
  description: string | null;
  kind: StoreItemKind;
  cost: number;
  level: number;
  stock: number | null;
  per_user_limit: number | null;
  user_cooldown_s: number;
  global_cooldown_s: number;
  requires_input: boolean;
  sound_url: string | null;
  message_template: string | null;
  enabled: boolean;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface StoreItemListResponse { success: true; items: StoreItem[]; count: number; limit: number }

/** `StoreItemInput` (§10.7.4). */
export interface StoreItemInput {
  name: string;
  description: string | null;
  kind: StoreItemKind;
  cost: number;
  level: number;
  stock: number | null;
  per_user_limit: number | null;
  user_cooldown_s: number;
  global_cooldown_s: number;
  requires_input: boolean;
  sound_url: string | null;
  message_template: string | null;
  enabled: boolean;
  sort_order: number;
}

/** Editor draft: optional numbers are strings so "unlimited" can be an empty field. */
export interface StoreItemDraft {
  name: string;
  description: string;
  kind: StoreItemKind;
  cost: number;
  level: number;
  stock: string;
  per_user_limit: string;
  user_cooldown_s: number;
  global_cooldown_s: number;
  requires_input: boolean;
  sound_url: string;
  message_template: string;
  enabled: boolean;
  sort_order: number;
}

export const EMPTY_ITEM_DRAFT: StoreItemDraft = {
  name: '', description: '', kind: 'generic', cost: 100, level: 0, stock: '', per_user_limit: '', user_cooldown_s: 0,
  global_cooldown_s: 0, requires_input: false, sound_url: '', message_template: '', enabled: true, sort_order: 0,
};

export const draftFromItem = (item: StoreItem): StoreItemDraft => ({
  name: item.name,
  description: item.description ?? '',
  kind: item.kind,
  cost: item.cost,
  level: item.level,
  stock: item.stock === null ? '' : String(item.stock),
  per_user_limit: item.per_user_limit === null ? '' : String(item.per_user_limit),
  user_cooldown_s: item.user_cooldown_s,
  global_cooldown_s: item.global_cooldown_s,
  requires_input: item.requires_input,
  sound_url: item.sound_url ?? '',
  message_template: item.message_template ?? '',
  enabled: item.enabled,
  sort_order: item.sort_order,
});

const optionalInt = (value: string): number | null => (value.trim() === '' ? null : Number(value.trim()));

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g;
export const oneLine = (value: string): string => value.replace(CONTROL, ' ').split(/\s+/).filter(Boolean).join(' ');

/** True for an https URL (no credentials) whose path ends in .mp3, .ogg or .wav. */
export const isSoundUrl = (value: string): boolean => {
  const text = value.trim();
  if (!text || text.length > STORE_LIMITS.soundUrlMax || /\s/.test(text)) return false;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password
      && /\.(mp3|ogg|wav)$/i.test(url.pathname);
  } catch {
    return false;
  }
};

/** First client-side problem in an item draft, or null. */
export const itemProblem = (draft: StoreItemDraft): string | null => {
  const name = oneLine(draft.name);
  if (!name) return 'Give the item a name.';
  if (name.length > STORE_LIMITS.nameMax) return `Names can be at most ${STORE_LIMITS.nameMax} characters.`;
  if (oneLine(draft.description).length > STORE_LIMITS.descriptionMax) {
    return `Descriptions can be at most ${STORE_LIMITS.descriptionMax} characters.`;
  }
  if (!Number.isInteger(draft.cost) || draft.cost < STORE_LIMITS.costMin || draft.cost > STORE_LIMITS.costMax) {
    return `The cost must be between ${STORE_LIMITS.costMin} and ${STORE_LIMITS.costMax.toLocaleString('en-US')}.`;
  }
  const stock = optionalInt(draft.stock);
  if (stock !== null && (!Number.isInteger(stock) || stock < 0 || stock > STORE_LIMITS.stockMax)) {
    return 'Stock must be empty (unlimited) or a whole number up to 1,000,000.';
  }
  const perUser = optionalInt(draft.per_user_limit);
  if (perUser !== null && (!Number.isInteger(perUser) || perUser < 1 || perUser > STORE_LIMITS.perUserMax)) {
    return 'The per-viewer limit must be empty (no limit) or between 1 and 1,000.';
  }
  for (const value of [draft.user_cooldown_s, draft.global_cooldown_s]) {
    if (!Number.isInteger(value) || value < 0 || value > STORE_LIMITS.cooldownMax) return 'Cooldowns can be at most 24 hours.';
  }
  if (draft.kind === 'sound' && !isSoundUrl(draft.sound_url)) {
    return 'A sound effect needs an https link to an .mp3, .ogg or .wav file.';
  }
  if (draft.kind === 'message') {
    const template = draft.message_template.trim();
    if (!template) return 'A chat message item needs the message to post.';
    if (template.length > STORE_LIMITS.templateMax) return `Messages can be at most ${STORE_LIMITS.templateMax} characters.`;
  }
  return null;
};

/** The request body for a draft (fields that do not apply to the kind are sent empty). */
export const itemInputFromDraft = (draft: StoreItemDraft): StoreItemInput => ({
  name: oneLine(draft.name),
  description: oneLine(draft.description) || null,
  kind: draft.kind,
  cost: draft.cost,
  level: draft.level,
  stock: optionalInt(draft.stock),
  per_user_limit: optionalInt(draft.per_user_limit),
  user_cooldown_s: draft.user_cooldown_s,
  global_cooldown_s: draft.global_cooldown_s,
  requires_input: draft.kind === 'song' ? true : draft.requires_input,
  sound_url: draft.kind === 'sound' ? draft.sound_url.trim() : null,
  message_template: draft.kind === 'message' ? draft.message_template.trim() : null,
  enabled: draft.enabled,
  sort_order: draft.sort_order,
});

export const sameItemDraft = (a: StoreItemDraft, b: StoreItemDraft): boolean =>
  (Object.keys(a) as Array<keyof StoreItemDraft>).every((key) => a[key] === b[key]);

/** "Unlimited", "Sold out" or "12 left". */
export const describeStock = (stock: number | null): string =>
  stock === null ? 'Unlimited' : stock <= 0 ? 'Sold out' : `${stock.toLocaleString('en-US')} left`;

// ── Redemptions ───────────────────────────────────────────────────────────

export type RedemptionStatus = 'pending' | 'fulfilled' | 'refunded' | 'rejected';

export interface Redemption {
  id: number;
  broadcaster_id: string;
  item_id: number;
  item_name: string;
  user_id: string;
  login: string;
  cost: number;
  user_input: string | null;
  status: RedemptionStatus;
  handled_by_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface RedemptionPage { success: true; items: Redemption[]; next_before_id: number | null }

export type RedemptionAction = 'fulfilled' | 'refunded' | 'rejected';

/** Actions the queue offers per status (refunded and rejected are final). */
export const redemptionActions = (status: RedemptionStatus): RedemptionAction[] => {
  if (status === 'pending') return ['fulfilled', 'refunded', 'rejected'];
  if (status === 'fulfilled') return ['refunded'];
  return [];
};

export const ACTION_LABELS: Record<RedemptionAction, string> = {
  fulfilled: 'Mark fulfilled', refunded: 'Refund', rejected: 'Reject',
};

export const STATUS_VIEW: Record<RedemptionStatus, { tone: 'active' | 'neutral' | 'warning' | 'error'; label: string }> = {
  pending: { tone: 'warning', label: 'Pending' },
  fulfilled: { tone: 'active', label: 'Fulfilled' },
  refunded: { tone: 'neutral', label: 'Refunded' },
  rejected: { tone: 'error', label: 'Rejected' },
};

export const redemptionQuery = (status: RedemptionStatus | 'all', beforeId: number | null): string => {
  const params = new URLSearchParams();
  if (status !== 'all') params.set('status', status);
  if (beforeId !== null) params.set('before_id', String(beforeId));
  params.set('limit', String(STORE_LIMITS.pageSize));
  return `?${params.toString()}`;
};

// ── Store settings and public pages ──────────────────────────────────────

export interface StoreSettings {
  enabled: boolean;
  redeem_template: string;
  public_page: boolean;
}

export type LeaderboardBy = 'points' | 'watch_minutes';

export interface PublicLeaderboardEntry {
  rank: number;
  login: string;
  display_name: string;
  points: number;
  watch_minutes: number;
}

export interface PublicLeaderboardResponse { success: true; currency_name: string; items: PublicLeaderboardEntry[] }

export interface PublicStoreItem {
  id: number;
  name: string;
  description: string | null;
  cost: number;
  kind: StoreItemKind;
  level_name: string;
  stock: number | null;
}

export interface PublicStoreResponse { success: true; currency_name: string; items: PublicStoreItem[] }

export const leaderboardQuery = (by: LeaderboardBy, limit = LOYALTY_LIMITS.publicLimit): string =>
  `?by=${by}&limit=${Math.max(1, Math.min(limit, LOYALTY_LIMITS.publicLimit))}`;

/** The chat command that redeems a public store item. */
export const redeemCommand = (item: Pick<PublicStoreItem, 'name' | 'kind'>, prefix = '!'): string =>
  `${prefix}redeem ${item.name}${item.kind === 'song' ? ' <song link or search>' : ''}`;
