import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('a bot install lands on that server dashboard; plain logins keep the old flow', async () => {
  const app = await read('src/App.tsx');
  assert.match(app, /get\('guild'\)/);
  assert.match(app, /\/\^\\d\{1,20\}\$\/\.test\(installedGuild\)/);
  assert.match(app, /dest = `\/server\/\$\{installedGuild\}\/overview`/);
  assert.match(app, /localStorage\.getItem\('postLoginRedirect'\)/);
});

test('every plan can choose where AI chat replies', async () => {
  const page = await read('src/features/ai/AiPage.tsx');
  const freeBranch = page.slice(page.indexOf('if (!hasAccess) {'), page.indexOf('const activePersonality'));
  assert.match(freeBranch, /<AiChannelScopeSection/);
  for (const field of ['channel_mode', 'allowed_channels', 'excluded_channels']) {
    assert.match(freeBranch, new RegExp(`${field}: form\\.${field}`));
  }
});

test('giveaways read as on when a server has no stored giveaway settings', async () => {
  const api = await read('src/api/giveaway.ts');
  assert.match(api, /enabled: raw\?\.enabled \?\? true/);
});

test('Live Activity names why an AI turn was blocked', async () => {
  const tab = await read('src/pages/admin/LiveActivityTab.tsx');
  for (const reason of ['ai_disabled_guild', 'ai_disabled_global', 'channel_out_of_scope', 'daily_limit', 'monthly_limit', 'free_spend_ceiling', 'cooldown']) {
    assert.match(tab, new RegExp(`${reason}: '`));
  }
  assert.match(tab, /label: `Blocked · \$\{blocked\}`/);
  assert.match(tab, /<dt>Blocked reason<\/dt>/);
});
