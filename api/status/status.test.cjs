const test = require('node:test');
const assert = require('node:assert/strict');

const { buildStatusPayload, normalizeHealthStatus, dailyStatus, readUptimeHistory, readCronHistory } = require('./index.js');

const checkedAt = '2026-08-22T22:00:00.000Z';

const sentry = (overrides = {}) => ({
  apiStatus: 'operational',
  websiteStatus: 'operational',
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

const now = Date.parse('2026-10-11T16:35:00.000Z');
const firstDay = Date.parse('2026-09-12T00:00:00.000Z');
const since = firstDay / 1000;
const until = now / 1000;

const mockSources = (t, { website = true, botHistoryFails = false, uptimeHistoryFails = false } = {}) => {
  const requests = [];
  t.mock.method(Date, 'now', () => now);
  const originalEnv = { ...process.env };
  for (const key of Object.keys(process.env)) if (key.startsWith('SENTRY_STATUS_')) delete process.env[key];
  process.env.SENTRY_STATUS_TOKEN = 'synthetic-test-token';
  t.after(() => { process.env = originalEnv; });
  t.mock.method(globalThis, 'fetch', async (input) => {
    const url = new URL(input);
    requests.push(url);
    let body = {};
    if (url.pathname.endsWith('/detectors/')) {
      body = [{ id: 'api-detector', name: 'Acosmibot API uptime' }];
      if (website) body.push({ id: 'site-detector', name: 'Acosmibot website uptime' });
    } else if (url.pathname.endsWith('/uptime-stats/')) {
      if (uptimeHistoryFails) throw new Error('Synthetic upstream failure');
      // Reproduce Sentry's 24-hour fallback if unsupported params return.
      const start = Number(url.searchParams.get('since') || (now / 1000 - 86400));
      const end = Number(url.searchParams.get('until') || now / 1000);
      const resolution = url.searchParams.get('resolution') === '1d' ? 86400 : 3600;
      const id = url.searchParams.get('uptimeDetectorId');
      body = { [id]: Array.from(
        { length: Math.ceil((end - start) / resolution) },
        (_, index) => [start + index * resolution, {
          success: id === 'site-detector' ? 1440 : index === 4 ? 0 : 1437,
          failure_incident: id === 'api-detector' && index === 0 ? 3 : 0,
          failure: 0,
          missed_window: 0,
        }],
      ) };
    } else if (url.pathname.includes('/uptime/')) {
      body = { uptimeStatus: 1, intervalSeconds: 60 };
    } else if (url.pathname.endsWith('/monitors-stats/')) {
      if (botHistoryFails) throw new Error('Synthetic upstream failure');
      body = { 'bot-monitor': Array.from({ length: 30 }, (_, index) => [
        since + index * 86400,
        { production: { ok: 1440, error: 0, timeout: 0, missed: 0 }, staging: { error: 10000 } },
      ]) };
    } else if (url.pathname.includes('/monitors/')) {
      body = { id: 'bot-monitor', config: { schedule_type: 'crontab', schedule: '* * * * *' }, environments: [{ name: 'production', status: 'ok', lastCheckIn: new Date(now).toISOString() }] };
    }
    return new Response(JSON.stringify(body), { status: 200 });
  });
  delete require.cache[require.resolve('./index.js')];
  return { requests, run: require('./index.js').run };
};

test('fetches 30 daily buckets per service with supported time ranges and production-only bot scope', async (t) => {
  const { requests, run } = mockSources(t);
  const context = {};
  await run(context);
  const statsRequests = requests.filter(url => url.pathname.endsWith('/uptime-stats/') || url.pathname.endsWith('/monitors-stats/'));
  assert.equal(statsRequests.length, 3);
  for (const { searchParams: query } of statsRequests) {
    assert.equal(query.get('since'), String(since));
    assert.equal(query.get('until'), String(until));
    assert.equal(query.get('resolution'), '1d');
    assert.equal(query.has('statsPeriod'), false);
    assert.equal(query.has('interval'), false);
  }
  assert.equal(statsRequests.find(url => url.pathname.endsWith('/monitors-stats/')).searchParams.get('environment'), 'production');
  assert.equal(context.res.status, 200);
  const components = context.res.body.components;
  for (const component of components) {
    assert.equal(component.history.segments.length, 30);
    assert.equal(component.history.segments[0].timestamp, '2026-09-12T00:00:00.000Z');
    assert.equal(component.history.segments[29].timestamp, '2026-10-11T00:00:00.000Z');
  }
  assert.equal(components.find(c => c.id === 'api').history.segments[4].status, 'unknown');
  assert.equal(components.find(c => c.id === 'website').history.percentage, 100);
  assert.equal(components.find(c => c.id === 'bot-database').history.percentage, 100);
  assert.deepEqual(context.res.body.uptime.segments, components.find(c => c.id === 'api').history.segments);
  assert.doesNotMatch(JSON.stringify(context.res.body), /synthetic-test-token|api-detector|site-detector|bot-monitor|staging/);
});

test('website without a monitor has no history even while its direct probe succeeds', async (t) => {
  const { run } = mockSources(t, { website: false });
  const context = {};
  await run(context);
  const site = context.res.body.components.find(c => c.id === 'website');
  assert.equal(site.status, 'operational');
  assert.equal(site.history.state, 'not_configured');
  assert.equal(site.history.percentage, null);
  assert.deepEqual(site.history.segments, []);
});

test('isolated relays never fall back to production URLs when configuration is absent', async (t) => {
  const { requests, run } = mockSources(t);
  process.env.ACOSMIBOT_ENVIRONMENT = 'test';
  for (const key of ['STATUS_API_HEALTH_URL', 'API_HEALTH_URL', 'STATUS_WEBSITE_HEALTH_URL', 'SENTRY_STATUS_ORIGIN']) delete process.env[key];
  const context = {};
  await run(context);
  assert.equal(requests.length, 0);
  assert.equal(context.res.body.overallStatus, 'unknown');
  assert.ok(context.res.body.components.every(component => component.history.percentage === null));
});

test('test relays use configured origins and never read production bot history', async (t) => {
  const { requests, run } = mockSources(t);
  process.env.ACOSMIBOT_ENVIRONMENT = 'test';
  process.env.STATUS_API_HEALTH_URL = 'http://api.test/health';
  process.env.STATUS_WEBSITE_HEALTH_URL = 'http://website.test/';
  process.env.SENTRY_STATUS_ORIGIN = 'https://sentry.test';
  const context = {};
  await run(context);
  assert.ok(requests.every(url => ['api.test', 'website.test', 'sentry.test'].includes(url.hostname)));
  const cronRequests = requests.filter(url => url.pathname.includes('/monitors/') || url.pathname.endsWith('/monitors-stats/'));
  assert.equal(cronRequests.length, 2);
  assert.ok(cronRequests.every(url => url.searchParams.get('environment') === 'test'));
  const bot = context.res.body.components.find(component => component.id === 'bot-database');
  assert.equal(bot.status, 'unknown');
  assert.deepEqual(bot.history.segments, []);
  const history = readCronHistory({ bot: [[since, { production: { error: 1440 }, test: { ok: 1440 } }]] }, 'bot', since, until, 60, 'test');
  assert.equal(history.percentage, 100);
  assert.equal(history.segments[0].status, 'operational');
});

test('history source failures do not erase current health or invent successful days', async (t) => {
  const { run } = mockSources(t, { botHistoryFails: true, uptimeHistoryFails: true });
  const context = {};
  await run(context);
  assert.equal(context.res.body.overallStatus, 'operational');
  for (const component of context.res.body.components) {
    assert.equal(component.history.state, 'unavailable');
    assert.equal(component.history.percentage, null);
    assert.deepEqual(component.history.segments, []);
  }
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
  assert.equal(context.res.body.components.find(c => c.id === 'website').history.percentage, null);
});

test('history parsers reject out-of-window and malformed rows and exclude test bot counts', () => {
  const http = readUptimeHistory({ api: [null, ['invalid', {}], [since - 86400, { success: 12 }], [until + 1, { success: 12 }], [since, { success: 0, failure: -5 }]] }, 'api', since, until, 60);
  assert.equal(http.totalChecks, 0);
  assert.equal(http.segments.length, 1);
  assert.equal(http.segments[0].status, 'unknown');
  const bot = readCronHistory({ bot: [[since, { staging: { ok: 1000 } }]] }, 'bot', since, until, 60);
  assert.equal(bot.totalChecks, 0);
  assert.deepEqual(bot.segments, []);
});


test('daily colors use confirmed downtime with the exact one-hour boundary', () => {
  assert.equal(dailyStatus(0, 1440), 'operational');
  assert.equal(dailyStatus(0.5, 1440), 'degraded');
  assert.equal(dailyStatus(59.999, 1440), 'degraded');
  assert.equal(dailyStatus(60, 1440), 'outage');
  assert.equal(dailyStatus(1440, 1440), 'outage');
  assert.equal(dailyStatus(0, 0), 'unknown');
});

test('HTTP history ignores isolated failures for color but retains diagnostic counts and confirmed downtime', () => {
  const history = readUptimeHistory({ api: [
    [since, { success: 1437, failure: 1, failure_incident: 0, missed_window: 2 }],
    [since + 86400, { success: 1433, failure: 3, failure_incident: 3, missed_window: 1 }],
    [since + 172800, { success: 1410, failure_incident: 30 }],
    [since + 259200, { missed_window: 1440 }],
  ] }, 'api', since, until, 120);
  assert.equal(history.segments[0].status, 'operational');
  assert.equal(history.segments[0].failedChecks, 1);
  assert.equal(history.segments[0].missedChecks, 2);
  assert.equal(history.segments[1].status, 'degraded');
  assert.equal(history.segments[1].downtimeMinutes, 6);
  assert.equal(history.segments[2].status, 'outage');
  assert.equal(history.segments[2].downtimeMinutes, 60);
  assert.equal(history.segments[3].status, 'unknown');
  assert.equal(history.segments[3].percentage, null);
  assert.equal(history.percentage, 99.236);
});

test('bot grace-expired missing heartbeats and failures count, in-progress and test checks do not', () => {
  const history = readCronHistory({ bot: [[since, {
    production: { ok: 1437, error: 1, timeout: 1, missed: 1, in_progress: 9000 },
    staging: { ok: 99999, error: 1000 },
  }]] }, 'bot', since, until, 60);
  assert.equal(history.totalChecks, 1440);
  assert.equal(history.percentage, 99.792);
  assert.equal(history.segments[0].downtimeMinutes, 3);
  assert.equal(history.segments[0].status, 'degraded');
});

test('missing cadence cannot fabricate a downtime duration or green history', () => {
  const history = readUptimeHistory({ api: [[since, { success: 100, failure_incident: 20 }]] }, 'api', since, until, 0);
  assert.equal(history.state, 'unavailable');
  assert.equal(history.percentage, null);
  assert.deepEqual(history.segments, []);
});

test('a current website outage overrides green history and creates a sanitized incident', () => {
  const payload = buildStatusPayload(
    { status: 'operational' },
    sentry({ websiteStatus: 'outage' }),
    checkedAt,
    { status: 'outage' },
  );
  assert.equal(payload.overallStatus, 'outage');
  assert.equal(payload.components.find(component => component.id === 'website').status, 'outage');
  assert.equal(payload.incidents[0].id, 'active-website-availability');
});
