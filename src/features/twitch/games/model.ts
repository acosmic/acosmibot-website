/**
 * Pure model of the Games page (§11.4, §12.5): types of the settings section, the
 * trivia bank and the rounds, draft validation and the parameters of the live
 * actions. No React here, so Node tests can import it.
 */

// ── limits (mirror the API and the settings model) ───────────────────────
export const GAME_LIMITS = {
  questionMax: 300,
  answerMax: 60,
  answersMax: 10,
  categoryMax: 40,
  importMax: 500,
  contestTitleMax: 100,
  contestOptionMax: 40,
  contestOptionsMax: 10,
  eightballAnswerMax: 100,
  eightballAnswersMax: 50,
  emotesMax: 50,
  emoteMax: 25,
  raffleSecondsMin: 10,
  raffleSecondsMax: 600,
  raffleWinnersMax: 100,
  bingoRewardMax: 1_000_000,
} as const;

// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g;

/** One line without control or bidi characters (the API does the same). */
export const oneLine = (value: string): string => value.replace(CONTROL_RE, ' ').split(/\s+/).filter(Boolean).join(' ');

// ── settings ─────────────────────────────────────────────────────────────
export interface GameCommon { enabled: boolean; min_bet: number; max_bet: number; allow_all_in: boolean }
export interface GambleSettings extends GameCommon { win_chance_percent: number }
export interface SlotsSettings extends GameCommon { symbols: Record<string, string> }
export interface DuelSettings extends GameCommon { accept_seconds: number; fee_percent: number }
export interface HeistSettings extends GameCommon { lobby_seconds: number; min_players: number; cooldown_s: number }
export interface RaffleSettings {
  enabled: boolean; default_amount: number; max_amount: number; default_duration_s: number; max_winners: number;
  subscriber_luck: number;
}
export interface EightballSettings { enabled: boolean; answers: string[] }
export interface TriviaSettings { enabled: boolean; reward: number; answer_seconds: number; auto_interval_minutes: number; fuzzy: boolean }
export interface BingoSettings {
  enabled: boolean; reward: number; duration_s: number; emotes: string[]; use_channel_emotes: boolean; hint_interval_s: number;
}
export interface ContestSettings { enabled: boolean; min_bet: number; max_bet: number; max_options: number }

export interface GamesSettings {
  gamble: GambleSettings;
  roulette: GameCommon;
  slots: SlotsSettings;
  duel: DuelSettings;
  heist: HeistSettings;
  raffle: RaffleSettings;
  eightball: EightballSettings;
  trivia: TriviaSettings;
  bingo: BingoSettings;
  contests: ContestSettings;
}

export const SLOT_SYMBOLS = ['cherry', 'lemon', 'orange', 'grape', 'bell', 'diamond', 'seven'] as const;

export const EMOTE_RE = /^\S{1,25}$/;

/** One value per non-empty line, trimmed. */
export const linesOf = (text: string): string[] => text.split('\n').map((line) => line.trim()).filter(Boolean);

export const listText = (items: readonly string[]): string => items.join('\n');

/** Why the settings cannot be saved yet, or null. The API validates the same rules. */
export function settingsProblem(s: GamesSettings): string | null {
  const bets: Array<[string, { min_bet: number; max_bet: number }]> = [
    ['Gamble', s.gamble], ['Roulette', s.roulette], ['Slots', s.slots], ['Duel', s.duel], ['Heist', s.heist],
    ['Contests', s.contests],
  ];
  for (const [label, game] of bets) {
    if (game.min_bet > game.max_bet) return `${label}: the smallest bet cannot be larger than the largest bet.`;
  }
  if (s.raffle.default_amount > s.raffle.max_amount) return 'Raffle: the default prize cannot be larger than the maximum prize.';
  if (s.eightball.answers.length < 1) return '8-ball needs at least one answer.';
  if (s.eightball.answers.length > GAME_LIMITS.eightballAnswersMax) return `8-ball can have at most ${GAME_LIMITS.eightballAnswersMax} answers.`;
  if (s.eightball.answers.some((a) => a.length > GAME_LIMITS.eightballAnswerMax)) {
    return `Each 8-ball answer can have at most ${GAME_LIMITS.eightballAnswerMax} characters.`;
  }
  if (s.bingo.emotes.length > GAME_LIMITS.emotesMax) return `Bingo can have at most ${GAME_LIMITS.emotesMax} emotes.`;
  if (s.bingo.emotes.some((e) => !EMOTE_RE.test(e))) return `Each bingo emote is one word of up to ${GAME_LIMITS.emoteMax} characters.`;
  if (SLOT_SYMBOLS.some((name) => !(s.slots.symbols?.[name] ?? '').trim())) return 'Every slot symbol needs some text.';
  return null;
}

// ── trivia bank ──────────────────────────────────────────────────────────
export interface TriviaQuestion {
  id: number;
  question: string;
  answers_json: string[];
  category: string | null;
  enabled: boolean;
  times_asked: number;
  updated_at?: string | null;
}
export interface TriviaListResponse { success: true; items: TriviaQuestion[]; count: number; limit: number }
export interface QuestionInput { question: string; answers: string[]; category: string | null; enabled: boolean }
export interface QuestionDraft { question: string; answers: string; category: string; enabled: boolean }

export const EMPTY_QUESTION_DRAFT: QuestionDraft = { question: '', answers: '', category: '', enabled: true };

export const draftFromQuestion = (q: TriviaQuestion): QuestionDraft => ({
  question: q.question, answers: listText(q.answers_json), category: q.category ?? '', enabled: q.enabled,
});

export const sameQuestionDraft = (a: QuestionDraft, b: QuestionDraft): boolean =>
  a.question === b.question && a.answers === b.answers && a.category === b.category && a.enabled === b.enabled;

export function questionInputFromDraft(draft: QuestionDraft): QuestionInput {
  const answers: string[] = [];
  for (const line of linesOf(draft.answers)) {
    const answer = oneLine(line);
    if (answer && !answers.some((existing) => existing.toLowerCase() === answer.toLowerCase())) answers.push(answer);
  }
  return {
    question: oneLine(draft.question), answers, category: oneLine(draft.category) || null, enabled: draft.enabled,
  };
}

export function questionProblem(draft: QuestionDraft): string | null {
  const input = questionInputFromDraft(draft);
  if (!input.question) return 'Write the question.';
  if (input.question.length > GAME_LIMITS.questionMax) return `A question can have at most ${GAME_LIMITS.questionMax} characters.`;
  if (!input.answers.length) return 'Add at least one accepted answer, one per line.';
  if (input.answers.length > GAME_LIMITS.answersMax) return `A question can have at most ${GAME_LIMITS.answersMax} answers.`;
  if (input.answers.some((a) => a.length > GAME_LIMITS.answerMax)) return `Each answer can have at most ${GAME_LIMITS.answerMax} characters.`;
  if ((input.category ?? '').length > GAME_LIMITS.categoryMax) return `The category can have at most ${GAME_LIMITS.categoryMax} characters.`;
  return null;
}

export interface ImportParse { questions: unknown[]; problem: string | null }

/** A pasted JSON list (or `{"questions": [...]}`) of at most 500 questions. The API checks every row again. */
export function parseQuestionImport(text: string): ImportParse {
  const trimmed = text.trim();
  if (!trimmed) return { questions: [], problem: 'Paste a JSON list of questions first.' };
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return { questions: [], problem: 'That is not valid JSON.' };
  }
  const list = Array.isArray(data) ? data : (data as { questions?: unknown } | null)?.questions;
  if (!Array.isArray(list)) return { questions: [], problem: 'Expected a list like [{"question": "...", "answers": ["..."]}].' };
  if (!list.length) return { questions: [], problem: 'The list is empty.' };
  if (list.length > GAME_LIMITS.importMax) return { questions: [], problem: `Import at most ${GAME_LIMITS.importMax} questions at a time.` };
  return { questions: list, problem: null };
}

export const IMPORT_EXAMPLE = '[\n  { "question": "What is the capital of France?", "answers": ["Paris"], "category": "Geography" }\n]';

// ── rounds ───────────────────────────────────────────────────────────────
export type GameName = 'duel' | 'heist' | 'raffle' | 'contest' | 'trivia' | 'bingo';
export type RoundStatus = 'open' | 'locked' | 'resolved' | 'cancelled' | 'refunded';

export interface StakeSummary { stakes: number; total_amount: number; total_payout: number; held: number }
export interface GameRound {
  id: number;
  game: GameName;
  status: RoundStatus;
  title: string | null;
  options_json: Record<string, unknown> | null;
  result_json: Record<string, unknown> | null;
  closes_at: string | null;
  resolved_at: string | null;
  created_at: string | null;
  stakes: StakeSummary;
}
export interface RoundListResponse { success: true; items: GameRound[] }

export const GAME_LABELS: Record<GameName, string> = {
  duel: 'Duel', heist: 'Heist', raffle: 'Raffle', contest: 'Contest', trivia: 'Trivia', bingo: 'Bingo',
};
export const GAME_NAMES = Object.keys(GAME_LABELS) as GameName[];

export const STATUS_LABELS: Record<RoundStatus, string> = {
  open: 'Open', locked: 'Betting closed', resolved: 'Finished', cancelled: 'Cancelled', refunded: 'Refunded',
};

export const isActiveRound = (round: Pick<GameRound, 'status'>): boolean => round.status === 'open' || round.status === 'locked';

/** Option labels of a contest round (from `options_json.options`). */
export function contestOptions(round: Pick<GameRound, 'options_json'>): string[] {
  const options = (round.options_json as { options?: unknown } | null)?.options;
  return Array.isArray(options) ? options.filter((o): o is string => typeof o === 'string') : [];
}

export function roundTitle(round: GameRound): string {
  if (round.title) return round.title;
  const opts = round.options_json ?? {};
  if (round.game === 'raffle' && typeof opts.amount === 'number') return `Prize ${opts.amount.toLocaleString()}`;
  if (round.game === 'bingo') return 'Hidden emote';
  return GAME_LABELS[round.game];
}

export function describeStakes(round: GameRound, currency: string): string {
  const s = round.stakes;
  if (round.game === 'trivia' || round.game === 'bingo') return '—';
  if (!s.stakes) return 'No entries';
  const entries = `${s.stakes.toLocaleString()} ${s.stakes === 1 ? 'entry' : 'entries'}`;
  if (round.game === 'raffle') return entries;
  const word = round.status === 'resolved' ? `${s.total_payout.toLocaleString()} paid out` : `${s.total_amount.toLocaleString()} ${currency} staked`;
  return `${entries}, ${word}`;
}

// ── live actions ─────────────────────────────────────────────────────────
export type GameAction =
  | 'raffle_start' | 'trivia_start' | 'bingo_start' | 'contest_open' | 'contest_close' | 'contest_resolve'
  | 'contest_refund' | 'cancel_round';

export interface ActionRequest { action: GameAction; params: Record<string, unknown> }

const wholeNumber = (text: string): number | null => (/^\d{1,10}$/.test(text.trim()) ? Number(text.trim()) : null);

export interface RaffleDraft { amount: string; seconds: string; winners: string }
export function raffleRequest(draft: RaffleDraft, limits: { maxAmount: number; maxWinners: number }): ActionRequest | string {
  const params: Record<string, unknown> = {};
  for (const [key, text] of [['amount', draft.amount], ['seconds', draft.seconds], ['winners', draft.winners]] as const) {
    if (!text.trim()) continue;
    const value = wholeNumber(text);
    if (value === null) return 'Use whole numbers only.';
    params[key] = value;
  }
  const amount = params.amount as number | undefined;
  const seconds = params.seconds as number | undefined;
  const winners = params.winners as number | undefined;
  if (amount !== undefined && (amount < 1 || amount > limits.maxAmount)) return `The prize must be between 1 and ${limits.maxAmount.toLocaleString()}.`;
  if (seconds !== undefined && (seconds < GAME_LIMITS.raffleSecondsMin || seconds > GAME_LIMITS.raffleSecondsMax)) {
    return `A raffle runs ${GAME_LIMITS.raffleSecondsMin} to ${GAME_LIMITS.raffleSecondsMax} seconds.`;
  }
  if (winners !== undefined && (winners < 1 || winners > limits.maxWinners)) return `Choose 1 to ${limits.maxWinners} winners.`;
  return { action: 'raffle_start', params };
}

export function bingoRequest(reward: string): ActionRequest | string {
  if (!reward.trim()) return { action: 'bingo_start', params: {} };
  const value = wholeNumber(reward);
  if (value === null || value > GAME_LIMITS.bingoRewardMax) return `The reward must be a whole number up to ${GAME_LIMITS.bingoRewardMax.toLocaleString()}.`;
  return { action: 'bingo_start', params: { reward: value } };
}

export function triviaRequest(questionId: string): ActionRequest {
  const id = wholeNumber(questionId);
  return { action: 'trivia_start', params: id ? { question_id: id } : {} };
}

export interface ContestDraft { title: string; options: string[] }
export const EMPTY_CONTEST_DRAFT: ContestDraft = { title: '', options: ['', ''] };

export function contestRequest(draft: ContestDraft, maxOptions: number): ActionRequest | string {
  const title = oneLine(draft.title);
  const options = draft.options.map(oneLine).filter(Boolean);
  if (!title) return 'Give the contest a title.';
  if (title.length > GAME_LIMITS.contestTitleMax) return `The title can have at most ${GAME_LIMITS.contestTitleMax} characters.`;
  if (options.length < 2) return 'A contest needs at least two options.';
  if (options.length > Math.min(maxOptions, GAME_LIMITS.contestOptionsMax)) return `A contest can have at most ${Math.min(maxOptions, GAME_LIMITS.contestOptionsMax)} options.`;
  if (options.some((o) => o.length > GAME_LIMITS.contestOptionMax)) return `Each option can have at most ${GAME_LIMITS.contestOptionMax} characters.`;
  return { action: 'contest_open', params: { title, options } };
}

/** Plain-language reasons for the error codes the bot answers with. */
export const ACTION_FAILURES: Record<string, string> = {
  round_active: 'That game already has a round running. Finish or cancel it first.',
  game_disabled: 'That game is turned off in the settings.',
  loyalty_disabled: 'Loyalty points are turned off for this channel.',
  no_questions: 'There are no enabled trivia questions to ask.',
  no_emotes: 'There are no emotes to play with. Add some in the bingo settings.',
  invalid_state: 'That round is no longer in a state where this can be done.',
  not_found: 'That round is not running any more.',
  bot_offline: 'The bot is offline, so nothing was started.',
  redis_unavailable: 'The bot cannot be reached right now.',
};

export const describeActionFailure = (code: string | undefined, fallback: string): string =>
  (code && ACTION_FAILURES[code]) || fallback;

/** Short copy for the odds, straight from the rules the bot plays by. */
export const RULES = {
  gamble: 'Wins with the chance below and pays double the bet.',
  roulette: 'European wheel, 0 to 36. Red, black, odd or even pay double; green or a number pays 36 times the bet.',
  slots: 'Three reels. Three of a kind pays 10 to 200 times the bet; exactly two cherries pay double.',
  duel: 'The challenger and the target each stake the bet; the winner takes both minus the fee.',
  heist: 'Players join a lobby; each succeeds on their own. Bigger crews pay a little more.',
  raffle: 'Viewers join with !join for free; the winners get new points.',
  eightball: 'A random answer to any question.',
  trivia: 'The first correct answer wins the reward. Questions come from the bank on the next tab.',
  bingo: 'The first message with the hidden emote wins the reward.',
  contests: 'Viewers bet on an option and the winners share every stake.',
} as const;
