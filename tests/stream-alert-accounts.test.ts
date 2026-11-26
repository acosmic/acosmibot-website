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

/* ---- Media library and alert designs (pure helpers) ---- */

import {
  alertLength,
  amountMinor,
  arrowStep,
  assetStatusText,
  assetsQueryKey,
  assetsWaiting,
  backgroundText,
  boxRect,
  boxVisibleAt,
  canRemoveBlack,
  clampScale,
  defaultText,
  DESIGN_FONTS,
  DESIGN_KINDS,
  designsQueryKey,
  fieldTextIndex,
  fillTemplate,
  fittingScale,
  fontAssetId,
  formatBytes,
  formatLength,
  googleFontsHref,
  insertAtCursor,
  inUseText,
  KIND_VARIABLES,
  mediaRect,
  moveBox,
  moveMedia,
  newDesign,
  normalizeDesign,
  normalizeField,
  resizeBox,
  resolveDraft,
  sameDesign,
  sampleFireOptions,
  sampleTemplateValues,
  sampleTestInput,
  DEFAULT_SAMPLES,
  screenToBoxFraction,
  screenToStage,
  shrinkToFit,
  stageScaleFor,
  templateProblem,
  templateVariables,
  timelinePercent,
  uploadedFontFamily,
  validateDesign,
  variablesFor,
} from '../src/utils/streamAlertDesigns.ts';

const readyVideo = { id: 12, kind: 'video' as const, status: 'ready' as const, url: 'https://cdn.example/v.webm', width: 800, height: 600, duration_ms: 6033, has_alpha: true, has_audio: true, font_family: null };
const readyImage = { ...readyVideo, id: 13, kind: 'image' as const, url: 'https://cdn.example/i.png', duration_ms: null, has_audio: false };
const readySound = { ...readyVideo, id: 14, kind: 'sound' as const, url: 'https://cdn.example/s.mp3', width: null, height: null, duration_ms: 2000 };
const readyFont = { ...readyVideo, id: 7, kind: 'font' as const, url: 'https://cdn.example/f.woff2', width: null, height: null, duration_ms: null, font_family: 'Ashbo Hand' };
const library = [readyVideo, readyImage, readySound, readyFont];

test('design query keys carry the account id', () => {
  assert.deepEqual(assetsQueryKey(3), ['stream-alerts', 3, 'assets']);
  assert.deepEqual(designsQueryKey(3), ['stream-alerts', 3, 'designs']);
});

test('each alert kind allows exactly the contract variables, name first', () => {
  assert.deepEqual(DESIGN_KINDS.slice().sort(), ['cheer', 'donation', 'follow', 'gift', 'hypetrain', 'raid', 'resub', 'sub']);
  assert.deepEqual(KIND_VARIABLES, {
    follow: ['name'], donation: ['name', 'amount', 'message'], sub: ['name', 'tier'], resub: ['name', 'months', 'tier', 'message'],
    gift: ['name', 'count', 'tier'], cheer: ['name', 'bits', 'message'], raid: ['name', 'viewers'], hypetrain: ['name', 'level'],
  });
  for (const kind of DESIGN_KINDS) assert.deepEqual(variablesFor(kind), KIND_VARIABLES[kind]);
  // The API's list wins, with or without braces, and name always comes first.
  assert.deepEqual(variablesFor('cheer', ['{bits}', '{name}', 'message']), ['name', 'bits', 'message']);
  assert.deepEqual(variablesFor('raid', []), ['name', 'viewers']);
  assert.deepEqual(variablesFor('raid', null), ['name', 'viewers']);
});

test('templates may use only the variables of their kind, within 200 characters', () => {
  assert.deepEqual(templateVariables('{name} gave {amount} {name}'), ['name', 'amount']);
  assert.equal(templateProblem('{name} just followed!', 'follow', KIND_VARIABLES.follow), null);
  assert.equal(templateProblem('{name} gave {amount}', 'donation', KIND_VARIABLES.donation), null);
  assert.equal(templateProblem('{amount}', 'follow', KIND_VARIABLES.follow), '{amount} cannot be used in a Follow alert. You can use {name}.');
  assert.equal(templateProblem('{months} months', 'gift', KIND_VARIABLES.gift), '{months} cannot be used in a Gift subs alert. You can use {name}, {count}, {tier}.');
  assert.match(templateProblem('', 'follow', ['name']) ?? '', /Type some text/);
  assert.match(templateProblem('   ', 'follow', ['name']) ?? '', /Type some text/);
  assert.equal(templateProblem('x'.repeat(200), 'follow', ['name']), null);
  assert.match(templateProblem('x'.repeat(201), 'follow', ['name']) ?? '', /200 characters or fewer/);
  assert.match(templateProblem('{name', 'follow', ['name']) ?? '', /needs a \}/);
  assert.match(templateProblem('{}', 'follow', ['name']) ?? '', /\{\} cannot be used/);
});

test('templates fill with sample values as plain text, and unknown variables stay as typed', () => {
  const values = sampleTemplateValues(DEFAULT_SAMPLES);
  assert.equal(values.name, 'Nova');
  assert.equal(values.amount, '$5.00');
  assert.equal(values.months, '14');
  assert.equal(values.tier, 'Tier 1');
  assert.equal(fillTemplate('{name} gave {amount}!', values), 'Nova gave $5.00!');
  assert.equal(fillTemplate('{nope} <b>{name}</b>', values), '{nope} <b>Nova</b>');
  assert.equal(sampleTemplateValues({ ...DEFAULT_SAMPLES, name: '  ', months: 'abc', tier: 'prime' }).name, 'Nova');
  assert.equal(sampleTemplateValues({ ...DEFAULT_SAMPLES, months: 'abc' }).months, '14');
  assert.equal(sampleTemplateValues({ ...DEFAULT_SAMPLES, tier: 'prime' }).tier, 'Prime');
  // As the overlay fills them: numbers with thousands commas, and a hype train has no viewer name.
  assert.equal(sampleTemplateValues({ ...DEFAULT_SAMPLES, bits: '12500' }).bits, '12,500');
  assert.equal(sampleTemplateValues(DEFAULT_SAMPLES, 'hypetrain').name, 'Hype Train');
  assert.equal(sampleTemplateValues(DEFAULT_SAMPLES, 'follow').name, 'Nova');
});

test('variable chips insert at the cursor, replacing a selection', () => {
  assert.deepEqual(insertAtCursor('Hi !', 3, 3, '{name}'), { value: 'Hi {name}!', caret: 9 });
  assert.deepEqual(insertAtCursor('Hi XX!', 3, 5, '{name}'), { value: 'Hi {name}!', caret: 9 });
  assert.deepEqual(insertAtCursor('Hi', null, null, '{name}'), { value: 'Hi{name}', caret: 8 });
  assert.deepEqual(insertAtCursor('Hi', 99, 99, '{name}'), { value: 'Hi{name}', caret: 8 });
});

test('sample values become the overlay fire options and the test alert of each kind', () => {
  assert.deepEqual(sampleFireOptions('follow', DEFAULT_SAMPLES), { user: 'Nova', test: true });
  assert.deepEqual(sampleFireOptions('donation', DEFAULT_SAMPLES), { user: 'Nova', test: true, text: DEFAULT_SAMPLES.message, amount: '$5.00' });
  assert.deepEqual(sampleFireOptions('resub', DEFAULT_SAMPLES), { user: 'Nova', test: true, text: DEFAULT_SAMPLES.message, tier: '1000', value: 14 });
  assert.deepEqual(sampleFireOptions('raid', DEFAULT_SAMPLES), { user: 'Nova', test: true, value: 42 });
  assert.deepEqual(sampleFireOptions('cheer', { ...DEFAULT_SAMPLES, bits: '12500' }).value, 12500);
  assert.deepEqual(sampleTestInput('donation', DEFAULT_SAMPLES), { type: 'donation', name: 'Nova', message: DEFAULT_SAMPLES.message, amount_minor: 500 });
  assert.deepEqual(sampleTestInput('gift', DEFAULT_SAMPLES), { type: 'gift', name: 'Nova', tier: '1000', value: 5 });
  assert.equal(amountMinor('$12.34'), 1234);
  assert.equal(amountMinor('nothing'), 500);
  assert.equal(amountMinor('-3'), 300);
});

test('the media sits centred on x, y at its scale, and drags stay on the 1920x1080 screen', () => {
  assert.deepEqual(mediaRect({ x: 960, y: 300, scale: 1 }, readyVideo), { left: 560, top: 0, width: 800, height: 600 });
  assert.deepEqual(mediaRect({ x: 960, y: 540, scale: 0.5 }, readyVideo), { left: 760, top: 390, width: 400, height: 300 });
  assert.deepEqual(moveMedia({ x: 960, y: 540 }, 100.4, -40.6), { x: 1060, y: 499 });
  assert.deepEqual(moveMedia({ x: 1900, y: 10 }, 500, -500), { x: 1920, y: 0 });
  assert.equal(stageScaleFor(960), 0.5);
  assert.equal(stageScaleFor(0), 0);
  assert.equal(screenToStage(50, 0.25), 200);
  assert.equal(clampScale(5), 3);
  assert.equal(clampScale(0.01), 0.1);
  assert.equal(clampScale(1.234), 1.23);
  assert.equal(fittingScale(readyVideo), 1);
  assert.equal(fittingScale({ width: 3840, height: 2160 }), 0.4);
  assert.deepEqual(arrowStep('ArrowLeft', false, false), { dx: -10, dy: 0 });
  assert.deepEqual(arrowStep('ArrowDown', true, false), { dx: 0, dy: 50 });
  assert.deepEqual(arrowStep('ArrowUp', false, true), { dx: 0, dy: -1 });
  assert.equal(arrowStep('Enter', false, false), null);
});

test('text boxes move and resize as fractions of the media and never leave it', () => {
  const media = mediaRect({ x: 960, y: 540, scale: 0.5 }, readyVideo);
  const box = { x: 0.1, y: 0.62, w: 0.8, h: 0.12 };
  assert.deepEqual(boxRect(box, media), { left: 800, top: 576, width: 320, height: 36 });
  // 40 screen px on a stage shown at 0.25 is 160 stage px, which is 0.4 of a 400 px wide media box.
  assert.deepEqual(screenToBoxFraction(40, 30, 0.25, media), { dx: 0.4, dy: 0.4 });
  assert.deepEqual(screenToBoxFraction(40, 30, 0, media), { dx: 0, dy: 0 });
  assert.deepEqual(moveBox(box, 0.05, 0.1), { x: 0.15, y: 0.72, w: 0.8, h: 0.12 });
  assert.deepEqual(moveBox(box, 0.5, 0.9), { x: 0.2, y: 0.88, w: 0.8, h: 0.12 });
  assert.deepEqual(moveBox(box, -1, -1), { x: 0, y: 0, w: 0.8, h: 0.12 });
  assert.deepEqual(resizeBox(box, 0.5, 0.1), { x: 0.1, y: 0.62, w: 0.9, h: 0.22 });
  assert.deepEqual(resizeBox(box, -2, -2), { x: 0.1, y: 0.62, w: 0.04, h: 0.04 });
  // Other fields of the box ride along unchanged.
  assert.equal(moveBox({ ...box, template: '{name}' }, 0, 0).template, '{name}');
});

test('a box shows between its appear and disappear times, and the timeline places markers', () => {
  const box = { appear_ms: 1800, disappear_ms: 5200 };
  assert.equal(boxVisibleAt(box, 1799), false);
  assert.equal(boxVisibleAt(box, 1800), true);
  assert.equal(boxVisibleAt(box, 5199), true);
  assert.equal(boxVisibleAt(box, 5200), false);
  assert.equal(boxVisibleAt({ appear_ms: 0, disappear_ms: null }, 29999), true);
  assert.equal(alertLength({ video: 12, duration_ms: 6000 }, readyVideo), 6033);
  assert.equal(alertLength({ video: null, duration_ms: 4000 }, null), 4000);
  assert.equal(timelinePercent(3000, 6000), 50);
  assert.equal(timelinePercent(9000, 6000), 100);
  assert.equal(timelinePercent(10, 0), 0);
});

test('shrink to fit finds the largest size that fits without measuring every pixel', () => {
  let measured = 0;
  const fitsBelow = (limit: number) => (size: number) => { measured += 1; return size <= limit; };
  assert.equal(shrinkToFit(56, fitsBelow(100)), 56);
  measured = 0;
  const size = shrinkToFit(56, fitsBelow(23.2));
  assert.ok(size <= 23.2 && size >= 22.5, String(size));
  assert.ok(measured < 12, String(measured));
  assert.equal(shrinkToFit(56, () => false, 4), 4);
});

test('a new design starts in the middle of the screen with the name on it', () => {
  const design = newDesign('follow', readyVideo);
  assert.equal(design.video, 12);
  assert.equal(design.image, null);
  assert.deepEqual([design.x, design.y, design.scale], [960, 540, 1]);
  assert.equal(design.texts.length, 1);
  assert.equal(design.texts[0].template, '{name}');
  assert.equal(newDesign('follow', readyImage).image, 13);
  assert.equal(defaultText('donation', 1).template, '{amount}');
  assert.equal(defaultText('cheer', 2).template, '{message}');
  assert.equal(defaultText('raid', 2).template, 'Thank you!');
  for (const kind of DESIGN_KINDS) {
    for (let i = 0; i < 4; i += 1) assert.equal(templateProblem(defaultText(kind, i).template, kind, KIND_VARIABLES[kind]), null, `${kind} ${i}`);
  }
  assert.deepEqual(validateDesign(design, 'follow', library), []);
});

test('designs compare by content, whatever order or gaps the API sends them with', () => {
  const design = newDesign('follow', readyVideo);
  const shuffled = JSON.parse(JSON.stringify({ texts: design.texts, scale: design.scale, y: design.y, x: design.x, volume: design.volume, duration_ms: design.duration_ms, sound: null, image: null, video: 12 }));
  assert.equal(sameDesign(design, shuffled), true);
  assert.equal(sameDesign(design, { ...design, x: 961 }), false);
  assert.equal(sameDesign(null, null), true);
  assert.equal(sameDesign(design, null), false);
  assert.equal(normalizeDesign({ video: 12 }).texts.length, 0);
  assert.equal(normalizeDesign({ texts: [{ template: '{name}' }] as never }).texts[0].fit, 'shrink');
});

test('validation points at the field, as the API does', () => {
  const design = newDesign('follow', readyVideo);
  const fields = (d: typeof design, kind: Parameters<typeof validateDesign>[1] = 'follow') => validateDesign(d, kind, library).map((p) => p.field);
  assert.deepEqual(fields({ ...design, video: null }), ['video']);
  assert.deepEqual(fields({ ...design, video: 99 }), ['video']);
  assert.deepEqual(fields({ ...design, video: 13 }), ['video']);
  assert.deepEqual(validateDesign({ ...design, video: 12 }, 'follow', [{ ...readyVideo, status: 'processing' }]).map((p) => p.field), ['video']);
  assert.deepEqual(fields({ ...design, video: null, image: 13, duration_ms: 500 }), ['duration_ms']);
  assert.deepEqual(fields({ ...design, sound: 12 }), ['sound']);
  assert.deepEqual(fields({ ...design, scale: 4, volume: 2, x: -1 }), ['x', 'scale', 'volume']);
  const text = design.texts[0];
  assert.deepEqual(fields({ ...design, texts: [{ ...text, template: '{amount}' }] }), ['texts.0.template']);
  assert.deepEqual(fields({ ...design, texts: [{ ...text, template: '{amount}' }] }, 'donation'), []);
  assert.deepEqual(fields({ ...design, texts: [{ ...text, font: 'Comic Sans' }] }), ['texts.0.font']);
  assert.deepEqual(fields({ ...design, texts: [{ ...text, font: 'asset:7' }] }), []);
  assert.deepEqual(fields({ ...design, texts: [{ ...text, font: 'asset:12' }] }), ['texts.0.font']);
  assert.deepEqual(fields({ ...design, texts: [{ ...text, size: 401 }, { ...text, color: 'red' }] }), ['texts.0.size', 'texts.1.color']);
  assert.deepEqual(fields({ ...design, texts: [{ ...text, appear_ms: 3000, disappear_ms: 2000 }] }), ['texts.0.disappear_ms']);
  assert.deepEqual(fields({ ...design, texts: [{ ...text, x: 0.5, w: 0.8 }] }), ['texts.0.x']);
  assert.deepEqual(fields({ ...design, texts: [text, text, text, text, text] }), ['texts']);
  assert.equal(normalizeField('texts[2].template'), 'texts.2.template');
  assert.equal(normalizeField('texts.2.template'), 'texts.2.template');
  assert.equal(normalizeField(''), null);
  assert.equal(normalizeField(undefined), null);
  assert.equal(fieldTextIndex('texts.2.font'), 2);
  assert.equal(fieldTextIndex('video'), null);
});

test('an unsaved draft resolves with the library facts, so the preview plays exactly what OBS will', () => {
  const design = { ...newDesign('follow', readyVideo), sound: 14, texts: [{ ...defaultText('follow', 0), font: 'asset:7' }, defaultText('follow', 1)] };
  const resolved = resolveDraft(design, library);
  assert.ok(resolved);
  assert.deepEqual(resolved.video, { url: readyVideo.url, width: 800, height: 600, duration_ms: 6033, has_audio: true, has_alpha: true });
  assert.equal(resolved.image, null);
  assert.equal(resolved.sound?.url, readySound.url);
  assert.equal(resolved.texts[0].font, 'acosmic-font-7');
  assert.equal(resolved.texts[1].font, 'Poppins');
  assert.deepEqual(resolved.fonts, [{ family: 'acosmic-font-7', url: readyFont.url }]);
  assert.deepEqual([resolved.x, resolved.y, resolved.scale, resolved.volume, resolved.duration_ms], [960, 540, 1, 0.8, 6000]);
  // The draft itself is left as it was.
  assert.equal(design.texts[0].font, 'asset:7');
  // A file that is not ready, or gone, means there is nothing to preview.
  assert.equal(resolveDraft(design, library.filter((a) => a.id !== 7)), null);
  assert.equal(resolveDraft({ ...design, video: null, image: null }, library), null);
  assert.equal(resolveDraft(design, [{ ...readyVideo, status: 'queued', url: null }, readySound, readyFont]), null);
  // A picture is used only without a video.
  assert.equal(resolveDraft({ ...design, image: 13 }, library)?.image, null);
  assert.equal(resolveDraft({ ...design, video: null, image: 13 }, library)?.image?.url, readyImage.url);
  assert.equal(uploadedFontFamily(7), 'acosmic-font-7');
  assert.equal(fontAssetId('asset:7'), 7);
  assert.equal(fontAssetId('Poppins'), null);
  assert.equal(fontAssetId('asset:x'), null);
});

test('the listed fonts load from one Google Fonts stylesheet with styles they really have', () => {
  assert.equal(DESIGN_FONTS.length, 15);
  const href = googleFontsHref() ?? '';
  assert.ok(href.startsWith('https://fonts.googleapis.com/css2?family='));
  assert.match(href, /family=Playfair\+Display:ital,wght@0,400;0,700;1,400;1,700/);
  assert.match(href, /family=Press\+Start\+2P&/);
  assert.match(href, /&display=swap$/);
  assert.equal(href.match(/family=/g)?.length, 15);
  assert.equal(googleFontsHref(['Comic Sans']), null);
});

test('the media library says what each file is in plain words', () => {
  assert.equal(formatBytes(812345), '793 KB');
  assert.equal(formatBytes(4.2 * 1024 * 1024), '4.2 MB');
  assert.equal(formatBytes(300 * 1024 * 1024), '300 MB');
  assert.equal(formatBytes(null), '0 bytes');
  assert.equal(formatLength(6033), '6.0 s');
  assert.equal(formatLength(65000), '1:05');
  assert.equal(assetsWaiting([{ status: 'ready' }, { status: 'failed' }]), false);
  assert.equal(assetsWaiting([{ status: 'ready' }, { status: 'queued' }]), true);
  assert.equal(assetsWaiting([{ status: 'processing' }]), true);
  assert.equal(assetsWaiting(undefined), false);
  assert.equal(assetStatusText({ status: 'processing', error: null }), 'Converting…');
  assert.equal(assetStatusText({ status: 'failed', error: 'That video is longer than 30 seconds.' }), 'That video is longer than 30 seconds.');
  assert.equal(backgroundText(readyVideo), 'Transparent');
  assert.equal(backgroundText({ ...readyVideo, has_alpha: false }), 'Has a background');
  assert.equal(backgroundText(readySound), null);
  assert.equal(backgroundText({ ...readyVideo, status: 'queued' }), null);
  assert.equal(inUseText([]), null);
  assert.equal(inUseText(['follow']), 'Used by your Follow alert');
  assert.equal(inUseText(['follow', 'raid', 'sub']), 'Used by your Follow, Raid and New sub alerts');
  assert.equal(canRemoveBlack({ name: 'a.mov', type: 'video/quicktime' }), true);
  assert.equal(canRemoveBlack({ name: 'a.png', type: 'image/png' }), true);
  assert.equal(canRemoveBlack({ name: 'a.mp3', type: 'audio/mpeg' }), false);
  assert.equal(canRemoveBlack({ name: 'a.woff2', type: '' }), false);
});
