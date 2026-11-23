import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  EMPTY_POLL_DRAFT,
  EMPTY_PREDICTION_DRAFT,
  availableActions,
  canDelete,
  canEdit,
  clampPickCount,
  clock,
  describeDrawOdds,
  describeEligibility,
  describeEntry,
  draftFromGiveaway,
  emptyGiveawayDraft,
  giveawayInput,
  giveawayProblem,
  isPollRunning,
  isPredictionRunning,
  isRunning,
  isoToLocalInput,
  localInputToIso,
  mergePollUpdate,
  mergePredictionUpdate,
  oneLine,
  pollInput,
  pollLeaders,
  pollProblem,
  predictionInput,
  predictionProblem,
  queueSettingsProblem,
  sameGiveawayDraft,
  secondsLeft,
  share,
  totalVotes,
  type Giveaway,
  type GiveawayWinner,
  type Poll,
  type Prediction,
} from '../src/features/twitch/engagement/model.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const NOW = Date.parse('2026-11-22T20:00:00Z');

const giveaway = (overrides: Partial<Giveaway> = {}): Giveaway => ({
  id: 1, broadcaster_id: '1000', title: 'Steam key', status: 'draft', entry_mode: 'keyword', keyword: '!enter',
  ticket_cost: null, max_tickets: 1, subscriber_luck: 1,
  eligibility_json: { min_level: 0, subscriber_only: false, min_follow_minutes: 0, min_account_age_days: 0, exclude_winners_days: 0 },
  winner_count: 1, claim_seconds: 60, active_window_minutes: 10, auto_close_at: null, entry_count: 0, created_by_user_id: null,
  opened_at: null, closed_at: null, created_at: null, updated_at: null, ...overrides,
});

const winner = (overrides: Partial<GiveawayWinner> = {}): GiveawayWinner => ({
  id: 1, giveaway_id: 1, user_id: '1001', login: 'a', display_name: 'A', draw_number: 1, status: 'pending', total_weight: 6,
  entry_count: 4, drawn_at: null, claim_deadline: null, claimed_at: null, ...overrides,
});

// ── giveaway forms ────────────────────────────────────────────────────────
test('a new giveaway draft uses the channel defaults', () => {
  const draft = emptyGiveawayDraft({ keyword: '!win', claim_seconds: 30 });
  assert.equal(draft.keyword, '!win');
  assert.equal(draft.claim_seconds, 30);
  assert.equal(draft.entry_mode, 'keyword');
  assert.equal(emptyGiveawayDraft().keyword, '!enter');
});

test('giveawayInput sends only the fields of the chosen entry mode', () => {
  const base = { ...emptyGiveawayDraft(), title: '  Big \n prize ' };
  const keyword = giveawayInput({ ...base, keyword: ' !go ', ticket_cost: 99, max_tickets: 7 });
  assert.equal(keyword.title, 'Big prize');
  assert.deepEqual([keyword.keyword, keyword.ticket_cost, keyword.max_tickets], ['!go', null, 1]);
  const tickets = giveawayInput({ ...base, entry_mode: 'tickets', keyword: '!x', ticket_cost: 25, max_tickets: 5 });
  assert.deepEqual([tickets.keyword, tickets.ticket_cost, tickets.max_tickets], [null, 25, 5]);
  const active = giveawayInput({ ...base, entry_mode: 'active', keyword: '!x', ticket_cost: 25 });
  assert.deepEqual([active.keyword, active.ticket_cost, active.max_tickets], [null, null, 1]);
  assert.deepEqual(keyword.eligibility, {
    min_level: 0, subscriber_only: false, min_follow_minutes: 0, min_account_age_days: 0, exclude_winners_days: 0 });
  assert.equal(giveawayInput({ ...base, keyword: '   ' }).keyword, null);
});

test('a giveaway round-trips through the form', () => {
  const g = giveaway({
    entry_mode: 'tickets', keyword: null, ticket_cost: 15, max_tickets: 8, subscriber_luck: 2.5, winner_count: 3, claim_seconds: 0,
    eligibility_json: { min_level: 300, subscriber_only: true, min_follow_minutes: 60, min_account_age_days: 30, exclude_winners_days: 7 },
  });
  const draft = draftFromGiveaway(g);
  assert.equal(draft.ticket_cost, 15);
  assert.equal(draft.min_level, 300);
  const input = giveawayInput(draft);
  assert.equal(input.entry_mode, 'tickets');
  assert.equal(input.ticket_cost, 15);
  assert.deepEqual(input.eligibility, g.eligibility_json);
  assert.equal(sameGiveawayDraft(draft, draftFromGiveaway(g)), true);
  assert.equal(sameGiveawayDraft(draft, { ...draft, winner_count: 4 }), false);
});

test('giveawayProblem enforces every bound before the request is sent', () => {
  const ok = { ...emptyGiveawayDraft(), title: 'Prize' };
  assert.equal(giveawayProblem(ok, NOW), null);
  assert.match(giveawayProblem({ ...ok, title: '  ' }, NOW) ?? '', /title/);
  assert.match(giveawayProblem({ ...ok, title: 'x'.repeat(101) }, NOW) ?? '', /at most 100/);
  assert.match(giveawayProblem({ ...ok, keyword: 'two words' }, NOW) ?? '', /one word/);
  assert.match(giveawayProblem({ ...ok, keyword: 'k'.repeat(41) }, NOW) ?? '', /one word/);
  assert.equal(giveawayProblem({ ...ok, keyword: '' }, NOW), null);
  const tickets = { ...ok, entry_mode: 'tickets' as const };
  assert.match(giveawayProblem({ ...tickets, ticket_cost: 0 }, NOW) ?? '', /ticket costs/);
  assert.match(giveawayProblem({ ...tickets, ticket_cost: 1_000_001 }, NOW) ?? '', /ticket costs/);
  assert.match(giveawayProblem({ ...tickets, max_tickets: 1001 }, NOW) ?? '', /1 to 1000 tickets/);
  assert.equal(giveawayProblem({ ...tickets, ticket_cost: 1_000_000, max_tickets: 1000 }, NOW), null);
  assert.match(giveawayProblem({ ...ok, subscriber_luck: 0.5 }, NOW) ?? '', /luck/);
  assert.match(giveawayProblem({ ...ok, subscriber_luck: 11 }, NOW) ?? '', /luck/);
  assert.match(giveawayProblem({ ...ok, winner_count: 0 }, NOW) ?? '', /1 to 20/);
  assert.match(giveawayProblem({ ...ok, winner_count: 21 }, NOW) ?? '', /1 to 20/);
  assert.match(giveawayProblem({ ...ok, claim_seconds: 3601 }, NOW) ?? '', /claim/);
  assert.match(giveawayProblem({ ...ok, entry_mode: 'active', active_window_minutes: 0 }, NOW) ?? '', /active window/);
  assert.match(giveawayProblem({ ...ok, min_follow_minutes: 525_601 }, NOW) ?? '', /minutes/);
  assert.match(giveawayProblem({ ...ok, min_account_age_days: 3651 }, NOW) ?? '', /3650/);
  assert.match(giveawayProblem({ ...ok, exclude_winners_days: 366 }, NOW) ?? '', /365/);
  assert.match(giveawayProblem({ ...ok, winner_count: 1.5 }, NOW) ?? '', /1 to 20/);
});

test('the automatic close time must be in the future within seven days', () => {
  const ok = { ...emptyGiveawayDraft(), title: 'Prize' };
  const local = (ms: number) => isoToLocalInput(new Date(ms).toISOString());
  assert.equal(giveawayProblem({ ...ok, auto_close_at: local(NOW + 3_600_000) }, NOW), null);
  assert.match(giveawayProblem({ ...ok, auto_close_at: local(NOW - 3_600_000) }, NOW) ?? '', /future/);
  assert.match(giveawayProblem({ ...ok, auto_close_at: local(NOW + 8 * 86_400_000) }, NOW) ?? '', /within 7 days/);
  assert.match(giveawayProblem({ ...ok, auto_close_at: 'not a date' }, NOW) ?? '', /valid date/);
});

test('datetime-local values round-trip through ISO instants', () => {
  const iso = '2026-11-23T08:30:00.000Z';
  const local = isoToLocalInput(iso);
  assert.match(local, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  assert.equal(localInputToIso(local), iso);
  assert.equal(isoToLocalInput(null), '');
  assert.equal(isoToLocalInput('nonsense'), '');
  assert.equal(localInputToIso(''), null);
  assert.equal(localInputToIso('nonsense'), null);
});

// ── giveaway state ────────────────────────────────────────────────────────
test('each status offers exactly the actions the bot accepts', () => {
  assert.deepEqual(availableActions('draft'), ['open']);
  assert.deepEqual(availableActions('open'), ['close', 'draw', 'cancel']);
  assert.deepEqual(availableActions('closed'), ['draw', 'cancel']);
  assert.deepEqual(availableActions('drawn'), ['reroll']);
  assert.deepEqual(availableActions('cancelled'), []);
  assert.equal(canEdit('draft') && canEdit('open'), true);
  assert.equal(canEdit('closed') || canEdit('drawn') || canEdit('cancelled'), false);
  assert.equal(canDelete('draft') && canDelete('cancelled') && canDelete('drawn'), true);
  assert.equal(canDelete('open') || canDelete('closed'), false);
});

test('a drawn giveaway counts as running only while a winner has not claimed', () => {
  assert.equal(isRunning(giveaway({ status: 'open' })), true);
  assert.equal(isRunning(giveaway({ status: 'closed' })), true);
  assert.equal(isRunning(giveaway({ status: 'drawn' }), [winner({ status: 'pending' })]), true);
  assert.equal(isRunning(giveaway({ status: 'drawn' }), [winner({ status: 'claimed' })]), false);
  assert.equal(isRunning(giveaway({ status: 'draft' })), false);
});

test('claim countdowns never go negative and clocks pad seconds', () => {
  assert.equal(secondsLeft('2026-11-22T20:01:00Z', NOW), 60);
  assert.equal(secondsLeft('2026-11-22T19:59:00Z', NOW), 0);
  assert.equal(secondsLeft(null, NOW), null);
  assert.equal(secondsLeft('x', NOW), null);
  assert.equal(clock(75), '1:15');
  assert.equal(clock(5), '0:05');
});

test('entry and eligibility descriptions only mention what is switched on', () => {
  assert.equal(describeEntry(giveaway()), 'Type !enter');
  assert.equal(describeEntry(giveaway({ entry_mode: 'tickets', ticket_cost: 2500, max_tickets: 4 })), '2,500 points per ticket, up to 4');
  assert.equal(describeEntry(giveaway({ entry_mode: 'active' })), 'Anyone active in chat');
  assert.deepEqual(describeEligibility(giveaway().eligibility_json), []);
  assert.deepEqual(
    describeEligibility({ min_level: 300, subscriber_only: true, min_follow_minutes: 120, min_account_age_days: 1, exclude_winners_days: 30 }, (v) => `L${v}`),
    ['Subscribers only', 'L300 or higher', 'Following for 2 hours', 'Account at least 1 day old', 'No wins in the last 30 days']);
  assert.equal(describeDrawOdds({ total_weight: 6, entry_count: 4 }), 'Drawn from 4 entries (weight 6)');
  assert.equal(describeDrawOdds({ total_weight: 1, entry_count: 1 }), 'Drawn from 1 entry (weight 1)');
});

// ── polls and predictions ─────────────────────────────────────────────────
test('oneLine strips control and bidi characters', () => {
  assert.equal(oneLine('  a\n\tb ‮ c​ '), 'a b c');
});

test('pollProblem mirrors Twitch: title 60, 2 to 5 choices of 25, 15 to 1800 seconds', () => {
  const ok = { title: 'Pizza?', choices: ['yes', 'no'], duration_s: 120 };
  assert.equal(pollProblem(ok), null);
  assert.match(pollProblem({ ...ok, title: ' ' }) ?? '', /question/);
  assert.match(pollProblem({ ...ok, title: 'x'.repeat(61) }) ?? '', /at most 60/);
  assert.equal(pollProblem({ ...ok, title: 'x'.repeat(60) }), null);
  assert.match(pollProblem({ ...ok, choices: ['only', ''] }) ?? '', /at least 2/);
  assert.match(pollProblem({ ...ok, choices: ['a', 'b', 'c', 'd', 'e', 'f'] }) ?? '', /at most 5/);
  assert.match(pollProblem({ ...ok, choices: ['a', 'y'.repeat(26)] }) ?? '', /at most 25/);
  assert.match(pollProblem({ ...ok, choices: ['a', 'A'] }) ?? '', /different/);
  assert.match(pollProblem({ ...ok, duration_s: 14 }) ?? '', /15 to 1800/);
  assert.match(pollProblem({ ...ok, duration_s: 1801 }) ?? '', /15 to 1800/);
  assert.equal(pollProblem({ ...ok, choices: ['a', 'b', '', ' '] }), null);          // blanks are ignored
  assert.deepEqual(pollInput({ title: ' Q  1 ', choices: ['a ', '', ' b'], duration_s: 30 }), { title: 'Q 1', choices: ['a', 'b'], duration_s: 30 });
  assert.deepEqual(EMPTY_POLL_DRAFT(45), { title: '', choices: ['', ''], duration_s: 45 });
});

test('predictionProblem mirrors Twitch: title 45, 2 to 10 outcomes of 25, 1 to 1800 seconds', () => {
  const ok = { title: 'Win?', outcomes: ['yes', 'no'], window_s: 120 };
  assert.equal(predictionProblem(ok), null);
  assert.match(predictionProblem({ ...ok, title: 'x'.repeat(46) }) ?? '', /at most 45/);
  assert.equal(predictionProblem({ ...ok, outcomes: Array.from({ length: 10 }, (_, i) => `o${i}`) }), null);
  assert.match(predictionProblem({ ...ok, outcomes: Array.from({ length: 11 }, (_, i) => `o${i}`) }) ?? '', /at most 10/);
  assert.match(predictionProblem({ ...ok, window_s: 0 }) ?? '', /1 to 1800/);
  assert.match(predictionProblem({ ...ok, window_s: 1801 }) ?? '', /1 to 1800/);
  assert.equal(predictionProblem({ ...ok, window_s: 1 }), null);
  assert.deepEqual(predictionInput({ title: 'T', outcomes: ['a', ' b '], window_s: 5 }), { title: 'T', outcomes: ['a', 'b'], window_s: 5 });
  assert.equal(EMPTY_PREDICTION_DRAFT().window_s, 120);
});

const poll = (overrides: Partial<Poll> = {}): Poll => ({
  id: 'p1', title: 'Pizza?', status: 'ACTIVE', duration: 120, started_at: null, ended_at: null,
  choices: [{ id: 'c1', title: 'yes', votes: 3 }, { id: 'c2', title: 'no', votes: 1 }], ...overrides,
});

test('poll results: shares, leaders and ties', () => {
  assert.equal(totalVotes(poll().choices), 4);
  assert.equal(share(3, 4), 75);
  assert.equal(share(0, 0), 0);
  assert.deepEqual(pollLeaders(poll().choices).map((c) => c.id), ['c1']);
  assert.deepEqual(pollLeaders([{ id: 'a', title: 'a', votes: 2 }, { id: 'b', title: 'b', votes: 2 }]).map((c) => c.id), ['a', 'b']);
  assert.deepEqual(pollLeaders([{ id: 'a', title: 'a', votes: 0 }]), []);
});

test('feed updates replace the same poll and add new ones first', () => {
  const merged = mergePollUpdate([poll({ duration: 120, started_at: 'x' })], {
    id: 'p1', phase: 'progress', title: 'Pizza?', status: 'ACTIVE', ends_at: null,
    choices: [{ id: 'c1', title: 'yes', votes: 5 }, { id: 'c2', title: 'no', votes: 1 }],
  });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].choices[0].votes, 5);
  assert.equal(merged[0].duration, 120);              // fields the feed does not carry survive
  const added = mergePollUpdate(merged, { id: 'p2', phase: 'begin', title: 'New', status: 'ACTIVE', ends_at: null, choices: [] });
  assert.deepEqual(added.map((p) => p.id), ['p2', 'p1']);
  assert.equal(isPollRunning(added[0]), true);
  assert.equal(isPollRunning(poll({ status: 'COMPLETED' })), false);
  assert.equal(isPollRunning(undefined), false);
});

test('prediction updates track lock and resolution', () => {
  const prediction: Prediction = {
    id: 'r1', title: 'Win?', status: 'ACTIVE', winning_outcome_id: null, prediction_window: 60, created_at: null, locked_at: null,
    ended_at: null, outcomes: [{ id: 'o1', title: 'yes', users: 0, channel_points: 0 }, { id: 'o2', title: 'no', users: 0, channel_points: 0 }],
  };
  const locked = mergePredictionUpdate([prediction], {
    id: 'r1', phase: 'lock', title: 'Win?', status: 'LOCKED', locks_at: null, winning_outcome_id: null,
    outcomes: [{ id: 'o1', title: 'yes', users: 2, channel_points: 500 }, { id: 'o2', title: 'no', users: 1, channel_points: 100 }],
  });
  assert.equal(isPredictionRunning(locked[0]), true);
  assert.equal(locked[0].outcomes[0].channel_points, 500);
  const done = mergePredictionUpdate(locked, { ...{ id: 'r1', phase: 'end', title: 'Win?', locks_at: null, outcomes: locked[0].outcomes },
    status: 'RESOLVED', winning_outcome_id: 'o1' });
  assert.equal(isPredictionRunning(done[0]), false);
  assert.equal(done[0].winning_outcome_id, 'o1');
});

// ── queue ─────────────────────────────────────────────────────────────────
test('queue pick counts are whole numbers from 1 to 10', () => {
  assert.equal(clampPickCount(3), 3);
  assert.equal(clampPickCount(0), 1);
  assert.equal(clampPickCount(99), 10);
  assert.equal(clampPickCount(2.9), 2);
  assert.equal(clampPickCount(Number.NaN), 1);
  assert.equal(queueSettingsProblem({ max_size: 100, cost: 0 }), null);
  assert.match(queueSettingsProblem({ max_size: 0, cost: 0 }) ?? '', /1 to 500/);
  assert.match(queueSettingsProblem({ max_size: 501, cost: 0 }) ?? '', /1 to 500/);
  assert.match(queueSettingsProblem({ max_size: 5, cost: 1_000_001 }) ?? '', /0 to 1,000,000/);
});

// ── registration and safety ───────────────────────────────────────────────
test('the slice registers three dashboard sections and one public page, loaded lazily', () => {
  const section = read('src/features/twitch/engagement/section.tsx');
  for (const id of ['giveaways', 'polls', 'queue']) assert.match(section, new RegExp(`id: '${id}'`));
  assert.match(section, /minRole: 'moderator'/);
  assert.equal((section.match(/lazyRoute\(/g) ?? []).length, 3);
  assert.doesNotMatch(section, /^import .*Page'/m);
  const pub = read('src/features/twitch/engagement/public.tsx');
  assert.match(pub, /id: 'queue'/);
});

test('viewer-written text is rendered as React text and never as HTML', () => {
  for (const file of ['GiveawaysPage', 'PollsPage', 'QueuePage', 'PublicQueuePage']) {
    const source = read(`src/features/twitch/engagement/${file}.tsx`);
    assert.doesNotMatch(source, /dangerouslySetInnerHTML|innerHTML/, file);
  }
});

test('every page owns its loading, failed-load and empty states through the shared frame', () => {
  for (const file of ['GiveawaysPage', 'PollsPage', 'QueuePage']) {
    const source = read(`src/features/twitch/engagement/${file}.tsx`);
    assert.match(source, /<SectionPage/, file);
    assert.match(source, /query=/, file);
    assert.match(source, /EmptyState/, file);
  }
  const publicPage = read('src/features/twitch/engagement/PublicQueuePage.tsx');
  assert.match(publicPage, /LoadFailed/);
  assert.match(publicPage, /LoadingSpinner/);
  assert.match(publicPage, /EmptyState/);
});
