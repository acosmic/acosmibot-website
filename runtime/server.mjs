import { createServer } from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { handleProfileRequest } from '../cloudflare-worker/profile-unfurl.js';
import cdnWorker from '../cloudflare-worker/cdn-blob-proxy.js';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = resolve(process.env.STATIC_ROOT || join(rootDir, 'dist'));
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';
const environment = String(
  process.env.ACOSMIBOT_ENVIRONMENT || process.env.APP_ENV || 'production',
).trim().toLowerCase();
const isTestEnvironment = environment === 'test' || environment === 'staging';

const trimUrl = (value) => {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed.replace(/\/$/, '') : undefined;
};

// Production values preserve the SWA/Cloudflare deployment contract. Test and
// staging values are emitted only when supplied by the isolated environment.
const runtimeConfig = {
  environment,
  siteOrigin: trimUrl(process.env.SITE_ORIGIN) || (isTestEnvironment ? undefined : 'https://acosmibot.com'),
  apiBaseUrl: trimUrl(process.env.API_BASE_URL) || (isTestEnvironment ? undefined : 'https://api.acosmibot.com'),
  originBaseUrl: trimUrl(process.env.ORIGIN_BASE_URL) || (isTestEnvironment ? undefined : trimUrl(process.env.SITE_ORIGIN) || 'https://acosmibot.com'),
  inviteUrl: isTestEnvironment
    ? (trimUrl(process.env.INVITE_URL)?.includes('client_id=1186802023799214223') ? null : trimUrl(process.env.INVITE_URL) || null)
    : trimUrl(process.env.INVITE_URL) || 'https://discord.com/oauth2/authorize?client_id=1186802023799214223&permissions=8&integration_type=0&scope=bot',
  paymentUrl: isTestEnvironment
    ? (trimUrl(process.env.PAYMENT_URL)?.startsWith('https://donate.stripe.com/') ? null : trimUrl(process.env.PAYMENT_URL) || null)
    : trimUrl(process.env.PAYMENT_URL) || 'https://donate.stripe.com/bJe3co1sfayvcMD16xgnK00',
  analyticsMeasurementId: isTestEnvironment ? null : trimUrl(process.env.ANALYTICS_MEASUREMENT_ID) || 'G-7PFS5W20SN',
  analyticsManualPageViewsReady: !isTestEnvironment && String(process.env.ANALYTICS_MANUAL_PAGE_VIEWS_READY || 'true') === 'true',
  statusUrl: trimUrl(process.env.STATUS_URL) || (isTestEnvironment ? undefined : '/api/status'),
  renderCardUrl: trimUrl(process.env.RENDER_CARD_URL) || (isTestEnvironment ? undefined : 'https://api.acosmibot.com/api/render-card'),
  cdnBaseUrl: trimUrl(process.env.CDN_BASE_URL) || (isTestEnvironment ? undefined : 'https://cdn.acosmibot.com'),
};

const securityHeaders = {
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const privateRoute = (pathname) => (
  pathname === '/dashboard'
  || pathname === '/servers'
  || pathname === '/settings'
  || pathname === '/card-studio'
  || pathname === '/credits'
  || pathname === '/me'
  || pathname === '/profile'
  || pathname.startsWith('/admin')
  || pathname.startsWith('/server/')
  || pathname.startsWith('/u/')
  || pathname.startsWith('/leaderboard')
  || pathname === '/achievements'
);

const responseHeaders = (extra = {}) => ({ ...securityHeaders, ...extra });

const textBody = async (response) => Buffer.from(await response.arrayBuffer());

const writeWebResponse = async (nodeResponse, webResponse, method = 'GET') => {
  const headers = Object.fromEntries(webResponse.headers.entries());
  nodeResponse.writeHead(webResponse.status, headers);
  if (method !== 'HEAD' && webResponse.body) nodeResponse.end(await textBody(webResponse));
  else nodeResponse.end();
};

const makeWorkerRequest = (req, url) => new Request(url, {
  method: req.method,
  headers: req.headers,
});

const workerEnv = () => ({
  ACOSMIBOT_ENVIRONMENT: environment,
  API_BASE_URL: process.env.API_BASE_URL,
  CDN_BLOB_ORIGIN: process.env.CDN_BLOB_ORIGIN,
});

const functionContext = () => ({
  res: undefined,
  log: {
    warn: () => {},
    error: () => {},
  },
});

const invokeFunction = async (nodeRequest, nodeResponse, handler, body) => {
  const context = functionContext();
  const headers = Object.fromEntries(
    Object.entries(nodeRequest.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value]),
  );
  await handler(context, {
    method: nodeRequest.method,
    headers,
    body,
    rawBody: body,
  });
  const result = context.res || { status: 500, body: 'Adapter did not return a response.' };
  const resultHeaders = responseHeaders(result.headers || {});
  nodeResponse.writeHead(result.status || 200, resultHeaders);
  if (nodeRequest.method === 'HEAD') {
    nodeResponse.end();
  } else if (Buffer.isBuffer(result.body)) {
    nodeResponse.end(result.body);
  } else if (typeof result.body === 'string') {
    nodeResponse.end(result.body);
  } else {
    nodeResponse.end(JSON.stringify(result.body ?? {}));
  }
};

const readRequestBody = async (request, maxBytes = 16 * 1024 * 1024) => {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) throw Object.assign(new Error('request body too large'), { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

const serveStaticWebResponse = async (requestUrl, method = 'GET') => {
  const pathname = requestUrl.pathname;
  if (pathname === '/premium') return new Response(null, { status: 301, headers: responseHeaders({ Location: '/pricing' }) });
  if (pathname === '/docs') return new Response(null, { status: 301, headers: responseHeaders({ Location: '/docs/introduction' }) });
  if (pathname === '/docs/spotify') return new Response(null, { status: 301, headers: responseHeaders({ Location: '/docs/music' }) });

  let relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let status = 200;
  if (privateRoute(pathname)) relative = 'app-shell.html';

  const candidate = resolve(staticRoot, relative);
  if (!candidate.startsWith(`${staticRoot}/`) || !(await stat(candidate).catch(() => null))?.isFile()) {
    relative = '404.html';
    status = 404;
  }
  const filePath = resolve(staticRoot, normalize(relative));
  const file = await readFile(filePath);
  const extension = relative.slice(relative.lastIndexOf('.')).toLowerCase();
  let body = file;
  const headers = responseHeaders({
    'Content-Type': contentTypes[extension] || 'application/octet-stream',
  });
  if (extension === '.html') {
    headers['Cache-Control'] = 'no-store';
    if (isTestEnvironment) {
      const testOrigin = runtimeConfig.siteOrigin || requestUrl.origin;
      const testInvite = runtimeConfig.inviteUrl || '#';
      const testPayment = runtimeConfig.paymentUrl || '#';
      headers['X-Robots-Tag'] = 'noindex, nofollow';
      body = Buffer.from(file.toString('utf8')
        .replace(/<meta\s+name="robots"\s+content="[^"]*"\s*\/?>(\s*)/i, '<meta name="robots" content="noindex, nofollow" />$1')
        .replace(/<link\s+rel="canonical"[^>]*>/i, '')
        .replaceAll('https://acosmibot.com', testOrigin)
        .replaceAll('https://discord.com/oauth2/authorize?client_id=1186802023799214223&permissions=8&integration_type=0&scope=bot', testInvite)
        .replaceAll('https://donate.stripe.com/bJe3co1sfayvcMD16xgnK00', testPayment));
    }
  } else if (extension === '.js' && relative === 'scripts/config.js') {
    // This branch is intentionally below the normal static lookup so the
    // production file remains a valid SWA asset while tests receive their
    // isolated settings from one server-owned source of truth.
    body = Buffer.from(`window.__ACOSMIBOT_RUNTIME_CONFIG__ = ${JSON.stringify(runtimeConfig)};\n${file.toString('utf8')}`);
  }
  if (method === 'HEAD') body = Buffer.alloc(0);
  headers['Content-Length'] = String(body.length);
  return new Response(body, { status, headers });
};

let renderCard;
let statusRelay;
const loadFunctions = async () => {
  if (!renderCard) renderCard = (await import('../api/render-card/index.js')).run;
  if (!statusRelay) statusRelay = (await import('../api/status/index.js')).run;
};

const handle = async (request, nodeResponse) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname;

  if (pathname === '/healthz' || pathname === '/health') {
    // Readiness proves that the image contains the built SPA and every local
    // adapter before it reports healthy to an orchestrator.
    await stat(join(staticRoot, 'index.html'));
    await loadFunctions();
    nodeResponse.writeHead(200, responseHeaders({ 'Content-Type': 'application/json; charset=utf-8' }));
    nodeResponse.end(JSON.stringify({ status: 'ok', ready: true, environment }));
    return;
  }

  if (pathname === '/scripts/config.js') {
    const response = await serveStaticWebResponse(requestUrl, request.method);
    await writeWebResponse(nodeResponse, response, request.method);
    return;
  }

  if (pathname === '/robots.txt' && isTestEnvironment) {
    nodeResponse.writeHead(200, responseHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }));
    nodeResponse.end('User-agent: *\nDisallow: /\n');
    return;
  }

  if (pathname === '/api/render-card' && request.method === 'POST') {
    await loadFunctions();
    const body = await readRequestBody(request);
    await invokeFunction(request, nodeResponse, renderCard, body);
    return;
  }

  if (pathname === '/api/status' && request.method === 'GET') {
    await loadFunctions();
    await invokeFunction(request, nodeResponse, statusRelay);
    return;
  }

  if (pathname.startsWith('/embed-images/')) {
    const workerRequest = makeWorkerRequest(request, requestUrl);
    await writeWebResponse(
      nodeResponse,
      await cdnWorker.fetch(workerRequest, workerEnv()),
      request.method,
    );
    return;
  }

  if (/^\/u\/[^/]+\/?$/.test(pathname)) {
    const workerRequest = makeWorkerRequest(request, requestUrl);
    const staticOrigin = (input) => serveStaticWebResponse(new URL(input.url), input.method);
    await writeWebResponse(nodeResponse, await handleProfileRequest(workerRequest, workerEnv(), staticOrigin), request.method);
    return;
  }

  const response = await serveStaticWebResponse(requestUrl, request.method);
  await writeWebResponse(nodeResponse, response, request.method);
};

export const server = createServer((request, response) => {
  handle(request, response).catch((error) => {
    const status = Number(error?.statusCode) || 500;
    response.writeHead(status, responseHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }));
    response.end(status === 413 ? 'Request body too large' : 'Runtime request failed');
  });
});

export { handle, serveStaticWebResponse, runtimeConfig };

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  server.listen(port, host, () => {
    console.log(`Acosmibot website runtime listening on ${host}:${port} (${environment})`);
  });

  process.on('SIGTERM', () => server.close(() => process.exit(0)));
  process.on('SIGINT', () => server.close(() => process.exit(0)));
}
