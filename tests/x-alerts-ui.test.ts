import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const api = await readFile(new URL('../src/api/xAlerts.ts', import.meta.url), 'utf8');
const apiClient = await readFile(new URL('../src/api/client.ts', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const sidebar = await readFile(new URL('../src/components/layout/Sidebar.tsx', import.meta.url), 'utf8');
const page = await readFile(new URL('../src/features/x-alerts/XAlertsPage.tsx', import.meta.url), 'utf8');
const pricing = await readFile(new URL('../src/pages/PremiumPage.tsx', import.meta.url), 'utf8');

test('X Alerts uses the dedicated API contract', () => {
  assert.match(api, /\/api\/guilds\/\$\{guildId\}\/x-alerts/);
  assert.match(api, /method: 'PUT'/);
  assert.match(api, /\/api\/x\/validate-username/);
  assert.match(api, /validateUsername: \(guildId: string, username: string\)/);
  assert.match(api, /guild_id: guildId/);
  assert.match(page, /validateUsername\(guildId, candidate\)/);
  assert.match(api, /user_id: string/);
  assert.match(apiClient, /'\/x-alerts'/);
});

test('X Alerts has a dedicated dashboard route and navigation item', () => {
  assert.match(app, /feature === 'x-alerts'/);
  assert.match(app, /<XAlertsPage \/>/);
  assert.match(sidebar, /\/x-alerts`} icon=\{AtSign\} label="X Posts"/);
});

test('X Alerts preserves downgrade priority and filters noisy post types', () => {
  assert.match(page, /Move the accounts that should keep delivering to the top/);
  assert.match(page, /the rest stay saved but suspended/);
  assert.match(page, /Replies and reposts are skipped/);
  assert.match(page, /original and quote posts/);
  assert.match(page, /priority: index/);
  assert.match(page, /form\.enabled && form\.channel_id/);
  assert.match(page, /'ready'/);
  assert.match(page, /formRef\.current/);
  assert.match(page, /aria-describedby=/);
  assert.match(page, /Saved capacity/);
  assert.match(page, /capacity is full/);
});

test('pricing communicates the paid X account limits', () => {
  assert.match(pricing, /X post alerts require Plus/);
  assert.match(pricing, /1 X account for post alerts/);
  assert.equal((pricing.match(/3 X accounts for post alerts/g) ?? []).length, 2);
});
