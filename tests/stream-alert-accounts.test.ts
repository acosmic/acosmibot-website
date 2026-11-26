import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accountLabel,
  effectsWithoutReward,
  isTwitchNotConnected,
  linkedAccountMissing,
  listWords,
  mergeSubscriptions,
  orderAccounts,
  ownerPossessive,
  parseAccountParam,
  parseTwitchResult,
  pickAccount,
  plainError,
  readTwitchReturn,
  rewardCost,
  rewardNote,
  rewardsQueryKey,
  TWITCH_RESULTS,
  twitchConnectHref,
  twitchListening,
  twitchQueryKey,
  twitchReturnNotice,
  withoutTwitchResult,
  withRewardMapping,
} from '../src/utils/streamAlertAccounts.ts';

const mine = { id: 3, is_own: true, owner_username: 'Acosmic' };
const novas = { id: 7, is_own: false, owner_username: 'Nova' };
const echos = { id: 5, is_own: false, owner_username: 'echo' };

test('the ?account= value is read only as a plain positive number', () => {
  assert.equal(parseAccountParam('7'), 7);
  for (const value of [null, undefined, '', '0', '-7', '7.5', '07', ' 7', '7abc', 'abc', '1e3', '99999999999999999']) {
    assert.equal(parseAccountParam(value), null, String(value));
  }
});

test('a link to an account you can open wins over your own account', () => {
  assert.equal(pickAccount([mine, novas, echos], '7', 3), novas);
  assert.equal(pickAccount([mine, novas, echos], '3', 3), mine);
});

test('without a usable link the page falls back to your own account, else the first', () => {
  assert.equal(pickAccount([novas, mine], null, 3), mine);
  assert.equal(pickAccount([novas, mine], '', 3), mine);
  assert.equal(pickAccount([novas, mine], 'nope', 3), mine);
  // An account you cannot open (or that does not exist) is never selected.
  assert.equal(pickAccount([novas, mine], '99', 3), mine);
  // An editor with no account of their own lands on the first one they edit.
  assert.equal(pickAccount([novas, echos], null, null), novas);
  assert.equal(pickAccount([novas, echos], '99', null), novas);
  // own_account_id pointing at an account missing from the list is ignored too.
  assert.equal(pickAccount([novas, echos], null, 3), novas);
  assert.equal(pickAccount([], '7', null), null);
  assert.equal(pickAccount([], null, 3), null);
});

test('a link is reported as missed only when it names an account that is not in the list', () => {
  assert.equal(linkedAccountMissing([mine, novas], null), false);
  assert.equal(linkedAccountMissing([mine, novas], ''), false);
  assert.equal(linkedAccountMissing([mine, novas], '7'), false);
  assert.equal(linkedAccountMissing([mine, novas], '99'), true);
  assert.equal(linkedAccountMissing([mine, novas], 'junk'), true);
  assert.equal(linkedAccountMissing([], '7'), true);
});

test('the switcher lists your own account first, then the others by owner name', () => {
  const input = [novas, echos, mine];
  assert.deepEqual(orderAccounts(input).map((account) => account.id), [3, 5, 7]);
  assert.deepEqual(input.map((account) => account.id), [7, 5, 3]);
  assert.deepEqual(orderAccounts([novas, echos]).map((account) => account.id), [5, 7]);
});

test('accounts are labelled "Yours" or by their owner', () => {
  assert.equal(accountLabel(mine), 'Yours');
  assert.equal(accountLabel(novas), "Nova's");
  assert.equal(ownerPossessive('  '), "Someone's");
});

test('request failures read as plain sentences', () => {
  assert.equal(plainError(new Error('owner_required')), 'Only the owner of these stream alerts can do that.');
  assert.equal(plainError(new Error('Not found')), 'These stream alerts no longer exist, or you no longer have access to them.');
  assert.equal(plainError(new Error('Failed to fetch')), 'Could not reach Acosmibot. Check your connection and try again.');
  assert.equal(plainError(new Error('That person cannot be added as an editor')), 'That person cannot be added as an editor');
  assert.equal(plainError(new Error('')), 'Something went wrong.');
  assert.equal(plainError(null), 'Something went wrong.');
  assert.equal(plainError('API error 500'), 'API error 500');
});

/* ---- Connect Twitch and channel point rewards ---- */

const SUB_TYPES = ['channel.follow', 'channel.subscribe', 'channel.subscription.message', 'channel.subscription.gift', 'channel.cheer',
  'channel.raid', 'channel.hype_train.begin', 'channel.hype_train.end',
  'channel.channel_points_custom_reward_redemption.add', 'channel.channel_points_custom_reward_redemption.update'];
const subs = (bad: Record<string, string> = {}) => SUB_TYPES.map((type) => ({ type, status: bad[type] ?? 'enabled' }));
const ALL_KINDS = ['follows', 'subs', 'resubs', 'gift subs', 'bits', 'raids', 'hype trains', 'channel point rewards'];

test('the ?twitch= value is one of the six results the API sends, or nothing', () => {
  assert.deepEqual([...TWITCH_RESULTS], ['connected', 'denied', 'missing_scopes', 'in_use', 'expired', 'error']);
  for (const result of TWITCH_RESULTS) assert.equal(parseTwitchResult(result), result);
  for (const value of [null, undefined, '', 'Connected', 'connected ', 'ok', '1', '<b>', 'missing-scopes']) {
    assert.equal(parseTwitchResult(value), null, String(value));
  }
});

test('the way back from Twitch is read from the address with the account it names', () => {
  assert.deepEqual(readTwitchReturn('?account=3&twitch=connected'), { present: true, result: 'connected', accountId: 3 });
  assert.deepEqual(readTwitchReturn(new URLSearchParams('twitch=denied')), { present: true, result: 'denied', accountId: null });
  // A value that means nothing is still there to be removed.
  assert.deepEqual(readTwitchReturn('?account=3&twitch=nonsense'), { present: true, result: null, accountId: 3 });
  assert.deepEqual(readTwitchReturn('?account=3&twitch='), { present: true, result: null, accountId: 3 });
  assert.deepEqual(readTwitchReturn('?account=3'), { present: false, result: null, accountId: 3 });
  assert.deepEqual(readTwitchReturn(''), { present: false, result: null, accountId: null });
});

test('only ?twitch= is taken out of the address', () => {
  assert.equal(withoutTwitchResult('?account=3&twitch=connected').toString(), 'account=3');
  assert.equal(withoutTwitchResult('?twitch=error&account=7&ref=x').toString(), 'account=7&ref=x');
  assert.equal(withoutTwitchResult('?twitch=a&twitch=b').toString(), '');
  assert.equal(withoutTwitchResult('?account=3').toString(), 'account=3');
  // The parameters given are left as they were.
  const given = new URLSearchParams('account=3&twitch=denied');
  assert.equal(withoutTwitchResult(given).toString(), 'account=3');
  assert.equal(given.toString(), 'account=3&twitch=denied');
});

test('each result has its own plain message, and none blames the streamer in jargon', () => {
  const texts = TWITCH_RESULTS.map((result) => twitchReturnNotice(result, true)!.text);
  assert.equal(new Set(texts).size, TWITCH_RESULTS.length);
  assert.deepEqual(twitchReturnNotice('connected', true), { tone: 'ok', text: 'Twitch is connected. Real follows, subs, bits, raids and hype trains now play on your overlay.' });
  assert.deepEqual(twitchReturnNotice('denied', false), { tone: 'note', text: 'You cancelled on Twitch, so nothing was connected. You can connect whenever you like.' });
  for (const result of ['missing_scopes', 'in_use', 'expired', 'error'] as const) {
    const notice = twitchReturnNotice(result, false)!;
    assert.equal(notice.tone, 'error', result);
    assert.match(notice.text, /so nothing was connected\./, result);
  }
  for (const text of texts) assert.doesNotMatch(text, /—|scope|OAuth|token|state|EventSub|webhook/i);
  assert.equal(twitchReturnNotice(null, true), null);
});

test('"connected" is only said once the API agrees', () => {
  // Still loading: say nothing yet.
  assert.equal(twitchReturnNotice('connected', null), null);
  assert.deepEqual(twitchReturnNotice('connected', false), { tone: 'error', text: 'Twitch did not finish connecting. Try again.' });
  // The other results do not wait for the API.
  assert.equal(twitchReturnNotice('denied', null)!.tone, 'note');
  assert.equal(twitchReturnNotice('expired', null)!.tone, 'error');
});

test('the Connect Twitch link goes only to the API connect page for this account', () => {
  const good = 'https://api.acosmibot.com/auth/stream-alerts/twitch/start?account=3';
  assert.equal(twitchConnectHref(good, 3), good);
  assert.equal(twitchConnectHref('http://localhost:5000/auth/stream-alerts/twitch/start?account=3', 3), 'http://localhost:5000/auth/stream-alerts/twitch/start?account=3');
  for (const bad of [null, undefined, '', 'not a url', '/auth/stream-alerts/twitch/start?account=3',
    'javascript:alert(1)', 'http://api.acosmibot.com/auth/stream-alerts/twitch/start?account=3',
    'https://api.acosmibot.com/auth/stream-alerts/twitch/callback?account=3', 'https://api.acosmibot.com/auth/stream-alerts/twitch/start',
    'https://api.acosmibot.com/auth/stream-alerts/twitch/start?account=7']) {
    assert.equal(twitchConnectHref(bad, 3), null, String(bad));
  }
});

test('Twitch queries are keyed by account', () => {
  assert.deepEqual(twitchQueryKey(3), ['stream-alerts', 3, 'twitch']);
  assert.deepEqual(rewardsQueryKey(3), ['stream-alerts', 3, 'rewards']);
  assert.notDeepEqual(twitchQueryKey(3), twitchQueryKey(7));
  assert.notDeepEqual(rewardsQueryKey(3), rewardsQueryKey(7));
});

test('every kind of Twitch event is listed as listening when all its subscriptions are enabled', () => {
  assert.deepEqual(twitchListening(subs()), { listening: ALL_KINDS, settingUp: [], failed: [] });
  assert.equal(listWords(ALL_KINDS), 'follows, subs, resubs, gift subs, bits, raids, hype trains and channel point rewards');
});

test('a failed, revoked or missing subscription makes its kind "not listening"', () => {
  const two = twitchListening(subs({ 'channel.raid': 'failed', 'channel.hype_train.begin': 'authorization_revoked' }));
  assert.deepEqual(two.failed, ['raids', 'hype trains']);
  assert.deepEqual(two.listening, ['follows', 'subs', 'resubs', 'gift subs', 'bits', 'channel point rewards']);
  // One half of a pair is enough to count the kind as broken.
  assert.deepEqual(twitchListening(subs({ 'channel.channel_points_custom_reward_redemption.update': 'failed' })).failed, ['channel point rewards']);
  // A subscription that was never recorded counts as failed, so "Fix" is offered for it.
  assert.deepEqual(twitchListening(subs().filter((item) => item.type !== 'channel.follow')).failed, ['follows']);
  assert.deepEqual(twitchListening([]), { listening: [], settingUp: [], failed: ALL_KINDS });
});

test('a subscription Twitch is still confirming is "setting up", not failed', () => {
  const pending = 'webhook_callback_verification_pending';
  assert.deepEqual(twitchListening(subs({ 'channel.cheer': pending })), {
    listening: ALL_KINDS.filter((kind) => kind !== 'bits'), settingUp: ['bits'], failed: [],
  });
  // Failed wins over setting up within one kind.
  assert.deepEqual(twitchListening(subs({ 'channel.hype_train.begin': pending, 'channel.hype_train.end': 'failed' })).failed, ['hype trains']);
});

test('a kind this page has no word for only shows when it is not working', () => {
  assert.deepEqual(twitchListening([...subs(), { type: 'channel.new_thing', status: 'enabled' }]), { listening: ALL_KINDS, settingUp: [], failed: [] });
  assert.deepEqual(twitchListening([...subs(), { type: 'channel.new_thing', status: 'failed' }]).failed, ['some other events']);
  assert.deepEqual(twitchListening([...subs(), { type: 'channel.new_thing', status: 'webhook_callback_verification_pending' }]).settingUp, ['some other events']);
});

test('the answer to "Fix" is merged into the list by type', () => {
  const before = subs({ 'channel.raid': 'failed', 'channel.cheer': 'failed' });
  // The API may answer with every subscription, or only the ones it set up again.
  assert.deepEqual(twitchListening(mergeSubscriptions(before, subs())).failed, []);
  const partial = mergeSubscriptions(before, [{ type: 'channel.raid', status: 'enabled' }]);
  assert.equal(partial.length, before.length);
  assert.deepEqual(twitchListening(partial).failed, ['bits']);
  assert.deepEqual(mergeSubscriptions([], [{ type: 'channel.raid', status: 'enabled' }]), [{ type: 'channel.raid', status: 'enabled' }]);
  assert.equal(before.find((item) => item.type === 'channel.raid')!.status, 'failed');
});

test('lists read as a sentence', () => {
  assert.equal(listWords([]), '');
  assert.equal(listWords(['raids']), 'raids');
  assert.equal(listWords(['raids', 'bits']), 'raids and bits');
  assert.equal(listWords(['raids', 'bits', 'subs']), 'raids, bits and subs');
});

test('reward costs and states read plainly', () => {
  assert.equal(rewardCost(300), '300 points');
  assert.equal(rewardCost(1500), '1,500 points');
  assert.equal(rewardCost(1), '1 point');
  assert.equal(rewardCost(Number.NaN), '0 points');
  assert.equal(rewardNote({ is_enabled: true, is_paused: false }), null);
  assert.equal(rewardNote({ is_enabled: true, is_paused: true }), 'Paused on Twitch');
  assert.equal(rewardNote({ is_enabled: false, is_paused: false }), 'Turned off on Twitch');
  assert.equal(rewardNote({ is_enabled: false, is_paused: true }), 'Turned off on Twitch');
});

test('Create reward is offered only for effects no reward plays', () => {
  const effects = [{ name: 'boop', label: 'Boop' }, { name: 'meteor', label: 'Meteor Shower' }, { name: 'news', label: 'Breaking News' }];
  const rewards = [
    { id: 'a', mapping: { effect: 'boop', on: 'redeemed' } },
    { id: 'b', mapping: null },
    { id: 'c', mapping: { effect: 'boop', on: 'fulfilled' } },
  ];
  assert.deepEqual(effectsWithoutReward(effects, rewards).map((effect) => effect.name), ['meteor', 'news']);
  assert.deepEqual(effectsWithoutReward(effects, []).map((effect) => effect.name), ['boop', 'meteor', 'news']);
  assert.deepEqual(effectsWithoutReward([], rewards), []);
});

test('a saved mapping replaces that reward only, in a new list', () => {
  const rewards = [
    { id: 'a', title: 'A', mapping: { effect: 'boop', on: 'redeemed' } },
    { id: 'b', title: 'B', mapping: null },
  ];
  const next = withRewardMapping(rewards, 'b', { effect: 'flood', on: 'fulfilled' });
  assert.deepEqual(next, [rewards[0], { id: 'b', title: 'B', mapping: { effect: 'flood', on: 'fulfilled' } }]);
  assert.equal(next[0], rewards[0]);
  assert.equal(rewards[1].mapping, null);
  assert.deepEqual(withRewardMapping(rewards, 'a', null)[0], { id: 'a', title: 'A', mapping: null });
  assert.deepEqual(withRewardMapping(rewards, 'missing', null), rewards);
});

test('Twitch failures read as plain sentences', () => {
  assert.equal(plainError(new Error('Twitch did not answer')), 'Twitch did not answer. Try again in a moment.');
  assert.equal(plainError(new Error('Twitch is not connected')), 'Twitch is not connected any more.');
  assert.equal(plainError(new Error('A reward with that name already exists. Map it instead.')), 'A reward with that name already exists. Map it instead.');
  assert.equal(isTwitchNotConnected(new Error('Twitch is not connected')), true);
  assert.equal(isTwitchNotConnected(new Error('Twitch did not answer')), false);
  assert.equal(isTwitchNotConnected('Twitch is not connected'), false);
  assert.equal(isTwitchNotConnected(null), false);
});
