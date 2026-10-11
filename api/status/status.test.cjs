const test = require('node:test');
const assert = require('node:assert/strict');

const { buildStatusPayload, normalizeHealthStatus } = require('./index.js');

const checkedAt = '2026-08-22T22:00:00.000Z';

const sentry = (overrides = {}) => ({
  apiStatus: 'operational',
  botStatus: 'operational',
  uptimePercentage: 99.998,
  totalChecks: 1200,
  segments: [],
  available: true,
  ...overrides,
});

test('normalizes only allowlisted health states', () => {
  assert.equal(normalizeHealthStatus('healthy'), 'operational');
  assert.equal(normalizeHealthStatus('missed_checkin'), 'outage');
  assert.equal(normalizeHealthStatus(1), 'operational');
  assert.equal(normalizeHealthStatus(2), 'outage');
  assert.equal(normalizeHealthStatus('a surprising internal value'), 'unknown');
});

test('reports healthy service when direct and independent signals agree', () => {
  const payload = buildStatusPayload(
    { status: 'operational', latencyMs: 84 },
    sentry(),
    checkedAt,
  );

  assert.equal(payload.overallStatus, 'operational');
  assert.equal(payload.dataState, 'live');
  assert.equal(payload.components.find((item) => item.id === 'api').latencyMs, 84);
  assert.equal(payload.uptime.percentage, 99.998);
  assert.equal(payload.incidents[0].status, 'resolved');
});

test('treats one failed live probe against a healthy Sentry detector as degraded', () => {
  const payload = buildStatusPayload(
    { status: 'outage' },
    sentry(),
    checkedAt,
  );

  assert.equal(payload.overallStatus, 'degraded');
  assert.equal(payload.components.find((item) => item.id === 'api').status, 'degraded');
  assert.equal(payload.incidents.some((incident) => incident.status !== 'resolved'), false);
});

test('publishes generic active incidents without Sentry issue content', () => {
  const payload = buildStatusPayload(
    { status: 'outage' },
    sentry({
      apiStatus: 'outage',
      botStatus: 'outage',
      apiIncidentStartedAt: '2026-08-22T21:55:00.000Z',
    }),
    checkedAt,
  );

  assert.equal(payload.overallStatus, 'outage');
  assert.equal(payload.incidents[0].title, 'API connectivity disruption');
  assert.equal(payload.incidents[1].title, 'Bot application heartbeat missed');
  assert.doesNotMatch(JSON.stringify(payload), /stack|discord.?id|projectId|shortId/i);
});

test('fetches all 30 UTC days using the Sentry stats contract and a matching summary window', async (t) => {
  const now = Date.parse('2026-10-11T16:35:00.000Z');
  const firstDay = Date.parse('2026-09-12T00:00:00.000Z');
  const dayMs = 86_400_000;
  const requests = [];
  t.mock.method(Date, 'now', () => now);
  const originalEnv = { ...process.env };
  process.env.SENTRY_STATUS_TOKEN = 'synthetic-test-token';
  process.env.SENTRY_STATUS_UPTIME_DETECTOR_ID = 'test-detector';
  t.after(() => { process.env = originalEnv; });
  t.mock.method(globalThis, 'fetch', async (input) => {
    const url = new URL(input);
    requests.push(url);
    let body = {};
    if (url.pathname.endsWith('/uptime-stats/')) {
      // Model Sentry's defaults: unsupported statsPeriod/interval yields only
      // the previous 24 hourly buckets, reproducing the original two-day UI.
      const since = Number(url.searchParams.get('since') || (now / 1000 - 86400));
      const until = Number(url.searchParams.get('until') || now / 1000);
      const resolution = url.searchParams.get('resolution') === '1d' ? 86400 : 3600;
      body = { 'test-detector': Array.from(
        { length: Math.ceil((until - since) / resolution) },
        (_, index) => [since + index * resolution, {
          success: index === 4 ? 0 : 1440,
          failure_incident: index === 0 ? 3 : 0,
          failure: index === 6 ? 1 : 0,
          missed_window: index === 7 ? 1 : 0,
        }],
      ) };
    } else if (url.pathname.endsWith('/uptime-summary/')) {
      body = { 'test-detector': { totalChecks: 42755, downtimeChecks: 3 } };
    } else if (url.pathname.includes('/uptime/')) {
      body = { uptimeStatus: 1 };
    } else if (url.pathname.includes('/monitors/')) {
      body = { environments: [{ name: 'production', status: 'ok' }] };
    }
    return new Response(JSON.stringify(body), { status: 200 });
  });
  // Each handler owns a 30-second module cache; load a fresh instance.
  delete require.cache[require.resolve('./index.js')];
  const context = {};
  await require('./index.js').run(context);

  const statsQuery = requests.find(url => url.pathname.endsWith('/uptime-stats/')).searchParams;
  const summaryQuery = requests.find(url => url.pathname.endsWith('/uptime-summary/')).searchParams;
  assert.equal(statsQuery.get('since'), String(firstDay / 1000));
  assert.equal(statsQuery.get('until'), String(now / 1000));
  assert.equal(statsQuery.get('resolution'), '1d');
  assert.equal(statsQuery.has('statsPeriod'), false);
  assert.equal(statsQuery.has('interval'), false);
  assert.equal(Date.parse(summaryQuery.get('start')), firstDay);
  assert.equal(Date.parse(summaryQuery.get('end')), now);

  assert.equal(context.res.status, 200);
  const segments = context.res.body.uptime.segments;
  assert.equal(segments.length, 30);
  assert.deepEqual(segments.map(segment => segment.timestamp), Array.from(
    { length: 30 }, (_, index) => new Date(firstDay + index * dayMs).toISOString(),
  ));
  assert.equal(segments[0].status, 'outage');
  assert.equal(segments[1].status, 'operational');
  assert.equal(segments[4].status, 'unknown');
  assert.equal(segments[6].status, 'degraded');
  assert.equal(segments[7].status, 'degraded');
  assert.equal(segments[29].status, 'operational');
  assert.equal(context.res.body.uptime.percentage, 99.993);
  assert.doesNotMatch(JSON.stringify(context.res.body), /synthetic-test-token|test-detector/);
});

test('missing Sentry history stays unknown instead of becoming successful days', async (t) => {
  const originalEnv = { ...process.env };
  delete process.env.SENTRY_STATUS_TOKEN;
  t.after(() => { process.env = originalEnv; });
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 200 }));
  delete require.cache[require.resolve('./index.js')];
  const context = {};
  await require('./index.js').run(context);
  assert.equal(context.res.status, 200);
  assert.equal(context.res.body.dataState, 'partial');
  assert.equal(context.res.body.uptime.percentage, null);
  assert.deepEqual(context.res.body.uptime.segments, []);
});
