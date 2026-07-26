/**
 * Cloudflare Worker: cdn.acosmibot.com → Azure Blob Storage
 * -----------------------------------------------------------------------------
 * Runs on the route  cdn.acosmibot.com/*
 *
 * Embed images live in the public `embed-images` container of the acosmibotcdn
 * storage account. Azure Blob routes requests by Host header, so it returns 400
 * for a request arriving with Host: cdn.acosmibot.com. Rewriting the Host/SNI on
 * the origin connection is an Enterprise-only Origin Rules feature, so this
 * Worker does it instead: it makes a fresh request to the blob endpoint, which
 * carries the correct Host and SNI by construction.
 *
 * Keeps the public URL shape unchanged, so the URLs already stored on embed
 * records keep working:
 *   https://cdn.acosmibot.com/embed-images/<guild_id>/<file>
 *     → https://acosmibotcdn.blob.core.windows.net/embed-images/<guild_id>/<file>
 *
 * Requires: the cdn.acosmibot.com DNS record set to "Proxied" (orange cloud).
 */

const ORIGIN = 'https://acosmibotcdn.blob.core.windows.net';

// Only this container is proxied. Anything else 404s rather than turning the
// Worker into an open proxy for the whole storage account.
const ALLOWED_PREFIX = '/embed-images/';

// Headers worth passing back from Azure. Everything else (x-ms-*, etc.) is
// dropped so storage-account internals aren't echoed to callers.
const PASSTHROUGH_HEADERS = [
  'content-type',
  'content-length',
  'etag',
  'last-modified',
  'cache-control',
];

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    if (!url.pathname.startsWith(ALLOWED_PREFIX)) {
      return new Response('Not found', { status: 404 });
    }

    // The query string is deliberately dropped: blob names never need one, and
    // forwarding it would allow cache-busting and SAS-token passthrough.
    const originResponse = await fetch(ORIGIN + url.pathname, {
      method: request.method,
      cf: { cacheEverything: true, cacheTtl: 31536000 },
    });

    const headers = new Headers();
    for (const name of PASSTHROUGH_HEADERS) {
      const value = originResponse.headers.get(name);
      if (value) headers.set(name, value);
    }

    // Parity with the nginx cdn vhost this replaces.
    headers.set('access-control-allow-origin', '*');
    headers.set('x-content-type-options', 'nosniff');

    return new Response(originResponse.body, {
      status: originResponse.status,
      headers,
    });
  },
};
