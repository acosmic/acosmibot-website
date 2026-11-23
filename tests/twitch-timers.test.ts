import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  ALERTS,
  EMPTY_GROUP_DRAFT,
  EMPTY_TIMER_DRAFT,
  RAID_SHOUTOUT_VARS,
  TIMER_LIMITS,
  alertChanged,
  describeRunFailure,
  describeSchedule,
  draftFromGroup,
  draftFromTimer,
  groupInputFromDraft,
  groupProblem,
  parseCategories,
  timerInputFromDraft,
  timerProblem,
  type AlertTemplate,
  type Timer,
  type TimerGroup,
} from '../src/features/twitch/timers-alerts/model.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const dir = 'src/features/twitch/timers-alerts';

const timer = (overrides: Partial<Timer> = {}): Timer => ({
  id: 1, broadcaster_id: '1000', group_id: null, name: 'Socials', message: 'Follow me', send_mode: 'say',
  announce_color: null, interval_s: 900, min_chat_lines: 5, availability: 'online', category_filter_json: null,
  enabled: true, sort_order: 0, last_sent_at: null, created_at: null, updated_at: null, ...overrides,
});

const group = (overrides: Partial<TimerGroup> = {}): TimerGroup => ({
  id: 4, broadcaster_id: '1000', name: 'Rotation', interval_s: 1200, min_chat_lines: 3, availability: 'always',
  category_filter_json: ['Chess'], rotation: 'random', enabled: true, last_sent_at: null, created_at: null,
  updated_at: null, ...overrides,
});

test('parseCategories splits lines and commas, trims and drops duplicates ignoring case', () => {
  assert.deepEqual(parseCategories(' Chess, just chatting\n\n509658 ,CHESS '), ['Chess', 'just chatting', '509658']);
  assert.deepEqual(parseCategories(''), []);
});

test('a timer round-trips through its draft and the API input', () => {
  const original = timer({ send_mode: 'announce', announce_color: 'purple', category_filter_json: ['Chess', '509658'], group_id: 4 });
  const input = timerInputFromDraft(draftFromTimer(original));
  assert.equal(input.announce_color, 'purple');
  assert.deepEqual(input.category_filter, ['Chess', '509658']);
  assert.equal(input.group_id, 4);
  assert.equal(input.interval_s, 900);
});

test('say mode sends no colour and an empty category box means any category', () => {
  const input = timerInputFromDraft({ ...EMPTY_TIMER_DRAFT, name: ' a ', message: 'x', announce_color: 'green' });
  assert.equal(input.announce_color, null);
  assert.equal(input.category_filter, null);
  assert.equal(input.name, 'a');
});

test('group input carries rotation and conditions', () => {
  const input = groupInputFromDraft(draftFromGroup(group()));
  assert.deepEqual(input, {
    name: 'Rotation', interval_s: 1200, min_chat_lines: 3, availability: 'always', category_filter: ['Chess'],
    rotation: 'random', enabled: true,
  });
});

test('timerProblem mirrors the API bounds', () => {
  const ok = { ...EMPTY_TIMER_DRAFT, name: 'a', message: 'hi' };
  assert.equal(timerProblem(ok), null);
  assert.match(timerProblem({ ...ok, name: '  ' }) ?? '', /name/);
  assert.match(timerProblem({ ...ok, name: 'x'.repeat(TIMER_LIMITS.nameMax + 1) }) ?? '', /40/);
  assert.match(timerProblem({ ...ok, message: '' }) ?? '', /message/);
  assert.match(timerProblem({ ...ok, message: 'x'.repeat(1001) }) ?? '', /1000/);
  assert.match(timerProblem({ ...ok, message: '/ban all' }) ?? '', /cannot start/);
  assert.match(timerProblem({ ...ok, message: ' .disconnect' }) ?? '', /cannot start/);
  assert.match(timerProblem({ ...ok, interval_s: 299 }) ?? '', /interval/);
  assert.match(timerProblem({ ...ok, interval_s: 86_401 }) ?? '', /interval/);
  assert.match(timerProblem({ ...ok, min_chat_lines: 1001 }) ?? '', /Chat lines/);
  assert.match(timerProblem({ ...ok, categories: Array.from({ length: 21 }, (_, i) => `c${i}`).join('\n') }) ?? '', /20/);
  assert.match(timerProblem({ ...ok, categories: 'y'.repeat(101) }) ?? '', /100/);
  assert.equal(timerProblem({ ...ok, interval_s: 300 }), null);
});

test('groupProblem needs a name and valid conditions', () => {
  assert.match(groupProblem(EMPTY_GROUP_DRAFT) ?? '', /name/);
  assert.equal(groupProblem({ ...EMPTY_GROUP_DRAFT, name: 'g' }), null);
  assert.match(groupProblem({ ...EMPTY_GROUP_DRAFT, name: 'g', interval_s: 60 }) ?? '', /interval/);
});

test('describeSchedule summarises the conditions', () => {
  const describe = (s: number) => `${s / 60} minutes`;
  assert.equal(describeSchedule(timer(), describe), 'Every 15 minutes, 5+ chat lines, while live');
  assert.equal(
    describeSchedule(timer({ min_chat_lines: 0, availability: 'offline', category_filter_json: ['Chess'] }), describe),
    'Every 15 minutes, while offline, in Chess',
  );
  assert.equal(
    describeSchedule(timer({ min_chat_lines: 0, availability: 'always', category_filter_json: ['a', 'b'] }), describe),
    'Every 15 minutes, in 2 categories',
  );
});

test('run failures read as sentences', () => {
  assert.match(describeRunFailure('silent'), /silent mode/);
  assert.match(describeRunFailure('weird_reason'), /weird_reason/);
  assert.match(describeRunFailure(null), /not sent/);
});

test('alert cards cover every alert once with its context names', () => {
  assert.deepEqual(ALERTS.map((alert) => alert.key), [
    'follow', 'sub', 'resub', 'gift_sub', 'community_gift', 'cheer', 'raid',
    'hype_train_begin', 'hype_train_end', 'redemption', 'ad_break_begin', 'ad_break_end',
  ]);
  assert.deepEqual(ALERTS.filter((alert) => alert.minLabel).map((alert) => alert.key), ['resub', 'community_gift', 'cheer', 'raid']);
  assert.ok(ALERTS.every((alert) => alert.testable));
});

test('alert context names match the core variable catalogue when the sibling checkout exists', () => {
  const path = new URL('../../acosmibot-core/acosmibot_core/twitch_bot/variables_catalog.py', import.meta.url);
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  const names = (key: string): string[] => {
    const match = text.match(new RegExp(`"${key}":\\s*\\(([^)]*)\\)`));
    assert.ok(match, `catalogue entry for ${key}`);
    return [...match[1].matchAll(/"([a-z_]+)"/g)].map((entry) => entry[1]);
  };
  for (const alert of ALERTS) {
    if (alert.key === 'ad_break_end' && !text.includes('chat_alerts.ad_break_end.template')) continue;
    assert.deepEqual(alert.vars, names(`chat_alerts.${alert.key}.template`), alert.key);
  }
  assert.deepEqual([...RAID_SHOUTOUT_VARS], names('chat_alerts.raid_shoutout_template'));
});

test('alertChanged compares every editable field', () => {
  const base: AlertTemplate = { enabled: true, template: 'a', min_amount: 0, send_mode: 'say', announce_color: 'primary' };
  assert.equal(alertChanged(base, { ...base }), false);
  assert.equal(alertChanged(base, { ...base, template: 'b' }), true);
  assert.equal(alertChanged(base, { ...base, min_amount: 5 }), true);
  assert.equal(alertChanged(base, { ...base, send_mode: 'announce' }), true);
  assert.equal(alertChanged(undefined, base), true);
});

test('sections register Timers and Chat alerts for moderators in the chat group', () => {
  const source = read(`${dir}/section.tsx`);
  assert.match(source, /id: 'timers'/);
  assert.match(source, /id: 'chat-alerts'/);
  assert.equal((source.match(/group: 'chat'/g) ?? []).length, 2);
  assert.equal((source.match(/minRole: 'moderator'/g) ?? []).length, 2);
  assert.match(source, /lazyRoute\(\(\) => import\('\.\/TimersPage'\)/);
  assert.match(source, /lazyRoute\(\(\) => import\('\.\/ChatAlertsPage'\)/);
});

test('the pages render text nodes only and use the shared building blocks', () => {
  for (const file of ['TimersPage.tsx', 'ChatAlertsPage.tsx']) {
    const source = read(`${dir}/${file}`);
    assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
    assert.match(source, /from '\.\.\/shared\/ui'/);
  }
  assert.match(read(`${dir}/TimersPage.tsx`), /RecordTable/);
  assert.match(read(`${dir}/TimersPage.tsx`), /EditorDrawer/);
  assert.match(read(`${dir}/ChatAlertsPage.tsx`), /useSectionSettings/);
  assert.match(read(`${dir}/ChatAlertsPage.tsx`), /SettingsSaveBar/);
  assert.match(read(`${dir}/ChatAlertsPage.tsx`), /TemplateField/);
  assert.match(read(`${dir}/ChatAlertsPage.tsx`), /Send test/);
});
