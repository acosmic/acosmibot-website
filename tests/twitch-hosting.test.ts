import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getSeoMeta, INDEXABLE_PUBLIC_PATHS } from '../src/seo/publicRoutes.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

type Route = { route: string; rewrite?: string; redirect?: string; headers?: Record<string, string> };
const hosting = JSON.parse(read('public/staticwebapp.config.json')) as {
  globalHeaders: Record<string, string>;
  routes: Route[];
  responseOverrides: Record<string, unknown>;
};
const routeIndex = (route: string) => hosting.routes.findIndex((entry) => entry.route === route);
const route = (path: string) => hosting.routes[routeIndex(path)];

test('/twitch, /twitch/* and /t/* rewrite to the app shell', () => {
  assert.deepEqual(route('/twitch'), { route: '/twitch', rewrite: '/app-shell.html' });
  assert.deepEqual(route('/twitch/*'), { route: '/twitch/*', rewrite: '/app-shell.html', headers: { 'X-Robots-Tag': 'noindex, nofollow' } });
  assert.deepEqual(route('/t/*'), { route: '/t/*', rewrite: '/app-shell.html', headers: { 'X-Robots-Tag': 'noindex, nofollow' } });
});

test('/twitch-overlay/* is static, frameable only by this site, uncached and unindexed', () => {
  assert.deepEqual(route('/twitch-overlay/*'), {
    route: '/twitch-overlay/*',
    headers: {
      'X-Frame-Options': '',
      'Content-Security-Policy': "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'no-store',
    },
  });
  assert.equal(route('/twitch-overlay/*').rewrite, undefined, 'overlay files are served as themselves');
});

test('the Twitch routes sit before /server/* and the existing rules are unchanged', () => {
  const server = routeIndex('/server/*');
  assert.ok(server > 0);
  for (const path of ['/twitch-overlay/*', '/twitch', '/twitch/*', '/t/*']) {
    const index = routeIndex(path);
    assert.ok(index >= 0 && index < server, `${path} must precede /server/*`);
  }
  assert.ok(routeIndex('/twitch-overlay/*') < routeIndex('/twitch'));
  assert.equal(hosting.globalHeaders['X-Frame-Options'], 'DENY');
  assert.deepEqual(hosting.responseOverrides, { 404: { rewrite: '/404.html' } });
  assert.equal(route('/server/*').rewrite, '/app-shell.html');
  assert.ok(route('/stream-overlay/*'));
});

test('runtime/server.mjs privateRoute serves the app shell for the Twitch paths only', () => {
  const source = read('runtime/server.mjs');
  const match = source.match(/const privateRoute = (\(pathname\) => \([\s\S]*?\n\));/);
  assert.ok(match, 'privateRoute() must stay a single arrow expression');
  assert.match(match[1], /pathname === '\/twitch' \|\| pathname\.startsWith\('\/twitch\/'\) \|\| pathname\.startsWith\('\/t\/'\)/);
  const privateRoute = new Function(`return ${match[1]}`)() as (pathname: string) => boolean;

  for (const path of ['/twitch', '/twitch/', '/twitch/dashboard', '/twitch/c/123/overview', '/t/streamer', '/t/streamer/commands']) {
    assert.equal(privateRoute(path), true, path);
  }
  for (const path of ['/twitch-overlay/alerts.html', '/twitchy', '/t', '/tos', '/', '/pricing']) {
    assert.equal(privateRoute(path), false, path);
  }
  // Existing private routes still apply.
  for (const path of ['/dashboard', '/servers', '/server/1/overview', '/u/someone']) {
    assert.equal(privateRoute(path), true, path);
  }
});

test('Twitch pages stay out of the SEO manifest', () => {
  for (const path of ['/twitch', '/twitch/dashboard', '/t/streamer']) {
    assert.equal(INDEXABLE_PUBLIC_PATHS.includes(path), false, path);
    assert.equal(getSeoMeta(path).indexable, false, path);
  }
});

test('App.tsx mounts the two lazy Twitch roots', () => {
  const app = read('src/App.tsx');
  assert.match(app, /const TwitchRoot = lazyRoute\(\(\) => import\('\.\/features\/twitch\/TwitchRoot'\)/);
  assert.match(app, /const TwitchPublicRoot = lazyRoute\(\(\) => import\('\.\/features\/twitch\/public\/TwitchPublicRoot'\)/);
  assert.match(app, /<Route path="\/twitch\/\*" element=\{<TwitchRoot \/>\} \/>/);
  assert.match(app, /<Route path="\/t\/:login\/\*" element=\{<TwitchPublicRoot \/>\} \/>/);
  assert.ok(app.indexOf('path="/t/:login/*"') < app.indexOf('path="*"'), 'Twitch routes precede the catch-all');
});
