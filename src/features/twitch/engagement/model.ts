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

export interface GiveawayEligibility {
  min_level: number;
  subscriber_only: boolean;
  min_follow_minutes: number;
  min_account_age_days: number;
  exclude_winners_days: number;
}

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
  eligibility_json: GiveawayEligibility;
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

export type GiveawayAction = 'open' | 'close' | 'draw' | 'reroll' | 'cancel';

/** Form state: strings and numbers as typed. `auto_close_at` is a `datetime-local` value. */
export interface GiveawayDraft {
  title: string;
  entry_mode: EntryMode;
  keyword: string;
  ticket_cost: number;
  max_tickets: number;
  subscriber_luck: number;
  min_level: number;
  subscriber_only: boolean;
  min_follow_minutes: number;
  min_account_age_days: number;
  exclude_winners_days: number;
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
  eligibility: GiveawayEligibility;
  winner_count: number;
  claim_seconds: number;
  active_window_minutes: number;
  auto_close_at: string | null;
}

export const emptyGiveawayDraft = (defaults: { keyword?: string; claim_seconds?: number } = {}): GiveawayDraft => ({
  title: '',
  entry_mode: 'keyword',
  keyword: defaults.keyword ?? '!enter',
  ticket_cost: 10,
  max_tickets: 10,
  subscriber_luck: 1,
  min_level: 0,
  subscriber_only: false,
  min_follow_minutes: 0,
  min_account_age_days: 0,
  exclude_winners_days: 0,
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
  min_level: giveaway.eligibility_json.min_level,
  subscriber_only: giveaway.eligibility_json.subscriber_only,
  min_follow_minutes: giveaway.eligibility_json.min_follow_minutes,
  min_account_age_days: giveaway.eligibility_json.min_account_age_days,
  exclude_winners_days: giveaway.eligibility_json.exclude_winners_days,
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
  eligibility: {
    min_level: draft.min_level,
    subscriber_only: draft.subscriber_only,
    min_follow_minutes: draft.min_follow_minutes,
    min_account_age_days: draft.min_account_age_days,
    exclude_winners_days: draft.exclude_winners_days,
  },
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
  if (!inRange(draft.min_follow_minutes, 0, L.followMinutesMax)) return `Follow time is at most ${L.followMinutesMax.toLocaleString('en-US')} minutes.`;
  if (!inRange(draft.min_account_age_days, 0, L.accountAgeDaysMax)) return `Account age is at most ${L.accountAgeDaysMax} days.`;
  if (!inRange(draft.exclude_winners_days, 0, L.excludeWinnersDaysMax)) return `Excluding past winners reaches back at most ${L.excludeWinnersDaysMax} days.`;
  if (draft.auto_close_at) {
    const at = new Date(draft.auto_close_at).getTime();
    if (Number.isNaN(at)) return 'The automatic close time is not a valid date.';
    if (at <= now) return 'The automatic close time must be in the future.';
    if (at > now + L.autoCloseDaysMax * 86_400_000) return `The automatic close time must be within ${L.autoCloseDaysMax} days.`;
  }
  return null;
};

export const sameGiveawayDraft = (a: GiveawayDraft, b: GiveawayDraft): boolean =>
  (Object.keys(a) as Array<keyof GiveawayDraft>).every((key) => a[key] === b[key]);

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
    case 'open': return ['close', 'draw', 'cancel'];
    case 'closed': return ['draw', 'cancel'];
    case 'drawn': return ['reroll'];
    default: return [];
  }
};

export const ACTION_LABEL: Record<GiveawayAction, string> = {
  open: 'Open entries', close: 'Close entries', draw: 'Draw winner', reroll: 'Reroll', cancel: 'Cancel giveaway',
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
