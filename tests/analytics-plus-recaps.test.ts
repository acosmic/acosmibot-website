import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), 'utf8');

const analyticsPage = source('src/features/analytics/GuildAnalyticsPage.tsx');
const entitlement = source('src/features/analytics/entitlement.ts');
const recapHook = source('src/features/analytics/useRecapConfig.ts');
const embedsPage = source('src/features/better-embeds/BetterEmbedsPage.tsx');
const pricingPage = source('src/pages/PremiumPage.tsx');

test('server analytics and recap controls are gated at Plus in the client', () => {
  assert.match(entitlement, /const ANALYTICS_TIERS = new Set\(\['plus', 'pro', 'max'/);
  assert.match(analyticsPage, /hasGuildAnalyticsAccess\(tier\)/);
  assert.match(analyticsPage, /enabled: !!guildId && hasAnalyticsAccess/);
  assert.match(analyticsPage, /<AnalyticsUpgrade guildId=\{guildId\} tier=\{tier\} \/>/);
  assert.match(analyticsPage, /if \(!guild \|\| tier === null\)/);
  assert.match(pricingPage, /7, 30 & 90-day server analytics/);
  assert.match(pricingPage, /Custom scheduled weekly recaps/);
});

test('weekly recap supports local delivery and six independently selected sections', () => {
  for (const field of ['weekday', 'post_time', 'timezone']) {
    assert.match(recapHook, new RegExp(`${field}:`));
  }
  for (const section of ['commands', 'reactions', 'channels', 'members', 'ai', 'social_embeds']) {
    assert.match(recapHook, new RegExp(`${section}:`));
  }
  assert.match(analyticsPage, /label="Recap channel"/);
  assert.match(analyticsPage, /id="recap-weekday"/);
  assert.match(analyticsPage, /type="time"/);
  assert.match(analyticsPage, /<TimezoneSelect/);
  assert.match(analyticsPage, /Choose at least one section to include in the recap/);
});

test('Better Social Embeds stays free while historical reporting is paid', () => {
  assert.match(embedsPage, /hasAnalytics \? \(/);
  assert.match(embedsPage, /<BetterEmbedsUsagePanel guildId=\{guildId!\} \/>/);
  assert.match(embedsPage, /Better Social Embeds themselves remain available on Free/);
  assert.match(embedsPage, /View Plus/);
});
