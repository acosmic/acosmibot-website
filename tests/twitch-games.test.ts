import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import {
  EMPTY_CONTEST_DRAFT,
  EMPTY_QUESTION_DRAFT,
  GAME_LIMITS,
  bingoRequest,
  contestOptions,
  contestRequest,
  describeActionFailure,
  describeStakes,
  draftFromQuestion,
  isActiveRound,
  linesOf,
  oneLine,
  parseQuestionImport,
  questionInputFromDraft,
  questionProblem,
  raffleRequest,
  roundTitle,
  settingsProblem,
  triviaRequest,
  type GameRound,
  type GamesSettings,
  type TriviaQuestion,
} from '../src/features/twitch/games/model.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const settings = (): GamesSettings => {
  const common = { enabled: true, min_bet: 10, max_bet: 10_000, allow_all_in: true };
  return {
    gamble: { ...common, win_chance_percent: 48 }, roulette: { ...common },
    slots: { ...common, symbols: { cherry: 'a', lemon: 'b', orange: 'c', grape: 'd', bell: 'e', diamond: 'f', seven: 'g' } },
    duel: { ...common, accept_seconds: 60, fee_percent: 0 },
    heist: { ...common, lobby_seconds: 120, min_players: 1, cooldown_s: 600 },
    raffle: { enabled: true, default_amount: 1000, max_amount: 100_000, default_duration_s: 60, max_winners: 10, subscriber_luck: 1 },
    eightball: { enabled: true, answers: ['Yes.'] },
    trivia: { enabled: false, reward: 100, answer_seconds: 30, auto_interval_minutes: 0, fuzzy: true },
    bingo: { enabled: false, reward: 500, duration_s: 300, emotes: [], use_channel_emotes: true, hint_interval_s: 60 },
    contests: { enabled: true, min_bet: 10, max_bet: 100_000, max_options: 10 },
  };
};

const round = (overrides: Partial<GameRound> = {}): GameRound => ({
  id: 1, game: 'heist', status: 'open', title: null, options_json: null, result_json: null, closes_at: null,
  resolved_at: null, created_at: null, stakes: { stakes: 0, total_amount: 0, total_payout: 0, held: 0 }, ...overrides,
});

// ── settings ─────────────────────────────────────────────────────────────
test('valid default settings have no problem', () => {
  assert.equal(settingsProblem(settings()), null);
});

test('a smallest bet above the largest bet is refused for every game', () => {
  for (const key of ['gamble', 'roulette', 'slots', 'duel', 'heist', 'contests'] as const) {
    const s = settings();
    s[key] = { ...s[key], min_bet: 500, max_bet: 100 } as never;
    assert.match(settingsProblem(s) ?? '', /smallest bet/i, key);
  }
});

test('raffle, 8-ball, bingo and slot rules', () => {
  let s = settings();
  s.raffle.default_amount = 200_000;
  assert.match(settingsProblem(s) ?? '', /default prize/i);
  s = settings();
  s.eightball.answers = [];
  assert.match(settingsProblem(s) ?? '', /at least one answer/i);
  s = settings();
  s.eightball.answers = ['x'.repeat(101)];
  assert.match(settingsProblem(s) ?? '', /100 characters/);
  s = settings();
  s.eightball.answers = Array.from({ length: 51 }, () => 'ok');
  assert.match(settingsProblem(s) ?? '', /at most 50/);
  s = settings();
  s.bingo.emotes = ['two words'];
  assert.match(settingsProblem(s) ?? '', /one word/);
  s = settings();
  s.slots.symbols.bell = '  ';
  assert.match(settingsProblem(s) ?? '', /symbol/);
});

test('linesOf trims and drops empty lines', () => {
  assert.deepEqual(linesOf(' a \n\n  b\n   \nc'), ['a', 'b', 'c']);
});

// ── trivia questions ─────────────────────────────────────────────────────
test('a question draft becomes a one-line input without duplicate answers', () => {
  const input = questionInputFromDraft({ question: '  Capital\n of   France? ‮', answers: 'Paris\nparis\n  City of Light \n', category: ' ', enabled: true });
  assert.deepEqual(input, { question: 'Capital of France?', answers: ['Paris', 'City of Light'], category: null, enabled: true });
});

test('question validation names the first problem', () => {
  assert.match(questionProblem(EMPTY_QUESTION_DRAFT) ?? '', /write the question/i);
  assert.match(questionProblem({ ...EMPTY_QUESTION_DRAFT, question: 'Q?' }) ?? '', /at least one accepted answer/i);
  assert.match(questionProblem({ ...EMPTY_QUESTION_DRAFT, question: 'q'.repeat(301), answers: 'a' }) ?? '', /300/);
  assert.match(questionProblem({ ...EMPTY_QUESTION_DRAFT, question: 'Q?', answers: 'a'.repeat(61) }) ?? '', /60/);
  assert.match(questionProblem({ ...EMPTY_QUESTION_DRAFT, question: 'Q?', answers: Array.from({ length: 11 }, (_, i) => `a${i}`).join('\n') }) ?? '', /at most 10/);
  assert.match(questionProblem({ ...EMPTY_QUESTION_DRAFT, question: 'Q?', answers: 'a', category: 'c'.repeat(41) }) ?? '', /40/);
  assert.equal(questionProblem({ ...EMPTY_QUESTION_DRAFT, question: 'Q?', answers: 'a' }), null);
});

test('a stored question round-trips through its draft', () => {
  const q: TriviaQuestion = { id: 4, question: 'Q?', answers_json: ['a', 'b'], category: 'geo', enabled: false, times_asked: 3 };
  const input = questionInputFromDraft(draftFromQuestion(q));
  assert.deepEqual(input, { question: 'Q?', answers: ['a', 'b'], category: 'geo', enabled: false });
});

test('import parsing accepts a list or an object and refuses everything else', () => {
  assert.equal(parseQuestionImport('[{"question":"Q?","answers":["a"]}]').questions.length, 1);
  assert.equal(parseQuestionImport('{"questions":[{"question":"Q?","answers":["a"]}]}').questions.length, 1);
  assert.match(parseQuestionImport('').problem ?? '', /paste/i);
  assert.match(parseQuestionImport('not json').problem ?? '', /valid JSON/);
  assert.match(parseQuestionImport('{"a":1}').problem ?? '', /Expected a list/);
  assert.match(parseQuestionImport('[]').problem ?? '', /empty/);
  assert.match(parseQuestionImport(JSON.stringify(Array.from({ length: GAME_LIMITS.importMax + 1 }, () => ({})))).problem ?? '', /at most 500/);
});

// ── live actions ─────────────────────────────────────────────────────────
const limits = { maxAmount: 100_000, maxWinners: 10 };

test('raffle requests send only the numbers that were filled in and check them', () => {
  assert.deepEqual(raffleRequest({ amount: '500', seconds: '60', winners: '2' }, limits), { action: 'raffle_start', params: { amount: 500, seconds: 60, winners: 2 } });
  assert.deepEqual(raffleRequest({ amount: '', seconds: '', winners: '' }, limits), { action: 'raffle_start', params: {} });
  for (const bad of [
    { amount: '0', seconds: '60', winners: '1' }, { amount: '100001', seconds: '60', winners: '1' },
    { amount: '10', seconds: '9', winners: '1' }, { amount: '10', seconds: '601', winners: '1' },
    { amount: '10', seconds: '60', winners: '0' }, { amount: '10', seconds: '60', winners: '11' },
    { amount: '1e3', seconds: '60', winners: '1' }, { amount: '-5', seconds: '60', winners: '1' },
    { amount: '5.5', seconds: '60', winners: '1' },
  ]) assert.equal(typeof raffleRequest(bad, limits), 'string', JSON.stringify(bad));
});

test('bingo and trivia requests', () => {
  assert.deepEqual(bingoRequest(''), { action: 'bingo_start', params: {} });
  assert.deepEqual(bingoRequest('0'), { action: 'bingo_start', params: { reward: 0 } });
  assert.deepEqual(bingoRequest('250'), { action: 'bingo_start', params: { reward: 250 } });
  assert.equal(typeof bingoRequest('1000001'), 'string');
  assert.equal(typeof bingoRequest('-1'), 'string');
  assert.deepEqual(triviaRequest(''), { action: 'trivia_start', params: {} });
  assert.deepEqual(triviaRequest('12'), { action: 'trivia_start', params: { question_id: 12 } });
});

test('contest requests need a title and two to ten short options', () => {
  assert.deepEqual(contestRequest({ title: ' Who\n wins? ', options: ['A ', '', ' B'] }, 10), { action: 'contest_open', params: { title: 'Who wins?', options: ['A', 'B'] } });
  assert.match(contestRequest(EMPTY_CONTEST_DRAFT, 10) as string, /title/);
  assert.match(contestRequest({ title: 'T', options: ['only'] }, 10) as string, /two options/);
  assert.match(contestRequest({ title: 'T', options: ['a', 'b', 'c', 'd'] }, 3) as string, /at most 3/);
  assert.match(contestRequest({ title: 'T', options: ['a', 'b'.repeat(41)] }, 10) as string, /40/);
  assert.match(contestRequest({ title: 't'.repeat(101), options: ['a', 'b'] }, 10) as string, /100/);
  assert.equal(typeof contestRequest({ title: 'T', options: Array.from({ length: 11 }, (_, i) => `o${i}`) }, 10), 'string');
});

test('bot error codes become plain sentences', () => {
  assert.match(describeActionFailure('round_active', 'x'), /already has a round/);
  assert.match(describeActionFailure('game_disabled', 'x'), /turned off/);
  assert.match(describeActionFailure('bot_offline', 'x'), /offline/);
  assert.equal(describeActionFailure('weird', 'fallback'), 'fallback');
  assert.equal(describeActionFailure(undefined, 'fallback'), 'fallback');
});

// ── rounds ───────────────────────────────────────────────────────────────
test('open and locked rounds are the running ones', () => {
  assert.equal(isActiveRound(round({ status: 'open' })), true);
  assert.equal(isActiveRound(round({ status: 'locked' })), true);
  for (const status of ['resolved', 'cancelled', 'refunded'] as const) assert.equal(isActiveRound(round({ status })), false);
});

test('round titles and stake summaries describe only what the API returned', () => {
  assert.equal(roundTitle(round({ title: 'Who wins?', game: 'contest' })), 'Who wins?');
  assert.equal(roundTitle(round({ game: 'raffle', options_json: { amount: 1500 } })), 'Prize 1,500');
  assert.equal(roundTitle(round({ game: 'duel' })), 'Duel');
  assert.deepEqual(contestOptions(round({ options_json: { options: ['A', 'B', 7] } })), ['A', 'B']);
  assert.deepEqual(contestOptions(round({ options_json: null })), []);
  assert.equal(describeStakes(round(), 'points'), 'No entries');
  assert.equal(describeStakes(round({ stakes: { stakes: 3, total_amount: 450, total_payout: 0, held: 3 } }), 'points'), '3 entries, 450 points staked');
  assert.equal(describeStakes(round({ status: 'resolved', stakes: { stakes: 1, total_amount: 100, total_payout: 175, held: 0 } }), 'points'), '1 entry, 175 paid out');
  assert.equal(describeStakes(round({ game: 'raffle', stakes: { stakes: 4, total_amount: 0, total_payout: 0, held: 4 } }), 'points'), '4 entries');
  assert.equal(describeStakes(round({ game: 'trivia' }), 'points'), '—');
});

test('oneLine strips control and bidi characters', () => {
  assert.equal(oneLine('  a\n\tb ‮ c​ '), 'a b c');
});

// ── wiring and safety ────────────────────────────────────────────────────
test('the section registers once, lazily, for moderators in the community group', () => {
  const source = read('src/features/twitch/games/section.tsx');
  assert.match(source, /id: 'games'/);
  assert.match(source, /group: 'community'/);
  assert.match(source, /minRole: 'moderator'/);
  assert.match(source, /lazyRoute\(\(\) => import\('\.\/GamesPage'\)/);
  assert.doesNotMatch(source, /^import .*GamesPage/m);
});

test('pages render text nodes only and send every call through the Twitch client', () => {
  const files = readdirSync(new URL('../src/features/twitch/games', import.meta.url)).filter((f) => /\.(tsx?|css)$/.test(f));
  assert.ok(files.length >= 8);
  for (const file of files) {
    const source = read(`src/features/twitch/games/${file}`);
    assert.doesNotMatch(source, /dangerouslySetInnerHTML|innerHTML|eval\(|new Function/, file);
    assert.doesNotMatch(source, /\bfetch\(/, file);
  }
  const api = read('src/features/twitch/games/api.ts');
  assert.match(api, /twitchApi\./);
  assert.match(api, /\/games\/actions/);
  assert.match(api, /\/trivia\/questions\/import/);
});

test('the games page keeps unsaved settings across tabs and wires the save bar', () => {
  const page = read('src/features/twitch/games/GamesPage.tsx');
  assert.match(page, /useSectionSettings<GamesSettings>\(channelId, 'games'\)/);
  assert.match(page, /<SettingsSaveBar/);
  assert.match(page, /ReadOnlyNotice/);
  const live = read('src/features/twitch/games/LiveTab.tsx');
  assert.match(live, /ConfirmDialog/);
  assert.match(live, /refetchInterval/);
});
