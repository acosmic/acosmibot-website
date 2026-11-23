import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

import {
  SECTION_GROUPS,
  collectFromModules,
  findSection,
  groupSections,
  roleRank,
  sortPublicPages,
  validatePublicPages,
  validateSections,
} from '../src/features/twitch/registryUtils.ts';
import type { TwitchPublicPage, TwitchSection } from '../src/features/twitch/types.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const twitchDir = new URL('../src/features/twitch/', import.meta.url);

// Components are opaque to the registry; any truthy value stands in for a lazy page.
const page = { lazy: true } as unknown as TwitchSection['component'];
const icon = (() => null) as unknown as TwitchSection['icon'];

const section = (overrides: Partial<TwitchSection>): TwitchSection => ({
  id: 'example',
  label: 'Example',
  group: 'chat',
  order: 10,
  icon,
  minRole: 'moderator',
  component: page,
  ...overrides,
});

test('roleRank orders moderator < editor < broadcaster and treats no role as 0', () => {
  assert.equal(roleRank('moderator'), 1);
  assert.equal(roleRank('editor'), 2);
  assert.equal(roleRank('broadcaster'), 3);
  assert.equal(roleRank(null), 0);
  assert.equal(roleRank(undefined), 0);
  assert.equal(roleRank('owner' as never), 0);
});

test('validateSections keeps valid sections in input order', () => {
  const input = [section({ id: 'commands' }), section({ id: 'mod-log', group: 'moderation' })];
  const result = validateSections(input);
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.valid.map((entry) => entry.id), ['commands', 'mod-log']);
});

test('validateSections rejects duplicate ids, keeping the first registration', () => {
  const first = section({ id: 'timers', label: 'Timers' });
  const second = section({ id: 'timers', label: 'Other timers' });
  const result = validateSections([first, second]);
  assert.equal(result.valid.length, 1);
  assert.equal(result.valid[0], first);
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /"timers" is registered more than once/);
});

test('validateSections rejects ids that are not lowercase URL segments', () => {
  for (const id of ['Commands', 'chat/log', 'chat log', '', 'émotes', 'a_b']) {
    const result = validateSections([section({ id })]);
    assert.equal(result.valid.length, 0, `id ${JSON.stringify(id)} should be rejected`);
    assert.match(result.problems[0], /lowercase URL segment/);
  }
});

test('validateSections rejects unknown groups, roles, missing labels, orders and components', () => {
  const cases: Array<[Partial<TwitchSection>, RegExp]> = [
    [{ group: 'misc' as never }, /unknown group/],
    [{ minRole: 'owner' as never }, /unknown minRole/],
    [{ label: '  ' }, /no label/],
    [{ order: Number.NaN }, /no numeric order/],
    [{ component: undefined as never }, /no component/],
  ];
  for (const [overrides, pattern] of cases) {
    const result = validateSections([section(overrides)]);
    assert.equal(result.valid.length, 0);
    assert.match(result.problems[0], pattern);
  }
});

test('groupSections respects role ranks', () => {
  const sections = [
    section({ id: 'overview', group: 'overview', order: 0, minRole: 'moderator' }),
    section({ id: 'commands', group: 'chat', order: 10, minRole: 'moderator' }),
    section({ id: 'channel-points', group: 'stream', order: 20, minRole: 'editor' }),
    section({ id: 'managers', group: 'channel', order: 10, minRole: 'broadcaster' }),
  ];
  const ids = (role: Parameters<typeof groupSections>[1]) =>
    groupSections(sections, role).flatMap((group) => group.sections.map((entry) => entry.id));

  assert.deepEqual(ids('moderator'), ['overview', 'commands']);
  assert.deepEqual(ids('editor'), ['overview', 'commands', 'channel-points']);
  assert.deepEqual(ids('broadcaster'), ['overview', 'commands', 'channel-points', 'managers']);
  assert.deepEqual(groupSections(sections, null), []);
});

test('groupSections follows the §11.3 group order, sorts by order, and omits empty groups', () => {
  const sections = [
    section({ id: 'settings', group: 'channel', order: 40 }),
    section({ id: 'counters', group: 'chat', order: 50 }),
    section({ id: 'commands', group: 'chat', order: 10 }),
    section({ id: 'overview', group: 'overview', order: 0 }),
    section({ id: 'timers', group: 'chat', order: 20 }),
  ];
  const groups = groupSections(sections, 'broadcaster');
  assert.deepEqual(groups.map((group) => group.id), ['overview', 'chat', 'channel']);
  assert.equal(groups[0].label, null);
  assert.equal(groups[1].label, 'Chat');
  assert.deepEqual(groups[1].sections.map((entry) => entry.id), ['commands', 'timers', 'counters']);
  assert.deepEqual(SECTION_GROUPS.map((group) => group.id), ['overview', 'chat', 'moderation', 'community', 'stream', 'channel']);
});

test('findSection looks a section up by URL segment', () => {
  const sections = [section({ id: 'overview', group: 'overview' }), section({ id: 'commands' })];
  assert.equal(findSection(sections, 'commands')?.id, 'commands');
  assert.equal(findSection(sections, 'missing'), undefined);
  assert.equal(findSection(sections, undefined), undefined);
});

test('public pages are validated and sorted by order', () => {
  const pageComponent = page as unknown as TwitchPublicPage['component'];
  const pages: TwitchPublicPage[] = [
    { id: 'songs', label: 'Songs', order: 30, component: pageComponent },
    { id: 'commands', label: 'Commands', order: 10, component: pageComponent },
    { id: 'commands', label: 'Duplicate', order: 20, component: pageComponent },
    { id: 'Bad Id', label: 'Bad', order: 40, component: pageComponent },
  ];
  const result = validatePublicPages(pages);
  assert.equal(result.problems.length, 2);
  assert.deepEqual(sortPublicPages(result.valid).map((entry) => entry.id), ['commands', 'songs']);
});

test('a new slice folder reaches the sidebar through discovery alone', () => {
  // What `import.meta.glob('./*/section.tsx', { eager: true })` hands the registry.
  const modules = {
    './overview/section.tsx': { sections: [section({ id: 'overview', group: 'overview', order: 0 })] },
    './quotes-demo/section.tsx': { sections: [section({ id: 'quotes', label: 'Quotes', group: 'chat', order: 40 })] },
    './broken/section.tsx': { somethingElse: true },
  };
  const { valid, problems } = validateSections(collectFromModules<TwitchSection>(modules, 'sections'));
  assert.deepEqual(problems, []);
  const groups = groupSections(valid, 'moderator');
  assert.deepEqual(groups.map((group) => group.sections.map((entry) => entry.id)), [['overview'], ['quotes']]);
});

test('the registry discovers every <slice>/section.tsx and public.tsx by glob', () => {
  const registry = read('src/features/twitch/registry.ts');
  assert.match(registry, /import\.meta\.glob<\{ sections: TwitchSection\[\] \}>\('\.\/\*\/section\.tsx', \{ eager: true \}\)/);
  assert.match(registry, /import\.meta\.glob<\{ publicPages: TwitchPublicPage\[\] \}>\('\.\/\*\/public\.tsx', \{ eager: true \}\)/);
  assert.match(registry, /export const TWITCH_SECTIONS: TwitchSection\[\]/);
  assert.match(registry, /export const TWITCH_PUBLIC_PAGES: TwitchPublicPage\[\]/);
  assert.match(registry, /validateSections\(/);
});

test('the overview section is registered like any slice, with a lazy page', () => {
  const folders = readdirSync(twitchDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(new URL(`${entry.name}/section.tsx`, twitchDir)))
    .map((entry) => entry.name);
  assert.ok(folders.includes('overview'));

  const overview = read('src/features/twitch/overview/section.tsx');
  assert.match(overview, /export const sections: TwitchSection\[\] = \[/);
  assert.match(overview, /id: 'overview'/);
  assert.match(overview, /group: 'overview'/);
  assert.match(overview, /order: 0/);
  assert.match(overview, /minRole: 'moderator'/);
  assert.match(overview, /lazyRoute\(\(\) => import\('\.\/OverviewPage'\)/);
  assert.doesNotMatch(overview, /^import .*OverviewPage/m, 'section.tsx must not import the page eagerly');

  // Every discovered section file exports the metadata array the glob expects.
  for (const folder of folders) {
    assert.match(read(`src/features/twitch/${folder}/section.tsx`), /export const sections\b/, folder);
  }
});

test('the sidebar and shell route from the registry, not from hard-coded section lists', () => {
  const sidebar = read('src/features/twitch/shell/TwitchSidebar.tsx');
  const shell = read('src/features/twitch/shell/TwitchDashboardShell.tsx');
  assert.match(sidebar, /groupSections\(TWITCH_SECTIONS, role\)/);
  assert.match(shell, /findSection\(TWITCH_SECTIONS, sectionId\)/);
  for (const source of [sidebar, shell]) {
    for (const id of ['commands', 'timers', 'loyalty', 'giveaways', 'song-requests', 'managers']) {
      assert.doesNotMatch(source, new RegExp(`['"\`/]${id}['"\`]`), `${id} must come from the registry`);
    }
  }
});
