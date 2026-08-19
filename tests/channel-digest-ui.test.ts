import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const toolConfig = await readFile(new URL('../src/features/ai/useAiConfig.ts', import.meta.url), 'utf8');
const adminApi = await readFile(new URL('../src/api/admin.ts', import.meta.url), 'utf8');
const subscriptionsApi = await readFile(new URL('../src/api/subscriptions.ts', import.meta.url), 'utf8');
const adminSettings = await readFile(new URL('../src/pages/admin/AiSettingsTab.tsx', import.meta.url), 'utf8');
const pricing = await readFile(new URL('../src/pages/PremiumPage.tsx', import.meta.url), 'utf8');

test('channel digest is present in the website AI catalog and limit contracts', () => {
  assert.match(toolConfig, /'channel_digest'/);
  assert.match(toolConfig, /label: 'Channel Digests'/);
  assert.match(toolConfig, /bounded recent history from the current Discord channel on Pro and Max servers/);
  assert.match(adminApi, /channel_digest_monthly_limit\??: number;/);
  assert.match(subscriptionsApi, /channel_digest_monthly_limit\?: number;/g);
});

test('owner digest limits normalize legacy API responses and explain the monthly quota', () => {
  assert.match(adminSettings, /free: 0,[\s\S]*plus: 0,[\s\S]*pro: 100,[\s\S]*max: 300/);
  assert.match(adminSettings, /normalizeChannelDigestLimit/);
  assert.match(adminSettings, /Fresh channel digests per month/);
  assert.match(adminSettings, /channel_digest_monthly_limit/);
});

test('pricing advertises digest quota only for Pro and Max and omits missing legacy values', () => {
  assert.match(pricing, /def\.tier === 'pro' \|\| def\.tier === 'max'/);
  assert.match(pricing, /channel_digest_monthly_limit/);
  assert.match(pricing, /fresh channel digests\/month/);
  assert.match(pricing, /formatQuotaValue/);
  assert.match(pricing, /value !== null/);
});
