import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getSeoMeta, INDEXABLE_PUBLIC_PATHS } from '../src/seo/publicRoutes.ts';
import { PUBLIC_STATUS_INCIDENTS } from '../src/status/publicIncidents.ts';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const readSource = (path: string) => readFileSync(`${testDir}../${path}`, 'utf8');

test('the public status route is indexable and linked from the shared footer', () => {
  const meta = getSeoMeta('/status');
  assert.equal(meta.indexable, true);
  assert.equal(meta.canonicalPath, '/status');
  assert.ok(INDEXABLE_PUBLIC_PATHS.includes('/status'));
  assert.match(readSource('src/App.tsx'), /path="\/status"/);
  assert.doesNotMatch(readSource('src/components/layout/PublicNav.tsx'), /to="\/status"/);
  assert.match(readSource('src/components/layout/SiteFooter.tsx'), /href="\/status"/);
  assert.match(readSource('src/pages/HomePage.tsx'), /to="\/status">Status/);

  const prerender = readSource('vite.config.ts');
  const prerenderNav = prerender.match(/const publicNav = `([\s\S]*?)`;/)?.[1] ?? '';
  const prerenderFooter = prerender.match(/const publicFooter = `([\s\S]*?)`;/)?.[1] ?? '';
  assert.doesNotMatch(prerenderNav, /href="\/status"/);
  assert.match(prerenderFooter, /href="\/status"/);
});

test('the status relay keeps credentials server-side and exposes a fixed public boundary', () => {
  const relay = readSource('api/status/index.ts');
  const client = readSource('src/api/status.ts');

  assert.match(relay, /process\.env\.SENTRY_STATUS_TOKEN/);
  assert.match(relay, /Authorization: `Bearer \$\{token\}`/);
  assert.doesNotMatch(client, /SENTRY_STATUS_TOKEN|Authorization:|sentry\.io/);
  assert.match(client, /fetch\('\/api\/status'/);
  assert.doesNotMatch(relay, /exception\.message|stacktrace|discord.?id/i);
});

test('published incident history contains the measured database outage', () => {
  const incident = PUBLIC_STATUS_INCIDENTS.find((item) => item.id === '2026-08-22-database-pool');
  assert.ok(incident);
  assert.equal(incident.status, 'resolved');
  assert.equal(incident.duration, '4h 19m');
  assert.equal(incident.startedAt, '2026-08-22T07:19:00Z');
  assert.equal(incident.resolvedAt, '2026-08-22T11:38:51Z');
});
