import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/pages/admin/LiveActivityTab.tsx', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../src/pages/admin/AdminPage.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/admin.css', import.meta.url), 'utf8');

test('live activity is the owner landing view with independent filters', () => {
  assert.match(admin, /useState<AdminTab>\('live'\)/);
  assert.match(source, /Commands/);
  assert.match(source, /AI usage/);
  assert.match(source, /Website actions/);
  assert.match(source, /Errors only/);
  assert.match(source, /event\.outcome === 'error'/);
  assert.match(source, /admin-live-activity-errors-only/);
  assert.match(source, /event\.category === 'website' \? 'Website' : 'Direct \/ global'/);
  assert.match(source, /aria-pressed=\{active\}/);
});

test('feed exposes pause, fullscreen, live status, and a detail dialog', () => {
  assert.match(source, /Pause/);
  assert.match(source, /requestFullscreen/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /Error reason/);
  assert.match(source, /adminApi\.getAiTrace/);
  assert.match(source, /\/api\/admin\/logs/);
  assert.match(source, /Prompts & outputs/);
  assert.match(source, /Full trace payload/);
  assert.match(source, /Activity payload/);
});

test('mobile activity details stay viewport-bound with a reachable close control', () => {
  assert.match(styles, /\.live-detail__backdrop \{ position: fixed; inset: 0; z-index: 1000;/);
  assert.match(styles, /height: min\(82dvh, 680px\)/);
  assert.match(styles, /\.live-detail header \{ position: sticky;/);
  assert.match(source, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(source, /aria-label="Close activity diagnostics"/);
});
