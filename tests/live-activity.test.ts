import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/pages/admin/LiveActivityTab.tsx', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../src/pages/admin/AdminPage.tsx', import.meta.url), 'utf8');

test('live activity is the owner landing view with independent filters', () => {
  assert.match(admin, /useState<AdminTab>\('live'\)/);
  assert.match(source, /Commands/);
  assert.match(source, /AI usage/);
  assert.match(source, /Website actions/);
  assert.match(source, /event\.category === 'website' \? 'Website' : 'Direct \/ global'/);
  assert.match(source, /aria-pressed=\{active\}/);
});

test('feed exposes pause, fullscreen, live status, and a detail dialog', () => {
  assert.match(source, /Pause/);
  assert.match(source, /requestFullscreen/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /role="dialog"/);
});
