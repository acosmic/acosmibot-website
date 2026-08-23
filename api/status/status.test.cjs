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
