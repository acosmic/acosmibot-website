import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import {
  ALERT_KINDS,
  BACKOFF_MAX_MS,
  BoundedQueue,
  WIDGETS,
  addEventLine,
  appendBounded,
  applyChatEvent,
  applyGiveawayEvent,
  applyGoalEvent,
  applyLabelEvent,
  applyNowPlayingEvent,
  backoffDelay,
  badgeLabels,
  chatMessageModel,
  clampWait,
  cleanText,
  createThrottle,
  describeAlert,
  emoteUrl,
  eventLinesFromState,
  fontScale,
  formatClock,
  giveawayFromState,
  giveawayStatusText,
  goalFromState,
  goalPercent,
  isAllowedApiBase,
  isSafeSoundUrl,
  isValidCursor,
  isValidToken,
  labelText,
  leaderboardRows,
  messageParts,
  nowPlayingFromState,
  parseFragment,
  resolveLink,
  pollShares,
  prependBounded,
  safeColor,
  secondsUntil,
  songProgress,
} from '../public/twitch-overlay/overlay-core.js';

const DIR = 'public/twitch-overlay';
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const files = readdirSync(new URL(`../${DIR}/`, import.meta.url));
const TOKEN = 'A'.repeat(20) + 'b_-9'.repeat(5) + 'xyz'; // 43 chars
const env = (type: string, data: Record<string, unknown> = {}, id = '1-0') => ({ id, type, ts: '2026-11-22T20:00:00.000Z', data });

// ── API base, token and fragment ─────────────────────────────────────────

test('api allowlist accepts exactly the four origins', () => {
  for (const ok of ['https://api.acosmibot.com', 'https://api-test.acosmibot.com', 'http://localhost:5000', 'http://127.0.0.1:5000']) {
    assert.equal(isAllowedApiBase(ok), true, ok);
  }
  for (const bad of [
    'https://api.acosmibot.com.evil.com', 'https://evil.com#api.acosmibot.com', 'https://evil.com/?https://api.acosmibot.com',
    'http://api.acosmibot.com', 'https://api.acosmibot.com/', 'https://api.acosmibot.com/api', 'https://user@api.acosmibot.com',
    'https://api.acosmibot.com:8443', 'https://API.acosmibot.com', 'https://apix.acosmibot.com', 'https://api-staging.acosmibot.com',
    'http://localhost:5001', 'https://localhost:5000', 'http://localhost', 'javascript:alert(1)', '', ' https://api.acosmibot.com',
  ]) {
    assert.equal(isAllowedApiBase(bad), false, bad);
  }
  assert.equal(isAllowedApiBase(null), false);
  assert.equal(isAllowedApiBase(42), false);
});

test('token and cursor formats', () => {
  assert.equal(TOKEN.length, 43);
  assert.equal(isValidToken(TOKEN), true);
  assert.equal(isValidToken(TOKEN.slice(1)), false);
  assert.equal(isValidToken(`${TOKEN}A`), false);
  assert.equal(isValidToken(`${TOKEN.slice(1)}=`), false);
  assert.equal(isValidCursor('1732300000000-3'), true);
  assert.equal(isValidCursor('$'), false);
  assert.equal(isValidCursor('1-2-3'), false);
});

test('fragment parsing', () => {
  const api = encodeURIComponent('https://api-test.acosmibot.com');
  assert.deepEqual(parseFragment(`#token=${TOKEN}&api=${api}`), { ok: true, token: TOKEN, api: 'https://api-test.acosmibot.com' });
  assert.equal(parseFragment(`#api=${api}&token=${TOKEN}`).ok, true, 'order does not matter');
  assert.equal(parseFragment(`#token=${TOKEN}&api=${encodeURIComponent('https://api.acosmibot.com/')}`).ok, true, 'one trailing slash tolerated');
  assert.equal(parseFragment('').ok, false);
  assert.equal(parseFragment('#').ok, false);
  assert.equal(parseFragment(`#api=${api}`).reason, 'token');
  assert.equal(parseFragment(`#token=short&api=${api}`).reason, 'token');
  assert.equal(parseFragment(`#token=${TOKEN}`).reason, 'api');
  assert.equal(parseFragment(`#token=${TOKEN}&api=${encodeURIComponent('https://evil.com')}`).reason, 'api');
  assert.equal(parseFragment(`#token=${TOKEN}&token=${TOKEN}&api=${api}`).ok, false, 'duplicate token');
  assert.equal(parseFragment(`#token=${TOKEN}&api=${api}&api=${encodeURIComponent('https://evil.com')}`).ok, false, 'duplicate api');
  assert.equal(parseFragment(`#token=${TOKEN}&api=${encodeURIComponent('https://api.acosmibot.com.evil.com')}`).ok, false);
  assert.equal(parseFragment('#' + 'x'.repeat(2000)).ok, false);
  const failure = parseFragment(`#token=${TOKEN}&api=bad`);
  assert.equal(JSON.stringify(failure).includes(TOKEN), false, 'failures never echo the token');
});

// ── Untrusted values ─────────────────────────────────────────────────────

test('emote URLs only for validated ids on the Twitch CDN', () => {
  assert.equal(emoteUrl('emotesv2_abc123'), 'https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_abc123/default/dark/2.0');
  assert.equal(emoteUrl('25'), 'https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0');
  for (const bad of ['', '../x', 'a/b', 'a b', 'a?b', 'a#b', 'x"onerror', '%2e%2e', 'é', 'a'.repeat(65), null, 5]) {
    assert.equal(emoteUrl(bad), null, String(bad));
  }
});

test('colour and sound URL validation', () => {
  assert.equal(safeColor('#1E90FF'), '#1e90ff');
  for (const bad of ['red', '#fff', '#1e90ffaa', 'rgb(1,2,3)', '#1e90ff;background:url(x)', '', null]) assert.equal(safeColor(bad), '');
  assert.equal(isSafeSoundUrl('https://cdn.example.com/sounds/boop.mp3'), true);
  assert.equal(isSafeSoundUrl('https://cdn.example.com/a.OGG'), true);
  for (const bad of ['http://cdn.example.com/a.mp3', 'https://cdn.example.com/a.mp3.exe', 'https://cdn.example.com/a.mp4',
    'https://u:p@cdn.example.com/a.wav', 'javascript:alert(1)//.mp3', 'data:audio/mp3;base64,AAAA.mp3',
    `https://x.com/${'a'.repeat(520)}.mp3`, '', null]) {
    assert.equal(isSafeSoundUrl(bad), false, String(bad));
  }
});

test('text sanitising and clamping', () => {
  assert.equal(cleanText('  hello\n\tworld  '), 'hello world');
  assert.equal(cleanText('a‮evil‬b'), 'a evil b');
  assert.equal(cleanText('x\u0000y\u0007z⁦q⁩'), 'x y z q');
  assert.equal(cleanText('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>', 'kept as plain text');
  assert.equal(cleanText('abcdef', 4), 'abc…');
  assert.equal(Array.from(cleanText('😀'.repeat(10), 5)).length, 5, 'clamps by code point');
  assert.equal(cleanText(null), '');
  assert.equal(cleanText({ toString: () => 'x' }), '');
  assert.equal(cleanText(12), '12');
  assert.equal(cleanText('a'.repeat(100_000), 10).length, 10);
});

// ── Timing ───────────────────────────────────────────────────────────────

test('backoff grows from 2 s, caps at 30 s and jitters within [cap/2, cap]', () => {
  assert.equal(backoffDelay(0, () => 1), 2000);
  assert.equal(backoffDelay(0, () => 0), 1000);
  assert.equal(backoffDelay(1, () => 1), 4000);
  assert.equal(backoffDelay(3, () => 1), 16000);
  assert.equal(backoffDelay(4, () => 1), BACKOFF_MAX_MS);
  assert.equal(backoffDelay(500, () => 1), BACKOFF_MAX_MS);
  assert.equal(backoffDelay(500, () => 0), BACKOFF_MAX_MS / 2);
  assert.equal(backoffDelay(-3, () => 1), 2000);
  assert.equal(backoffDelay(2, () => Number.NaN), 4000);
  assert.equal(backoffDelay(2, () => 7), 8000);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const delay = backoffDelay(attempt);
    assert.ok(delay >= 1000 && delay <= BACKOFF_MAX_MS, `attempt ${attempt}: ${delay}`);
  }
  assert.equal(clampWait(2000), 2000);
  assert.equal(clampWait(-1), 0);
  assert.equal(clampWait(Number.POSITIVE_INFINITY), 0);
  assert.equal(clampWait(10 ** 9), 60000);
});

test('throttle allows a run at most every interval', () => {
  const t = createThrottle(30000);
  assert.equal(t.request(1000), 0);
  t.ran(1000);
  assert.equal(t.request(11000), 20000);
  assert.equal(t.request(31000), 0);
});

// ── Bounded containers ───────────────────────────────────────────────────

test('bounded queue and lists drop the oldest', () => {
  const q = new BoundedQueue(3);
  for (const n of [1, 2, 3, 4, 5]) q.push(n);
  assert.equal(q.size, 3);
  assert.equal(q.dropped, 2);
  assert.deepEqual([q.shift(), q.shift(), q.shift(), q.shift()], [3, 4, 5, undefined]);
  assert.deepEqual(appendBounded([1, 2, 3], 4, 3), [2, 3, 4]);
  assert.deepEqual(prependBounded([1, 2, 3], 0, 3), [0, 1, 2]);
});

// ── Alerts ───────────────────────────────────────────────────────────────

test('every alert kind renders a card from projected data', () => {
  const samples: Record<string, Record<string, unknown>> = {
    follow: { display_name: 'Ann' },
    sub: { display_name: 'Ann', kind: 'sub', tier: '1000', months: 1, is_prime: false, is_gift: false, message: 'hi' },
    resub: { display_name: 'Ann', kind: 'resub', tier: '2000', months: 12, streak_months: 3, message: 'twelve!' },
    gift_sub: { gifter_display_name: null, recipient_display_name: 'Bob', tier: '1000', months: 1 },
    community_gift: { gifter_display_name: 'Cid', total: 5, tier: '3000' },
    cheer: { display_name: 'Ann', bits: 100, kind: 'cheer', message: 'Cheer100 gg' },
    raid: { display_name: 'Raider', viewers: 42 },
    redemption: { display_name: 'Ann', reward_title: 'Hydrate', cost: 500, user_input: 'pls' },
    hype_train: { phase: 'begin', level: 2, total: 900, progress: 100, goal: 500 },
  };
  for (const kind of ALERT_KINDS) {
    const card = describeAlert(env(`activity.${kind}`, samples[kind]));
    assert.ok(card, kind);
    assert.equal(card.kind, kind);
    assert.equal(card.test, false);
    assert.ok(card.kicker && card.name, kind);
  }
  assert.deepEqual(
    (({ kicker, name, detail, message }) => ({ kicker, name, detail, message }))(describeAlert(env('activity.resub', samples.resub))!),
    { kicker: 'Resubscribed', name: 'Ann', detail: 'Tier 2 · 12 months · 3-month streak', message: 'twelve!' },
  );
  assert.equal(describeAlert(env('activity.gift_sub', samples.gift_sub))!.name, 'An anonymous gifter');
  assert.equal(describeAlert(env('activity.gift_sub', samples.gift_sub))!.detail, 'to Bob · Tier 1');
  assert.equal(describeAlert(env('activity.community_gift', samples.community_gift))!.detail, '5 gift subs · Tier 3');
  assert.equal(describeAlert(env('activity.cheer', samples.cheer))!.detail, '100 bits');
  assert.equal(describeAlert(env('activity.raid', samples.raid))!.detail, 'with 42 viewers');
  assert.equal(describeAlert(env('activity.sub', { display_name: 'P', is_prime: true, tier: '1000' }))!.detail, 'Prime');
});

test('alert.test and alert.sound', () => {
  const testCard = describeAlert(env('alert.test', { kind: 'cheer', data: { display_name: 'Test Viewer', bits: 500 } }));
  assert.equal(testCard!.test, true);
  assert.equal(testCard!.kind, 'cheer');
  assert.equal(testCard!.detail, '500 bits');
  assert.equal(describeAlert(env('alert.test', { kind: 'evil', data: {} })), null);
  const sound = describeAlert(env('alert.sound', { display_name: 'Ann', item_name: 'Airhorn', sound_url: 'https://cdn.example.com/horn.mp3' }));
  assert.equal(sound!.soundUrl, 'https://cdn.example.com/horn.mp3');
  assert.equal(sound!.detail, 'Airhorn');
  assert.equal(describeAlert(env('alert.sound', { display_name: 'Ann', item_name: 'x', sound_url: 'http://evil/x.mp3' }))!.soundUrl, null);
  assert.equal(describeAlert(env('alert.sound', { display_name: 'Ann', item_name: 'x', sound_url: null }))!.soundUrl, null);
});

test('non-alert envelopes and hostile data never produce cards', () => {
  for (const type of ['chat.message', 'stream.online', 'activity.ad_break', 'activity.__proto__', 'activity.', '', 'alert.other']) {
    assert.equal(describeAlert(env(type, { display_name: 'x' })), null, type);
  }
  assert.equal(describeAlert(null), null);
  const card = describeAlert(env('activity.follow', { display_name: '‮evil\u0000'.repeat(20) }));
  assert.ok(card!.name.length <= 40);
  assert.equal(/[\u0000‮]/.test(card!.name), false);
  assert.equal(describeAlert(env('activity.cheer', { display_name: 'a', bits: -5 }))!.detail, '0 bits');
  assert.equal(describeAlert(env('activity.follow', { display_name: { evil: true } }))!.name, 'Someone');
});

test('alert queue plays one card at a time in arrival order and stays bounded', () => {
  const q = new BoundedQueue(50);
  for (let i = 0; i < 60; i += 1) q.push(describeAlert(env('activity.follow', { display_name: `v${i}` }, `${i}-0`)));
  assert.equal(q.size, 50);
  assert.equal(q.shift().name, 'v10');
  assert.equal(q.shift().name, 'v11');
});

// ── Event list ───────────────────────────────────────────────────────────

test('event list: newest first, max_items, duplicates and non-events ignored', () => {
  let lines: ReturnType<typeof eventLinesFromState> = [];
  for (let i = 0; i < 12; i += 1) lines = addEventLine(lines, env('activity.follow', { display_name: `v${i}` }, `${i}-0`), 8);
  assert.equal(lines.length, 8);
  assert.equal(lines[0].name, 'v11');
  assert.equal(lines[0].text, 'followed');
  assert.equal(addEventLine(lines, env('activity.follow', { display_name: 'dup' }, '11-0'), 8), lines);
  assert.equal(addEventLine(lines, env('alert.sound', { display_name: 'x', item_name: 'y' }), 8), lines);
  assert.equal(addEventLine(lines, env('stream.online', {}), 8), lines);
  const fromState = eventLinesFromState({ items: [env('activity.cheer', { display_name: 'A', bits: 5 }, 'row-2'), env('activity.raid', { display_name: 'B', viewers: 3 }, 'row-1')] }, 1);
  assert.deepEqual(fromState, [{ id: 'row-2', name: 'A', text: 'cheered 5 bits', test: false }]);
  assert.deepEqual(eventLinesFromState(null, 5), []);
  assert.equal(addEventLine([], env('alert.test', { kind: 'raid', data: { display_name: 'T', viewers: 1 } }), 3)[0].test, true);
});

// ── Chat ─────────────────────────────────────────────────────────────────

const chat = (id: string, userId: string, fragments: unknown[], extra: Record<string, unknown> = {}) =>
  env('chat.message', { message_id: id, user_id: userId, display_name: `U${userId}`, color: '#ff0000', badges: [{ set_id: 'moderator' }], fragments, ...extra }, `${id}-0`);

test('chat message model: badges as labels, emotes validated, text bounded', () => {
  const model = chatMessageModel({
    message_id: 'm1', user_id: '7', display_name: 'Ann', color: 'javascript:alert(1)',
    badges: [{ set_id: 'broadcaster' }, { set_id: 'subscriber' }, { set_id: 'founder' }, { set_id: 'glhf-pledge' }, { set_id: '<b>' }],
    fragments: [
      { type: 'text', text: 'hi ' },
      { type: 'emote', text: 'Kappa', emote_id: '25' },
      { type: 'emote', text: 'Evil', emote_id: '../../x' },
      { type: 'text', text: ' <script>' },
    ],
  }, { showBadges: true });
  assert.ok(model);
  assert.equal(model.color, '');
  assert.deepEqual(model.badges, ['Host', 'Sub']);
  assert.deepEqual(model.parts, [
    { kind: 'text', text: 'hi ' },
    { kind: 'emote', text: 'Kappa', id: '25', url: 'https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0' },
    { kind: 'text', text: 'Evil <script>' },
  ]);
  assert.deepEqual(chatMessageModel({ message_id: 'm', user_id: '1', fragments: [{ type: 'text', text: 'x' }], badges: [{ set_id: 'vip' }] }, { showBadges: false })!.badges, []);
  assert.deepEqual(badgeLabels([{ set_id: 'vip' }, { set_id: 'moderator' }, { set_id: 'lead_moderator' }]), ['VIP', 'Mod']);
  assert.equal(chatMessageModel({ message_id: '', fragments: [{ type: 'text', text: 'x' }] }), null);
  assert.equal(chatMessageModel({ message_id: 'm', fragments: [] }), null);
  const long = messageParts(Array.from({ length: 100 }, () => ({ type: 'text', text: 'abcdefghij' })));
  assert.equal(long.map((p: { text: string }) => p.text).join('').length, 500);
});

test('chat box: max_messages, delete, clear_user (ban/timeout) and clear', () => {
  const opts = { maxMessages: 5, showBadges: true };
  let list: unknown[] = [];
  for (let i = 0; i < 8; i += 1) list = applyChatEvent(list, chat(`m${i}`, i % 2 ? 'odd' : 'even', [{ type: 'text', text: `msg ${i}` }]), opts);
  assert.equal(list.length, 5);
  assert.deepEqual(list.map((m: any) => m.id), ['m3', 'm4', 'm5', 'm6', 'm7']);
  assert.equal(applyChatEvent(list, chat('m7', 'odd', [{ type: 'text', text: 'again' }]), opts), list, 'duplicate ignored');
  list = applyChatEvent(list, env('chat.delete', { message_id: 'm5' }), opts);
  assert.deepEqual(list.map((m: any) => m.id), ['m3', 'm4', 'm6', 'm7']);
  list = applyChatEvent(list, env('chat.clear_user', { user_id: 'odd' }), opts);
  assert.deepEqual(list.map((m: any) => m.id), ['m4', 'm6']);
  assert.equal(applyChatEvent(list, env('chat.delete', {}), opts), list);
  assert.equal(applyChatEvent(list, env('stream.offline', {}), opts), list);
  assert.deepEqual(applyChatEvent(list, env('chat.clear', {}), opts), []);
  let capped: unknown[] = [];
  for (let i = 0; i < 80; i += 1) capped = applyChatEvent(capped, chat(`c${i}`, '1', [{ type: 'text', text: 'x' }]), { maxMessages: 500 });
  assert.equal(capped.length, 50, 'never more than 50 even with a bad config');
});

// ── Goal ─────────────────────────────────────────────────────────────────

test('goal: increments, goal.update and poll.update', () => {
  let goal = goalFromState({ source: 'followers', title: 'Followers', current: 98, target: 100, poll: null });
  goal = applyGoalEvent(goal, env('activity.follow', { amount: 1 }));
  assert.equal(goal.current, 99);
  goal = applyGoalEvent(goal, env('activity.community_gift', { amount: 5 }));
  assert.equal(goal.current, 104);
  assert.equal(goalPercent(goal.current, goal.target), 100);
  assert.equal(applyGoalEvent(goal, env('activity.follow', { amount: -3 })), goal);
  assert.equal(applyGoalEvent(goal, env('chat.message', { amount: 3 })), goal);
  let twitch = goalFromState({ source: 'twitch_goal', title: '', current: 1, target: 10 });
  twitch = applyGoalEvent(twitch, env('goal.update', { goal_id: 'g', type: 'follower', description: 'Road to 50', current: 7, target: 50, phase: 'progress' }));
  assert.deepEqual([twitch.current, twitch.target, twitch.title], [7, 50, 'Road to 50']);
  assert.equal(applyGoalEvent(twitch, env('goal.update', { description: 'x', current: 8, target: 50 }), 'My title').title, 'My title');
  let poll = goalFromState({ source: 'poll', title: '', current: 0, target: 1, poll: null });
  poll = applyGoalEvent(poll, env('poll.update', { id: 'p1', phase: 'progress', title: 'Best?', status: 'ACTIVE', choices: [{ id: 'a', title: 'A', votes: 3 }, { id: 'b', title: 'B', votes: 1 }], ends_at: null }));
  assert.deepEqual(pollShares(poll.poll).map((c: { percent: number }) => c.percent), [75, 25]);
  assert.equal(goalPercent(5, 0), 0);
  assert.equal(goalFromState(null).target, 1);
});

// ── Label, leaderboard, giveaway, now playing ────────────────────────────

test('label text and events', () => {
  assert.equal(labelText('Latest follower:', 'Ann'), 'Latest follower: Ann');
  assert.equal(labelText('', 'Ann'), 'Ann');
  assert.equal(labelText('Prefix', ''), '');
  assert.deepEqual(applyLabelEvent(env('label.text', { text: 'Bob\u0000' })), { text: 'Bob' });
  assert.deepEqual(applyLabelEvent(env('label.refresh', {})), { refresh: true });
  assert.equal(applyLabelEvent(env('activity.follow', { display_name: 'x' })), null);
});

test('leaderboard rows are bounded and cleaned', () => {
  const items = Array.from({ length: 20 }, (_, i) => ({ rank: i + 1, display_name: `v${i}‮`, value: 1000 - i }));
  const rows = leaderboardRows({ items }, 5);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows[0], { rank: 1, name: 'v0', value: '1,000' });
  assert.equal(leaderboardRows({ items }, 99).length, 10);
  assert.deepEqual(leaderboardRows(null, 5), []);
});

test('giveaway state, updates, winner and countdown', () => {
  let g = giveawayFromState({ giveaway: { giveaway_id: 4, status: 'open', title: 'Key', entry_mode: 'keyword', keyword: '!enter', entry_count: 3, ticket_cost: 0 }, winner: null });
  assert.equal(giveawayStatusText(g.giveaway), 'Type !enter to enter');
  g = applyGiveawayEvent(g, env('giveaway.update', { giveaway_id: 4, status: 'closed', title: 'Key', entry_mode: 'keyword', keyword: '!enter', entry_count: 9, ticket_cost: 0 }));
  assert.equal(g.giveaway!.entryCount, 9);
  g = applyGiveawayEvent(g, env('giveaway.winner', { giveaway_id: 4, display_name: 'Win', status: 'pending', claim_deadline: '2026-11-22T20:01:00.000Z' }));
  assert.equal(g.winner!.name, 'Win');
  assert.equal(secondsUntil(g.winner!.claimDeadline, Date.parse('2026-11-22T20:00:30.000Z')), 30);
  assert.equal(secondsUntil('nonsense', 0), 0);
  g = applyGiveawayEvent(g, env('giveaway.update', { giveaway_id: 5, status: 'open', title: 'Next', entry_mode: 'active', entry_count: null }));
  assert.equal(g.winner, null, 'a new giveaway clears the old winner');
  assert.equal(g.giveaway!.entryCount, null, 'show_entries off');
  assert.deepEqual(giveawayFromState({ giveaway: null, winner: null }), { giveaway: null, winner: null });
});

test('now playing state, updates and progress', () => {
  let np = nowPlayingFromState({ current: { title: 'Song', channel_title: 'Artist', duration_s: 200, requested_by_display_name: null, started_at: '2026-11-22T20:00:00.000Z' }, length: 2 });
  assert.equal(np.current!.requester, null);
  assert.deepEqual(songProgress(np.current, Date.parse('2026-11-22T20:00:50.000Z')), { elapsed: 50, duration: 200, fraction: 0.25 });
  assert.equal(songProgress(np.current, Date.parse('2026-11-22T21:00:00.000Z'))!.elapsed, 200, 'clamped to the duration');
  np = applyNowPlayingEvent(np, env('song.queue', { length: 7 }));
  assert.equal(np.length, 7);
  np = applyNowPlayingEvent(np, env('song.now_playing', {}));
  assert.equal(np.current, null, 'idle');
  np = applyNowPlayingEvent(np, env('song.now_playing', { title: 'Next', duration_s: 0, started_at: null }));
  assert.equal(songProgress(np.current, Date.now()), null);
  assert.equal(formatClock(65), '1:05');
  assert.equal(formatClock(3725), '1:02:05');
});

test('config helpers', () => {
  assert.equal(fontScale(5), 2);
  assert.equal(fontScale(0.1), 0.5);
  assert.equal(fontScale('2' as unknown as number), 1);
});

// ── Static checks of the shipped files ───────────────────────────────────

test('every widget has a page and a script, and nothing else is shipped', () => {
  for (const widget of WIDGETS) {
    assert.ok(files.includes(`${widget}.html`), `${widget}.html`);
    assert.ok(files.includes(`${widget}.js`), `${widget}.js`);
  }
  const allowed = new Set([...WIDGETS.flatMap((w: string) => [`${w}.html`, `${w}.js`]), 'overlay.js', 'overlay-core.js', 'overlay.css']);
  for (const file of files) assert.ok(allowed.has(file), `unexpected file ${file}`);
});

test('no file builds HTML from strings or evaluates code', () => {
  for (const file of files) {
    const source = read(`${DIR}/${file}`);
    for (const pattern of [/\.innerHTML\b/, /\.outerHTML\b/, /insertAdjacentHTML/, /document\.write/, /\beval\s*\(/, /new\s+Function\b/, /setAttribute\(\s*['"]style/, /setAttribute\(\s*['"]on/]) {
      assert.equal(pattern.test(source), false, `${file} uses ${pattern}`);
    }
  }
});

test('pages have no inline scripts or styles and load only same-origin relative files', () => {
  for (const file of files.filter((f) => f.endsWith('.html'))) {
    const html = read(`${DIR}/${file}`);
    assert.equal(/<style/i.test(html), false, `${file}: <style>`);
    assert.equal(/\sstyle\s*=/i.test(html), false, `${file}: style=`);
    assert.equal(/\son[a-z]+\s*=/i.test(html), false, `${file}: inline handler`);
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    assert.equal(scripts.length, 1, `${file}: one script`);
    assert.equal(scripts[0][2].trim(), '', `${file}: no inline script body`);
    assert.match(scripts[0][1], /type="module"/);
    assert.match(scripts[0][1], new RegExp(`src="${file.replace('.html', '.js')}"`));
    for (const [, url] of html.matchAll(/\s(?:src|href)="([^"]*)"/gi)) {
      assert.match(url, /^[a-z0-9-]+\.(js|css)$/, `${file}: ${url} must be a same-origin relative file`);
    }
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
    assert.match(html, /<meta name="referrer" content="no-referrer">/);
  }
  for (const file of files.filter((f) => f.endsWith('.js'))) {
    const source = read(`${DIR}/${file}`);
    for (const [, spec] of source.matchAll(/\bfrom\s+'([^']+)'/g)) {
      assert.match(spec, /^\.\/[a-z-]+\.js$/, `${file} imports ${spec}`);
    }
    assert.equal(/https?:\/\/(?!static-cdn\.jtvnw\.net\/|api(-test)?\\?\.acosmibot|localhost|127\.0\.0\.1)/.test(source.replace(/\/\/.*$/gm, '')), false, `${file}: no third-party URLs`);
  }
  const css = read(`${DIR}/overlay.css`);
  assert.equal(/@import|url\(/i.test(css), false, 'no external fonts or images in CSS');
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /background: transparent/);
});

// ── Dashboard model (src/features/twitch/overlays/model.ts) ─────────────────
import * as model from '../src/features/twitch/overlays/model.ts';

test('dashboard model: widget catalogue and kinds match the overlay runtime', () => {
  assert.deepEqual([...model.WIDGETS], [...WIDGETS]);
  assert.deepEqual([...model.ALERT_KINDS], [...ALERT_KINDS]);
  assert.equal(model.isWidgetKind('alerts'), true);
  assert.equal(model.isWidgetKind('donations'), false);
  assert.equal(model.widgetLabel('mystery'), 'mystery');
  for (const widget of model.WIDGETS) assert.ok(model.WIDGET_INFO[widget].label);
});

test('dashboard model: default configs mirror the API defaults', () => {
  assert.deepEqual(model.defaultConfig('alerts'), {
    types: ['follow', 'sub', 'resub', 'gift_sub', 'community_gift', 'cheer', 'raid', 'hype_train'],
    duration_ms: 6000, min_bits: 1, min_raid_viewers: 1, sound: false, font_scale: 1,
  });
  assert.deepEqual(model.defaultConfig('chat'), { max_messages: 15, fade_after_s: 0, show_badges: true, font_scale: 1 });
  assert.deepEqual(model.defaultConfig('goal'), { source: 'followers', target: 100, title: '' });
  assert.deepEqual(model.defaultConfig('label'), { kind: 'latest_follower', prefix: '' });
  assert.deepEqual(model.defaultConfig('leaderboard'), { by: 'points', count: 5, title: '' });
  assert.deepEqual(model.defaultConfig('giveaway'), { show_entries: true });
  assert.deepEqual(model.defaultConfig('nowplaying'), { show_requester: true, show_progress: true });
  const a = model.defaultConfig('events');
  (a.types as string[]).push('redemption');
  assert.equal((model.defaultConfig('events').types as string[]).includes('redemption'), false, 'fresh copy each call');
});

test('dashboard model: normalizeConfig clamps, filters and drops unknown keys', () => {
  const config = model.normalizeConfig('alerts', {
    duration_ms: 99999, min_bits: 2.6, types: ['raid', 'donation', 'follow'], sound: 'yes', extra: 1, font_scale: 0.1,
  });
  assert.equal(config.duration_ms, 15000);
  assert.equal(config.min_bits, 3);
  assert.deepEqual(config.types, ['follow', 'raid']);
  assert.equal(config.sound, false);
  assert.equal(config.font_scale, 0.5);
  assert.equal('extra' in config, false);
  assert.deepEqual(model.normalizeConfig('goal', { source: 'bits', title: 'x'.repeat(80) }),
    { source: 'followers', target: 100, title: 'x'.repeat(60) });
  assert.deepEqual(model.normalizeConfig('chat', null), model.defaultConfig('chat'));
  assert.deepEqual(model.configForApi('label', { kind: 'latest_raid', prefix: '  Raid: ' }), { kind: 'latest_raid', prefix: 'Raid:' });
});

test('dashboard model: configProblems reports what the API would reject', () => {
  assert.deepEqual(model.configProblems('alerts', model.defaultConfig('alerts')), []);
  const fields = (problems: { field: string }[]) => problems.map((p) => p.field).sort();
  assert.deepEqual(fields(model.configProblems('alerts', { ...model.defaultConfig('alerts'), types: [], duration_ms: 100 })),
    ['duration_ms', 'types']);
  assert.deepEqual(fields(model.configProblems('chat', { ...model.defaultConfig('chat'), max_messages: 7.5, show_badges: 'no' })),
    ['max_messages', 'show_badges']);
  assert.deepEqual(fields(model.configProblems('goal', { source: 'bits', target: 0, title: 'x'.repeat(61) })),
    ['source', 'target', 'title']);
  assert.equal(model.sameConfig(model.defaultConfig('alerts'), model.defaultConfig('alerts')), true);
  assert.equal(model.sameConfig(model.defaultConfig('alerts'), { ...model.defaultConfig('alerts'), types: ['follow'] }), false);
});

test('dashboard model: names, errors and activity filters', () => {
  assert.equal(model.nameProblem('   '), 'Give the overlay a name.');
  assert.match(model.nameProblem('x'.repeat(41)) ?? '', /40/);
  assert.equal(model.nameProblem(' Main‮ chat '), null);
  assert.equal(model.oneLine(' a\u0000​b \n c '), 'a b c');
  const chatLabel = model.WIDGET_INFO.chat.label;
  assert.equal(model.suggestName('chat', []), chatLabel);
  assert.equal(model.suggestName('chat', [{ name: chatLabel.toLowerCase() }, { name: `${chatLabel} 2` }]), `${chatLabel} 3`);
  assert.match(model.overlayErrorMessage('limit_reached') ?? '', /30/);
  assert.equal(model.overlayErrorMessage('something_else'), null);
  assert.equal(model.feedActivityType('activity.sub', { kind: 'resub' }), 'resub');
  assert.equal(model.feedActivityType('activity.sub', { kind: 'sub' }), 'sub');
  assert.equal(model.feedActivityType('chat.message'), null);
  assert.equal(model.activityFilterAdmits([], 'follow'), true);
  assert.equal(model.activityFilterAdmits(['cheer'], 'follow'), false);
  assert.equal(model.activityFilterAdmits([], null), false);
  assert.equal(model.activityQuery(), '?limit=50');
  assert.equal(model.activityQuery({ types: ['cheer', 'bogus', 'cheer', 'raid'], beforeId: 42, limit: 500 }),
    '?types=cheer,raid&before_id=42&limit=100');
  assert.equal(model.activityQuery({ beforeId: -1, limit: 0 }), '?limit=1');
});

test('resolveLink keeps a validated session copy so an OBS reload without the fragment still works', () => {
  const api = encodeURIComponent('https://api.acosmibot.com');
  const fresh = resolveLink(`#token=${TOKEN}&api=${api}`, null);
  assert.equal(fresh.link.ok, true);
  assert.deepEqual(JSON.parse(fresh.store ?? 'null'), { token: TOKEN, api: 'https://api.acosmibot.com' });
  const reloaded = resolveLink('', fresh.store);
  assert.equal(reloaded.link.ok, true);
  assert.equal(reloaded.store, null);
  assert.equal(resolveLink('', JSON.stringify({ token: TOKEN, api: 'https://evil.example' })).link.ok, false);
  assert.equal(resolveLink('', JSON.stringify({ token: 'short', api: 'https://api.acosmibot.com' })).link.ok, false);
  assert.equal(resolveLink('', '{not json').link.ok, false);
  assert.equal(resolveLink('', null).link.ok, false);
  // A broken fragment never falls back to an older stored link.
  assert.equal(resolveLink('#token=bad', fresh.store).link.ok, false);
});
