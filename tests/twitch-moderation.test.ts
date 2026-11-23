import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  EMPTY_TERM_DRAFT,
  FILTERS,
  badgeNames,
  chatLogQuery,
  describeActionError,
  describeLogAction,
  describeProtection,
  domainProblem,
  draftFromTerm,
  ladderProblem,
  modLogQuery,
  moderationProblem,
  normalizeDomain,
  ruleLabel,
  sameTermDraft,
  termInputFromDraft,
  termProblem,
  type BlockedTerm,
  type ModerationSettings,
} from '../src/features/twitch/moderation/model.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const dir = 'src/features/twitch/moderation';

const filter = (enabled: boolean, extra: Record<string, unknown> = {}) => ({ enabled, exempt_level: 400, reason: 'r', ...extra });

const settings = (overrides: Partial<ModerationSettings> = {}): ModerationSettings => ({
  enabled: true,
  warning_template: '$(user), $(reason).',
  warning_cooldown_s: 30,
  strike_window_s: 3600,
  ladder: [{ action: 'delete', duration_s: 0 }, { action: 'timeout', duration_s: 60 }],
  links: { ...filter(true), allowlist: ['twitch.tv'], permit_seconds: 60, block_bare_domains: true },
  caps: { ...filter(false), min_length: 15, max_percent: 70 },
  symbols: { ...filter(false), min_length: 15, max_percent: 50, max_consecutive: 15 },
  emotes: { ...filter(false), max_emotes: 15 },
  repetition: { ...filter(false), max_repeated_words: 8, max_repeated_chars: 20, duplicate_window_s: 30 },
  length: { ...filter(false), max_length: 350 },
  zalgo: { ...filter(true), max_marks_per_char: 2, max_total_marks: 10 },
  me: filter(false),
  mentions: { ...filter(true), max_mentions: 5 },
  scripts: { ...filter(false), min_length: 10, max_percent: 50 },
  blocked_terms_enabled: true,
  raid_protection: { enabled: false, min_viewers: 50, followers_only_minutes: 10, shield_mode: false, duration_s: 300 },
  follow_bot_protection: { enabled: false, follows_per_minute: 30, followers_only_minutes: 10, shield_mode: true, duration_s: 600 },
  ...overrides,
});

test('the /me filter stays hidden from the dashboard until verified', () => {
  assert.equal(FILTERS.some((meta) => (meta.key as string) === 'me'), false);
  assert.deepEqual(FILTERS.map((meta) => meta.key),
    ['links', 'length', 'caps', 'symbols', 'emotes', 'repetition', 'zalgo', 'mentions', 'scripts']);
});

test('domains are normalised and validated like the settings model', () => {
  assert.equal(normalizeDomain(' https://www.Example.com/path?q=1 '), 'www.example.com');
  assert.equal(normalizeDomain('example.com:443'), 'example.com');
  assert.equal(normalizeDomain('example.com.'), 'example.com');
  assert.equal(domainProblem('example.com'), null);
  assert.match(domainProblem('localhost') ?? '', /not a valid domain/);
  assert.match(domainProblem('') ?? '', /Enter a domain/);
});

test('ladder rules: 1 to 6 steps, ban only last, timeout bounds', () => {
  assert.equal(ladderProblem([{ action: 'delete', duration_s: 0 }, { action: 'ban', duration_s: 0 }]), null);
  assert.match(ladderProblem([{ action: 'ban', duration_s: 0 }, { action: 'delete', duration_s: 0 }]) ?? '', /last step/);
  assert.match(ladderProblem([]) ?? '', /at least one/);
  assert.match(ladderProblem(Array.from({ length: 7 }, () => ({ action: 'delete' as const, duration_s: 0 }))) ?? '', /at most 6/);
  assert.match(ladderProblem([{ action: 'timeout', duration_s: 0 }]) ?? '', /between 1 second and 14 days/);
});

test('form problems name the first invalid field', () => {
  assert.equal(moderationProblem(settings()), null);
  const bad = settings({ caps: { ...filter(true), min_length: 2, max_percent: 70 } });
  assert.match(moderationProblem(bad) ?? '', /Capital letters/);
  const badDomain = settings({ links: { ...settings().links, allowlist: ['nope'] } });
  assert.match(moderationProblem(badDomain) ?? '', /not a valid domain/);
});

test('blocked term drafts round-trip and validate', () => {
  const term: BlockedTerm = {
    id: 3, broadcaster_id: '1000', pattern: 'f*ck', match_type: 'wildcard', action: 'timeout', timeout_s: 300,
    exempt_level: 500, enabled: true, created_by_user_id: '456', created_at: null, updated_at: null,
  };
  const draft = draftFromTerm(term);
  assert.deepEqual(termInputFromDraft(draft), {
    pattern: 'f*ck', match_type: 'wildcard', action: 'timeout', timeout_s: 300, exempt_level: 500, enabled: true,
  });
  assert.equal(termInputFromDraft({ ...draft, action: 'delete' }).timeout_s, null);
  assert.ok(sameTermDraft(draft, draftFromTerm(term)));
  assert.match(termProblem(EMPTY_TERM_DRAFT) ?? '', /Enter the word/);
  assert.match(termProblem({ ...draft, pattern: 'x'.repeat(201) }) ?? '', /at most 200/);
  assert.match(termProblem({ ...draft, pattern: 'a*b*c*d*e*f*g' }) ?? '', /at most 5/);
  assert.match(termProblem({ ...draft, pattern: '**' }) ?? '', /every message/);
  assert.match(termProblem({ ...draft, timeout_s: 0 }) ?? '', /between 1 second/);
  assert.equal(termProblem(draft), null);
});

test('search queries are bounded and pick user id or login', () => {
  assert.deepEqual(chatLogQuery({ user: '@Viewer', text: ' hi ' }), { query: '?login=viewer&q=hi&limit=50', problem: null });
  assert.equal(chatLogQuery({ user: '12345', text: '' }).query, '?user_id=12345&limit=50');
  assert.match(chatLogQuery({ user: 'bad name', text: '' }).problem ?? '', /username or user id/);
  assert.match(chatLogQuery({ user: '', text: 'x'.repeat(101) }).problem ?? '', /100 characters/);
  assert.equal(chatLogQuery({ user: '', text: '', beforeId: 40 }).query, '?before_id=40&limit=50');
  assert.equal(modLogQuery({ action: 'timeout', userId: '1001', beforeId: 9 }),
    '?action=timeout&target_user_id=1001&before_id=9&limit=50');
});

test('descriptions', () => {
  assert.equal(describeLogAction({ action: 'timeout', duration_s: 600, strike: 2 }), 'Timeout 10m · strike 2');
  assert.equal(describeLogAction({ action: 'delete', duration_s: null, strike: null }), 'Deleted message');
  assert.equal(ruleLabel('blocked_term:12'), 'Blocked term');
  assert.equal(ruleLabel('links'), 'Links filter');
  assert.match(describeActionError('not_permitted'), /moderator/);
  assert.equal(describeProtection({ kind: 'shield', active: true, shield_mode: true, followers_only: false, errors: [] }),
    'Shield Mode is on.');
  assert.deepEqual(badgeNames('shared:vip/1,subscriber/12'), { shared: true, names: ['vip', 'subscriber'] });
});

test('section registration and safe rendering', () => {
  const section = read(`${dir}/section.tsx`);
  for (const id of ["id: 'moderation'", "id: 'mod-log'", "id: 'chat-log'"]) assert.ok(section.includes(id), id);
  assert.ok(section.includes("group: 'moderation'"));
  assert.ok(!/import\s+\{[^}]*\}\s+from\s+'\.\/(FiltersPage|ModLogPage|ChatLogPage)'/.test(section), 'pages load lazily');
  for (const file of ['FiltersPage.tsx', 'ModLogPage.tsx', 'ChatLogPage.tsx', 'UserDrawer.tsx']) {
    assert.ok(!read(`${dir}/${file}`).includes('dangerouslySetInnerHTML'), file);
  }
});
