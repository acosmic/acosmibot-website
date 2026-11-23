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
  blockingFixes,
  defaultRules,
  describeExclusions,
  describeRules,
  explainVerdict,
  newRequestId,
  normalizeRules,
  presetsProblem,
  rulesFromLegacy,
  rulesOf,
  rulesProblem,
  sameRules,
  type EligibilityRules,
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
  // Contract change (eligibility rules v2): the form sends version 2 rules; the defaults let everyone enter.
  assert.deepEqual(keyword.eligibility, defaultRules());
  assert.equal(giveawayInput({ ...base, keyword: '   ' }).keyword, null);
});

test('a giveaway round-trips through the form', () => {
  const g = giveaway({
    entry_mode: 'tickets', keyword: null, ticket_cost: 15, max_tickets: 8, subscriber_luck: 2.5, winner_count: 3, claim_seconds: 0,
    eligibility_json: { min_level: 300, subscriber_only: true, min_follow_minutes: 60, min_account_age_days: 30, exclude_winners_days: 7 },
  });
  const draft = draftFromGiveaway(g);
  assert.equal(draft.ticket_cost, 15);
  assert.equal(draft.rules.min_level, 300);
  const input = giveawayInput(draft);
  assert.equal(input.entry_mode, 'tickets');
  assert.equal(input.ticket_cost, 15);
  // Contract change (eligibility rules v2): the older keys come back as the same rules in version 2.
  assert.deepEqual(input.eligibility, rulesFromLegacy(g.eligibility_json));
  assert.equal(input.eligibility.subscription, 'subscribers');
  assert.deepEqual(input.eligibility.prior_winners.statuses, ['pending', 'claimed', 'expired']);
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
  // Contract change (eligibility rules v2): rule bounds are checked through rulesProblem.
  const rules = defaultRules();
  assert.match(giveawayProblem({ ...ok, rules: { ...rules, following: { mode: 'followers', min_follow_minutes: 525_601 } } }, NOW) ?? '', /one year/);
  assert.match(giveawayProblem({ ...ok, rules: { ...rules, min_account_age_days: 3651 } }, NOW) ?? '', /3650/);
  assert.match(giveawayProblem({ ...ok, rules: { ...rules, prior_winners: { ...rules.prior_winners, period: 'rolling', days: 0 } } }, NOW) ?? '', /1 to 3650 days/);
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
  // Contract change (eligibility rules v2): open and closed giveaways can go back to draft to change their rules.
  assert.deepEqual(availableActions('open'), ['close', 'draw', 'reset', 'cancel']);
  assert.deepEqual(availableActions('closed'), ['draw', 'reset', 'cancel']);
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

// ── eligibility rules (version 2) ─────────────────────────────────────────
const rules = (patch: Partial<EligibilityRules> = {}): EligibilityRules => ({ ...defaultRules(), ...patch });

test('the default rules let everyone in chat enter and say so in plain words', () => {
  assert.deepEqual(describeRules(defaultRules()), ['Everyone in chat can enter.', 'You (the broadcaster) cannot enter.']);
  const withBroadcaster = rules({ roles: { ...defaultRules().roles, broadcaster: 'allow' } });
  assert.deepEqual(describeRules(withBroadcaster), ['Everyone in chat can enter.', 'You (the broadcaster) can enter too.']);
  assert.equal(rulesProblem(defaultRules()), null);
});

test('the plain-language summary names every rule that is switched on, and only those', () => {
  const r = rules({
    min_level: 300,
    roles: { broadcaster: 'exclude', moderators: 'exclude', vips: 'allow', regulars: 'allow', only: ['vips', 'regulars'] },
    subscription: 'subscribers',
    following: { mode: 'followers', min_follow_minutes: 7 * 1440 },
    prior_winners: { period: 'week', days: 0, start: null, end: null, statuses: ['pending', 'claimed'] },
    min_account_age_days: 30,
    participation: { min_watch_minutes: 120, min_messages: 10, min_points: 500 },
    named_exclusions: [{ user_id: '1', login: 'alt1' }, { user_id: '2', login: 'alt2' }, { user_id: '3', login: 'alt3' }, { user_id: '4', login: 'alt4' }],
  });
  assert.deepEqual(describeRules(r, { levelName: (v) => `L${v}`, timezone: 'Europe/Berlin' }), [
    'Only VIPs and regulars can enter.',
    'Moderators cannot enter.',
    'Chat level L300 or higher.',
    'Subscribers only.',
    'Followers who have followed for at least 7 days.',
    'Nobody who won a giveaway in this channel this week (weeks start on Monday).',
    'A win counts once drawn, claimed or still waiting to claim; prizes nobody claimed do not count.',
    'Days follow the channel time zone (Europe/Berlin).',
    'Twitch account at least 30 days old.',
    'At least 2 hours watched, 10 chat messages and 500 points in this channel.',
    'Excluded by name: alt1, alt2, alt3 and 1 more.',
    'You (the broadcaster) cannot enter.',
  ]);
});

test('"this week" and "the last seven days" read differently, and custom periods and statuses are named', () => {
  const prior = defaultRules().prior_winners;
  const week = describeRules(rules({ prior_winners: { ...prior, period: 'week' } }))[0];
  const rolling = describeRules(rules({ prior_winners: { ...prior, period: 'rolling', days: 7 } }))[0];
  assert.match(week, /this week \(weeks start on Monday\)/);
  assert.match(rolling, /in the last 7 days/);
  const range = describeRules(rules({ prior_winners: { ...prior, period: 'range', start: '2026-11-01', end: '2026-11-15' } }), { timezone: 'UTC' });
  assert.equal(range[0], 'Nobody who won a giveaway in this channel between 1 Nov 2026 and 15 Nov 2026.');
  assert.equal(range[2], 'Days follow the channel time zone (UTC).');
  const ever = describeRules(rules({ prior_winners: { ...prior, period: 'ever', statuses: ['claimed', 'expired'] } }));
  assert.equal(ever[1], 'Counted as a win: claimed prizes and prizes nobody claimed in time.');
  assert.equal(describeRules(rules({ following: { mode: 'non_followers', min_follow_minutes: 0 } }))[0], 'Only viewers who do not follow the channel.');
  assert.equal(describeRules(rules({ following: { mode: 'followers', min_follow_minutes: 60 } }))[0], 'Followers who have followed for at least 1 hour.');
});

test('rulesProblem mirrors the server validation', () => {
  const base = defaultRules();
  assert.match(rulesProblem(rules({ roles: { ...base.roles, vips: 'exclude', only: ['vips'] } })) ?? '', /both required and excluded/);
  assert.match(rulesProblem(rules({ following: { mode: 'everyone', min_follow_minutes: 10 } })) ?? '', /Followers only/);
  assert.match(rulesProblem(rules({ prior_winners: { ...base.prior_winners, period: 'range', start: '2026-11-10', end: null } })) ?? '', /start and an end/);
  assert.match(rulesProblem(rules({ prior_winners: { ...base.prior_winners, period: 'range', start: '2026-11-10', end: '2026-11-01' } })) ?? '', /not be after/);
  assert.match(rulesProblem(rules({ prior_winners: { ...base.prior_winners, period: 'today', statuses: [] } })) ?? '', /at least one/);
  assert.match(rulesProblem(rules({ participation: { min_watch_minutes: 1.5, min_messages: 0, min_points: 0 } })) ?? '', /watch time/);
  const many = Array.from({ length: 101 }, (_v, i) => ({ user_id: String(i), login: `u${i}` }));
  assert.match(rulesProblem(rules({ named_exclusions: many })) ?? '', /at most 100/);
});

test('saved rule sets: a cap of ten, unique one-line names, valid rules', () => {
  assert.equal(presetsProblem([{ name: 'Subs', rules: defaultRules() }]), null);
  assert.match(presetsProblem(Array.from({ length: 11 }, (_v, i) => ({ name: `p${i}`, rules: defaultRules() }))) ?? '', /at most 10/);
  assert.match(presetsProblem([{ name: 'A', rules: defaultRules() }, { name: ' a ', rules: defaultRules() }]) ?? '', /Two saved rule sets/);
  assert.match(presetsProblem([{ name: '  ', rules: defaultRules() }]) ?? '', /needs a name/);
  assert.match(presetsProblem([{ name: 'x'.repeat(41), rules: defaultRules() }]) ?? '', /40 characters/);
  assert.match(presetsProblem([{ name: 'Bad', rules: rules({ min_account_age_days: 9999 }) }]) ?? '', /^Bad: /);
});

test('rules compare by meaning: excluded accounts by id, so a login change is not an edit', () => {
  const a = rules({ named_exclusions: [{ user_id: '7', login: 'old' }, { user_id: '8', login: 'x' }] });
  const b = rules({ named_exclusions: [{ user_id: '8', login: 'x' }, { user_id: '7', login: 'renamed' }] });
  assert.equal(sameRules(a, b), true);
  assert.equal(sameRules(a, rules()), false);
  const draft = { ...emptyGiveawayDraft(), rules: a };
  assert.equal(sameGiveawayDraft(draft, { ...draft, rules: b }), true);
  assert.equal(sameGiveawayDraft(draft, { ...draft, rules: rules() }), false);
});

test('a giveaway reads its version 2 rules when present, else the older keys', () => {
  const v2 = rules({ subscription: 'non_subscribers' });
  assert.equal(rulesOf(giveaway({ eligibility: v2 })).subscription, 'non_subscribers');
  assert.deepEqual(rulesOf(giveaway()), defaultRules());
  assert.deepEqual(normalizeRules({ v: 2 } as EligibilityRules), defaultRules());
  assert.equal(emptyGiveawayDraft({ rules: v2 }).rules.subscription, 'non_subscribers');
});

test('entrant verdicts are explained in plain words, with what stops a draw', () => {
  assert.equal(explainVerdict({ status: 'eligible', reason: null }), 'Meets every rule');
  assert.equal(explainVerdict({ status: 'excluded', reason: 'prior_winner' }), 'Already won in the past-winners period');
  assert.equal(explainVerdict({ status: 'excluded', reason: 'something_new' }), 'Excluded by a rule');
  assert.equal(explainVerdict({ status: 'unknown', reason: 'missing_grant' }), 'Cannot be checked: Acosmibot needs to be reconnected');
  assert.equal(explainVerdict({ status: 'unknown', reason: 'not_checked' }), 'Checked again when you draw');
  const counts = { total: 6, eligible: 2, excluded: 3, unknown: 1, excluded_by_reason: { role_vip: 1, not_following: 2 }, unknown_by_reason: { missing_grant: 1 } };
  assert.deepEqual(describeExclusions(counts), ['Not following: 2', 'VIPs cannot enter: 1']);
  assert.deepEqual(blockingFixes({ counts, checks: [{ fact: 'follow', rule: 'following', available: false, reason: 'missing_grant', fix: 'Reconnect Acosmibot to check followers.' }] }),
    ['Reconnect Acosmibot to check followers.']);
  assert.deepEqual(blockingFixes({ counts: { ...counts, unknown_by_reason: { not_checked: 4 } }, checks: [] }), []);
});

test('draw request ids are fresh, bounded and in the accepted alphabet', () => {
  const a = newRequestId();
  assert.match(a, /^[A-Za-z0-9_-]{8,64}$/);
  assert.notEqual(a, newRequestId());
});

test('the giveaways page builds its rule editor from shared parts and never renders viewer text as HTML', () => {
  const editor = read('src/features/twitch/engagement/RulesEditor.tsx');
  assert.doesNotMatch(editor, /dangerouslySetInnerHTML|innerHTML/);
  assert.match(editor, /from '\.\.\/shared\/ui'/);
  const page = read('src/features/twitch/engagement/GiveawaysPage.tsx');
  assert.match(page, /newRequestId\(\)/);
  assert.match(page, /giveawaysApi\.eligibility/);
});
