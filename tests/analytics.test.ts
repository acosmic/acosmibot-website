import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANALYTICS_CONSENT_KEY,
  CONSENT_SCHEMA_VERSION,
  initializeAnalytics,
  readAnalyticsConsent,
  resolveAnalyticsPage,
  trackEvent,
  trackPageView,
  writeAnalyticsConsent,
} from '../src/lib/analytics.ts';

test('migrates legacy consent and rejects unknown future schemas', () => {
  const storage = new Map<string, string>([[ANALYTICS_CONSENT_KEY, 'granted']]);
  Object.assign(globalThis, {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });

  assert.equal(readAnalyticsConsent(), 'granted');
  assert.deepEqual(JSON.parse(storage.get(ANALYTICS_CONSENT_KEY) ?? ''), {
    version: CONSENT_SCHEMA_VERSION,
    analytics: true,
  });

  storage.set(ANALYTICS_CONSENT_KEY, JSON.stringify({
    version: CONSENT_SCHEMA_VERSION + 1,
    analytics: true,
    marketing: true,
  }));
  assert.equal(readAnalyticsConsent(), null);
});

test('normalizes identifiers out of public and guild routes', () => {
  assert.equal(resolveAnalyticsPage('/u/SomeUser').path, '/u/:profile');
  assert.equal(resolveAnalyticsPage('/leaderboard/123456789012345678').path, '/leaderboard/:guild');
  assert.equal(
    resolveAnalyticsPage('/server/123456789012345678/embeds/edit/987').path,
    '/server/:guild/embeds/edit/:item',
  );
});

test('suppresses authentication, owner, and redirect-only routes', () => {
  assert.equal(resolveAnalyticsPage('/dashboard').track, false);
  assert.equal(resolveAnalyticsPage('/admin').track, false);
  assert.equal(resolveAnalyticsPage('/server/123456789012345678').track, false);
  assert.equal(resolveAnalyticsPage('/me').track, false);
});

test('does not preserve arbitrary documentation slugs or unknown URLs', () => {
  assert.equal(resolveAnalyticsPage('/docs/music').path, '/docs/music');
  assert.equal(resolveAnalyticsPage('/docs/alice-private-note').path, '/docs/:page');
  assert.equal(resolveAnalyticsPage('/anything/user-entered').path, '/404');
});

test('fails closed before consent, then sends only normalized allowlisted data', () => {
  const storage = new Map<string, string>();
  const appendedScripts: unknown[] = [];
  const fakeDocument = {
    cookie: '',
    referrer: 'https://search.example/results?q=private',
    querySelector: () => null,
    createElement: () => ({ async: false, src: '', dataset: {} }),
    head: { appendChild: (value: unknown) => appendedScripts.push(value) },
  };
  const fakeWindow = {
    AppConfig: { analyticsMeasurementId: 'G-TEST', analyticsManualPageViewsReady: false },
    location: { origin: 'https://acosmibot.com' },
    dataLayer: [] as unknown[],
    dispatchEvent: () => true,
  };
  const fakeStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  };
  Object.assign(globalThis, {
    document: fakeDocument,
    window: fakeWindow,
    localStorage: fakeStorage,
  });

  assert.equal(initializeAnalytics(), false);
  assert.equal(appendedScripts.length, 0);

  writeAnalyticsConsent('granted');
  assert.equal(initializeAnalytics(), false);
  fakeWindow.AppConfig.analyticsManualPageViewsReady = true;
  assert.equal(initializeAnalytics(), true);
  trackPageView(resolveAnalyticsPage('/server/123456789012345678/overview'));
  trackEvent('server_open', { access: 'Owner', ignored_identifier: '123456789012345678' });

  assert.equal(appendedScripts.length, 1);
  const commands = fakeWindow.dataLayer as ArrayLike<unknown>[];
  assert.equal(
    commands.every((command) => Object.prototype.toString.call(command) === '[object Arguments]'),
    true,
    'gtag must queue Arguments objects so the Google tag processes its commands',
  );
  const pageView = commands.find((command) => command[0] === 'event' && command[1] === 'page_view');
  assert.equal((pageView?.[2] as Record<string, string>).page_location, 'https://acosmibot.com/server/:guild/overview');
  assert.equal((pageView?.[2] as Record<string, string>).page_referrer, 'https://search.example');
  const serverOpen = commands.find((command) => command[0] === 'event' && command[1] === 'server_open');
  assert.deepEqual(serverOpen?.[2], { access: 'owner' });
});
