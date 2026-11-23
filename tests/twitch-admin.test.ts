import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CHART_METRICS,
  DELETION_COPY,
  customBotLoginProblem,
  daySeries,
  defaultSelection,
  deletionView,
  describeApply,
  describePreview,
  formatMinutes,
  generalSettingsProblem,
  groupSynced,
  hasAnyValue,
  isSelectable,
  managerLoginProblem,
  niceMax,
  parseDay,
  parseLoginList,
  presetRange,
  previewBody,
  previewInputProblem,
  reconcileSelection,
  settingsCapabilities,
  sourceAllowsChannel,
  translatedText,
  type AnalyticsDay,
  type GeneralSettings,
  type ImportItem,
} from '../src/features/twitch/admin/model.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const item = (overrides: Partial<ImportItem> = {}): ImportItem => ({
  index: 0, kind: 'command', name: '!hi', status: 'ok', warnings: [], errors: [],
  translated: { name: '!hi', response: 'Hi $(user)' }, ...overrides,
});

const day = (value: string, overrides: Partial<AnalyticsDay> = {}): AnalyticsDay => ({
  day: value, messages: 0, unique_chatters: 0, commands_used: 0, new_followers: 0, subs: 0, gift_subs: 0, bits: 0,
  raids_received: 0, points_awarded: 0, points_spent: 0, stream_minutes: 0, peak_viewers: 0, song_requests: 0,
  moderation_actions: 0, ...overrides,
});

const general = (overrides: Partial<GeneralSettings> = {}): GeneralSettings => ({
  command_prefix: '!', timezone: 'UTC', silent: false, reply_style: 'mention', shared_chat_mode: 'ignore',
  ignore_known_bots: true, ignored_logins: [], max_messages_per_response: 2, ...overrides,
});

test('section registry: four admin sections in the channel group with the spec roles', () => {
  const source = read('src/features/twitch/admin/section.tsx');
  for (const [id, order, role] of [['managers', 10, 'broadcaster'], ['import', 20, 'editor'], ['analytics', 30, 'editor'],
    ['settings', 40, 'editor']] as const) {
    assert.match(source, new RegExp(`id: '${id}',[\\s\\S]*?group: 'channel',\\s*order: ${order},[\\s\\S]*?minRole: '${role}'`));
  }
  assert.doesNotMatch(source, /import \{[^}]*Page[^}]*\} from '\.\//, 'pages must load lazily');
});

test('admin pages never inject HTML', () => {
  for (const file of ['ManagersPage.tsx', 'ImportExportPage.tsx', 'AnalyticsPage.tsx', 'ChannelSettingsPage.tsx']) {
    assert.doesNotMatch(read(`src/features/twitch/admin/${file}`), /dangerouslySetInnerHTML|innerHTML/);
  }
});

test('manager and custom bot login checks', () => {
  assert.equal(managerLoginProblem('@NewMod', 'streamer'), null);
  assert.match(managerLoginProblem('', 'streamer') ?? '', /Enter/);
  assert.match(managerLoginProblem('bad name', 'streamer') ?? '', /1 to 25/);
  assert.match(managerLoginProblem('Streamer', 'streamer') ?? '', /own channel/);
  assert.equal(customBotLoginProblem('mybot', 'streamer', 'acosmibot'), null);
  assert.match(customBotLoginProblem('streamer', 'streamer', 'acosmibot') ?? '', /separate account/);
  assert.match(customBotLoginProblem('AcosmiBot', 'streamer', 'acosmibot') ?? '', /shared/);
  assert.match(customBotLoginProblem('x y', 'streamer', null) ?? '', /1 to 25/);
});

test('synced managers are grouped per user with the higher role', () => {
  const rows = groupSynced([
    { user_id: '2', login: 'zed', role: 'moderator', source: 'twitch_moderator', synced_at: null },
    { user_id: '1', login: 'amy', role: 'moderator', source: 'twitch_moderator', synced_at: null },
    { user_id: '1', login: 'amy', role: 'editor', source: 'twitch_editor', synced_at: null },
  ]);
  assert.deepEqual(rows.map((r) => [r.login, r.role, r.sources.length]), [['amy', 'editor', 2], ['zed', 'moderator', 1]]);
});

test('import selection rules: errors never, conflicts only when overwriting', () => {
  const items = [item(), item({ index: 1, status: 'warning' }), item({ index: 2, status: 'conflict' }),
    item({ index: 3, status: 'error', translated: null }), item({ index: 4, status: 'warning', translated: null })];
  assert.deepEqual(defaultSelection(items, 'skip'), [0, 1]);
  assert.deepEqual(defaultSelection(items, 'overwrite'), [0, 1, 2]);
  assert.equal(isSelectable(items[3], 'overwrite'), false);
  assert.equal(isSelectable(items[4], 'overwrite'), false);
  assert.deepEqual(reconcileSelection([0, 2, 3], items, 'skip'), [0]);
});

test('import input checks and request bodies', () => {
  assert.equal(sourceAllowsChannel('nightbot'), false);
  assert.equal(sourceAllowsChannel('streamelements'), true);
  assert.match(previewInputProblem('nightbot', 'channel', '', 'x') ?? '', /pasted/);
  assert.match(previewInputProblem('streamelements', 'channel', '', '../x') ?? '', /letters/);
  assert.equal(previewInputProblem('streamelements', 'channel', '', '@Streamer'), null);
  assert.match(previewInputProblem('nightbot', 'paste', '   ', '') ?? '', /Paste/);
  assert.match(previewInputProblem('nightbot', 'paste', 'x'.repeat(1_048_577), '') ?? '', /1 MB/);
  assert.deepEqual(previewBody('streamelements', 'channel', 'ignored', '@Streamer'),
    { source: 'streamelements', input_kind: 'channel', channel_login: 'streamer' });
  assert.deepEqual(previewBody('nightbot', 'paste', '[1]', 'ignored'), { source: 'nightbot', input_kind: 'paste', data: '[1]' });
});

test('import summaries describe only what happened', () => {
  assert.equal(describePreview({ total: 3, commands: 2, timers: 1, ok: 1, warning: 1, error: 1, conflict: 0, fetch_urls: 0 }),
    '3 items, 1 ready, 1 to check, 1 that cannot be imported.');
  assert.equal(describeApply({ created: 2, updated: 0, skipped: 1, failed: 0, builtins_disabled: [] }), '2 created, 1 skipped.');
  assert.equal(describeApply({ created: 0, updated: 0, skipped: 0, failed: 0, builtins_disabled: [] }), 'Nothing was imported.');
  assert.match(describeApply({ created: 1, updated: 0, skipped: 0, failed: 0, builtins_disabled: [], interrupted: true }), /stopped part way/);
  assert.equal(translatedText(item({ kind: 'timer', translated: { message: 'Follow!' } })), 'Follow!');
  assert.equal(translatedText(item({ translated: null })), '');
});

test('analytics day series keeps unrecorded days as gaps, not zeros', () => {
  const series = daySeries('2026-11-01', '2026-11-04', [day('2026-11-01', { messages: 5 }), day('2026-11-03', { messages: 0 })], 'messages');
  assert.deepEqual(series, [
    { day: '2026-11-01', value: 5 }, { day: '2026-11-02', value: null }, { day: '2026-11-03', value: 0 },
    { day: '2026-11-04', value: null }]);
  assert.equal(hasAnyValue(series), true);
  assert.equal(hasAnyValue(daySeries('2026-11-01', '2026-11-02', [], 'bits')), false);
  assert.deepEqual(daySeries('2026-11-05', '2026-11-01', [], 'bits'), []);
  assert.equal(daySeries('2025-01-01', '2026-12-31', [], 'bits').length, 400);     // never more than the API allows
});

test('analytics scale, ranges and formatting', () => {
  assert.equal(niceMax([null, 0]), 1);
  assert.equal(niceMax([3]), 5);
  assert.equal(niceMax([12, null]), 20);
  assert.equal(niceMax([100]), 100);
  assert.equal(niceMax([501]), 1000);
  assert.deepEqual(presetRange('7', new Date('2026-11-23T05:00:00Z')), { from: '2026-11-17', to: '2026-11-23' });
  assert.deepEqual(presetRange('30', new Date('2026-03-01T23:59:00Z')), { from: '2026-01-31', to: '2026-03-01' });
  assert.equal(parseDay('2026-02-30'), null);
  assert.equal(parseDay('2026-1-1'), null);
  assert.equal(formatMinutes(0), '0 min');
  assert.equal(formatMinutes(125), '2 h 5 min');
  assert.equal(formatMinutes(null), '—');
  assert.deepEqual(CHART_METRICS.map((m) => m.key).slice(0, 6),
    ['messages', 'unique_chatters', 'new_followers', 'subs', 'gift_subs', 'bits']);
});

test('general settings: ignored users parsing and validation', () => {
  assert.deepEqual(parseLoginList('@Nightbot, someone\nsomeone  bad-name'), { logins: ['nightbot', 'someone'], invalid: ['bad-name'] });
  assert.match(generalSettingsProblem(general(), 'ok bad-name') ?? '', /bad-name/);
  assert.equal(generalSettingsProblem(general(), 'a b c'), null);
  assert.match(generalSettingsProblem(general(), Array.from({ length: 101 }, (_, i) => `u${i}`).join(' ')) ?? '', /100/);
  assert.match(generalSettingsProblem(general({ command_prefix: '@' }), '') ?? '', /prefix/);
  assert.match(generalSettingsProblem(general({ timezone: '' }), '') ?? '', /time zone/);
});

test('deletion status: a 404 after removal means completed', () => {
  assert.equal(deletionView(null), 'none');
  assert.equal(deletionView({ request: null }), 'none');
  assert.equal(deletionView({ request: { id: 1, status: 'pending', created_at: null, completed_at: null } }), 'queued');
  assert.equal(deletionView({ request: { id: 1, status: 'running', created_at: null, completed_at: null } }), 'running');
  assert.equal(deletionView({ request: { id: 1, status: 'failed', created_at: null, completed_at: null } }), 'retrying');
  assert.equal(deletionView('not_found'), 'completed');
  assert.match(DELETION_COPY.completed, /deleted/);
});

test('settings capabilities follow the role (presentation only)', () => {
  assert.deepEqual(settingsCapabilities('moderator'), { editGeneral: false, broadcasterTools: false });
  assert.deepEqual(settingsCapabilities('editor'), { editGeneral: true, broadcasterTools: false });
  assert.deepEqual(settingsCapabilities('broadcaster'), { editGeneral: true, broadcasterTools: true });
});

test('reauth_required: data is kept, the purge time is stated, and Reconnect Acosmibot is the action', async () => {
  const { REAUTH_GRACE_DAYS, channelStatusView, reauthDetail, reauthReasonText } =
    await import('../src/features/twitch/shared/ui/channelStatus.ts');
  assert.equal(REAUTH_GRACE_DAYS, 7);
  const view = channelStatusView('reauth_required');
  assert.equal(view.tone, 'error');
  assert.match(view.detail, /kept for 7 days/);
  const detail = reauthDetail(
    { status_reason: 'token_revoked', reauth: { reason: 'user_removed', since: '2026-11-22T20:00:00.000Z', purge_after: '2026-11-29T20:00:00.000Z' } },
    (value) => (value === '2026-11-29T20:00:00.000Z' ? 'Nov 29' : null),
  );
  assert.equal(detail, `${reauthReasonText('user_removed')} Acosmibot has left the chat but kept this channel’s settings and data. `
    + 'Reconnect Acosmibot before Nov 29 to keep them; after that they are deleted.');
  assert.match(reauthDetail({ status_reason: 'token_revoked', reauth: null }, () => null), /within 7 days of losing access/);
  assert.match(reauthReasonText('authorization_revoked'), /disconnected/);
  assert.match(reauthReasonText(null), /no longer accepts/);

  const overview = readFileSync(new URL('../src/features/twitch/overview/OverviewPage.tsx', import.meta.url), 'utf8');
  assert.match(overview, /Reconnect Acosmibot/);
  const settings = readFileSync(new URL('../src/features/twitch/admin/ChannelSettingsPage.tsx', import.meta.url), 'utf8');
  assert.match(settings, /Reconnect Acosmibot/);
  assert.match(settings, /Only this button deletes right away/);
});
