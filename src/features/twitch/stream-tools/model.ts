/**
 * Types, limits and pure helpers for the Quotes, Counters, Stream tools and
 * Channel points pages (§10.7.8, §12.8).
 *
 * No React and no `@/` imports, so Node tests can import this file directly.
 * The API is the authority; the checks here only save a round trip and mirror
 * `acosmibot_core.twitch_bot.limits` and the endpoint validation.
 */

// ── Quotes ────────────────────────────────────────────────────────────────

export const QUOTE_LIMITS = { textMax: 400, nameMax: 64, categoryMax: 100, searchMax: 100, pageSize: 50 } as const;

export interface Quote {
  id: number;
  broadcaster_id: string;
  number: number;
  text: string;
  quoted_name: string | null;
  category_name: string | null;
  added_by_user_id: string | null;
  added_by_login: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** `GET /public/:login/quotes` item: no author fields. */
export interface PublicQuote {
  number: number;
  text: string;
  quoted_name: string | null;
  category_name: string | null;
  created_at: string | null;
}

export interface QuoteListResponse {
  success: true;
  items: Quote[];
  total: number;
  limit: number;
}

export interface QuoteDraft {
  text: string;
  quoted_name: string;
  category_name: string;
}

export interface QuoteInput {
  text: string;
  quoted_name: string | null;
  category_name: string | null;
}

export const EMPTY_QUOTE_DRAFT: QuoteDraft = { text: '', quoted_name: '', category_name: '' };

/** One line of text: control characters and runs of whitespace become single spaces. */
export const oneLine = (value: string): string =>
  // eslint-disable-next-line no-control-regex
  value.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g, ' ').split(/\s+/).filter(Boolean).join(' ');

export const draftFromQuote = (quote: Quote): QuoteDraft => ({
  text: quote.text,
  quoted_name: quote.quoted_name ?? '',
  category_name: quote.category_name ?? '',
});

export const quoteInputFromDraft = (draft: QuoteDraft): QuoteInput => ({
  text: oneLine(draft.text),
  quoted_name: oneLine(draft.quoted_name) || null,
  category_name: oneLine(draft.category_name) || null,
});

/** The first problem a quote draft has, or null when it can be sent. */
export function quoteProblem(draft: QuoteDraft): string | null {
  const input = quoteInputFromDraft(draft);
  if (!input.text) return 'Write the quote first.';
  if (input.text.length > QUOTE_LIMITS.textMax) return `A quote is at most ${QUOTE_LIMITS.textMax} characters.`;
  if (input.text.startsWith('/')) return 'A quote cannot start with a slash.';
  if ((input.quoted_name ?? '').length > QUOTE_LIMITS.nameMax) return `Who said it is at most ${QUOTE_LIMITS.nameMax} characters.`;
  if ((input.category_name ?? '').length > QUOTE_LIMITS.categoryMax) return `The category is at most ${QUOTE_LIMITS.categoryMax} characters.`;
  return null;
}

/** `?q=&offset=&limit=` for the quote lists; an empty search is left out. */
export function quoteQuery(search: string, page: number, pageSize: number = QUOTE_LIMITS.pageSize): string {
  const params = new URLSearchParams();
  const text = oneLine(search).slice(0, QUOTE_LIMITS.searchMax);
  if (text) params.set('q', text);
  params.set('offset', String(Math.max(0, page) * pageSize));
  params.set('limit', String(pageSize));
  return `?${params.toString()}`;
}

/** "1–50 of 120" for a page of an offset list. */
export function describePage(page: number, pageSize: number, shown: number, total: number): string {
  if (total <= 0 || shown <= 0) return 'No results';
  const first = page * pageSize + 1;
  return `${first}–${first + shown - 1} of ${total}`;
}

// ── Counters ──────────────────────────────────────────────────────────────

export const COUNTER_LIMITS = { nameMax: 40, valueMax: 1_000_000_000_000_000 } as const;
const COUNTER_NAME = /^[\p{L}\p{N}_-]{1,40}$/u;

export interface Counter {
  name: string;
  value: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface CounterListResponse {
  success: true;
  items: Counter[];
  limit: number;
}

/** Names are stored lowercase. */
export const normalizeCounterName = (value: string): string => value.trim().toLowerCase();

export function counterNameProblem(value: string): string | null {
  const name = normalizeCounterName(value);
  if (!name) return 'Give the counter a name.';
  if (!COUNTER_NAME.test(name)) return `Use letters, numbers, - and _ only, up to ${COUNTER_LIMITS.nameMax} characters.`;
  return null;
}

/** A counter value typed into a text box; null when it is not a whole number in range. */
export function parseCounterValue(raw: string): number | null {
  const text = raw.trim();
  if (!/^-?\d{1,16}$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) && Math.abs(value) <= COUNTER_LIMITS.valueMax ? value : null;
}

export const counterValueProblem = (raw: string): string | null =>
  parseCounterValue(raw) === null ? 'Enter a whole number between -1,000,000,000,000,000 and 1,000,000,000,000,000.' : null;

// ── Stream tools ──────────────────────────────────────────────────────────

export const STREAM_LIMITS = { titleMax: 140, categoryQueryMax: 100 } as const;
export const COMMERCIAL_LENGTHS = [30, 60, 90, 120, 150, 180] as const;

export interface StreamInfo {
  title: string;
  category_id: string;
  category_name: string;
  language: string;
}

export interface Category {
  id: string;
  name: string;
  box_art_url: string | null;
}

export interface ShoutoutResult {
  success: true;
  sent: boolean;
  native: boolean;
}

export function titleProblem(raw: string): string | null {
  const title = oneLine(raw);
  if (!title) return 'The title cannot be empty.';
  if (title.length > STREAM_LIMITS.titleMax) return `A title is at most ${STREAM_LIMITS.titleMax} characters.`;
  return null;
}

/** The body for `PUT /stream-info`: only what changed. */
export function streamInfoChanges(
  saved: Pick<StreamInfo, 'title' | 'category_id'>,
  title: string,
  category: { id: string } | null,
): { title?: string; category_id?: string } {
  const changes: { title?: string; category_id?: string } = {};
  const clean = oneLine(title);
  if (clean !== saved.title) changes.title = clean;
  if (category && category.id !== saved.category_id) changes.category_id = category.id;
  return changes;
}

export function describeShoutout(result: Pick<ShoutoutResult, 'sent' | 'native'>): string {
  if (result.sent && result.native) return 'Shoutout posted in chat and sent with Twitch shoutouts.';
  if (result.sent) return 'Shoutout posted in chat. Twitch did not send its own shoutout (they are limited to one every two minutes, and only while live).';
  if (result.native) return 'Twitch shoutout sent. The chat message was not delivered.';
  return 'Nothing was sent. Check that Acosmibot can talk in this chat.';
}

export interface StreamToolsSettings {
  shoutout_native: boolean;
  shoutout_template: string;
  default_commercial_length_s: number;
  clip_template: string;
  marker_template: string;
}

export interface QuotesSettings {
  enabled: boolean;
  template: string;
  public_page: boolean;
}

export interface ChannelPointsSettings {
  enabled: boolean;
}

export const TEMPLATE_MAX = 500;

// ── Channel points ────────────────────────────────────────────────────────

export const REWARD_LIMITS = {
  titleMax: 45,
  costMin: 1,
  costMax: 1_000_000_000,
  promptMax: 200,
  perStreamMax: 1_000_000_000,
  cooldownMax: 604_800,
  pointsMax: 1_000_000,
  soundUrlMax: 500,
} as const;

export type BindingAction = 'chat_message' | 'song_request' | 'add_points' | 'counter' | 'queue_join' | 'sound';

export interface BindingActionMeta {
  value: BindingAction;
  label: string;
  description: string;
}

export const BINDING_ACTIONS: ReadonlyArray<BindingActionMeta> = [
  { value: 'chat_message', label: 'Say a message in chat', description: 'Posts a message. It can use $(user), $(reward) and $(input) (what the viewer typed).' },
  { value: 'song_request', label: 'Request a song', description: 'Adds what the viewer typed as a song request, free of charge. Needs song requests to be set up.' },
  { value: 'add_points', label: 'Give loyalty points', description: 'Adds loyalty points to the viewer. Needs loyalty to be turned on.' },
  { value: 'counter', label: 'Change a counter', description: 'Adds to, subtracts from or sets a named counter.' },
  { value: 'queue_join', label: 'Join the viewer queue', description: 'Puts the viewer in the viewer queue, with what they typed as the note. Needs the viewer queue to be set up.' },
  { value: 'sound', label: 'Play a sound on stream', description: 'Plays a sound in the alert box overlay. Needs an alerts overlay in OBS.' },
];

export const bindingActionLabel = (action: string): string =>
  BINDING_ACTIONS.find((entry) => entry.value === action)?.label ?? action;

/** The subset of a Twitch custom reward the API returns (`reward_view`). */
export interface Reward {
  id: string;
  title: string;
  prompt: string;
  cost: number;
  background_color: string | null;
  is_enabled: boolean;
  is_paused: boolean;
  is_in_stock: boolean;
  is_user_input_required: boolean;
  should_redemptions_skip_request_queue: boolean;
  max_per_stream: { is_enabled: boolean; max_per_stream: number | null };
  max_per_user_per_stream: { is_enabled: boolean; max_per_user_per_stream: number | null };
  global_cooldown: { is_enabled: boolean; global_cooldown_seconds: number | null };
  image_url: string | null;
}

export interface Binding {
  id: number;
  reward_id: string;
  reward_title: string;
  managed: boolean;
  action: BindingAction;
  action_config: Record<string, unknown>;
  auto_fulfill: boolean;
  enabled: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface RewardItem {
  /** null when the reward was deleted on Twitch but a binding remains. */
  reward: Reward | null;
  manageable: boolean;
  binding: Binding | null;
}

export interface RewardListResponse {
  success: true;
  items: RewardItem[];
  binding_limit: number;
}

export const rewardItemKey = (item: RewardItem): string => item.reward?.id ?? item.binding?.reward_id ?? '';
export const rewardItemTitle = (item: RewardItem): string => item.reward?.title ?? item.binding?.reward_title ?? 'Deleted reward';

export interface RewardDraft {
  title: string;
  cost: string;
  prompt: string;
  is_enabled: boolean;
  is_user_input_required: boolean;
  should_redemptions_skip_request_queue: boolean;
  background_color: string;
  max_per_stream: string;
  max_per_user_per_stream: string;
  global_cooldown_seconds: string;
}

export const EMPTY_REWARD_DRAFT: RewardDraft = {
  title: '',
  cost: '100',
  prompt: '',
  is_enabled: true,
  is_user_input_required: false,
  should_redemptions_skip_request_queue: false,
  background_color: '',
  max_per_stream: '',
  max_per_user_per_stream: '',
  global_cooldown_seconds: '',
};

export const draftFromReward = (reward: Reward): RewardDraft => ({
  title: reward.title,
  cost: String(reward.cost),
  prompt: reward.prompt,
  is_enabled: reward.is_enabled,
  is_user_input_required: reward.is_user_input_required,
  should_redemptions_skip_request_queue: reward.should_redemptions_skip_request_queue,
  background_color: reward.background_color ?? '',
  max_per_stream: reward.max_per_stream.is_enabled && reward.max_per_stream.max_per_stream ? String(reward.max_per_stream.max_per_stream) : '',
  max_per_user_per_stream: reward.max_per_user_per_stream.is_enabled && reward.max_per_user_per_stream.max_per_user_per_stream
    ? String(reward.max_per_user_per_stream.max_per_user_per_stream) : '',
  global_cooldown_seconds: reward.global_cooldown.is_enabled && reward.global_cooldown.global_cooldown_seconds
    ? String(reward.global_cooldown.global_cooldown_seconds) : '',
});

const wholeNumber = (raw: string): number | null => (/^\d{1,12}$/.test(raw.trim()) ? Number(raw.trim()) : null);
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/** The first problem a reward draft has, or null when it can be sent. */
export function rewardProblem(draft: RewardDraft): string | null {
  const title = oneLine(draft.title);
  if (!title) return 'Give the reward a title.';
  if (title.length > REWARD_LIMITS.titleMax) return `A title is at most ${REWARD_LIMITS.titleMax} characters.`;
  const cost = wholeNumber(draft.cost);
  if (cost === null || cost < REWARD_LIMITS.costMin || cost > REWARD_LIMITS.costMax) return 'The cost is a whole number from 1 to 1,000,000,000.';
  if (draft.prompt.length > REWARD_LIMITS.promptMax) return `The prompt is at most ${REWARD_LIMITS.promptMax} characters.`;
  if (draft.background_color.trim() && !HEX_COLOR.test(draft.background_color.trim())) return 'The colour is a hex code like #9147FF.';
  for (const [raw, label, max] of [
    [draft.max_per_stream, 'The limit per stream', REWARD_LIMITS.perStreamMax],
    [draft.max_per_user_per_stream, 'The limit per viewer', REWARD_LIMITS.perStreamMax],
    [draft.global_cooldown_seconds, 'The cooldown', REWARD_LIMITS.cooldownMax],
  ] as const) {
    if (!raw.trim()) continue;
    const value = wholeNumber(raw);
    if (value === null || value < 1 || value > max) return `${label} is a whole number from 1 to ${max.toLocaleString('en-US')}, or empty for no limit.`;
  }
  return null;
}

const optionalNumber = (raw: string): number | null => (raw.trim() ? Number(raw.trim()) : null);

/** The body for `POST /rewards`. */
export function rewardCreateInput(draft: RewardDraft): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: oneLine(draft.title),
    cost: Number(draft.cost.trim()),
    prompt: draft.prompt.trim(),
    is_enabled: draft.is_enabled,
    is_user_input_required: draft.is_user_input_required,
    should_redemptions_skip_request_queue: draft.should_redemptions_skip_request_queue,
  };
  if (draft.background_color.trim()) body.background_color = draft.background_color.trim();
  for (const field of ['max_per_stream', 'max_per_user_per_stream', 'global_cooldown_seconds'] as const) {
    const value = optionalNumber(draft[field]);
    if (value !== null) body[field] = value;
  }
  return body;
}

/** The body for `PATCH /rewards/:id`: only the fields that differ from the saved draft (`null` clears a limit). */
export function rewardPatch(draft: RewardDraft, saved: RewardDraft): Record<string, unknown> {
  const full = rewardCreateInput(draft);
  const patch: Record<string, unknown> = {};
  const was = rewardCreateInput(saved);
  for (const key of Object.keys(full)) {
    if (full[key] !== was[key]) patch[key] = full[key];
  }
  for (const field of ['max_per_stream', 'max_per_user_per_stream', 'global_cooldown_seconds'] as const) {
    if (draft[field].trim() === '' && saved[field].trim() !== '') patch[field] = null;
  }
  if (draft.background_color.trim() === '' && saved.background_color.trim() !== '') delete patch.background_color;
  return patch;
}

export interface BindingDraft {
  action: BindingAction;
  template: string;
  amount: string;
  counter_name: string;
  counter_op: string;
  sound_url: string;
  auto_fulfill: boolean;
  enabled: boolean;
}

export const EMPTY_BINDING_DRAFT: BindingDraft = {
  action: 'chat_message',
  template: '$(user) redeemed $(reward)!',
  amount: '100',
  counter_name: '',
  counter_op: '+1',
  sound_url: '',
  auto_fulfill: true,
  enabled: true,
};

export function draftFromBinding(binding: Binding | null): BindingDraft {
  if (!binding) return { ...EMPTY_BINDING_DRAFT };
  const config = binding.action_config ?? {};
  const text = (key: string, fallback: string) => (typeof config[key] === 'string' ? (config[key] as string) : fallback);
  return {
    ...EMPTY_BINDING_DRAFT,
    action: binding.action,
    template: text('template', EMPTY_BINDING_DRAFT.template),
    amount: typeof config.amount === 'number' ? String(config.amount) : EMPTY_BINDING_DRAFT.amount,
    counter_name: text('name', ''),
    counter_op: text('op', '+1'),
    sound_url: text('sound_url', ''),
    auto_fulfill: binding.auto_fulfill,
    enabled: binding.enabled,
  };
}

const COUNTER_OP = /^(?:\+\d{1,15}|-\d{1,15}|=-?\d{1,15}|reset)$/i;

export function bindingConfigFromDraft(draft: BindingDraft): Record<string, unknown> {
  switch (draft.action) {
    case 'chat_message': return { template: draft.template.trim() };
    case 'add_points': return { amount: Number(draft.amount.trim()) };
    case 'counter': return { name: normalizeCounterName(draft.counter_name), op: draft.counter_op.trim() || '+1' };
    case 'sound': return { sound_url: draft.sound_url.trim() };
    default: return {};
  }
}

export function bindingProblem(draft: BindingDraft): string | null {
  switch (draft.action) {
    case 'chat_message': {
      const template = draft.template.trim();
      if (!template) return 'Write the message to post.';
      if (template.length > TEMPLATE_MAX) return `The message is at most ${TEMPLATE_MAX} characters.`;
      return null;
    }
    case 'add_points': {
      const amount = wholeNumber(draft.amount);
      return amount !== null && amount >= 1 && amount <= REWARD_LIMITS.pointsMax ? null : 'Points are a whole number from 1 to 1,000,000.';
    }
    case 'counter': {
      const name = counterNameProblem(draft.counter_name);
      if (name) return name;
      return COUNTER_OP.test(draft.counter_op.trim() || '+1') ? null : 'Use +n, -n, =n or reset for the change.';
    }
    case 'sound': {
      const url = draft.sound_url.trim();
      if (!url) return 'Enter the sound link.';
      if (url.length > REWARD_LIMITS.soundUrlMax) return `The link is at most ${REWARD_LIMITS.soundUrlMax} characters.`;
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? null : 'The sound link must start with https:// and have no password.';
      } catch {
        return 'The sound link must be a full https:// address.';
      }
    }
    default:
      return null;
  }
}

/** The body for `PUT /rewards/:id/binding`. Unmanaged rewards never auto-fulfil. */
export function bindingInput(draft: BindingDraft, manageable: boolean): {
  action: BindingAction; action_config: Record<string, unknown>; auto_fulfill: boolean; enabled: boolean;
} {
  return {
    action: draft.action,
    action_config: bindingConfigFromDraft(draft),
    auto_fulfill: manageable && draft.auto_fulfill,
    enabled: draft.enabled,
  };
}

/** One sentence about what a binding does, for the rewards table. */
export function describeBinding(binding: Binding | null): string {
  if (!binding) return 'No action';
  return `${bindingActionLabel(binding.action)}${binding.enabled ? '' : ' (off)'}`;
}
