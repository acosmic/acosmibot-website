import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const overview = await readFile(new URL('../src/features/overview/OverviewPage.tsx', import.meta.url), 'utf8');
const overviewHook = await readFile(new URL('../src/features/overview/useOverviewStats.ts', import.meta.url), 'utf8');
const moderation = await readFile(new URL('../src/features/moderation/ModerationPage.tsx', import.meta.url), 'utf8');
const customCommands = await readFile(new URL('../src/features/custom-commands/CustomCommandsPage.tsx', import.meta.url), 'utf8');
const reactionRoles = await readFile(new URL('../src/features/reaction-roles/ReactionRoleBuilderPage.tsx', import.meta.url), 'utf8');
const channelSelect = await readFile(new URL('../src/components/ui/ChannelSelect.tsx', import.meta.url), 'utf8');
const collapsibleSection = await readFile(new URL('../src/components/ui/CollapsibleSection.tsx', import.meta.url), 'utf8');
const dashboardCss = await readFile(new URL('../src/styles/dashboard.css', import.meta.url), 'utf8');

test('server overview uses earned containers instead of a card stack', () => {
  assert.doesNotMatch(overview, /className="card/);
  assert.match(overview, /className="overview-server-summary"/);
  assert.match(overview, /className="overview-metric-grid"/);
  assert.match(overview, /className="overview-analytics"/);
  assert.match(overview, /className="overview-link-rail"/);
});

test('overview failures are explicit, retryable, and never imply a confirmed subscription', () => {
  assert.match(overviewHook, /refetch: \(\) => Promise\.all/);
  assert.match(overview, /Some overview stats could not be loaded/);
  assert.match(overview, /memberFlow\.isError/);
  assert.match(overview, /Subscription status unavailable/);
  assert.match(overview, /rel="noopener noreferrer"/);
});

test('dashboard hardening preserves labels, section relationships, and touch targets', () => {
  assert.match(moderation, /htmlFor=\{switchId\}/g);
  assert.match(moderation, /role="switch"/g);
  assert.match(channelSelect, /htmlFor=\{selectId\}/);
  assert.match(collapsibleSection, /aria-controls=\{panelId\}/);
  assert.match(collapsibleSection, /<h2 className="control-section__heading">/);
  assert.match(dashboardCss, /\.dashboard-shell \.btn \{[\s\S]*?min-height: 44px;/);
});

test('legacy builder field groups no longer nest complete cards', () => {
  for (const source of [moderation, customCommands, reactionRoles]) {
    assert.match(source, /nested-control-group/);
  }
  assert.doesNotMatch(moderation, /card bg-tertiary p-3/);
  assert.doesNotMatch(customCommands, /className="card p-3" style=\{\{ background: 'var\(--bg-overlay\)'/);
  assert.doesNotMatch(reactionRoles, /className="card p-3 mb-3" style=\{\{ background: 'var\(--bg-tertiary\)'/);
});
