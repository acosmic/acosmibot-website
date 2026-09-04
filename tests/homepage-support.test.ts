import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const homepage = readFileSync(`${testDir}../src/pages/HomePage.tsx`, 'utf8');

test('homepage support dialog uses the live Stripe donation link', () => {
  assert.match(homepage, /https:\/\/donate\.stripe\.com\/bJe3co1sfayvcMD16xgnK00/);
  assert.match(homepage, /className="method-name">Stripe</);
  assert.match(homepage, /Choose a one-time amount; no public attribution/);
  assert.doesNotMatch(homepage, /paypal\.com/i);
});
