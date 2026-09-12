/**
 * Cloudflare Worker: profile link unfurls
 * -----------------------------------------------------------------------------
 * Runs on the route  acosmibot.com/u/*
 *
 * When a social/crawler bot (Discord, Twitter, Slack, etc.) fetches a profile
 * URL it CANNOT run our React app's JavaScript, so it would see an empty page
 * and produce no link preview. This Worker detects those bots and serves them a
 * tiny server-rendered Open Graph page from the API instead. Real humans are
 * passed straight through to the Azure Static Web App (the SPA) untouched.
 *
 * Requires: the acosmibot.com DNS record set to "Proxied" (orange cloud) so
 * Cloudflare actually runs this Worker on the request.
 */

const PRODUCTION_API_BASE = 'https://api.acosmibot.com';

// User-agents of link-preview crawlers. Matched case-insensitively.
const CRAWLER_UA = /(discordbot|twitterbot|facebookexternalhit|slackbot|telegrambot|whatsapp|linkedinbot|pinterest|redditbot|embedly|skypeuripreview|googlebot|bingbot|applebot|mastodon|iframely|vkshare|w3c_validator|developers\.google\.com)/i;

const isTestEnvironment = (env) => ['test', 'staging'].includes(
  String(env?.ACOSMIBOT_ENVIRONMENT || env?.environment || '').toLowerCase(),
);

const apiBaseFor = (env) => {
  const configured = String(env?.API_BASE_URL || env?.apiBaseUrl || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  return isTestEnvironment(env) ? null : PRODUCTION_API_BASE;
};

/**
 * Shared handler used by Cloudflare and the local Node rehearsal adapter.
 * `originFetch` is injectable so the Node host can pass humans to its static
 * origin while Cloudflare keeps using the platform's fetch(request).
 */
export async function handleProfileRequest(
  request,
  env = {},
  originFetch = fetch,
  upstreamFetch = fetch,
) {
    const url = new URL(request.url);

    // Only act on profile routes; everything else goes to origin (Azure SWA).
    const match = url.pathname.match(/^\/u\/([^/]+)\/?$/);
    if (!match) {
      return originFetch(request);
    }

    const ua = request.headers.get('user-agent') || '';
    if (!CRAWLER_UA.test(ua)) {
      // Human visitor → serve the normal SPA from origin.
      return originFetch(request);
    }

    // Crawler → fetch the server-rendered Open Graph page from the API.
    const apiBase = apiBaseFor(env);
    if (!apiBase) {
      return new Response('Profile unfurl API is not configured for this test environment.', { status: 503 });
    }
    let identifier;
    try {
      identifier = encodeURIComponent(decodeURIComponent(match[1]));
    } catch {
      return new Response('Invalid profile identifier', { status: 400 });
    }
    const ogResponse = await upstreamFetch(`${apiBase}/api/profile/${identifier}/og`, {
      headers: { 'user-agent': ua },
    });

    const body = await ogResponse.text();
    return new Response(body, {
      status: ogResponse.status === 404 ? 200 : ogResponse.status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // Cache previews briefly at the edge so repeated shares are fast.
        'cache-control': 'public, max-age=300',
      },
    });
}

export default {
  async fetch(request, env) {
    return handleProfileRequest(request, env, (input) => fetch(input), (input, init) => fetch(input, init));
  },
};
