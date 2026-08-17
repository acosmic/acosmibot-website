import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const guildAnalytics = await readFile(
  new URL('../src/features/analytics/GuildAnalyticsPage.tsx', import.meta.url),
  'utf8',
);
const adminAnalytics = await readFile(
  new URL('../src/pages/admin/AnalyticsTab.tsx', import.meta.url),
  'utf8',
);
const analyticsApi = await readFile(
  new URL('../src/api/analytics.ts', import.meta.url),
  'utf8',
);

test('server analytics renders activity without owner-only cost data', () => {
  assert.doesNotMatch(guildAnalytics, /total_cost|total_tokens|Total cost|fmtCost/);

  const guildContract = analyticsApi.match(
    /export interface GuildAiUsage \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(guildContract);
  assert.doesNotMatch(guildContract, /total_cost|total_tokens|by_model/);
});

test('owner admin analytics retains the AI cost breakdown', () => {
  assert.match(adminAnalytics, /Total cost/);
  assert.match(adminAnalytics, /s\.total_tokens/);
  assert.match(adminAnalytics, /s\.total_cost/);
});
