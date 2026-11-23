/**
 * Types, limits and pure helpers for the Giveaways, Polls & predictions and
 * Viewer queue pages (§10.7.6, §12.6).
 *
 * No React and no `@/` imports, so Node tests can import this file directly.
 * The API is the authority; the checks here only save a round trip and mirror
 * the endpoint validation and Twitch's limits.
 */

export const TEMPLATE_MAX = 500;

/** One line of text: control characters and runs of whitespace become single spaces. */
export const oneLine = (value: string): string =>
  // eslint-disable-next-line no-control-regex
  value.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g, ' ').split(/\s+/).filter(Boolean).join(' ');

// ── Giveaways ─────────────────────────────────────────────────────────────

export type EntryMode = 'keyword' | 'active' | 'tickets';
export type GiveawayStatus = 'draft' | 'open' | 'closed' | 'drawn' | 'cancelled';
export type WinnerStatus = 'pending' | 'claimed' | 'expired' | 'rerolled';

export const GIVEAWAY_LIMITS = {
  titleMax: 100, keywordMax: 40, ticketCostMax: 1_000_000, maxTicketsMax: 1000, luckMin: 1, luckMax: 10,
  winnerCountMax: 20, claimMax: 3600, windowMin: 1, windowMax: 120, followMinutesMax: 525_600,
  accountAgeDaysMax: 3650, excludeWinnersDaysMax: 365, autoCloseDaysMax: 7, entriesPageSize: 50,
} as const;

export const ENTRY_MODES: ReadonlyArray<{ value: EntryMode; label: string; help: string }> = [
  { value: 'keyword', label: 'Type a keyword', help: 'Viewers enter by typing the keyword in chat. One entry each.' },
  { value: 'tickets', label: 'Buy tickets', help: 'Viewers spend points on tickets with !ticket. More tickets, better odds.' },
  { value: 'active', label: 'Active chatters', help: 'Nobody has to enter. The winner is drawn from people who chatted recently.' },
];

/** The pre-version-2 rule keys. The API still returns them inside `eligibility_json` for older clients. */
export interface GiveawayEligibility {
  min_level: number;
  subscriber_only: boolean;
  min_follow_minutes: number;
  min_account_age_days: number;
  exclude_winners_days: number;
}

// ── Eligibility rules (version 2, core giveaway_rules.EligibilityRules) ───────

export type RoleChoice = 'allow' | 'exclude';
export type RoleName = 'broadcaster' | 'moderators' | 'vips' | 'regulars';
export type SubscriptionRule = 'everyone' | 'subscribers' | 'non_subscribers';
export type FollowingMode = 'everyone' | 'followers' | 'non_followers';
export type PriorPeriod = 'off' | 'today' | 'week' | 'month' | 'year' | 'ever' | 'range' | 'rolling';
export type CountedStatus = 'pending' | 'claimed' | 'expired' | 'rerolled';

export interface NamedExclusion { user_id: string; login: string }

export interface EligibilityRules {
  v: 2;
  min_level: number;
  roles: { broadcaster: RoleChoice; moderators: RoleChoice; vips: RoleChoice; regulars: RoleChoice; only: RoleName[] };
  subscription: SubscriptionRule;
  following: { mode: FollowingMode; min_follow_minutes: number };
  prior_winners: { period: PriorPeriod; days: number; start: string | null; end: string | null; statuses: CountedStatus[]; scope?: 'channel' };
  min_account_age_days: number;
  participation: { min_watch_minutes: number; min_messages: number; min_points: number };
  named_exclusions: NamedExclusion[];
}

export interface EligibilityPreset { name: string; rules: EligibilityRules }

export const RULE_LIMITS = {
  namedExclusionsMax: 100, presetsMax: 10, presetNameMax: 40, followMinutesMax: 525_600, rollingDaysMax: 3650,
  rangeDaysMax: 3660, accountAgeDaysMax: 3650, watchMinutesMax: 10_000_000, messagesMax: 100_000_000,
  pointsMax: 1_000_000_000_000,
} as const;

export const ROLE_NAMES: readonly RoleName[] = ['broadcaster', 'moderators', 'vips', 'regulars'];
export const ROLE_LABEL: Record<RoleName, string> = { broadcaster: 'You (the broadcaster)', moderators: 'Moderators', vips: 'VIPs', regulars: 'Regulars' };
const ROLE_NOUN: Record<RoleName, string> = { broadcaster: 'the broadcaster', moderators: 'moderators', vips: 'VIPs', regulars: 'regulars' };
export const COUNTED_STATUSES: readonly CountedStatus[] = ['pending', 'claimed', 'expired', 'rerolled'];
export const DEFAULT_COUNTED: readonly CountedStatus[] = ['pending', 'claimed'];
export const COUNTED_LABEL: Record<CountedStatus, string> = {
  pending: 'Winners still waiting to claim', claimed: 'Claimed prizes', expired: 'Prizes nobody claimed in time', rerolled: 'Rerolled draws',
};

export const PRIOR_PERIODS: ReadonlyArray<{ value: PriorPeriod; label: string }> = [
  { value: 'off', label: 'Past winners can enter' },
  { value: 'today', label: 'Not if they won today' },
  { value: 'week', label: 'Not if they won this week (weeks start Monday)' },
  { value: 'month', label: 'Not if they won this month' },
  { value: 'year', label: 'Not if they won this year' },
  { value: 'rolling', label: 'Not if they won in the last few days' },
  { value: 'range', label: 'Not if they won between two dates' },
  { value: 'ever', label: 'Not if they ever won here' },
];

/** Rules that let everyone in chat enter, except the broadcaster: the default for a new giveaway. */
export const defaultRules = (): EligibilityRules => ({
  v: 2,
  min_level: 0,
  roles: { broadcaster: 'exclude', moderators: 'allow', vips: 'allow', regulars: 'allow', only: [] },
  subscription: 'everyone',
  following: { mode: 'everyone', min_follow_minutes: 0 },
  prior_winners: { period: 'off', days: 0, start: null, end: null, statuses: [...DEFAULT_COUNTED], scope: 'channel' },
  min_account_age_days: 0,
  participation: { min_watch_minutes: 0, min_messages: 0, min_points: 0 },
  named_exclusions: [],
});

/** The older five-key shape as version 2 rules (same meaning; mirrors core `upgrade_legacy`). */
export const rulesFromLegacy = (legacy: Partial<GiveawayEligibility> | null | undefined): EligibilityRules => {
  const rules = defaultRules();
  if (!legacy) return rules;
  rules.min_level = Number(legacy.min_level) || 0;
  if (legacy.subscriber_only) rules.subscription = 'subscribers';
  const follow = Number(legacy.min_follow_minutes) || 0;
  if (follow > 0) rules.following = { mode: 'followers', min_follow_minutes: follow };
  rules.min_account_age_days = Number(legacy.min_account_age_days) || 0;
  const days = Number(legacy.exclude_winners_days) || 0;
  if (days > 0) rules.prior_winners = { period: 'rolling', days, start: null, end: null, statuses: ['pending', 'claimed', 'expired'], scope: 'channel' };
  return rules;
};

/** A deep copy with every field present (stored rules may come from an older client). */
export const normalizeRules = (rules: Partial<EligibilityRules> | null | undefined): EligibilityRules => {
  const base = defaultRules();
  if (!rules) return base;
  return {
    ...base, ...rules, v: 2,
    roles: { ...base.roles, ...(rules.roles ?? {}), only: [...(rules.roles?.only ?? [])] },
    following: { ...base.following, ...(rules.following ?? {}) },
    prior_winners: { ...base.prior_winners, ...(rules.prior_winners ?? {}), statuses: [...(rules.prior_winners?.statuses ?? DEFAULT_COUNTED)] },
    participation: { ...base.participation, ...(rules.participation ?? {}) },
    named_exclusions: (rules.named_exclusions ?? []).map((item) => ({ user_id: item.user_id, login: item.login })),
  };
};

/** The rules of a giveaway: `eligibility` (version 2) when the API sent it, else the older keys. */
export const rulesOf = (giveaway: Pick<Giveaway, 'eligibility_json'> & { eligibility?: EligibilityRules | null }): EligibilityRules =>
  giveaway.eligibility ? normalizeRules(giveaway.eligibility) : rulesFromLegacy(giveaway.eligibility_json);

const canonicalRules = (rules: EligibilityRules) => {
  const r = normalizeRules(rules);
  return JSON.stringify({
    ...r,
    roles: { ...r.roles, only: ROLE_NAMES.filter((name) => r.roles.only.includes(name)) },
    prior_winners: { ...r.prior_winners, scope: 'channel', statuses: COUNTED_STATUSES.filter((x) => r.prior_winners.statuses.includes(x)) },
    named_exclusions: r.named_exclusions.map((item) => item.user_id).sort(),
  });
};

export const sameRules = (a: EligibilityRules, b: EligibilityRules): boolean => canonicalRules(a) === canonicalRules(b);

const isInt = (value: number, low: number, high: number): boolean => Number.isInteger(value) && value >= low && value <= high;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The first thing wrong with a rule set, or `null` (mirrors the core model's validation). */
export const rulesProblem = (rules: EligibilityRules): string | null => {
  const L = RULE_LIMITS;
  const clash = rules.roles.only.find((name) => rules.roles[name] === 'exclude');
  if (clash) return `${ROLE_LABEL[clash]} cannot be both required and excluded.`;
  if (!isInt(rules.following.min_follow_minutes, 0, L.followMinutesMax)) return 'A follow time is at most one year.';
  if (rules.following.min_follow_minutes > 0 && rules.following.mode !== 'followers') return 'A minimum follow time needs "Followers only".';
  const prior = rules.prior_winners;
  if (prior.period === 'rolling' && !isInt(prior.days, 1, L.rollingDaysMax)) return `Count back 1 to ${L.rollingDaysMax} days for past winners.`;
  if (prior.period === 'range') {
    if (!prior.start || !prior.end || !ISO_DATE.test(prior.start) || !ISO_DATE.test(prior.end)) return 'Choose a start and an end date for past winners.';
    if (prior.start > prior.end) return 'The start date for past winners must not be after the end date.';
    if (prior.start < '2000-01-01' || prior.end > '2100-12-31') return 'Past-winner dates must lie between 2000 and 2100.';
    const span = (Date.parse(`${prior.end}T00:00:00Z`) - Date.parse(`${prior.start}T00:00:00Z`)) / 86_400_000;
    if (span > L.rangeDaysMax) return `A custom period can span at most ${L.rangeDaysMax} days.`;
  }
  if (prior.period !== 'off' && prior.statuses.length === 0) return 'Choose at least one kind of win that counts.';
  if (!isInt(rules.min_account_age_days, 0, L.accountAgeDaysMax)) return `Account age is at most ${L.accountAgeDaysMax} days.`;
  const p = rules.participation;
  if (!isInt(p.min_watch_minutes, 0, L.watchMinutesMax)) return 'The watch time minimum is too large.';
  if (!isInt(p.min_messages, 0, L.messagesMax)) return 'The chat message minimum is too large.';
  if (!isInt(p.min_points, 0, L.pointsMax)) return 'The points minimum is too large.';
  if (rules.named_exclusions.length > L.namedExclusionsMax) return `Exclude at most ${L.namedExclusionsMax} accounts by name.`;
  return null;
};

/** Saved rule sets: at most 10, each with a one-line name (unique, case-insensitive) and valid rules. */
export const presetsProblem = (presets: EligibilityPreset[]): string | null => {
  if (presets.length > RULE_LIMITS.presetsMax) return `Save at most ${RULE_LIMITS.presetsMax} rule sets.`;
  const seen = new Set<string>();
  for (const preset of presets) {
    const name = oneLine(preset.name);
    if (!name) return 'Every saved rule set needs a name.';
    if (name.length > RULE_LIMITS.presetNameMax) return `A rule set name is at most ${RULE_LIMITS.presetNameMax} characters.`;
    if (seen.has(name.toLocaleLowerCase())) return `Two saved rule sets are named "${name}".`;
    seen.add(name.toLocaleLowerCase());
    const problem = rulesProblem(preset.rules);
    if (problem) return `${name}: ${problem}`;
  }
  return null;
};

const listWords = (items: string[]): string => {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
};

const capitalize = (text: string): string => (text ? text[0].toUpperCase() + text.slice(1) : text);
const plural = (count: number, word: string): string => `${count.toLocaleString('en-US')} ${word}${count === 1 ? '' : 's'}`;

const formatDay = (iso: string): string => {
  const at = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(at.getTime()) ? iso : at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

/** Follow time in words: whole days when it is a whole number of days, else hours or minutes. */
export const describeFollowTime = (minutes: number): string => {
  if (minutes % 1440 === 0) return plural(minutes / 1440, 'day');
  if (minutes % 60 === 0) return plural(minutes / 60, 'hour');
  return plural(minutes, 'minute');
};

const PRIOR_TEXT: Record<Exclude<PriorPeriod, 'off' | 'range' | 'rolling'>, string> = {
  today: 'today', week: 'this week (weeks start on Monday)', month: 'this month', year: 'this year', ever: 'at any time',
};

/**
 * The rules in plain language, one sentence per rule that is switched on. `timezone` (the channel's)
 * is named when a calendar period depends on it. Never says more than the rules do.
 */
export const describeRules = (
  input: EligibilityRules,
  options: { levelName?: (value: number) => string; timezone?: string | null; currency?: string } = {},
): string[] => {
  const rules = normalizeRules(input);
  const levelName = options.levelName ?? ((value: number) => `level ${value}`);
  const out: string[] = [];
  const { roles } = rules;
  if (roles.only.length) out.push(`Only ${listWords(roles.only.map((name) => ROLE_NOUN[name]))} can enter.`);
  const excludedRoles = (['moderators', 'vips', 'regulars'] as RoleName[]).filter((name) => roles[name] === 'exclude');
  if (excludedRoles.length) out.push(`${capitalize(listWords(excludedRoles.map((name) => ROLE_NOUN[name])))} cannot enter.`);
  if (rules.min_level > 0) out.push(`Chat level ${levelName(rules.min_level)} or higher.`);
  if (rules.subscription === 'subscribers') out.push('Subscribers only.');
  if (rules.subscription === 'non_subscribers') out.push('Only viewers who are not subscribed.');
  if (rules.following.mode === 'followers') {
    out.push(rules.following.min_follow_minutes > 0
      ? `Followers who have followed for at least ${describeFollowTime(rules.following.min_follow_minutes)}.`
      : 'Followers only.');
  }
  if (rules.following.mode === 'non_followers') out.push('Only viewers who do not follow the channel.');
  const prior = rules.prior_winners;
  if (prior.period !== 'off') {
    const when = prior.period === 'rolling'
      ? `in the last ${plural(prior.days, 'day')}`
      : prior.period === 'range'
        ? `between ${formatDay(prior.start ?? '')} and ${formatDay(prior.end ?? '')}`
        : PRIOR_TEXT[prior.period];
    out.push(`Nobody who won a giveaway in this channel ${when}.`);
    const counted = COUNTED_STATUSES.filter((status) => prior.statuses.includes(status));
    const isDefault = counted.length === DEFAULT_COUNTED.length && DEFAULT_COUNTED.every((status) => counted.includes(status));
    out.push(isDefault
      ? 'A win counts once drawn, claimed or still waiting to claim; prizes nobody claimed do not count.'
      : `Counted as a win: ${listWords(counted.map((status) => COUNTED_LABEL[status].toLowerCase()))}.`);
    if (['today', 'week', 'month', 'year', 'range'].includes(prior.period) && options.timezone) {
      out.push(`Days follow the channel time zone (${options.timezone}).`);
    }
  }
  if (rules.min_account_age_days > 0) out.push(`Twitch account at least ${plural(rules.min_account_age_days, 'day')} old.`);
  const p = rules.participation;
  const needs: string[] = [];
  if (p.min_watch_minutes > 0) needs.push(`${describeFollowTime(p.min_watch_minutes)} watched`);
  if (p.min_messages > 0) needs.push(plural(p.min_messages, 'chat message'));
  if (p.min_points > 0) needs.push(`${p.min_points.toLocaleString('en-US')} ${options.currency ?? 'points'}`);
  if (needs.length) out.push(`At least ${listWords(needs)} in this channel.`);
  const names = rules.named_exclusions.map((item) => item.login);
  if (names.length) {
    const shown = names.slice(0, 3);
    out.push(`Excluded by name: ${shown.join(', ')}${names.length > shown.length ? ` and ${names.length - shown.length} more` : ''}.`);
  }
  if (out.length === 0) out.push('Everyone in chat can enter.');
  out.push(roles.broadcaster === 'allow' ? 'You (the broadcaster) can enter too.' : 'You (the broadcaster) cannot enter.');
  return out;
};

// ── Eligibility verdicts (GET /giveaways/:id/eligibility) ─────────────────────

export type VerdictStatus = 'eligible' | 'excluded' | 'unknown';

export interface EligibilityItem {
  user_id: string;
  login: string;
  display_name: string;
  tickets: number;
  entered: boolean;
  status: VerdictStatus;
  reason: string | null;
  rule: string | null;
  fact: string | null;
  fix: string | null;
  checked_at: string | null;
}

export interface EligibilityCounts {
  total: number;
  eligible: number;
  excluded: number;
  unknown: number;
  excluded_by_reason: Record<string, number>;
  unknown_by_reason: Record<string, number>;
}

export interface EligibilityCheck { fact: string; rule: string | null; available: boolean; reason: string | null; fix: string | null }

export interface EligibilityResponse {
  success: true;
  live: boolean;
  status: GiveawayStatus;
  entry_mode: EntryMode;
  timezone: string | null;
  counts: EligibilityCounts | null;
  total: number;
  items: EligibilityItem[];
  checks: EligibilityCheck[];
  evaluated_at?: string | null;
  audit_truncated?: boolean;
}

export const EXCLUSION_TEXT: Record<string, string> = {
  named_exclusion: 'Excluded by name',
  role_broadcaster: 'The broadcaster cannot enter',
  role_moderator: 'Moderators cannot enter',
  role_vip: 'VIPs cannot enter',
  role_regular: 'Regulars cannot enter',
  prior_winner: 'Already won in the past-winners period',
  not_subscriber: 'Not subscribed',
  subscriber: 'Subscribed (this giveaway is for non-subscribers)',
  not_following: 'Not following',
  follow_too_recent: 'Has not followed long enough',
  follower: 'Follows the channel (this giveaway is for non-followers)',
  account_unavailable: 'Twitch account not found (suspended or deleted)',
  account_too_new: 'Twitch account too new',
  low_watch_time: 'Not enough watch time',
  few_messages: 'Not enough chat messages',
  few_points: 'Not enough points',
  not_in_roles: 'Does not have one of the required roles',
  level_too_low: 'Chat level too low',
};

export const UNKNOWN_TEXT: Record<string, string> = {
  missing_grant: 'Cannot be checked: Acosmibot needs to be reconnected',
  twitch_error: 'Cannot be checked right now: Twitch did not answer',
  timeout: 'Cannot be checked right now: Twitch did not answer in time',
  not_seen: 'VIP status is unknown until they send a chat message',
  storage_error: 'Cannot be checked right now: the database did not answer',
  not_checked: 'Checked again when you draw',
};

export const VERDICT_LABEL: Record<VerdictStatus, string> = { eligible: 'Eligible', excluded: 'Excluded', unknown: 'Unknown' };

export const verdictTone = (status: VerdictStatus): 'active' | 'neutral' | 'warning' | 'error' =>
  status === 'eligible' ? 'active' : status === 'unknown' ? 'warning' : 'neutral';

/** Why an entrant has this status, in one phrase. */
export const explainVerdict = (item: Pick<EligibilityItem, 'status' | 'reason'>): string => {
  if (item.status === 'eligible') return 'Meets every rule';
  const table = item.status === 'excluded' ? EXCLUSION_TEXT : UNKNOWN_TEXT;
  return (item.reason && table[item.reason]) || (item.status === 'excluded' ? 'Excluded by a rule' : 'Not known yet');
};

/** Excluded counts by reason, largest first, as `Not subscribed: 3`. */
export const describeExclusions = (counts: EligibilityCounts | null | undefined): string[] =>
  Object.entries(counts?.excluded_by_reason ?? {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([reason, count]) => `${EXCLUSION_TEXT[reason] ?? 'Excluded by a rule'}: ${count.toLocaleString('en-US')}`);

/**
 * What stops a draw from being sure: required checks Acosmibot cannot make, and entrants whose
 * status is unknown for a reason other than "checked again when you draw". One line per fix.
 */
export const blockingFixes = (response: Pick<EligibilityResponse, 'checks' | 'counts'> | null | undefined): string[] => {
  const fixes = new Set<string>();
  for (const check of response?.checks ?? []) if (!check.available && check.fix) fixes.add(check.fix);
  const unknown = response?.counts?.unknown_by_reason ?? {};
  if ((unknown.missing_grant ?? 0) > 0 && fixes.size === 0) fixes.add('Reconnect Acosmibot so it can check these rules.');
  if ((unknown.not_seen ?? 0) > 0) fixes.add('VIP status shows only on chat messages: entrants who have not chatted since the giveaway opened are checked when they chat.');
  return [...fixes];
};

/** A fresh idempotency key for one draw or reroll click (a retried request reuses it). */
export const newRequestId = (): string => {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return `dash-${random}`.slice(0, 64);
};

export interface Giveaway {
  id: number;
  broadcaster_id: string;
  title: string;
  status: GiveawayStatus;
  entry_mode: EntryMode;
  keyword: string | null;
  ticket_cost: number | null;
  max_tickets: number;
  subscriber_luck: number;
  /** Older keys plus the version 2 rules (the API merges both). */
  eligibility_json: GiveawayEligibility;
  /** Version 2 rules (absent from older API responses: then read `eligibility_json`). */
  eligibility?: EligibilityRules | null;
  /** Frozen when the giveaway opened. */
  rules_snapshot?: { opened_by_user_id: string | null; opened_at: string | null; timezone: string | null; rules_version: number; freshness_s: number; history_scope: string } | null;
  eligibility_audit?: { evaluated_at: string | null; counts: EligibilityCounts | null; draws: number } | null;
  winner_count: number;
  claim_seconds: number;
  active_window_minutes: number;
  auto_close_at: string | null;
  entry_count: number;
  created_by_user_id: string | null;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface GiveawayEntry {
  giveaway_id: number;
  user_id: string;
  login: string;
  display_name: string;
  tickets: number;
  weight: number;
  is_subscriber: boolean;
  created_at: string | null;
}

export interface GiveawayWinner {
  id: number;
  giveaway_id: number;
  user_id: string;
  login: string;
  display_name: string;
  draw_number: number;
  status: WinnerStatus;
  total_weight: number;
  entry_count: number;
  drawn_at: string | null;
  claim_deadline: string | null;
  claimed_at: string | null;
}

export interface GiveawayListResponse { success: true; items: Giveaway[]; next_before_id: number | null }
export interface EntriesResponse { success: true; items: GiveawayEntry[]; total: number; live: boolean }
export interface WinnersResponse { success: true; items: GiveawayWinner[] }

export type GiveawayAction = 'open' | 'close' | 'draw' | 'reroll' | 'cancel' | 'reset';

/** Form state: strings and numbers as typed. `auto_close_at` is a `datetime-local` value. */
export interface GiveawayDraft {
  title: string;
  entry_mode: EntryMode;
  keyword: string;
  ticket_cost: number;
  max_tickets: number;
  subscriber_luck: number;
  rules: EligibilityRules;
  winner_count: number;
  claim_seconds: number;
  active_window_minutes: number;
  auto_close_at: string;
}

export interface GiveawayInput {
  title: string;
  entry_mode: EntryMode;
  keyword: string | null;
  ticket_cost: number | null;
  max_tickets: number;
  subscriber_luck: number;
  eligibility: EligibilityRules;
  winner_count: number;
  claim_seconds: number;
  active_window_minutes: number;
  auto_close_at: string | null;
}

export const emptyGiveawayDraft = (
  defaults: { keyword?: string; claim_seconds?: number; rules?: EligibilityRules | null } = {},
): GiveawayDraft => ({
  title: '',
  entry_mode: 'keyword',
  keyword: defaults.keyword ?? '!enter',
  ticket_cost: 10,
  max_tickets: 10,
  subscriber_luck: 1,
  rules: normalizeRules(defaults.rules ?? defaultRules()),
  winner_count: 1,
  claim_seconds: defaults.claim_seconds ?? 60,
  active_window_minutes: 10,
  auto_close_at: '',
});

const pad = (value: number): string => String(value).padStart(2, '0');

/** ISO instant to the value of a `datetime-local` input in the viewer's time zone. */
export const isoToLocalInput = (iso: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** `datetime-local` value (local time zone) to an ISO instant; empty or invalid is `null`. */
export const localInputToIso = (value: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const draftFromGiveaway = (giveaway: Giveaway): GiveawayDraft => ({
  title: giveaway.title,
  entry_mode: giveaway.entry_mode,
  keyword: giveaway.keyword ?? '',
  ticket_cost: giveaway.ticket_cost ?? 10,
  max_tickets: giveaway.max_tickets,
  subscriber_luck: giveaway.subscriber_luck,
  rules: rulesOf(giveaway),
  winner_count: giveaway.winner_count,
  claim_seconds: giveaway.claim_seconds,
  active_window_minutes: giveaway.active_window_minutes,
  auto_close_at: isoToLocalInput(giveaway.auto_close_at),
});

export const giveawayInput = (draft: GiveawayDraft): GiveawayInput => ({
  title: oneLine(draft.title),
  entry_mode: draft.entry_mode,
  keyword: draft.entry_mode === 'keyword' ? (draft.keyword.trim() || null) : null,
  ticket_cost: draft.entry_mode === 'tickets' ? draft.ticket_cost : null,
  max_tickets: draft.entry_mode === 'tickets' ? draft.max_tickets : 1,
  subscriber_luck: draft.subscriber_luck,
  eligibility: normalizeRules(draft.rules),
  winner_count: draft.winner_count,
  claim_seconds: draft.claim_seconds,
  active_window_minutes: draft.active_window_minutes,
  auto_close_at: localInputToIso(draft.auto_close_at),
});

const inRange = (value: number, low: number, high: number): boolean => Number.isInteger(value) && value >= low && value <= high;

/** The first thing wrong with a giveaway form, or `null`. */
export const giveawayProblem = (draft: GiveawayDraft, now: number = Date.now()): string | null => {
  const L = GIVEAWAY_LIMITS;
  const title = oneLine(draft.title);
  if (!title) return 'Give the giveaway a title.';
  if (title.length > L.titleMax) return `The title can be at most ${L.titleMax} characters.`;
  if (draft.entry_mode === 'keyword') {
    const keyword = draft.keyword.trim();
    if (keyword && (/\s/.test(keyword) || keyword.length > L.keywordMax)) return `The keyword is one word of at most ${L.keywordMax} characters.`;
  }
  if (draft.entry_mode === 'tickets') {
    if (!inRange(draft.ticket_cost, 1, L.ticketCostMax)) return `A ticket costs 1 to ${L.ticketCostMax.toLocaleString('en-US')} points.`;
    if (!inRange(draft.max_tickets, 1, L.maxTicketsMax)) return `Viewers can hold 1 to ${L.maxTicketsMax} tickets.`;
  }
  if (!(draft.subscriber_luck >= L.luckMin && draft.subscriber_luck <= L.luckMax)) return `Subscriber luck is between ${L.luckMin} and ${L.luckMax}.`;
  if (!inRange(draft.winner_count, 1, L.winnerCountMax)) return `Draw 1 to ${L.winnerCountMax} winners.`;
  if (!inRange(draft.claim_seconds, 0, L.claimMax)) return `The claim time is 0 to ${L.claimMax} seconds.`;
  if (draft.entry_mode === 'active' && !inRange(draft.active_window_minutes, L.windowMin, L.windowMax)) {
    return `The active window is ${L.windowMin} to ${L.windowMax} minutes.`;
  }
  const rules = rulesProblem(draft.rules);
  if (rules) return rules;
  if (draft.auto_close_at) {
    const at = new Date(draft.auto_close_at).getTime();
    if (Number.isNaN(at)) return 'The automatic close time is not a valid date.';
    if (at <= now) return 'The automatic close time must be in the future.';
    if (at > now + L.autoCloseDaysMax * 86_400_000) return `The automatic close time must be within ${L.autoCloseDaysMax} days.`;
  }
  return null;
};

export const sameGiveawayDraft = (a: GiveawayDraft, b: GiveawayDraft): boolean =>
  (Object.keys(a) as Array<keyof GiveawayDraft>).every((key) => (key === 'rules' ? sameRules(a.rules, b.rules) : a[key] === b[key]));

export const STATUS_LABEL: Record<GiveawayStatus, string> = {
  draft: 'Draft', open: 'Open', closed: 'Closed', drawn: 'Drawn', cancelled: 'Cancelled',
};

export const statusTone = (status: GiveawayStatus): 'active' | 'neutral' | 'warning' | 'error' =>
  status === 'open' ? 'active' : status === 'closed' ? 'warning' : 'neutral';

/** A giveaway still running: open, closed, or drawn with a winner who has not claimed yet. */
export const isRunning = (giveaway: Giveaway, winners: GiveawayWinner[] = []): boolean =>
  giveaway.status === 'open' || giveaway.status === 'closed'
  || (giveaway.status === 'drawn' && winners.some((winner) => winner.status === 'pending'));

/** The actions the dashboard offers for a status (the bot re-checks every one). */
export const availableActions = (status: GiveawayStatus): GiveawayAction[] => {
  switch (status) {
    case 'draft': return ['open'];
    case 'open': return ['close', 'draw', 'reset', 'cancel'];
    case 'closed': return ['draw', 'reset', 'cancel'];
    case 'drawn': return ['reroll'];
    default: return [];
  }
};

export const ACTION_LABEL: Record<GiveawayAction, string> = {
  open: 'Open entries', close: 'Close entries', draw: 'Draw winner', reroll: 'Reroll', cancel: 'Cancel giveaway',
  reset: 'Back to draft',
};

export const canDelete = (status: GiveawayStatus): boolean => status === 'draft' || status === 'cancelled' || status === 'drawn';
export const canEdit = (status: GiveawayStatus): boolean => status === 'draft' || status === 'open';

/** How viewers enter, in one phrase. */
export const describeEntry = (giveaway: Pick<Giveaway, 'entry_mode' | 'keyword' | 'ticket_cost' | 'max_tickets'>): string => {
  if (giveaway.entry_mode === 'keyword') return giveaway.keyword ? `Type ${giveaway.keyword}` : 'Type the default keyword';
  if (giveaway.entry_mode === 'tickets') {
    return `${(giveaway.ticket_cost ?? 0).toLocaleString('en-US')} points per ticket, up to ${giveaway.max_tickets}`;
  }
  return 'Anyone active in chat';
};

/** Eligibility rules that are switched on, as short phrases. */
export const describeEligibility = (rules: GiveawayEligibility, levelName: (value: number) => string = (value) => `level ${value}`): string[] => {
  const out: string[] = [];
  if (rules.subscriber_only) out.push('Subscribers only');
  if (rules.min_level > 0) out.push(`${levelName(rules.min_level)} or higher`);
  if (rules.min_follow_minutes > 0) out.push(`Following for ${describeSpan(rules.min_follow_minutes * 60)}`);
  if (rules.min_account_age_days > 0) out.push(`Account at least ${rules.min_account_age_days} day${rules.min_account_age_days === 1 ? '' : 's'} old`);
  if (rules.exclude_winners_days > 0) out.push(`No wins in the last ${rules.exclude_winners_days} day${rules.exclude_winners_days === 1 ? '' : 's'}`);
  return out;
};

const describeSpan = (seconds: number): string => {
  const units: Array<[string, number]> = [['year', 31_536_000], ['month', 2_592_000], ['week', 604_800], ['day', 86_400], ['hour', 3600], ['minute', 60]];
  for (const [name, size] of units) {
    if (seconds >= size) {
      const count = Math.floor(seconds / size);
      return `${count} ${name}${count === 1 ? '' : 's'}`;
    }
  }
  return `${seconds} seconds`;
};

/** Whole seconds left until `deadline` (never negative); `null` when there is none. */
export const secondsLeft = (deadline: string | null, now: number = Date.now()): number | null => {
  if (!deadline) return null;
  const at = new Date(deadline).getTime();
  return Number.isNaN(at) ? null : Math.max(0, Math.ceil((at - now) / 1000));
};

export const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${pad(seconds % 60)}`;

export const WINNER_LABEL: Record<WinnerStatus, string> = {
  pending: 'Waiting to claim', claimed: 'Claimed', expired: 'Did not claim', rerolled: 'Rerolled',
};

/** Share of the pool this winner had when drawn, e.g. `4 of 120` weight over entries. */
export const describeDrawOdds = (winner: Pick<GiveawayWinner, 'total_weight' | 'entry_count'>): string =>
  `Drawn from ${winner.entry_count.toLocaleString('en-US')} ${winner.entry_count === 1 ? 'entry' : 'entries'} (weight ${winner.total_weight.toLocaleString('en-US')})`;

export interface GiveawaySettings {
  enabled: boolean;
  default_keyword: string;
  default_claim_seconds: number;
  auto_reroll: boolean;
  open_template: string;
  close_template: string;
  winner_template: string;
  claimed_template: string;
  expired_template: string;
  default_eligibility: EligibilityRules;
  eligibility_presets: EligibilityPreset[];
}

// ── Polls and predictions ─────────────────────────────────────────────────

export const POLL_LIMITS = {
  pollTitleMax: 60, pollChoicesMin: 2, pollChoicesMax: 5, choiceMax: 25, pollDurationMin: 15, pollDurationMax: 1800,
  predictionTitleMax: 45, outcomesMin: 2, outcomesMax: 10, windowMin: 1, windowMax: 1800,
} as const;

export interface PollChoice { id: string; title: string; votes: number; channel_points_votes?: number }
export interface Poll {
  id: string;
  title: string;
  status: 'ACTIVE' | 'COMPLETED' | 'TERMINATED' | 'ARCHIVED' | 'MODERATED' | 'INVALID' | string;
  choices: PollChoice[];
  duration: number;
  started_at: string | null;
  ended_at: string | null;
}

export interface PredictionOutcome { id: string; title: string; users: number; channel_points: number; color?: string | null }
export interface Prediction {
  id: string;
  title: string;
  status: 'ACTIVE' | 'LOCKED' | 'RESOLVED' | 'CANCELED' | string;
  winning_outcome_id: string | null;
  outcomes: PredictionOutcome[];
  prediction_window: number;
  created_at: string | null;
  locked_at: string | null;
  ended_at: string | null;
}

/** Feed events (§9.4). */
export interface PollUpdate {
  id: string; phase: string; title: string; status: string;
  choices: Array<{ id: string; title: string; votes: number }>; ends_at: string | null;
}
export interface PredictionUpdate {
  id: string; phase: string; title: string; status: string;
  outcomes: Array<{ id: string; title: string; users: number; channel_points: number }>;
  locks_at: string | null; winning_outcome_id: string | null;
}

export interface PollDraft { title: string; choices: string[]; duration_s: number }
export interface PredictionDraft { title: string; outcomes: string[]; window_s: number }

export const EMPTY_POLL_DRAFT = (duration_s = 120): PollDraft => ({ title: '', choices: ['', ''], duration_s });
export const EMPTY_PREDICTION_DRAFT = (window_s = 120): PredictionDraft => ({ title: '', outcomes: ['', ''], window_s });

const listProblem = (items: string[], noun: string, min: number, max: number, itemMax: number): string | null => {
  const cleaned = items.map(oneLine).filter(Boolean);
  if (cleaned.length < min) return `Add at least ${min} ${noun}s.`;
  if (cleaned.length > max) return `Use at most ${max} ${noun}s.`;
  if (cleaned.some((item) => item.length > itemMax)) return `Each ${noun} can be at most ${itemMax} characters.`;
  if (new Set(cleaned.map((item) => item.toLocaleLowerCase())).size !== cleaned.length) return `Each ${noun} must be different.`;
  return null;
};

export const pollProblem = (draft: PollDraft): string | null => {
  const L = POLL_LIMITS;
  const title = oneLine(draft.title);
  if (!title) return 'Ask a question.';
  if (title.length > L.pollTitleMax) return `The question can be at most ${L.pollTitleMax} characters.`;
  const list = listProblem(draft.choices, 'choice', L.pollChoicesMin, L.pollChoicesMax, L.choiceMax);
  if (list) return list;
  if (!inRange(draft.duration_s, L.pollDurationMin, L.pollDurationMax)) return `A poll runs ${L.pollDurationMin} to ${L.pollDurationMax} seconds.`;
  return null;
};

export const pollInput = (draft: PollDraft) => ({
  title: oneLine(draft.title),
  choices: draft.choices.map(oneLine).filter(Boolean),
  duration_s: draft.duration_s,
});

export const predictionProblem = (draft: PredictionDraft): string | null => {
  const L = POLL_LIMITS;
  const title = oneLine(draft.title);
  if (!title) return 'Ask a question.';
  if (title.length > L.predictionTitleMax) return `The question can be at most ${L.predictionTitleMax} characters.`;
  const list = listProblem(draft.outcomes, 'outcome', L.outcomesMin, L.outcomesMax, L.choiceMax);
  if (list) return list;
  if (!inRange(draft.window_s, L.windowMin, L.windowMax)) return `Viewers can predict for ${L.windowMin} to ${L.windowMax} seconds.`;
  return null;
};

export const predictionInput = (draft: PredictionDraft) => ({
  title: oneLine(draft.title),
  outcomes: draft.outcomes.map(oneLine).filter(Boolean),
  window_s: draft.window_s,
});

export const isPollRunning = (poll: Pick<Poll, 'status'> | undefined | null): boolean => poll?.status === 'ACTIVE';
export const isPredictionRunning = (prediction: Pick<Prediction, 'status'> | undefined | null): boolean =>
  prediction?.status === 'ACTIVE' || prediction?.status === 'LOCKED';

/** Whole-number share of `part` in `total` (0 when nothing was cast). */
export const share = (part: number, total: number): number => (total > 0 ? Math.round((part / total) * 100) : 0);

export const totalVotes = (choices: Array<{ votes: number }>): number => choices.reduce((sum, choice) => sum + Math.max(choice.votes, 0), 0);

export const pollLeaders = (choices: PollChoice[]): PollChoice[] => {
  const top = Math.max(0, ...choices.map((choice) => choice.votes));
  return top > 0 ? choices.filter((choice) => choice.votes === top) : [];
};

export const POLL_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Running', COMPLETED: 'Finished', TERMINATED: 'Ended early', ARCHIVED: 'Archived', MODERATED: 'Removed', INVALID: 'Invalid',
};
export const PREDICTION_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Taking predictions', LOCKED: 'Locked', RESOLVED: 'Resolved', CANCELED: 'Cancelled',
};

/** Put a `poll.update` event into a list of polls: replace the same id, else add it first. */
export const mergePollUpdate = (items: Poll[], update: PollUpdate): Poll[] => {
  const existing = items.find((poll) => poll.id === update.id);
  const merged: Poll = {
    duration: 0, started_at: null, ended_at: null, ...existing,
    id: update.id, title: update.title, status: update.status,
    choices: update.choices.map((choice) => ({ id: choice.id, title: choice.title, votes: choice.votes })),
  };
  return existing ? items.map((poll) => (poll.id === update.id ? merged : poll)) : [merged, ...items];
};

export const mergePredictionUpdate = (items: Prediction[], update: PredictionUpdate): Prediction[] => {
  const existing = items.find((prediction) => prediction.id === update.id);
  const merged: Prediction = {
    prediction_window: 0, created_at: null, locked_at: null, ended_at: null, ...existing,
    id: update.id, title: update.title, status: update.status, winning_outcome_id: update.winning_outcome_id,
    outcomes: update.outcomes.map((outcome) => ({ ...outcome })),
  };
  return existing ? items.map((prediction) => (prediction.id === update.id ? merged : prediction)) : [merged, ...items];
};

export interface PollsSettings {
  enabled: boolean;
  default_duration_s: number;
  default_prediction_window_s: number;
  announce_results: boolean;
}

// ── Viewer queue ──────────────────────────────────────────────────────────

export const QUEUE_LIMITS = { sizeMax: 500, costMax: 1_000_000, pickMax: 10 } as const;

export interface QueueEntry {
  id: number;
  broadcaster_id: string;
  user_id: string;
  login: string;
  display_name: string;
  note: string | null;
  status: 'waiting' | 'picked' | 'removed' | 'left';
  position: number;
  created_at: string | null;
  picked_at: string | null;
}

export interface QueueResponse { success: true; open: boolean; enabled: boolean; items: QueueEntry[] }
export interface PublicQueueItem { position: number; display_name: string; note: string | null }
export interface PublicQueueResponse { success: true; open: boolean; items: PublicQueueItem[] }

export interface ViewerQueueSettings {
  enabled: boolean;
  is_open: boolean;
  max_size: number;
  cost: number;
  allow_notes: boolean;
  pick_template: string;
  public_page: boolean;
}

export type QueueActionBody =
  | { action: 'pick_next'; count: number }
  | { action: 'pick'; entry_id: number }
  | { action: 'open' }
  | { action: 'close' };

export const clampPickCount = (value: number): number =>
  Number.isFinite(value) ? Math.max(1, Math.min(QUEUE_LIMITS.pickMax, Math.trunc(value))) : 1;

export const queueSettingsProblem = (settings: Pick<ViewerQueueSettings, 'max_size' | 'cost'>): string | null => {
  if (!inRange(settings.max_size, 1, QUEUE_LIMITS.sizeMax)) return `The queue holds 1 to ${QUEUE_LIMITS.sizeMax} viewers.`;
  if (!inRange(settings.cost, 0, QUEUE_LIMITS.costMax)) return `Joining costs 0 to ${QUEUE_LIMITS.costMax.toLocaleString('en-US')} points.`;
  return null;
};
