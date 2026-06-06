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

const API_BASE = 'https://api.acosmibot.com';

// User-agents of link-preview crawlers. Matched case-insensitively.
const CRAWLER_UA = /(discordbot|twitterbot|facebookexternalhit|slackbot|telegrambot|whatsapp|linkedinbot|pinterest|redditbot|embedly|skypeuripreview|googlebot|bingbot|applebot|mastodon|iframely|vkshare|w3c_validator|developers\.google\.com)/i;

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Only act on profile routes; everything else goes to origin (Azure SWA).
    const match = url.pathname.match(/^\/u\/([^/]+)\/?$/);
    if (!match) {
      return fetch(request);
    }

    const ua = request.headers.get('user-agent') || '';
    if (!CRAWLER_UA.test(ua)) {
      // Human visitor → serve the normal SPA from origin.
      return fetch(request);
    }

    // Crawler → fetch the server-rendered Open Graph page from the API.
    const identifier = match[1];
    const ogResponse = await fetch(`${API_BASE}/api/profile/${identifier}/og`, {
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
  },
};
