import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { handleCdnProxyRequest } from '../cloudflare-worker/cdn-blob-proxy.js';
import { handleProfileRequest } from '../cloudflare-worker/profile-unfurl.js';

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('profile adapter fails closed when a test API endpoint is absent', async () => {
  let upstreamCalled = false;
  const response = await handleProfileRequest(
    new Request('https://test.example/u/member', { headers: { 'user-agent': 'Discordbot' } }),
    { ACOSMIBOT_ENVIRONMENT: 'test' },
    () => new Response('origin'),
    async () => {
      upstreamCalled = true;
      return new Response('unexpected');
    },
  );

  assert.equal(response.status, 503);
  assert.equal(upstreamCalled, false);
});

test('profile adapter keeps crawler response semantics and encodes identifiers', async () => {
  let requestedUrl = '';
  const response = await handleProfileRequest(
    new Request('https://test.example/u/alice%20bot', { headers: { 'user-agent': 'Discordbot' } }),
    { ACOSMIBOT_ENVIRONMENT: 'test', API_BASE_URL: 'http://api.test' },
    () => new Response('origin'),
    async (input) => {
      requestedUrl = String(input);
      return new Response('<meta property="og:title" content="Alice">', { status: 404 });
    },
  );

  assert.equal(requestedUrl, 'http://api.test/api/profile/alice%20bot/og');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=300');
  assert.match(await response.text(), /og:title/);
});

test('CDN adapter drops query strings and rejects unconfigured test origins', async () => {
  let requestedUrl = '';
  const response = await handleCdnProxyRequest(
    new Request('https://cdn.test/embed-images/guild/card.png?sig=must-not-forward'),
    { ACOSMIBOT_ENVIRONMENT: 'test', CDN_BLOB_ORIGIN: 'https://blob.test' },
    async (input) => {
      requestedUrl = String(input);
      return new Response('image', { headers: { 'content-type': 'image/png', etag: 'x' } });
    },
  );
  assert.equal(requestedUrl, 'https://blob.test/embed-images/guild/card.png');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');

  const missingOrigin = await handleCdnProxyRequest(
    new Request('https://cdn.test/embed-images/guild/card.png'),
    { ACOSMIBOT_ENVIRONMENT: 'test' },
    async () => new Response('unexpected'),
  );
  assert.equal(missingOrigin.status, 503);
});

test('container runtime and browser config retain hardened portability boundaries', async () => {
  const [dockerfile, runtime, config, staticWebApp] = await Promise.all([
    source('../Dockerfile'),
    source('../runtime/server.mjs'),
    source('../public/scripts/config.js'),
    source('../public/staticwebapp.config.json'),
  ]);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(dockerfile, /tini/);
  assert.match(dockerfile, /ACOSMIBOT_ENVIRONMENT=test/);
  assert.match(runtime, /ACOSMIBOT_ENVIRONMENT/);
  assert.match(runtime, /ready: true/);
  assert.match(runtime, /join\(staticRoot, 'index\.html'\)/);
  assert.match(runtime, /loadFunctions\(\)/);
  assert.match(runtime, /X-Robots-Tag/);
  assert.match(runtime, /404\.html/);
  assert.match(config, /environment/);
  assert.match(config, /production && !local/);
  assert.match(staticWebApp, /X-Frame-Options/);
  assert.match(staticWebApp, /responseOverrides/);
});

test('runtime documentation keeps the production SWA boundary explicit', async () => {
  const readme = await source('../runtime/README.md');
  assert.match(readme, /production website continues to build and deploy as an Azure Static Web App/);
  assert.match(readme, /One image, one process/);
  assert.match(readme, /POST \/api\/render-card/);
  assert.match(readme, /crawler `GET \/u\/<identifier>`/);
});
