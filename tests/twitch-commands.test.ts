import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  COMMAND_LIMITS,
  describeCommand,
  draftProblems,
  emptyDraft,
  filterCommands,
  fromDefaultDraft,
  fromDraft,
  isValidName,
  issueMessages,
  keywordWords,
  parseAliases,
  parseBuiltinAliases,
  sameDraft,
  templateIssuesFrom,
  toDefaultDraft,
  toDraft,
  withPrefix,
  type Command,
  type DefaultCommandState,
} from '../src/features/twitch/commands/model.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const label = (level: number) => ({ 0: 'Everyone', 300: 'Subscribers', 500: 'Moderators', 1000: 'Broadcaster only' } as Record<number, string>)[level] ?? `Level ${level}`;

const command: Command = {
  id: 7, name: '!discord', aliases: ['!dc'], match_mode: 'trigger', response: 'Join us', send_mode: 'say',
  announce_color: null, level: 0, global_cooldown_s: 5, user_cooldown_s: 15, cost: 0, availability: 'always',
  hidden: false, enabled: true, use_count: 12, description: null, source: 'dashboard', created_at: null, updated_at: null,
};

test('names follow COMMAND_NAME_PATTERN', () => {
  assert.equal(isValidName('!discord'), true);
  assert.equal(isValidName('hello'), true);
  assert.equal(isValidName('#good-morning'), true);
  assert.equal(isValidName('!Café'), true);
  assert.equal(isValidName('!two words'), false);
  assert.equal(isValidName('!!double'), false);
  assert.equal(isValidName(`!${'a'.repeat(49)}`), false);
  assert.equal(isValidName(''), false);
});

test('aliases are parsed, lowercased and de-duplicated', () => {
  assert.deepEqual(parseAliases('!DC, !dc  !server,,', '!discord'), ['!dc', '!server']);
  assert.deepEqual(parseAliases('!discord, !x', '!discord'), ['!x']);
  assert.deepEqual(parseBuiltinAliases('!Up, up online cmds', 'uptime'), ['up', 'online', 'cmds']);
  assert.deepEqual(parseBuiltinAliases('!uptime', 'uptime'), []);
  assert.deepEqual(keywordWords('!good-morning'), ['good', 'morning']);
});

test('draft round trip and normalisation', () => {
  const draft = toDraft(command);
  assert.equal(sameDraft(draft, toDraft(command)), true);
  assert.deepEqual(fromDraft({ ...draft, name: ' !Discord ', aliasesText: '!DC, !discord', description: '  ' }), {
    name: '!discord', aliases: ['!dc'], match_mode: 'trigger', response: 'Join us', send_mode: 'say', announce_color: null,
    level: 0, global_cooldown_s: 5, user_cooldown_s: 15, cost: 0, availability: 'always', hidden: false, enabled: true,
    description: null,
  });
  const announce = fromDraft({ ...draft, send_mode: 'announce', announce_color: 'green' });
  assert.equal(announce.announce_color, 'green');
  const keyword = fromDraft({ ...draft, match_mode: 'keyword', name: 'good-morning' });
  assert.deepEqual(keyword.aliases, []);
  assert.equal(emptyDraft('?').name, '?');
});

test('client problems mirror the API refusals', () => {
  const base = { ...emptyDraft(), name: '!x', response: 'hi' };
  assert.deepEqual(draftProblems(base), {});
  assert.ok(draftProblems({ ...base, name: '!bad name' }).name);
  assert.ok(draftProblems({ ...base, response: '/ban someone' }).response?.includes('/'));
  assert.ok(draftProblems({ ...base, response: '   .me waves' }).response);
  assert.ok(draftProblems({ ...base, response: '' }).response);
  assert.ok(draftProblems({ ...base, response: 'x'.repeat(COMMAND_LIMITS.responseMax + 1) }).response);
  assert.ok(draftProblems({ ...base, aliasesText: Array.from({ length: 11 }, (_, i) => `!a${i}`).join(',') }).aliases);
  assert.ok(draftProblems({ ...base, global_cooldown_s: 86_401 }).global_cooldown_s);
  assert.ok(draftProblems({ ...base, cost: 1_000_001 }).cost);
  assert.ok(draftProblems({ ...base, match_mode: 'keyword', name: '!' }).name);
});

test('the preview spells out trigger, level, cooldown and cost', () => {
  const preview = describeCommand({ ...fromDraft(toDraft(command)), level: 300, cost: 50 }, label, 'gems');
  assert.equal(preview.trigger, 'Runs when a chat message starts with !discord or !dc.');
  assert.equal(preview.who, 'Subscribers and everyone above them can use it.');
  assert.equal(preview.cooldown, 'Waits 5 seconds between uses in the channel, and 15 seconds between uses by the same viewer.');
  assert.equal(preview.cost, 'Costs 50 gems per use, refunded if the command fails.');
  assert.equal(preview.when, 'Works whether or not the stream is live.');
  const keyword = describeCommand({ ...fromDraft(toDraft(command)), match_mode: 'keyword', name: 'good-morning', aliases: [],
    global_cooldown_s: 0, user_cooldown_s: 0, availability: 'online', send_mode: 'announce', announce_color: 'blue' }, label);
  assert.equal(keyword.trigger, 'Runs when a chat message contains the words “good morning” anywhere.');
  assert.match(keyword.cooldown, /at least 30 seconds/);
  assert.equal(keyword.when, 'Works only while the stream is live.');
  assert.equal(keyword.how, 'Acosmibot posts it as an announcement (blue).');
  assert.equal(describeCommand({ ...fromDraft(toDraft(command)), level: 1000 }, label).who, 'Only the broadcaster can use it.');
  assert.equal(describeCommand({ ...fromDraft(toDraft(command)), global_cooldown_s: 0, user_cooldown_s: 0 }, label).cooldown,
    'No cooldown: it can run on every message.');
});

test('server template issues become field messages', () => {
  const details = { templates: [{ field: 'response', issues: [{ code: 'leading_slash', message: 'No slash.', severity: 'error' }] }] };
  assert.deepEqual(templateIssuesFrom(details, 'response').map((i) => i.code), ['leading_slash']);
  assert.deepEqual(templateIssuesFrom(details, 'other'), []);
  assert.deepEqual(templateIssuesFrom(undefined, 'response'), []);
  assert.deepEqual(issueMessages([{ code: 'a', message: 'Bad.', severity: 'error' }, { code: 'b', message: 'Hmm.', severity: 'warning' }]),
    ['Bad.', 'Note: Hmm.']);
});

test('built-in overrides send null for default values', () => {
  const state: DefaultCommandState = {
    key: 'uptime', trigger: 'uptime', module: 'commands', usage: '!uptime', description: 'How long the stream has been live.',
    defaults: { level: 0, global_cooldown_s: 5, user_cooldown_s: 15, cost: 0, aliases: [], response: '$(channel) has been live for $(uptime).' },
    override: null,
    effective: { enabled: true, level: 0, global_cooldown_s: 5, user_cooldown_s: 15, cost: 0, aliases: [] },
  };
  const draft = toDefaultDraft(state);
  assert.deepEqual(fromDefaultDraft(state, draft), {
    enabled: true, level: null, global_cooldown_s: null, user_cooldown_s: null, cost: null, aliases: [], response_override: null,
  });
  assert.deepEqual(fromDefaultDraft(state, { ...draft, level: 500, aliasesText: '!up', response: ' Live: $(uptime) ' }), {
    enabled: true, level: 500, global_cooldown_s: null, user_cooldown_s: null, cost: null, aliases: ['up'],
    response_override: 'Live: $(uptime)',
  });
  const noTemplate = { ...state, defaults: { ...state.defaults, response: null } };
  assert.equal(fromDefaultDraft(noTemplate, { ...draft, response: 'x' }).response_override, null);
});

test('prefix substitution and search', () => {
  assert.equal(withPrefix('!so <user>', '?'), '?so <user>');
  assert.equal(withPrefix('!command add|edit <name>', '!'), '!command add|edit <name>');
  assert.deepEqual(filterCommands([command, { ...command, id: 8, name: '!rules', aliases: [], response: 'Be kind' }], 'kind').map((c) => c.id), [8]);
  assert.deepEqual(filterCommands([command], 'dc').map((c) => c.id), [7]);
});

test('section and public page register lazily without unsafe HTML', () => {
  const section = read('src/features/twitch/commands/section.tsx');
  assert.match(section, /id: 'commands'/);
  assert.match(section, /group: 'chat'/);
  assert.match(section, /order: 10/);
  assert.match(section, /lazyRoute\(\(\) => import\('\.\/CommandsPage'\)/);
  const publicPage = read('src/features/twitch/commands/public.tsx');
  assert.match(publicPage, /id: 'commands'/);
  assert.match(publicPage, /lazyRoute\(\(\) => import\('\.\/PublicCommandsPage'\)/);
  for (const file of ['CommandsPage.tsx', 'CustomCommandsTab.tsx', 'CommandEditor.tsx', 'DefaultCommandsTab.tsx',
    'RegularsTab.tsx', 'CommandSettingsTab.tsx', 'PublicCommandsPage.tsx', 'CommandPreview.tsx']) {
    assert.doesNotMatch(read(`src/features/twitch/commands/${file}`), /dangerouslySetInnerHTML/, file);
  }
});
