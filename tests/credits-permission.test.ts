import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../src/pages/AICreditsPage.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/styles/ai-credits.css', import.meta.url), 'utf8');

test('server personal-credit consent requires the saved global fallback guardrail', () => {
  assert.match(page, /guildFallbackRequired = consentEnabled && !savedGuildFallbackEnabled/);
  assert.match(page, /consentQuery\.isLoading \|\| guildFallbackRequired/);
  assert.match(page, /Allow guild fallback is required/);
  assert.match(page, /Enable guild fallback/);
});

test('the required global fallback control receives a non-color-only warning state', () => {
  assert.match(page, /attentionMessage=\{guildFallbackAttention\}/);
  assert.match(page, /Required by the selected “Use my credits” server permission below/);
  assert.match(styles, /\.credits-policy-switch\.needs-attention/);
  assert.match(styles, /\.credits-policy-switch__attention/);
});

test('the wallet explains when platform spending is paused', () => {
  assert.match(page, /!personal\.spending_enabled/);
  assert.match(page, /AI Credit spending is currently paused/);
});
