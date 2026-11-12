import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../src/pages/AICreditsPage.tsx', import.meta.url), 'utf8');
const client = await readFile(new URL('../src/api/aiCredits.ts', import.meta.url), 'utf8');
const billing = await readFile(new URL('../src/features/billing/BillingPage.tsx', import.meta.url), 'utf8');
const docs = await readFile(new URL('../public/docs/views/ai-credits-view.html', import.meta.url), 'utf8');
const aiDocs = await readFile(new URL('../public/docs/views/ai-view.html', import.meta.url), 'utf8');

const RETIRED_COPY = /\b(fallback|guild|consent|policy|guardrails?|overage|temporary hold)\b/i;

const visibleText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&lt;|&gt;/g, ' ');

test('the retired member-wide switches are gone from the wallet', () => {
  assert.doesNotMatch(page, /allow_guild_spending|allow_dm_spending/);
  assert.doesNotMatch(client, /allow_guild_spending|allow_dm_spending/);
  assert.doesNotMatch(page, /Allow guild fallback|Enable guild fallback|master guardrail|Allow DM spending/);
});

test('each server gets one "Use my credits in <server>" switch that saves on its own', () => {
  assert.match(page, /useQueries\(/);
  assert.match(page, /guilds\.map\(\(guild\) => \(\{\s*queryKey: \['ai-credits', 'consent', guild\.id\]/);
  assert.match(page, /label=\{`Use my credits in \$\{guild\.name\}`\}/);
  assert.match(page, /consentMutation\.mutate\(\{ guildId: guild\.id, guildName: guild\.name, enabled: checked \}\)/);
  assert.doesNotMatch(page, /guildFallbackRequired/);
});

test('the wallet explains the spending order in plain words', () => {
  assert.match(
    page,
    /In a server, its included AI allowance is used first, then the server’s credits, then your own credits if you switched them on for that server below\./,
  );
});

test('DM wording follows the platform flags instead of a member switch', () => {
  assert.match(page, /personal\?\.dm_enabled \?\? catalogQuery\.data\?\.dm_enabled/);
  assert.match(page, /In your Discord DMs, AI requests use your own credits\./);
  assert.match(page, /Your own credits can’t be used in Discord DMs yet\./);
});

test('the wallet explains when platform spending is paused', () => {
  assert.match(page, /!personal\.spending_enabled/);
  assert.match(page, /AI Credit spending is currently paused/);
});

test('server billing shows the credit switches on unless stored off', () => {
  assert.match(billing, /server_pool_enabled: policyBoolean\(policy\?\.server_pool_enabled, true\)/);
  assert.match(billing, /personal_fallback_allowed: policyBoolean\(policy\?\.personal_fallback_allowed, true\)/);
  for (const operation of ['chat', 'tool_chat', 'image_generation', 'image_analysis']) {
    assert.match(billing, new RegExp(`${operation}: policyBoolean\\(policy\\?\\.allowed_operations\\?\\.${operation}, true\\)`));
  }
  assert.match(billing, /Nothing is spent until someone buys credits\./);
  assert.match(billing, /Members may use their own credits here/);
});

test('user-facing wallet and docs copy avoids the retired jargon', () => {
  const pageCopy = [...page.matchAll(/>([^<>{}]+)</g)].map((match) => match[1]).join(' ');
  assert.doesNotMatch(pageCopy, RETIRED_COPY);
  const fundingSection = docs.slice(docs.indexOf('How a request is paid for'), docs.indexOf('Allowance renewal and status'));
  assert.doesNotMatch(visibleText(fundingSection), RETIRED_COPY);
  assert.doesNotMatch(docs, /global guild-spending switch|guild fallback|DM spending/);
  assert.doesNotMatch(aiDocs, /global guild-spending switch|guild fallback|DM spending is enabled/);
});
