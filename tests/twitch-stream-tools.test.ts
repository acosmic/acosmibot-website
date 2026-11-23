import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  BINDING_ACTIONS,
  COMMERCIAL_LENGTHS,
  EMPTY_BINDING_DRAFT,
  EMPTY_QUOTE_DRAFT,
  EMPTY_REWARD_DRAFT,
  bindingInput,
  bindingProblem,
  counterNameProblem,
  counterValueProblem,
  describeBinding,
  describePage,
  describeShoutout,
  draftFromBinding,
  draftFromReward,
  normalizeCounterName,
  oneLine,
  parseCounterValue,
  quoteInputFromDraft,
  quoteProblem,
  quoteQuery,
  rewardCreateInput,
  rewardItemKey,
  rewardItemTitle,
  rewardPatch,
  rewardProblem,
  streamInfoChanges,
  titleProblem,
  type Binding,
  type Reward,
  type RewardItem,
} from '../src/features/twitch/stream-tools/model.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const reward = (overrides: Partial<Reward> = {}): Reward => ({
  id: 'r1', title: 'Hydrate', prompt: '', cost: 250, background_color: '#9147FF', is_enabled: true, is_paused: false,
  is_in_stock: true, is_user_input_required: false, should_redemptions_skip_request_queue: false,
  max_per_stream: { is_enabled: false, max_per_stream: 0 },
  max_per_user_per_stream: { is_enabled: true, max_per_user_per_stream: 2 },
  global_cooldown: { is_enabled: false, global_cooldown_seconds: 0 }, image_url: null, ...overrides,
});

const binding = (overrides: Partial<Binding> = {}): Binding => ({
  id: 1, reward_id: 'r1', reward_title: 'Hydrate', managed: true, action: 'counter',
  action_config: { name: 'water', op: '+1' }, auto_fulfill: true, enabled: true, created_at: null, updated_at: null, ...overrides,
});

// ── quotes ───────────────────────────────────────────────────────────────
test('oneLine collapses whitespace and strips control and bidi characters', () => {
  assert.equal(oneLine('  a\n\tb ‮ c​ '), 'a b c');
});

test('a quote draft becomes a one-line input with empty optional fields as null', () => {
  assert.deepEqual(quoteInputFromDraft({ text: ' never   give up ', quoted_name: ' ', category_name: 'Chess' }),
    { text: 'never give up', quoted_name: null, category_name: 'Chess' });
});

test('quoteProblem enforces the 400, 64 and 100 character bounds and the leading slash rule', () => {
  assert.equal(quoteProblem({ ...EMPTY_QUOTE_DRAFT, text: 'ok' }), null);
  assert.match(quoteProblem(EMPTY_QUOTE_DRAFT) ?? '', /Write the quote/);
  assert.equal(quoteProblem({ ...EMPTY_QUOTE_DRAFT, text: 'x'.repeat(400) }), null);
  assert.match(quoteProblem({ ...EMPTY_QUOTE_DRAFT, text: 'x'.repeat(401) }) ?? '', /at most 400/);
  assert.match(quoteProblem({ ...EMPTY_QUOTE_DRAFT, text: '/ban someone' }) ?? '', /slash/);
  assert.match(quoteProblem({ text: 'ok', quoted_name: 'n'.repeat(65), category_name: '' }) ?? '', /64/);
  assert.match(quoteProblem({ text: 'ok', quoted_name: '', category_name: 'c'.repeat(101) }) ?? '', /100/);
});

test('quoteQuery builds a bounded offset query and drops an empty search', () => {
  assert.equal(quoteQuery('', 0), '?offset=0&limit=50');
  assert.equal(quoteQuery('  cats  and dogs ', 2), '?q=cats+and+dogs&offset=100&limit=50');
  assert.equal(quoteQuery('a'.repeat(300), 0).match(/q=(a+)/)?.[1].length, 100);
  assert.equal(quoteQuery('x', -3), '?q=x&offset=0&limit=50');
});

test('describePage reports the visible range', () => {
  assert.equal(describePage(0, 50, 50, 120), '1–50 of 120');
  assert.equal(describePage(2, 50, 20, 120), '101–120 of 120');
  assert.equal(describePage(0, 50, 0, 0), 'No results');
});

// ── counters ─────────────────────────────────────────────────────────────
test('counter names are lowercase letters, numbers, dash and underscore up to 40', () => {
  assert.equal(normalizeCounterName('  Deaths '), 'deaths');
  assert.equal(counterNameProblem('Deaths'), null);
  assert.equal(counterNameProblem('boss-kills_2'), null);
  assert.equal(counterNameProblem('a'.repeat(40)), null);
  assert.match(counterNameProblem('a'.repeat(41)) ?? '', /up to 40/);
  assert.match(counterNameProblem('bad name') ?? '', /Use letters/);
  assert.match(counterNameProblem('x.y') ?? '', /Use letters/);
  assert.match(counterNameProblem('  ') ?? '', /Give the counter a name/);
});

test('counter values are whole numbers within 1e15', () => {
  assert.equal(parseCounterValue('42'), 42);
  assert.equal(parseCounterValue(' -7 '), -7);
  assert.equal(parseCounterValue('1000000000000000'), 1e15);
  assert.equal(parseCounterValue('1000000000000001'), null);
  assert.equal(parseCounterValue('1.5'), null);
  assert.equal(parseCounterValue('1e3'), null);
  assert.equal(parseCounterValue(''), null);
  assert.equal(counterValueProblem('5'), null);
  assert.match(counterValueProblem('abc') ?? '', /whole number/);
});

// ── stream tools ─────────────────────────────────────────────────────────
test('titleProblem allows 1 to 140 characters', () => {
  assert.equal(titleProblem('Playing chess'), null);
  assert.equal(titleProblem('t'.repeat(140)), null);
  assert.match(titleProblem('t'.repeat(141)) ?? '', /at most 140/);
  assert.match(titleProblem('   ') ?? '', /cannot be empty/);
});

test('streamInfoChanges sends only what changed', () => {
  const saved = { title: 'Old', category_id: '10' };
  assert.deepEqual(streamInfoChanges(saved, 'Old', null), {});
  assert.deepEqual(streamInfoChanges(saved, 'Old', { id: '10' }), {});
  assert.deepEqual(streamInfoChanges(saved, ' New   title ', null), { title: 'New title' });
  assert.deepEqual(streamInfoChanges(saved, 'Old', { id: '20' }), { category_id: '20' });
  assert.deepEqual(streamInfoChanges(saved, 'New', { id: '20' }), { title: 'New', category_id: '20' });
});

test('describeShoutout covers every combination', () => {
  assert.match(describeShoutout({ sent: true, native: true }), /chat and sent with Twitch/);
  assert.match(describeShoutout({ sent: true, native: false }), /did not send its own/);
  assert.match(describeShoutout({ sent: false, native: true }), /chat message was not delivered/);
  assert.match(describeShoutout({ sent: false, native: false }), /Nothing was sent/);
});

test('commercial lengths are the six Twitch values', () => {
  assert.deepEqual([...COMMERCIAL_LENGTHS], [30, 60, 90, 120, 150, 180]);
});

// ── rewards ──────────────────────────────────────────────────────────────
test('draftFromReward shows limits only when they are on', () => {
  const draft = draftFromReward(reward());
  assert.equal(draft.cost, '250');
  assert.equal(draft.max_per_stream, '');
  assert.equal(draft.max_per_user_per_stream, '2');
  assert.equal(draft.global_cooldown_seconds, '');
});

test('rewardProblem checks title, cost, prompt, colour and limits', () => {
  const ok = { ...EMPTY_REWARD_DRAFT, title: 'Hydrate' };
  assert.equal(rewardProblem(ok), null);
  assert.match(rewardProblem({ ...ok, title: ' ' }) ?? '', /title/);
  assert.match(rewardProblem({ ...ok, title: 'x'.repeat(46) }) ?? '', /45/);
  assert.match(rewardProblem({ ...ok, cost: '0' }) ?? '', /cost/);
  assert.match(rewardProblem({ ...ok, cost: '1000000001' }) ?? '', /cost/);
  assert.match(rewardProblem({ ...ok, cost: '1.5' }) ?? '', /cost/);
  assert.match(rewardProblem({ ...ok, prompt: 'p'.repeat(201) }) ?? '', /200/);
  assert.match(rewardProblem({ ...ok, background_color: 'red' }) ?? '', /hex/);
  assert.equal(rewardProblem({ ...ok, background_color: '#00e5cb' }), null);
  assert.match(rewardProblem({ ...ok, max_per_stream: '0' }) ?? '', /limit per stream/);
  assert.match(rewardProblem({ ...ok, global_cooldown_seconds: '604801' }) ?? '', /cooldown/);
  assert.equal(rewardProblem({ ...ok, max_per_stream: '5', global_cooldown_seconds: '60' }), null);
});

test('rewardCreateInput sends numbers and leaves empty limits out', () => {
  assert.deepEqual(rewardCreateInput({ ...EMPTY_REWARD_DRAFT, title: ' Hydrate ', cost: '250', max_per_stream: '5' }), {
    title: 'Hydrate', cost: 250, prompt: '', is_enabled: true, is_user_input_required: false,
    should_redemptions_skip_request_queue: false, max_per_stream: 5,
  });
});

test('rewardPatch sends changed fields and null to remove a limit', () => {
  const saved = draftFromReward(reward());
  assert.deepEqual(rewardPatch(saved, saved), {});
  assert.deepEqual(rewardPatch({ ...saved, cost: '500', title: 'Drink' }, saved), { cost: 500, title: 'Drink' });
  assert.deepEqual(rewardPatch({ ...saved, max_per_user_per_stream: '' }, saved), { max_per_user_per_stream: null });
  assert.deepEqual(rewardPatch({ ...saved, max_per_stream: '3' }, saved), { max_per_stream: 3 });
  assert.deepEqual(rewardPatch({ ...saved, is_enabled: false }, saved), { is_enabled: false });
  assert.deepEqual(rewardPatch({ ...saved, background_color: '' }, saved), {});
});

test('rewards list helpers cope with a reward that no longer exists on Twitch', () => {
  const gone: RewardItem = { reward: null, manageable: false, binding: binding({ reward_id: 'gone', reward_title: 'Old reward' }) };
  assert.equal(rewardItemKey(gone), 'gone');
  assert.equal(rewardItemTitle(gone), 'Old reward');
  const live: RewardItem = { reward: reward(), manageable: true, binding: null };
  assert.equal(rewardItemKey(live), 'r1');
  assert.equal(rewardItemTitle(live), 'Hydrate');
});

// ── bindings ─────────────────────────────────────────────────────────────
test('every action in the table has a label and description, and matches the API actions', () => {
  assert.deepEqual(BINDING_ACTIONS.map((action) => action.value),
    ['chat_message', 'song_request', 'add_points', 'counter', 'queue_join', 'sound']);
  for (const action of BINDING_ACTIONS) {
    assert.ok(action.label.length > 0 && action.description.length > 0);
  }
});

test('draftFromBinding round-trips each action config', () => {
  assert.deepEqual(draftFromBinding(null), EMPTY_BINDING_DRAFT);
  const counter = draftFromBinding(binding());
  assert.equal(counter.counter_name, 'water');
  assert.equal(counter.counter_op, '+1');
  assert.deepEqual(bindingInput(counter, true).action_config, { name: 'water', op: '+1' });
  const points = draftFromBinding(binding({ action: 'add_points', action_config: { amount: 75 } }));
  assert.deepEqual(bindingInput(points, true).action_config, { amount: 75 });
  const sound = draftFromBinding(binding({ action: 'sound', action_config: { sound_url: 'https://x.example/a.mp3' } }));
  assert.deepEqual(bindingInput(sound, true).action_config, { sound_url: 'https://x.example/a.mp3' });
  const message = draftFromBinding(binding({ action: 'chat_message', action_config: { template: 'hi $(user)' } }));
  assert.deepEqual(bindingInput(message, true).action_config, { template: 'hi $(user)' });
  assert.deepEqual(bindingInput(draftFromBinding(binding({ action: 'song_request', action_config: {} })), true).action_config, {});
});

test('an unmanaged reward never auto-fulfils', () => {
  const draft = { ...EMPTY_BINDING_DRAFT, auto_fulfill: true };
  assert.equal(bindingInput(draft, true).auto_fulfill, true);
  assert.equal(bindingInput(draft, false).auto_fulfill, false);
});

test('bindingProblem validates each action', () => {
  assert.equal(bindingProblem({ ...EMPTY_BINDING_DRAFT, action: 'song_request' }), null);
  assert.equal(bindingProblem({ ...EMPTY_BINDING_DRAFT, action: 'queue_join' }), null);
  assert.match(bindingProblem({ ...EMPTY_BINDING_DRAFT, template: '  ' }) ?? '', /Write the message/);
  assert.match(bindingProblem({ ...EMPTY_BINDING_DRAFT, template: 'x'.repeat(501) }) ?? '', /500/);
  const points = { ...EMPTY_BINDING_DRAFT, action: 'add_points' as const };
  assert.equal(bindingProblem({ ...points, amount: '1000000' }), null);
  assert.match(bindingProblem({ ...points, amount: '0' }) ?? '', /1 to 1,000,000/);
  assert.match(bindingProblem({ ...points, amount: '1000001' }) ?? '', /1 to 1,000,000/);
  assert.match(bindingProblem({ ...points, amount: '2.5' }) ?? '', /1 to 1,000,000/);
  const counter = { ...EMPTY_BINDING_DRAFT, action: 'counter' as const, counter_name: 'deaths' };
  assert.equal(bindingProblem(counter), null);
  assert.equal(bindingProblem({ ...counter, counter_op: 'reset' }), null);
  assert.equal(bindingProblem({ ...counter, counter_op: '=-5' }), null);
  assert.match(bindingProblem({ ...counter, counter_op: 'banana' }) ?? '', /\+n/);
  assert.match(bindingProblem({ ...counter, counter_name: 'bad name' }) ?? '', /Use letters/);
  const sound = { ...EMPTY_BINDING_DRAFT, action: 'sound' as const };
  assert.equal(bindingProblem({ ...sound, sound_url: 'https://cdn.example.com/a.mp3' }), null);
  assert.match(bindingProblem({ ...sound, sound_url: '' }) ?? '', /Enter the sound link/);
  assert.match(bindingProblem({ ...sound, sound_url: 'http://cdn.example.com/a.mp3' }) ?? '', /https/);
  assert.match(bindingProblem({ ...sound, sound_url: 'javascript:alert(1)' }) ?? '', /https/);
  assert.match(bindingProblem({ ...sound, sound_url: 'https://user:pw@cdn.example.com/a.mp3' }) ?? '', /password/);
  assert.match(bindingProblem({ ...sound, sound_url: 'not a url' }) ?? '', /https/);
});

test('describeBinding names the action and flags a disabled one', () => {
  assert.equal(describeBinding(null), 'No action');
  assert.equal(describeBinding(binding()), 'Change a counter');
  assert.equal(describeBinding(binding({ enabled: false })), 'Change a counter (off)');
});

// ── registration and safety ──────────────────────────────────────────────
test('the slice registers the four sections and the public quotes page, with allowed groups and roles', () => {
  const sections = read('src/features/twitch/stream-tools/section.tsx');
  for (const [id, group, order, role] of [
    ['quotes', 'chat', 40, 'moderator'], ['counters', 'chat', 50, 'moderator'],
    ['stream-tools', 'stream', 10, 'moderator'], ['channel-points', 'stream', 20, 'editor'],
  ] as const) {
    const block = sections.slice(sections.indexOf(`id: '${id}'`));
    assert.ok(sections.includes(`id: '${id}'`), id);
    assert.match(block, new RegExp(`group: '${group}',\\s+order: ${order},[\\s\\S]*?minRole: '${role}'`), id);
  }
  assert.match(read('src/features/twitch/stream-tools/public.tsx'), /id: 'quotes'/);
});

test('slice pages never render raw HTML', () => {
  for (const file of ['QuotesPage', 'CountersPage', 'StreamToolsPage', 'ChannelPointsPage', 'PublicQuotesPage']) {
    assert.doesNotMatch(read(`src/features/twitch/stream-tools/${file}.tsx`), /dangerouslySetInnerHTML/);
  }
});
