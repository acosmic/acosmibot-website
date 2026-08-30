import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), 'utf8');

const api = source('src/api/analytics.ts');
const guildPanel = source('src/features/better-embeds/BetterEmbedsUsagePanel.tsx');
const ownerPanel = source('src/pages/admin/AnalyticsTab.tsx');
const page = source('src/features/better-embeds/BetterEmbedsPage.tsx');
const css = source('src/styles/dashboard.css');

test('Better Embeds exposes bounded guild and owner aggregate endpoints', () => {
  assert.match(api, /\/api\/guilds\/\$\{guildId\}\/analytics\/better-embeds\?days=\$\{days\}/);
  assert.match(api, /\/api\/admin\/analytics\/better-embeds\?days=\$\{days\}/);
  assert.match(api, /tracking_started_at: string \| null/);
  assert.match(api, /completion_rate: number/);
});

test('server admins get a responsive usage ledger with explicit states and ranges', () => {
  assert.match(page, /<BetterEmbedsUsagePanel guildId=\{guildId!\} \/>/);
  assert.match(guildPanel, /const RANGE_OPTIONS = \[7, 30, 90\] as const/);
  assert.match(guildPanel, /Loading replacement activity/);
  assert.match(guildPanel, /Replacement activity is unavailable/);
  assert.match(guildPanel, /No supported links recorded in this range/);
  assert.match(guildPanel, /blocked_permissions/);
  assert.match(guildPanel, /retained for up to 400 days/);
  assert.doesNotMatch(guildPanel, /\b(?:user_id|channel_id|message_id|provider|url)\b/);
  assert.match(css, /\.better-embeds-usage__metrics/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.better-embeds-usage__details/);
});

test('owner analytics adds provider-resolution and cross-server health', () => {
  assert.match(ownerPanel, /analyticsApi\.globalBetterEmbeds\(embedsDays\)/);
  assert.match(ownerPanel, /Fallback resolutions/);
  assert.match(ownerPanel, /Unverified \/ probe errors/);
  assert.match(ownerPanel, /Top servers by replacements/);
  assert.match(ownerPanel, /Provider resolution/);
});
