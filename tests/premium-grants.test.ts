import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const adminPage = await readFile(new URL('../src/pages/admin/AdminPage.tsx', import.meta.url), 'utf8');
const grants = await readFile(new URL('../src/pages/admin/PremiumGrantsTab.tsx', import.meta.url), 'utf8');
const billing = await readFile(new URL('../src/features/billing/BillingPage.tsx', import.meta.url), 'utf8');
const guildSelect = await readFile(new URL('../src/pages/GuildSelectPage.tsx', import.meta.url), 'utf8');
const api = await readFile(new URL('../src/api/admin.ts', import.meta.url), 'utf8');

test('owner console exposes the complete premium-grant lifecycle', () => {
  assert.match(adminPage, /id: 'grants'/);
  assert.match(grants, /Grant complimentary access/);
  assert.match(grants, /Edit \/ extend/);
  assert.match(grants, /Revoke/);
  assert.match(grants, /Restore/);
  assert.match(grants, /active.*scheduled.*expired.*revoked/s);
  assert.match(grants, /Never shown to server administrators/);
});

test('grant selector uses the unpaginated owner-only server options endpoint', () => {
  assert.match(api, /\/api\/admin\/guild-options/);
  assert.doesNotMatch(api, /getGuildOptions:[\s\S]*guilds\?limit=100/);
});

test('normal surfaces label complimentary access without Stripe renewal copy', () => {
  assert.match(billing, /Complimentary \$\{TIER_LABELS\[tier\]\}/);
  assert.match(billing, /No Stripe renewal/);
  assert.match(billing, /does not renew through Stripe/);
  assert.match(guildSelect, /Complimentary \$\{PREMIUM_TIER_LABELS\[tier\]\}/);
});

test('admin mutations invalidate both grant and guild entitlement queries', () => {
  assert.match(grants, /invalidateQueries\(\{ queryKey: \['admin', 'premium-grants'\] \}\)/);
  assert.match(grants, /invalidateQueries\(\{ queryKey: \['guild'\] \}\)/);
  assert.match(grants, /invalidateQueries\(\{ queryKey: \['guilds'\] \}\)/);
  assert.match(grants, /invalidateQueries\(\{ queryKey: \['user', 'guilds'\] \}\)/);
});
