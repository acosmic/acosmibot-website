/**
 * Types, limits and pure helpers for the Overlays and Activity pages
 * (§10.7.9, §12.9). The widget configs mirror the API's pydantic models; the
 * API is the authority and these checks only save a round trip.
 *
 * No React and no `@/` imports, so Node tests can import this file directly.
 */

// ── Widgets ───────────────────────────────────────────────────────────────

export const WIDGETS = ['alerts', 'chat', 'events', 'goal', 'label', 'leaderboard', 'giveaway', 'nowplaying'] as const;
export type WidgetKind = (typeof WIDGETS)[number];

export const isWidgetKind = (value: unknown): value is WidgetKind =>
  typeof value === 'string' && (WIDGETS as readonly string[]).includes(value);

export interface WidgetInfo {
  label: string;
  /** One sentence: what the widget shows on stream. */
  description: string;
  /** Suggested OBS browser source size in pixels. */
  width: number;
  height: number;
}

export const WIDGET_INFO: Record<WidgetKind, WidgetInfo> = {
  alerts: {
    label: 'Alert box',
    description: 'Shows one card at a time for follows, subs, gifts, cheers, raids, Hype Trains, redemptions and sound redemptions.',
    width: 800, height: 300,
  },
  chat: {
    label: 'Chat box',
    description: 'Shows the latest chat messages with emotes and removes messages that moderators delete or users who are timed out or banned.',
    width: 400, height: 600,
  },
  events: {
    label: 'Event list',
    description: 'Lists the most recent follows, subs, gifts, cheers, raids and other events.',
    width: 400, height: 400,
  },
  goal: {
    label: 'Goal bar',
    description: 'A progress bar for followers, subscribers, the channel’s Twitch goal or the running poll.',
    width: 800, height: 120,
  },
  label: {
    label: 'Label',
    description: 'One line of text: the latest follower, subscriber, cheer or raid, the top cheerer this week, or the stream title.',
    width: 600, height: 80,
  },
  leaderboard: {
    label: 'Leaderboard',
    description: 'The top viewers by loyalty points or watch time.',
    width: 400, height: 400,
  },
  giveaway: {
    label: 'Giveaway',
    description: 'The running giveaway, how to enter, the number of entries and the winner.',
    width: 600, height: 200,
  },
  nowplaying: {
    label: 'Now playing',
    description: 'The current song request, who requested it and how many songs are queued.',
    width: 600, height: 140,
  },
};

// ── Alert and activity kinds ──────────────────────────────────────────────

export const ALERT_KINDS = ['follow', 'sub', 'resub', 'gift_sub', 'community_gift', 'cheer', 'raid', 'redemption', 'hype_train'] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  follow: 'Follow',
  sub: 'Subscription',
  resub: 'Resubscription',
  gift_sub: 'Gifted sub',
  community_gift: 'Community gift',
  cheer: 'Cheer',
  raid: 'Raid',
  redemption: 'Channel point redemption',
  hype_train: 'Hype Train',
};

export const ACTIVITY_TYPES = [
  'follow', 'sub', 'resub', 'gift_sub', 'community_gift', 'cheer', 'raid', 'redemption', 'hype_train',
  'ad_break', 'poll', 'prediction', 'shoutout_received',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  ...ALERT_KIND_LABELS,
  ad_break: 'Ad break',
  poll: 'Poll',
  prediction: 'Prediction',
  shoutout_received: 'Shoutout received',
};

export const isActivityType = (value: unknown): value is ActivityType =>
  typeof value === 'string' && (ACTIVITY_TYPES as readonly string[]).includes(value);

/**
 * The activity type of a live feed envelope (`activity.<type>`), matching the
 * stored row type: `activity.sub` with `data.kind === "resub"` is a `resub` row.
 * Null for anything that is not an activity event.
 */
export function feedActivityType(type: string, data?: Record<string, unknown> | null): ActivityType | null {
  if (!type.startsWith('activity.')) return null;
  const kind = type.slice('activity.'.length);
  if (kind === 'sub' && data?.kind === 'resub') return 'resub';
  return isActivityType(kind) ? kind : null;
}

/** True when a type filter (empty = everything) admits this activity type. */
export const activityFilterAdmits = (selected: readonly ActivityType[], type: ActivityType | null): boolean =>
  type !== null && (selected.length === 0 || selected.includes(type));

export const ACTIVITY_PAGE_SIZE = 50;
export const ACTIVITY_LIVE_MAX = 50;

/** Query string of `GET /channels/:id/activity`: `?types=a,b&before_id=N&limit=50` (known types only, deduplicated). */
export function activityQuery(options: { types?: readonly string[]; beforeId?: number | null; limit?: number } = {}): string {
  const params: string[] = [];
  const types = Array.from(new Set((options.types ?? []).filter(isActivityType)));
  if (types.length) params.push(`types=${types.join(',')}`);
  if (typeof options.beforeId === 'number' && Number.isInteger(options.beforeId) && options.beforeId > 0) {
    params.push(`before_id=${options.beforeId}`);
  }
  const limit = Math.trunc(options.limit ?? ACTIVITY_PAGE_SIZE);
  params.push(`limit=${Math.min(100, Math.max(1, Number.isFinite(limit) ? limit : ACTIVITY_PAGE_SIZE))}`);
  return `?${params.join('&')}`;
}

// ── Widget configs ────────────────────────────────────────────────────────

export type ConfigValue = string | number | boolean | string[];
export type WidgetConfig = Record<string, ConfigValue>;

export interface ConfigOption { value: string; label: string }

/** One editable config field (the page renders these generically). */
export type ConfigField =
  | { key: string; label: string; help?: string; kind: 'int' | 'float'; min: number; max: number; step?: number; unit?: string; default: number }
  | { key: string; label: string; help?: string; kind: 'bool'; default: boolean }
  | { key: string; label: string; help?: string; kind: 'select'; options: ConfigOption[]; default: string }
  | { key: string; label: string; help?: string; kind: 'multiselect'; options: ConfigOption[]; default: string[]; minItems?: number }
  | { key: string; label: string; help?: string; kind: 'text'; maxLength: number; default: string };

const kindOptions: ConfigOption[] = ALERT_KINDS.map((kind) => ({ value: kind, label: ALERT_KIND_LABELS[kind] }));
const DEFAULT_ALERT_TYPES = ALERT_KINDS.filter((kind) => kind !== 'redemption');
const fontScale: ConfigField = {
  key: 'font_scale', label: 'Text size', kind: 'float', min: 0.5, max: 2, step: 0.1, unit: '×', default: 1,
  help: 'From 0.5× to 2× the normal size.',
};

export const WIDGET_FIELDS: Record<WidgetKind, ConfigField[]> = {
  alerts: [
    { key: 'types', label: 'Show alerts for', kind: 'multiselect', options: kindOptions, default: DEFAULT_ALERT_TYPES, minItems: 1 },
    { key: 'duration_ms', label: 'Show each alert for', kind: 'int', min: 2000, max: 15000, step: 500, unit: 'ms', default: 6000,
      help: 'From 2,000 to 15,000 milliseconds.' },
    { key: 'min_bits', label: 'Smallest cheer to show', kind: 'int', min: 1, max: 1_000_000, unit: 'bits', default: 1 },
    { key: 'min_raid_viewers', label: 'Smallest raid to show', kind: 'int', min: 1, max: 1_000_000, unit: 'viewers', default: 1 },
    { key: 'sound', label: 'Play sound redemptions', kind: 'bool', default: false,
      help: 'Plays the sound of loyalty store and channel point sound redemptions in this browser source.' },
    fontScale,
  ],
  chat: [
    { key: 'max_messages', label: 'Messages shown', kind: 'int', min: 5, max: 50, default: 15 },
    { key: 'fade_after_s', label: 'Hide messages after', kind: 'int', min: 0, max: 600, unit: 's', default: 0,
      help: '0 keeps messages until newer ones push them out.' },
    { key: 'show_badges', label: 'Show badges', kind: 'bool', default: true, help: 'Badges appear as short text labels.' },
    fontScale,
  ],
  events: [
    { key: 'types', label: 'List events for', kind: 'multiselect', options: kindOptions, default: DEFAULT_ALERT_TYPES, minItems: 1 },
    { key: 'max_items', label: 'Events shown', kind: 'int', min: 3, max: 20, default: 8 },
  ],
  goal: [
    { key: 'source', label: 'Goal', kind: 'select', default: 'followers', options: [
      { value: 'followers', label: 'Followers' },
      { value: 'subscribers', label: 'Subscribers' },
      { value: 'twitch_goal', label: 'The channel’s Twitch goal' },
      { value: 'poll', label: 'The running poll' },
    ] },
    { key: 'target', label: 'Target', kind: 'int', min: 1, max: 10_000_000, default: 100,
      help: 'Used for followers and subscribers. A Twitch goal brings its own target.' },
    { key: 'title', label: 'Title', kind: 'text', maxLength: 60, default: '',
      help: 'Leave empty to use the Twitch goal’s description (or no title).' },
  ],
  label: [
    { key: 'kind', label: 'Shows', kind: 'select', default: 'latest_follower', options: [
      { value: 'latest_follower', label: 'Latest follower' },
      { value: 'latest_sub', label: 'Latest subscriber' },
      { value: 'latest_cheer', label: 'Latest cheer' },
      { value: 'latest_raid', label: 'Latest raid' },
      { value: 'top_cheerer_week', label: 'Top cheerer in the last 7 days' },
      { value: 'stream_title', label: 'Stream title' },
    ] },
    { key: 'prefix', label: 'Text before it', kind: 'text', maxLength: 40, default: '', help: 'For example “Latest follower: ”.' },
  ],
  leaderboard: [
    { key: 'by', label: 'Rank by', kind: 'select', default: 'points', options: [
      { value: 'points', label: 'Loyalty points' },
      { value: 'watch_minutes', label: 'Watch time' },
    ] },
    { key: 'count', label: 'Viewers shown', kind: 'int', min: 3, max: 10, default: 5 },
    { key: 'title', label: 'Title', kind: 'text', maxLength: 40, default: '' },
  ],
  giveaway: [
    { key: 'show_entries', label: 'Show the number of entries', kind: 'bool', default: true },
  ],
  nowplaying: [
    { key: 'show_requester', label: 'Show who requested the song', kind: 'bool', default: true },
    { key: 'show_progress', label: 'Show a progress bar', kind: 'bool', default: true },
  ],
};

const cloneValue = (value: ConfigValue): ConfigValue => (Array.isArray(value) ? [...value] : value);

/** The full default config of a widget (a fresh object every call). */
export function defaultConfig(widget: WidgetKind): WidgetConfig {
  const config: WidgetConfig = {};
  for (const field of WIDGET_FIELDS[widget]) config[field.key] = cloneValue(field.default);
  return config;
}

/**
 * A widget config with every field present and of the right type: known keys
 * are kept when their type fits (numbers clamped to the bounds, options
 * filtered to the allowed values), missing or wrong ones take the default,
 * unknown keys are dropped.
 */
export function normalizeConfig(widget: WidgetKind, raw: unknown): WidgetConfig {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const config = defaultConfig(widget);
  for (const field of WIDGET_FIELDS[widget]) {
    const value = source[field.key];
    switch (field.kind) {
      case 'int':
      case 'float':
        if (typeof value === 'number' && Number.isFinite(value)) {
          const clamped = Math.min(field.max, Math.max(field.min, value));
          config[field.key] = field.kind === 'int' ? Math.round(clamped) : clamped;
        }
        break;
      case 'bool':
        if (typeof value === 'boolean') config[field.key] = value;
        break;
      case 'select':
        if (typeof value === 'string' && field.options.some((option) => option.value === value)) config[field.key] = value;
        break;
      case 'multiselect':
        if (Array.isArray(value)) {
          config[field.key] = field.options.map((option) => option.value).filter((option) => value.includes(option));
        }
        break;
      case 'text':
        if (typeof value === 'string') config[field.key] = value.slice(0, field.maxLength);
        break;
    }
  }
  return config;
}

export interface ConfigProblem { field: string; message: string }

/** Every problem of a config draft (empty when the API would accept it). */
export function configProblems(widget: WidgetKind, config: WidgetConfig): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  for (const field of WIDGET_FIELDS[widget]) {
    const value = config[field.key];
    switch (field.kind) {
      case 'int':
      case 'float': {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          problems.push({ field: field.key, message: `${field.label} must be a number.` });
        } else if (field.kind === 'int' && !Number.isInteger(value)) {
          problems.push({ field: field.key, message: `${field.label} must be a whole number.` });
        } else if (value < field.min || value > field.max) {
          problems.push({ field: field.key, message: `${field.label} must be from ${field.min.toLocaleString('en-US')} to ${field.max.toLocaleString('en-US')}.` });
        }
        break;
      }
      case 'bool':
        if (typeof value !== 'boolean') problems.push({ field: field.key, message: `${field.label} must be on or off.` });
        break;
      case 'select':
        if (typeof value !== 'string' || !field.options.some((option) => option.value === value)) {
          problems.push({ field: field.key, message: `Choose an option for ${field.label.toLowerCase()}.` });
        }
        break;
      case 'multiselect': {
        const allowed = field.options.map((option) => option.value);
        if (!Array.isArray(value) || value.some((item) => !allowed.includes(item))) {
          problems.push({ field: field.key, message: `${field.label} has an option that does not exist.` });
        } else if (value.length < (field.minItems ?? 0)) {
          problems.push({ field: field.key, message: `Choose at least one option for ${field.label.toLowerCase()}.` });
        }
        break;
      }
      case 'text':
        if (typeof value !== 'string') problems.push({ field: field.key, message: `${field.label} must be text.` });
        else if (value.trim().length > field.maxLength) {
          problems.push({ field: field.key, message: `${field.label} is at most ${field.maxLength} characters.` });
        }
        break;
    }
  }
  return problems;
}

/** The config to send: text trimmed, otherwise as normalised. */
export function configForApi(widget: WidgetKind, config: WidgetConfig): WidgetConfig {
  const out = normalizeConfig(widget, config);
  for (const field of WIDGET_FIELDS[widget]) {
    if (field.kind === 'text') out[field.key] = String(out[field.key]).trim();
  }
  return out;
}

export const sameConfig = (a: WidgetConfig, b: WidgetConfig): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const left = a[key];
    const right = b[key];
    if (Array.isArray(left) || Array.isArray(right)) {
      if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || left.some((item, i) => item !== right[i])) {
        return false;
      }
    } else if (left !== right) {
      return false;
    }
  }
  return true;
};

// ── Overlay records ───────────────────────────────────────────────────────

export const OVERLAY_LIMITS = { nameMax: 40, maxOverlays: 30, createsPerHour: 10 } as const;

export interface Overlay {
  id: number;
  widget: WidgetKind;
  name: string;
  config: WidgetConfig;
  token_prefix: string;
  last_used_at: string | null;
  connected: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface OverlayListResponse {
  success: true;
  items: Overlay[];
  count: number;
  limit: number;
}

/** `POST /overlays` and `POST /overlays/:id/rotate`: the plaintext URL is in this response only. */
export interface OverlayTokenResponse {
  success: true;
  overlay: Overlay;
  token: string;
  url: string;
}

export interface OverlayInput {
  widget?: WidgetKind;
  name: string;
  config: WidgetConfig;
}

/** One line of text: control characters and whitespace runs become single spaces. */
export const oneLine = (value: string): string =>
  // eslint-disable-next-line no-control-regex
  value.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g, ' ').split(/\s+/).filter(Boolean).join(' ');

/** The problem with an overlay name, or null when it can be sent. */
export function nameProblem(name: string): string | null {
  const value = oneLine(name);
  if (!value) return 'Give the overlay a name.';
  if (value.length > OVERLAY_LIMITS.nameMax) return `A name is at most ${OVERLAY_LIMITS.nameMax} characters.`;
  return null;
}

/** A default name for a new overlay of this widget that is not taken yet. */
export function suggestName(widget: WidgetKind, existing: readonly Pick<Overlay, 'name'>[]): string {
  const base = WIDGET_INFO[widget].label;
  const taken = new Set(existing.map((item) => item.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return base;
}

/** The dashboard sentence for an overlay API error code, or null to use the API's own message. */
export function overlayErrorMessage(code: string | null | undefined): string | null {
  switch (code) {
    case 'limit_reached':
      return `This channel has reached the limit of ${OVERLAY_LIMITS.maxOverlays} overlays. Delete one you no longer use first.`;
    case 'rate_limited':
      return `Overlay links can be created or replaced ${OVERLAY_LIMITS.createsPerHour} times per hour. Try again later.`;
    case 'redis_unavailable':
      return 'Live events are unavailable right now, so the test alert was not sent. Try again in a moment.';
    case 'not_found':
      return 'That overlay no longer exists. It may have been deleted in another tab.';
    default:
      return null;
  }
}

/** Widget label for a stored widget string (unknown widgets show as written). */
export const widgetLabel = (widget: string): string => (isWidgetKind(widget) ? WIDGET_INFO[widget].label : widget);

// ── Settings sections ─────────────────────────────────────────────────────

export interface OverlaysSettings {
  enabled: boolean;
  chat_hide_commands: boolean;
  chat_hide_bots: boolean;
}

export interface ActivitySettings {
  enabled: boolean;
}
