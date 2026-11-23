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

const OVERLAY_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  'img-src https://static-cdn.jtvnw.net',
  'media-src https:',
  'connect-src https://api.acosmibot.com https://api-test.acosmibot.com http://localhost:5000 http://127.0.0.1:5000',
  "require-trusted-types-for 'script'",
  "frame-ancestors 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

test('/twitch-overlay/* is static, frameable only by this site, revalidated, unindexed and locked down by CSP', () => {
  assert.deepEqual(route('/twitch-overlay/*'), {
    route: '/twitch-overlay/*',
    headers: {
      'X-Frame-Options': '',
      'Content-Security-Policy': OVERLAY_CSP,
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'no-cache',
    },
  });
  assert.equal(route('/twitch-overlay/*').rewrite, undefined, 'overlay files are served as themselves');
  const directives = OVERLAY_CSP.split('; ');
  assert.ok(!directives.some((d) => /unsafe-|\*|data:|blob:/.test(d.replace('https:', ''))), 'no unsafe sources');
});

test('the container runtime serves /twitch-overlay/* with the same headers as Azure', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const root = mkdtempSync(join(tmpdir(), 'overlay-hosting-'));
  mkdirSync(join(root, 'twitch-overlay'));
  writeFileSync(join(root, 'twitch-overlay', 'alerts.html'), '<!doctype html><title>x</title>');
  writeFileSync(join(root, 'twitch-overlay', 'overlay.js'), 'export {};');
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>home</title>');
  writeFileSync(join(root, '404.html'), '<!doctype html><title>missing</title>');
  process.env.STATIC_ROOT = root;
  const runtime = await import('../runtime/server.mjs');
  const azure = route('/twitch-overlay/*').headers ?? {};
  assert.deepEqual(runtime.twitchOverlayHeaders, {
    'Content-Security-Policy': azure['Content-Security-Policy'],
    'X-Robots-Tag': azure['X-Robots-Tag'],
    'Cache-Control': azure['Cache-Control'],
  });
  for (const path of ['/twitch-overlay/alerts.html', '/twitch-overlay/overlay.js']) {
    const response = await runtime.serveStaticWebResponse(new URL(`http://localhost${path}`));
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('x-frame-options'), null, `${path} may be framed by this site`);
    assert.equal(response.headers.get('content-security-policy'), OVERLAY_CSP, path);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow', path);
    assert.equal(response.headers.get('cache-control'), 'no-cache', path);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', path);
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer', path);
  }
  // Every other route keeps the global headers.
  for (const path of ['/', '/twitch-overlayx/alerts.html', '/twitch-overlay/missing.html']) {
    const response = await runtime.serveStaticWebResponse(new URL(`http://localhost${path}`));
    assert.equal(response.headers.get('x-frame-options'), 'DENY', path);
    assert.equal(response.headers.get('content-security-policy'), hosting.globalHeaders['Content-Security-Policy'], path);
  }
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
