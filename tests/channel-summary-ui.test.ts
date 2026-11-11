import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const toolConfig = await readFile(new URL('../src/features/ai/useAiConfig.ts', import.meta.url), 'utf8');
const adminApi = await readFile(new URL('../src/api/admin.ts', import.meta.url), 'utf8');
const subscriptionsApi = await readFile(new URL('../src/api/subscriptions.ts', import.meta.url), 'utf8');
const adminSettings = await readFile(new URL('../src/pages/admin/AiSettingsTab.tsx', import.meta.url), 'utf8');
const pricing = await readFile(new URL('../src/pages/PremiumPage.tsx', import.meta.url), 'utf8');

test('channel summary is present in the website AI catalog and limit contracts', () => {
  assert.match(toolConfig, /'channel_summary'/);
  assert.match(toolConfig, /label: 'Channel Summaries'/);
  assert.match(toolConfig, /bounded recent history from the current Discord channel within the monthly summary allowance/);
  assert.match(toolConfig, /BASIC_AI_TOOLS[\s\S]*'channel_summary'/);
  assert.match(adminApi, /channel_summary_monthly_limit\??: number;/);
  assert.match(subscriptionsApi, /channel_summary_monthly_limit\?: number;/g);
});

test('owner summary limits normalize legacy API responses and explain the monthly quota', () => {
  // Fallbacks for older API payloads must match core TIER_LIMITS (2026-11-11).
  assert.match(adminSettings, /CHANNEL_SUMMARY_DEFAULTS[\s\S]*free: 3,[\s\S]*plus: 10,[\s\S]*pro: 100,[\s\S]*max: 300/);
  assert.match(adminSettings, /WEB_SEARCH_DEFAULTS[\s\S]*free: 10,[\s\S]*plus: 30,[\s\S]*pro: 50,[\s\S]*max: 100/);
  assert.match(adminSettings, /free_tier_daily_spend_usd/);
  assert.match(adminSettings, /normalizeChannelSummaryLimit/);
  assert.match(adminSettings, /Fresh channel summaries per month/);
  assert.match(adminSettings, /channel_summary_monthly_limit/);
});

test('pricing advertises the AI quotas of every plan and omits missing legacy or zero values', () => {
  assert.doesNotMatch(pricing, /def\.tier === 'pro' \|\| def\.tier === 'max'/);
  assert.match(pricing, /web_search_monthly_limit/);
  assert.match(pricing, /value !== '0'/);
  assert.match(pricing, /channel_summary_monthly_limit/);
  assert.match(pricing, /fresh channel summaries\/month/);
  assert.match(pricing, /formatQuotaValue/);
  assert.match(pricing, /value !== null/);
});
