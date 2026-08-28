import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

const [
  activityMonitor,
  betterEmbeds,
  billing,
  embedBuilder,
  embedsList,
  games,
  goodDeeds,
  heist,
  giveaway,
  polymorph,
  reactionRoleBuilder,
  reactionRolesList,
  streaming,
  dashboardCss,
  billingCss,
] = await Promise.all([
  readSource('../src/features/activity-monitor/ActivityMonitorPage.tsx'),
  readSource('../src/features/better-embeds/BetterEmbedsPage.tsx'),
  readSource('../src/features/billing/BillingPage.tsx'),
  readSource('../src/features/embeds/EmbedBuilderPage.tsx'),
  readSource('../src/features/embeds/EmbedsListPage.tsx'),
  readSource('../src/features/games/GamesPage.tsx'),
  readSource('../src/features/games/GoodDeedsSection.tsx'),
  readSource('../src/features/games/HeistSection.tsx'),
  readSource('../src/features/giveaway/GiveawayPage.tsx'),
  readSource('../src/features/polymorph/PolymorphPage.tsx'),
  readSource('../src/features/reaction-roles/ReactionRoleBuilderPage.tsx'),
  readSource('../src/features/reaction-roles/ReactionRolesListPage.tsx'),
  readSource('../src/features/streaming/StreamPlatformFeature.tsx'),
  readSource('../src/styles/dashboard.css'),
  readSource('../src/features/billing/BillingPage.css'),
]);

test('configuration workflows use one perimeter or an open section instead of stacked cards', () => {
  for (const source of [activityMonitor, betterEmbeds, goodDeeds, heist, giveaway, polymorph]) {
    assert.match(source, /dashboard-(?:workflow-ledger|workflow-section|open-section)|feature-toggle-ledger/);
  }

  assert.doesNotMatch(goodDeeds, /className="card/);
  assert.doesNotMatch(heist, /className="card/);
  assert.doesNotMatch(polymorph, /className="card/);
  assert.doesNotMatch(streaming, /className={`card/);
  assert.doesNotMatch(games, /className="card p-4 mb-4"/);
});

test('saved collections share a ledger perimeter instead of wrapping every row in a card', () => {
  for (const source of [activityMonitor, embedsList, giveaway, reactionRolesList]) {
    assert.match(source, /dashboard-record-ledger/);
    assert.match(source, /dashboard-record-row/);
  }
});

test('streaming uses the shared social roster instead of nested record cards', () => {
  assert.match(streaming, /<SocialAlertRecord/);
  assert.match(streaming, /<SocialAlertsPanel/);
  assert.doesNotMatch(streaming, /dashboard-record-ledger/);
  assert.doesNotMatch(streaming, /className={`card/);
});

test('builders keep preview artifacts bordered while their editors use open or tonal groups', () => {
  assert.match(embedBuilder, /<div className="card p-4">/);
  assert.match(embedBuilder, /dashboard-open-section/);
  assert.match(embedBuilder, /nested-control-group/);

  assert.match(reactionRoleBuilder, /<div className="card p-4">/);
  assert.match(reactionRoleBuilder, /dashboard-open-section/);
  assert.doesNotMatch(reactionRoleBuilder, /className="card p-4 mb-4"/);
});

test('billing summaries use segmented metrics while plan choices remain distinct objects', () => {
  assert.match(billing, /billing-summary-grid/);
  assert.match(billing, /dashboard-open-section/);
  assert.match(billingCss, /\.billing-summary-grid/);
  assert.match(billingCss, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(billing, /className="p-3 rounded bg-tertiary border border-light h-100 d-flex flex-column gap-3"/);
});

test('shared earned-container primitives keep one border at the parent level', () => {
  assert.match(dashboardCss, /\.dashboard-workflow-ledger,[\s\S]*?border: 1px solid var\(--border-light\)/);
  assert.match(dashboardCss, /\.dashboard-record-ledger \{[\s\S]*?gap: 1px/);
  assert.match(dashboardCss, /\.dashboard-workflow-section \+ \.dashboard-workflow-section \{[\s\S]*?border-top:/);
  assert.match(dashboardCss, /\.feature-toggle-ledger \.feature-toggle \{[\s\S]*?border: 0/);
});
