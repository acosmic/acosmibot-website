/**
 * Types and pure helpers for the Timers and Chat alerts pages (§10.7.2, §12.2).
 *
 * No React and no `@/` imports, so Node tests can import this file directly.
 * Resource shapes are the entity dictionaries of §10.5 (column names as keys);
 * inputs are `TimerInput` / `TimerGroupInput` of §10.7.2.
 */

export type Availability = 'always' | 'online' | 'offline';
export type SendMode = 'say' | 'announce';
export type AnnounceColor = 'primary' | 'blue' | 'green' | 'orange' | 'purple';
export type Rotation = 'sequential' | 'random';

/** Limits of `acosmibot_core.twitch_bot.limits` (the API enforces them). */
export const TIMER_LIMITS = {
  nameMax: 40,
  messageMax: 1000,
  intervalMin: 300,
  intervalMax: 86_400,
  linesMax: 1000,
  categoriesMax: 20,
  categoryMax: 100,
  minGapMin: 30,
  minGapMax: 3600,
  sortOrderMax: 100_000,
} as const;

export const AVAILABILITY_OPTIONS: ReadonlyArray<{ value: Availability; label: string }> = [
  { value: 'online', label: 'Only while live' },
  { value: 'offline', label: 'Only while offline' },
  { value: 'always', label: 'Live or offline' },
];

export const ANNOUNCE_COLORS: ReadonlyArray<{ value: AnnounceColor; label: string }> = [
  { value: 'primary', label: 'Channel colour' },
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'orange', label: 'Orange' },
  { value: 'purple', label: 'Purple' },
];

export interface Timer {
  id: number;
  broadcaster_id: string;
  group_id: number | null;
  name: string;
  message: string;
  send_mode: SendMode;
  announce_color: AnnounceColor | null;
  interval_s: number;
  min_chat_lines: number;
  availability: Availability;
  category_filter_json: string[] | null;
  enabled: boolean;
  sort_order: number;
  last_sent_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TimerGroup {
  id: number;
  broadcaster_id: string;
  name: string;
  interval_s: number;
  min_chat_lines: number;
  availability: Availability;
  category_filter_json: string[] | null;
  rotation: Rotation;
  enabled: boolean;
  last_sent_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TimerListResponse { success: true; items: Timer[]; count: number; limit: number }
export interface GroupListResponse { success: true; items: TimerGroup[]; count: number; limit: number }
export interface RunResponse { success: true; sent: boolean; reason: string | null }

/** `TimerInput` body. */
export interface TimerInput {
  name: string;
  message: string;
  send_mode: SendMode;
  announce_color: AnnounceColor | null;
  group_id: number | null;
  interval_s: number;
  min_chat_lines: number;
  availability: Availability;
  category_filter: string[] | null;
  enabled: boolean;
  sort_order: number;
}

/** `TimerGroupInput` body. */
export interface TimerGroupInput {
  name: string;
  interval_s: number;
  min_chat_lines: number;
  availability: Availability;
  category_filter: string[] | null;
  rotation: Rotation;
  enabled: boolean;
}

/** Form state of the timer drawer; categories are one text box (one per line or comma separated). */
export interface TimerDraft {
  name: string;
  message: string;
  send_mode: SendMode;
  announce_color: AnnounceColor;
  group_id: number | null;
  interval_s: number;
  min_chat_lines: number;
  availability: Availability;
  categories: string;
  enabled: boolean;
  sort_order: number;
}

export interface GroupDraft {
  name: string;
  rotation: Rotation;
  interval_s: number;
  min_chat_lines: number;
  availability: Availability;
  categories: string;
  enabled: boolean;
}

export const EMPTY_TIMER_DRAFT: TimerDraft = {
  name: '',
  message: '',
  send_mode: 'say',
  announce_color: 'primary',
  group_id: null,
  interval_s: 900,
  min_chat_lines: 5,
  availability: 'online',
  categories: '',
  enabled: true,
  sort_order: 0,
};

export const EMPTY_GROUP_DRAFT: GroupDraft = {
  name: '',
  rotation: 'sequential',
  interval_s: 900,
  min_chat_lines: 5,
  availability: 'online',
  categories: '',
  enabled: true,
};

/** "Chess, Just Chatting\n509658" → `['Chess', 'Just Chatting', '509658']` (trimmed, no case-insensitive duplicates). */
export function parseCategories(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[\n,]/)) {
    const value = part.trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export const categoriesText = (list: string[] | null | undefined): string => (list ?? []).join('\n');

export const draftFromTimer = (timer: Timer): TimerDraft => ({
  name: timer.name,
  message: timer.message,
  send_mode: timer.send_mode,
  announce_color: timer.announce_color ?? 'primary',
  group_id: timer.group_id,
  interval_s: timer.interval_s,
  min_chat_lines: timer.min_chat_lines,
  availability: timer.availability,
  categories: categoriesText(timer.category_filter_json),
  enabled: timer.enabled,
  sort_order: timer.sort_order,
});

export const draftFromGroup = (group: TimerGroup): GroupDraft => ({
  name: group.name,
  rotation: group.rotation,
  interval_s: group.interval_s,
  min_chat_lines: group.min_chat_lines,
  availability: group.availability,
  categories: categoriesText(group.category_filter_json),
  enabled: group.enabled,
});

export function timerInputFromDraft(draft: TimerDraft): TimerInput {
  const categories = parseCategories(draft.categories);
  return {
    name: draft.name.trim(),
    message: draft.message,
    send_mode: draft.send_mode,
    announce_color: draft.send_mode === 'announce' ? draft.announce_color : null,
    group_id: draft.group_id,
    interval_s: draft.interval_s,
    min_chat_lines: draft.min_chat_lines,
    availability: draft.availability,
    category_filter: categories.length ? categories : null,
    enabled: draft.enabled,
    sort_order: draft.sort_order,
  };
}

export function groupInputFromDraft(draft: GroupDraft): TimerGroupInput {
  const categories = parseCategories(draft.categories);
  return {
    name: draft.name.trim(),
    interval_s: draft.interval_s,
    min_chat_lines: draft.min_chat_lines,
    availability: draft.availability,
    category_filter: categories.length ? categories : null,
    rotation: draft.rotation,
    enabled: draft.enabled,
  };
}

const conditionProblem = (draft: { interval_s: number; min_chat_lines: number; categories: string }): string | null => {
  if (!Number.isInteger(draft.interval_s) || draft.interval_s < TIMER_LIMITS.intervalMin || draft.interval_s > TIMER_LIMITS.intervalMax) {
    return 'The interval must be between 5 minutes and 24 hours.';
  }
  if (!Number.isInteger(draft.min_chat_lines) || draft.min_chat_lines < 0 || draft.min_chat_lines > TIMER_LIMITS.linesMax) {
    return `Chat lines must be between 0 and ${TIMER_LIMITS.linesMax}.`;
  }
  const categories = parseCategories(draft.categories);
  if (categories.length > TIMER_LIMITS.categoriesMax) return `Use at most ${TIMER_LIMITS.categoriesMax} categories.`;
  if (categories.some((category) => category.length > TIMER_LIMITS.categoryMax)) {
    return `Each category is at most ${TIMER_LIMITS.categoryMax} characters.`;
  }
  return null;
};

/** First client-side problem with a timer draft, or null. The API repeats every check. */
export function timerProblem(draft: TimerDraft): string | null {
  const name = draft.name.trim();
  if (!name) return 'Give the timer a name.';
  if (name.length > TIMER_LIMITS.nameMax) return `The name is at most ${TIMER_LIMITS.nameMax} characters.`;
  if (!draft.message.trim()) return 'Write the message the timer sends.';
  if (draft.message.length > TIMER_LIMITS.messageMax) return `The message is at most ${TIMER_LIMITS.messageMax} characters.`;
  if (/^\s*[/.]/.test(draft.message)) return 'The message cannot start with / or . (chat commands are not supported).';
  return conditionProblem(draft);
}

export function groupProblem(draft: GroupDraft): string | null {
  const name = draft.name.trim();
  if (!name) return 'Give the group a name.';
  if (name.length > TIMER_LIMITS.nameMax) return `The name is at most ${TIMER_LIMITS.nameMax} characters.`;
  return conditionProblem(draft);
}

/** Short description of when a timer or group runs, e.g. "Every 15 minutes, 5+ chat lines, while live". */
export function describeSchedule(
  unit: { interval_s: number; min_chat_lines: number; availability: Availability; category_filter_json: string[] | null },
  describeInterval: (seconds: number) => string,
): string {
  const parts = [`Every ${describeInterval(unit.interval_s)}`];
  if (unit.min_chat_lines > 0) parts.push(`${unit.min_chat_lines}+ chat lines`);
  if (unit.availability === 'online') parts.push('while live');
  else if (unit.availability === 'offline') parts.push('while offline');
  const categories = unit.category_filter_json ?? [];
  if (categories.length) parts.push(categories.length === 1 ? `in ${categories[0]}` : `in ${categories.length} categories`);
  return parts.join(', ');
}

/** Why `POST …/run` did not send, as a sentence. */
export function describeRunFailure(reason: string | null): string {
  switch (reason) {
    case 'silent': return 'The channel is in silent mode, so the bot does not talk.';
    case 'queue_full': return 'The bot is busy sending other messages. Try again in a moment.';
    case 'bot_unauthorized': return 'The bot has no account to send as in this channel.';
    case 'channel_inactive': return 'The channel is paused or not active.';
    case 'forbidden': return 'Twitch refused the message. Check that the bot can chat in this channel.';
    case 'missing_grant': return 'The bot is missing a permission it needs. Reconnect the channel on Overview.';
    case 'rate_limited': return 'The bot is sending too quickly. Try again in a moment.';
    case 'empty': return 'The message rendered empty, so nothing was sent.';
    default: return reason ? `Not sent (${reason}).` : 'The message was not sent.';
  }
}

/* ── Chat alerts ──────────────────────────────────────────────────────── */

export interface AlertTemplate {
  enabled: boolean;
  template: string;
  min_amount: number;
  send_mode: SendMode;
  announce_color: AnnounceColor;
}

export interface RaidShoutout {
  enabled: boolean;
  min_viewers: number;
  native: boolean;
  delay_s: number;
}

export type AlertKey =
  | 'follow' | 'sub' | 'resub' | 'gift_sub' | 'community_gift' | 'cheer' | 'raid'
  | 'hype_train_begin' | 'hype_train_end' | 'redemption' | 'ad_break_begin' | 'ad_break_end';

export interface ChatAlertsSettings extends Record<AlertKey, AlertTemplate> {
  enabled: boolean;
  raid_shoutout: RaidShoutout;
  raid_shoutout_template: string;
  shared_chat_alerts: boolean;
}

export interface TimersSettings {
  enabled: boolean;
  min_gap_s: number;
}

export interface AlertMeta {
  key: AlertKey;
  label: string;
  description: string;
  /** Context names the template can use (§7.6; `variables_catalog.CONTEXT_VARIABLES`). */
  vars: string[];
  /** Label of the `min_amount` field, for the alerts it applies to (§12.2). */
  minLabel?: string;
  /** Whether `POST /chat-alerts/test` accepts the kind (all of them do). */
  testable: boolean;
}

export const ALERTS: readonly AlertMeta[] = [
  { key: 'follow', label: 'Follow', testable: true, vars: ['user', 'login'],
    description: 'When someone follows. Follows within 5 seconds of each other are summarised in one message.' },
  { key: 'sub', label: 'New subscription', testable: true, vars: ['user', 'login', 'tier'],
    description: 'A new subscription, a Prime subscription, or a gifted sub that is continued.' },
  { key: 'resub', label: 'Resubscription', testable: true, vars: ['user', 'login', 'tier', 'months', 'streak', 'message'],
    minLabel: 'Minimum months', description: 'A subscription renewal, with the viewer\'s message when they add one.' },
  { key: 'gift_sub', label: 'Gifted sub', testable: true, vars: ['gifter', 'recipient', 'tier'],
    description: 'One sub gifted to one viewer. Subs gifted in a batch only produce the community gift alert.' },
  { key: 'community_gift', label: 'Community gift', testable: true, vars: ['gifter', 'count', 'tier'],
    minLabel: 'Minimum gifts', description: 'Several subs gifted to the community at once.' },
  { key: 'cheer', label: 'Cheer', testable: true, vars: ['user', 'login', 'amount', 'message'],
    minLabel: 'Minimum bits', description: 'When bits are used in the channel.' },
  { key: 'raid', label: 'Raid', testable: true, vars: ['user', 'login', 'viewers'],
    minLabel: 'Minimum viewers', description: 'When another channel raids this one.' },
  { key: 'hype_train_begin', label: 'Hype Train starts', testable: true, vars: ['level'],
    description: 'When a Hype Train begins. Progress updates never post.' },
  { key: 'hype_train_end', label: 'Hype Train ends', testable: true, vars: ['level'],
    description: 'When a Hype Train ends, with the level it reached.' },
  { key: 'redemption', label: 'Channel point redemption', testable: true, vars: ['user', 'login', 'reward', 'message'],
    description: 'When a viewer redeems a custom channel point reward.' },
  { key: 'ad_break_begin', label: 'Ad break starts', testable: true, vars: ['duration'],
    description: 'When an ad break begins, with its length in seconds.' },
  { key: 'ad_break_end', label: 'Ad break ends', testable: true, vars: ['duration'],
    description: 'Sent when the ad break\'s length has passed.' },
];

export const RAID_SHOUTOUT_VARS = ['user', 'login', 'viewers', 'raider_game'] as const;
export const ALERT_TEMPLATE_MAX = 500;

/** Fields of one alert that differ between two settings objects (for per-card dirty hints). */
export function alertChanged(a: AlertTemplate | undefined, b: AlertTemplate | undefined): boolean {
  if (!a || !b) return a !== b;
  return a.enabled !== b.enabled || a.template !== b.template || a.min_amount !== b.min_amount
    || a.send_mode !== b.send_mode || a.announce_color !== b.announce_color;
}
