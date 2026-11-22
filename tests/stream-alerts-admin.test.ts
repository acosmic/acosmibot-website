import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const admin = read('src/pages/admin/AdminPage.tsx');
const tab = read('src/pages/admin/StreamAlertsTab.tsx');
const api = read('src/api/admin.ts');
const overlay = read('public/stream-overlay/effects.html');
const hosting = JSON.parse(read('public/staticwebapp.config.json'));

test('stream alerts is an owner admin tab', () => {
  assert.match(admin, /id: 'stream', label: 'Stream Alerts'/);
  assert.match(admin, /tab === 'stream' && \(\s*<div className="admin-surface">\s*<StreamAlertsTab \/>/);
});

test('every alert the overlay draws can be previewed and sent from the dashboard', () => {
  const overlayKinds = [...overlay.matchAll(/^    (\w+): \{ kicker: /gm)].map((match) => match[1]).sort();
  const dashboardKinds = [...tab.matchAll(/\{ type: '(\w+)', label: /g)].map((match) => match[1]).sort();
  assert.deepEqual(dashboardKinds, overlayKinds);
  assert.deepEqual(dashboardKinds, ['cheer', 'donation', 'follow', 'gift', 'hypetrain', 'raid', 'resub', 'sub']);
  for (const kind of dashboardKinds) assert.match(api, new RegExp(`'${kind}'`));
  assert.match(tab, /Send to OBS/);
  assert.match(tab, /Replay in OBS/);
  assert.match(tab, /adminApi\.fireStreamAlert/);
  assert.match(tab, /adminApi\.replayStreamAlert/);
});

test('the preview frame loads the hosted overlay without connecting to anything', () => {
  assert.match(tab, /src="\/stream-overlay\/effects\.html\?offline=1"/);
  assert.match(overlay, /GENERATED COPY/);
  assert.match(overlay, /window\.AcosmicFX = /);
});

test('only the overlay path may be framed, and only by this site', () => {
  assert.equal(hosting.globalHeaders['X-Frame-Options'], 'DENY');
  const route = hosting.routes.find((item: { route: string }) => item.route === '/stream-overlay/*');
  assert.ok(route);
  assert.match(route.headers['Content-Security-Policy'], /frame-ancestors 'self'/);
  assert.equal(route.headers['X-Robots-Tag'], 'noindex, nofollow');
});

test('dashboard calls stay on the owner-only admin API', () => {
  for (const path of ['status', 'recent', 'test', 'replay']) assert.match(api, new RegExp(`/api/admin/stream-alerts/${path}`));
  assert.doesNotMatch(tab, /Bearer|overlay key value|STREAM_ALERTS_OVERLAY_KEY/);
});
