/**
 * Moderation slice model (§12.3, §10.7.3): settings and resource types, the
 * filter catalogue shown on the Filters page, and pure validation/description
 * helpers. No React and no path aliases, so Node tests import it directly.
 * The API and the bot validate everything again; these checks only give
 * earlier, clearer messages.
 */
import type { Level } from '../types';

/* ── Settings (core `ModerationSettings` / `ChatLogSettings`) ──────────── */

export type StrikeAction = 'delete' | 'warn' | 'timeout' | 'ban';
export interface StrikeStep { action: StrikeAction; duration_s: number }

export interface FilterBase { enabled: boolean; exempt_level: Level; reason: string }
export interface LinkFilter extends FilterBase { allowlist: string[]; permit_seconds: number; block_bare_domains: boolean }
export interface CapsFilter extends FilterBase { min_length: number; max_percent: number }
export interface SymbolFilter extends FilterBase { min_length: number; max_percent: number; max_consecutive: number }
export interface EmoteFilter extends FilterBase { max_emotes: number }
export interface RepetitionFilter extends FilterBase { max_repeated_words: number; max_repeated_chars: number; duplicate_window_s: number }
export interface LengthFilter extends FilterBase { max_length: number }
export interface ZalgoFilter extends FilterBase { max_marks_per_char: number; max_total_marks: number }
export type MeFilter = FilterBase;
export interface MentionFilter extends FilterBase { max_mentions: number }
export interface ScriptFilter extends FilterBase { min_length: number; max_percent: number }

export interface RaidProtection { enabled: boolean; min_viewers: number; followers_only_minutes: number; shield_mode: boolean; duration_s: number }
export interface FollowBotProtection { enabled: boolean; follows_per_minute: number; followers_only_minutes: number; shield_mode: boolean; duration_s: number }

export interface ModerationSettings {
  enabled: boolean;
  warning_template: string;
  warning_cooldown_s: number;
  strike_window_s: number;
  ladder: StrikeStep[];
  links: LinkFilter;
  caps: CapsFilter;
  symbols: SymbolFilter;
  emotes: EmoteFilter;
  repetition: RepetitionFilter;
  length: LengthFilter;
  zalgo: ZalgoFilter;
  me: MeFilter;
  mentions: MentionFilter;
  scripts: ScriptFilter;
  blocked_terms_enabled: boolean;
  raid_protection: RaidProtection;
  follow_bot_protection: FollowBotProtection;
}

export interface ChatLogSettings { enabled: boolean; retention_days: number }

/* ── Resources (`to_api_dict` of the core entities) ─────────────────────── */

export type MatchType = 'plain' | 'wildcard' | 'regex';
export type TermAction = 'delete' | 'timeout' | 'ban' | 'warn';

export interface BlockedTerm {
  id: number;
  broadcaster_id: string;
  pattern: string;
  match_type: MatchType;
  action: TermAction;
  timeout_s: number | null;
  exempt_level: Level;
  enabled: boolean;
  created_by_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BlockedTermInput {
  pattern: string;
  match_type: MatchType;
  action: TermAction;
  timeout_s: number | null;
  exempt_level: Level;
  enabled: boolean;
}

export interface BlockedTermList { success: true; items: BlockedTerm[]; count: number; limit: number; regex_limit: number }
export interface TermTestResult { success: true; valid: boolean; matches: boolean; error: string | null }

export interface ModLogEntry {
  id: number;
  broadcaster_id: string;
  target_user_id: string | null;
  target_login: string | null;
  actor_type: 'bot' | 'user';
  actor_user_id: string | null;
  rule: string;
  action: string;
  duration_s: number | null;
  strike: number | null;
  message_excerpt: string | null;
  created_at: string | null;
}

export interface ChatLogEntry {
  id: number;
  broadcaster_id: string;
  message_id: string;
  user_id: string;
  login: string;
  display_name: string;
  text: string;
  badges: string;
  level: number;
  is_deleted: boolean;
  created_at: string | null;
}

export interface Page<T> { success: true; items: T[]; next_before_id: number | null }

export interface ViewerRow {
  user_id: string;
  login: string;
  display_name: string;
  points: number;
  watch_minutes: number;
  message_count?: number;
  last_seen_at?: string | null;
}

export interface UserLookup {
  success: true;
  user: { user_id: string; login: string | null; display_name: string | null };
  viewer: ViewerRow | null;
  is_regular: boolean;
  recent_messages: ChatLogEntry[];
  moderation: ModLogEntry[];
  follow: { followed_at: string } | null;
}

export type ManualAction = 'timeout' | 'ban' | 'unban' | 'warn' | 'delete';
export interface ManualActionInput { action: ManualAction; user_id: string; message_id?: string; duration_s?: number; reason?: string }
export interface ManualActionResult { success: true; ok: boolean; acted_as: 'bot' | 'broadcaster' | null; error: string | null }

export type ProtectionKind = 'raid' | 'follow_bot' | 'shield';
export interface ProtectionResult {
  success: true;
  kind: ProtectionKind;
  active: boolean;
  followers_only: boolean;
  shield_mode: boolean;
  active_protections: string[];
  errors: string[];
}

/* ── Limits (mirror core limits.py / settings.py) ───────────────────────── */

export const LIMITS = {
  termChars: 200,
  wildcards: 5,
  sampleChars: 500,
  maxTimeoutS: 1_209_600,
  ladderSteps: 6,
  allowlist: 100,
  reasonChars: 100,
  warningChars: 500,
  searchChars: 100,
  pageSize: 50,
} as const;

/* ── Filter catalogue (the Filters page) ────────────────────────────────── */

export type FilterKey = 'links' | 'caps' | 'symbols' | 'emotes' | 'repetition' | 'length' | 'zalgo' | 'mentions' | 'scripts';

export interface NumberFieldMeta {
  key: string;
  label: string;
  min: number;
  max: number;
  /** `seconds` fields use DurationInput; `percent` shows a % suffix in the label. */
  kind: 'count' | 'percent' | 'seconds';
  help?: string;
}

export interface FilterMeta { key: FilterKey; label: string; description: string; fields: NumberFieldMeta[] }

/**
 * Filters in the order the bot checks them (after blocked terms). The `/me`
 * filter is deliberately absent: §12.3.1 keeps it hidden until the end-to-end
 * check confirms how Twitch delivers `/me` messages.
 */
export const FILTERS: FilterMeta[] = [
  {
    key: 'links', label: 'Links',
    description: 'Removes links unless every link goes to an allowed domain or the chatter has a !permit.',
    fields: [{ key: 'permit_seconds', label: '!permit lasts', min: 10, max: 600, kind: 'seconds' }],
  },
  {
    key: 'length', label: 'Long messages', description: 'Removes messages longer than the limit.',
    fields: [{ key: 'max_length', label: 'Longest message (characters)', min: 20, max: 500, kind: 'count' }],
  },
  {
    key: 'caps', label: 'Capital letters', description: 'Removes messages that are mostly capital letters.',
    fields: [
      { key: 'min_length', label: 'Only check messages with at least this many letters', min: 5, max: 500, kind: 'count' },
      { key: 'max_percent', label: 'Most capitals allowed (%)', min: 10, max: 100, kind: 'percent' },
    ],
  },
  {
    key: 'symbols', label: 'Symbols', description: 'Removes messages made mostly of symbols, or with a long run of one symbol. Emoji are counted by the emote filter instead.',
    fields: [
      { key: 'min_length', label: 'Only check messages with at least this many characters', min: 5, max: 500, kind: 'count' },
      { key: 'max_percent', label: 'Most symbols allowed (%)', min: 10, max: 100, kind: 'percent' },
      { key: 'max_consecutive', label: 'Longest run of one symbol', min: 3, max: 500, kind: 'count' },
    ],
  },
  {
    key: 'emotes', label: 'Emotes', description: 'Removes messages with too many emotes and emoji together.',
    fields: [{ key: 'max_emotes', label: 'Most emotes allowed', min: 1, max: 200, kind: 'count' }],
  },
  {
    key: 'repetition', label: 'Repetition', description: 'Removes repeated words, long runs of one character, and the same message sent again by the same chatter.',
    fields: [
      { key: 'max_repeated_words', label: 'Most times one word may appear', min: 2, max: 100, kind: 'count' },
      { key: 'max_repeated_chars', label: 'Longest run of one character', min: 3, max: 500, kind: 'count' },
      { key: 'duplicate_window_s', label: 'Same message again within', min: 0, max: 600, kind: 'seconds', help: '0 turns the repeated-message check off.' },
    ],
  },
  {
    key: 'zalgo', label: 'Zalgo text', description: 'Removes text stacked with combining marks. Ordinary accents and scripts that use marks, such as Hindi or Thai, are not affected.',
    fields: [
      { key: 'max_marks_per_char', label: 'Most marks on one character', min: 1, max: 20, kind: 'count' },
      { key: 'max_total_marks', label: 'Most stacking marks in a message', min: 1, max: 200, kind: 'count' },
    ],
  },
  {
    key: 'mentions', label: 'Mass mentions', description: 'Removes messages that mention too many different people.',
    fields: [{ key: 'max_mentions', label: 'Most people mentioned', min: 1, max: 50, kind: 'count' }],
  },
  {
    key: 'scripts', label: 'Non-Latin scripts', description: 'Removes messages written mostly outside the Latin alphabet.',
    fields: [
      { key: 'min_length', label: 'Only check messages with at least this many letters', min: 1, max: 500, kind: 'count' },
      { key: 'max_percent', label: 'Most non-Latin letters allowed (%)', min: 1, max: 100, kind: 'percent' },
    ],
  },
];

export const STRIKE_ACTIONS: { value: StrikeAction; label: string }[] = [
  { value: 'delete', label: 'Delete the message' },
  { value: 'warn', label: 'Twitch warning (and delete)' },
  { value: 'timeout', label: 'Timeout' },
  { value: 'ban', label: 'Ban' },
];

export const TERM_ACTIONS: { value: TermAction; label: string }[] = STRIKE_ACTIONS;

export const MATCH_TYPES: { value: MatchType; label: string; help: string }[] = [
  { value: 'plain', label: 'Text', help: 'Matches the text anywhere in a message, ignoring case.' },
  { value: 'wildcard', label: 'Wildcard', help: '* matches any run of non-space characters (up to 5), ? matches one.' },
  { value: 'regex', label: 'Regular expression', help: 'Checked for speed when saved; slow or unsafe patterns are refused.' },
];

/* ── Validation ─────────────────────────────────────────────────────────── */

const DOMAIN_PATTERN = /^([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

/** `https://www.Example.com/path` → `www.example.com`; returns '' for junk. */
export function normalizeDomain(value: string): string {
  let text = value.trim().toLowerCase();
  text = text.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  text = text.split(/[/?#\s]/)[0] ?? '';
  text = text.replace(/:\d+$/, '').replace(/\.+$/, '');
  return text;
}

export function domainProblem(domain: string): string | null {
  if (!domain) return 'Enter a domain such as example.com.';
  if (domain.length > 253 || !DOMAIN_PATTERN.test(domain)) return `${domain} is not a valid domain.`;
  return null;
}

export function ladderProblem(ladder: StrikeStep[]): string | null {
  if (ladder.length < 1) return 'The strike ladder needs at least one step.';
  if (ladder.length > LIMITS.ladderSteps) return `The strike ladder can have at most ${LIMITS.ladderSteps} steps.`;
  for (let index = 0; index < ladder.length; index += 1) {
    const step = ladder[index];
    if (step.action === 'ban' && index < ladder.length - 1) return 'Ban can only be the last step of the ladder.';
    if (step.action === 'timeout' && (step.duration_s < 1 || step.duration_s > LIMITS.maxTimeoutS)) {
      return 'Timeouts must last between 1 second and 14 days.';
    }
  }
  return null;
}

/** First problem in the whole form, for the save bar. */
export function moderationProblem(form: ModerationSettings): string | null {
  const ladder = ladderProblem(form.ladder);
  if (ladder) return ladder;
  if (form.links.allowlist.length > LIMITS.allowlist) return `At most ${LIMITS.allowlist} allowed domains.`;
  for (const domain of form.links.allowlist) {
    const problem = domainProblem(domain);
    if (problem) return problem;
  }
  for (const meta of FILTERS) {
    const filter = form[meta.key] as unknown as Record<string, unknown>;
    if (String(filter.reason ?? '').length > LIMITS.reasonChars) return `${meta.label}: the reason is too long.`;
    for (const field of meta.fields) {
      const value = Number(filter[field.key]);
      if (!Number.isFinite(value) || value < field.min || value > field.max) {
        return `${meta.label}: “${field.label}” must be between ${field.min} and ${field.max}.`;
      }
    }
  }
  if (form.warning_template.length > LIMITS.warningChars) return 'The warning message is too long.';
  return null;
}

export interface TermDraft { pattern: string; match_type: MatchType; action: TermAction; timeout_s: number; exempt_level: Level; enabled: boolean }

export const EMPTY_TERM_DRAFT: TermDraft = { pattern: '', match_type: 'plain', action: 'delete', timeout_s: 600, exempt_level: 500, enabled: true };

export const draftFromTerm = (term: BlockedTerm): TermDraft => ({
  pattern: term.pattern,
  match_type: term.match_type,
  action: term.action,
  timeout_s: term.timeout_s ?? 600,
  exempt_level: term.exempt_level,
  enabled: term.enabled,
});

export const termInputFromDraft = (draft: TermDraft): BlockedTermInput => ({
  pattern: draft.pattern.trim(),
  match_type: draft.match_type,
  action: draft.action,
  timeout_s: draft.action === 'timeout' ? draft.timeout_s : null,
  exempt_level: draft.exempt_level,
  enabled: draft.enabled,
});

export const sameTermDraft = (a: TermDraft, b: TermDraft): boolean =>
  a.pattern === b.pattern && a.match_type === b.match_type && a.action === b.action && a.timeout_s === b.timeout_s
  && a.exempt_level === b.exempt_level && a.enabled === b.enabled;

export function termProblem(draft: TermDraft): string | null {
  const pattern = draft.pattern.trim();
  if (!pattern) return 'Enter the word, phrase or pattern to block.';
  if (pattern.length > LIMITS.termChars) return `Patterns can be at most ${LIMITS.termChars} characters.`;
  if (draft.match_type === 'wildcard' && (pattern.match(/\*/g)?.length ?? 0) > LIMITS.wildcards) {
    return `Use at most ${LIMITS.wildcards} * wildcards.`;
  }
  if (draft.match_type === 'wildcard' && /^[*?\s]+$/.test(pattern)) return 'A pattern of only wildcards would match every message.';
  if (draft.action === 'timeout' && (!Number.isInteger(draft.timeout_s) || draft.timeout_s < 1 || draft.timeout_s > LIMITS.maxTimeoutS)) {
    return 'Timeouts must last between 1 second and 14 days.';
  }
  return null;
}

/* ── Descriptions ───────────────────────────────────────────────────────── */

export const LOG_ACTIONS: { value: string; label: string }[] = [
  { value: 'delete', label: 'Deleted message' },
  { value: 'warn', label: 'Warning' },
  { value: 'timeout', label: 'Timeout' },
  { value: 'ban', label: 'Ban' },
  { value: 'unban', label: 'Unban' },
  { value: 'followers_only_on', label: 'Followers-only on' },
  { value: 'followers_only_off', label: 'Followers-only off' },
  { value: 'shield_on', label: 'Shield Mode on' },
  { value: 'shield_off', label: 'Shield Mode off' },
];

const ACTION_LABEL = new Map(LOG_ACTIONS.map((item) => [item.value, item.label]));

export const actionLabel = (action: string): string => ACTION_LABEL.get(action) ?? action;

const RULE_LABEL: Record<string, string> = {
  links: 'Links filter', length: 'Long messages filter', caps: 'Capital letters filter', symbols: 'Symbols filter',
  emotes: 'Emotes filter', repetition: 'Repetition filter', zalgo: 'Zalgo filter', mentions: 'Mass mentions filter',
  scripts: 'Non-Latin scripts filter', me: '/me filter', manual: 'Moderator (dashboard)',
  raid_protection: 'Raid protection', follow_bot_protection: 'Follow-bot protection',
};

export function ruleLabel(rule: string): string {
  if (rule.startsWith('blocked_term')) return 'Blocked term';
  return RULE_LABEL[rule] ?? rule;
}

const DURATION_UNITS: [number, string][] = [[86_400, 'd'], [3_600, 'h'], [60, 'm'], [1, 's']];

export function shortDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 1) return '';
  for (const [size, unit] of DURATION_UNITS) {
    if (seconds % size === 0) return `${seconds / size}${unit}`;
  }
  return `${seconds}s`;
}

export function describeLogAction(entry: Pick<ModLogEntry, 'action' | 'duration_s' | 'strike'>): string {
  let text = actionLabel(entry.action);
  if (entry.action === 'timeout' && entry.duration_s) text += ` ${shortDuration(entry.duration_s)}`;
  if (entry.strike) text += ` · strike ${entry.strike}`;
  return text;
}

const ERROR_TEXT: Record<string, string> = {
  not_permitted: 'Twitch did not allow it. Make Acosmibot a moderator, or reconnect the channel from the overview.',
  missing_grant: 'The channel connection is missing a permission. Reconnect it from the overview.',
  target_is_moderator: 'Moderators and the broadcaster cannot be moderated.',
  rate_limited: 'Twitch is rate limiting requests. Try again in a moment.',
  twitch_error: 'Twitch rejected the request.',
};

export const describeActionError = (code: string | null | undefined): string =>
  (code && ERROR_TEXT[code]) || 'The action did not go through.';

export function describeProtection(result: Pick<ProtectionResult, 'kind' | 'active' | 'shield_mode' | 'followers_only' | 'errors'>): string {
  if (result.errors.length) return describeActionError(result.errors[0]);
  if (result.kind === 'shield') return result.active ? 'Shield Mode is on.' : 'Shield Mode is off.';
  return result.active ? 'Protection is on.' : 'Protection is off and chat settings are restored.';
}

/** Query string for the chat log search; returns null with a message when invalid. */
export function chatLogQuery(input: { user: string; text: string; beforeId?: number | null; limit?: number }): { query: string; problem: string | null } {
  const params = new URLSearchParams();
  const user = input.user.trim().replace(/^@/, '').toLowerCase();
  if (user) {
    if (/^[0-9]{1,32}$/.test(user)) params.set('user_id', user);
    else if (/^[a-z0-9_]{1,25}$/.test(user)) params.set('login', user);
    else return { query: '', problem: 'Enter a Twitch username or user id.' };
  }
  const text = input.text.trim();
  if (text.length > LIMITS.searchChars) return { query: '', problem: `Search text is limited to ${LIMITS.searchChars} characters.` };
  if (text) params.set('q', text);
  if (input.beforeId) params.set('before_id', String(input.beforeId));
  params.set('limit', String(input.limit ?? LIMITS.pageSize));
  return { query: `?${params.toString()}`, problem: null };
}

export function modLogQuery(input: { action: string; userId: string | null; beforeId?: number | null; limit?: number }): string {
  const params = new URLSearchParams();
  if (input.action) params.set('action', input.action);
  if (input.userId) params.set('target_user_id', input.userId);
  if (input.beforeId) params.set('before_id', String(input.beforeId));
  params.set('limit', String(input.limit ?? LIMITS.pageSize));
  return `?${params.toString()}`;
}

/** "subscriber/12,vip/1" → ["subscriber", "vip"]; shared-chat rows keep a "shared" marker. */
export function badgeNames(badges: string): { shared: boolean; names: string[] } {
  const shared = badges.startsWith('shared:');
  const raw = shared ? badges.slice('shared:'.length) : badges;
  const names = raw.split(',').map((part) => part.split('/')[0]).filter(Boolean);
  return { shared, names };
}
