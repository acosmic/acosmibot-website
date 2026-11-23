// Shared browser runtime of the OBS overlay pages (TWITCH_BOT_SPEC.md §12.9.2).
//
// Reads `#token=<t>&api=<base>` once, keeps the token in memory only and drops
// the fragment from the address bar, then loads /config and /state and runs the
// long-poll feed loop. Network and server errors never reach the stream: the
// page keeps what it shows and retries with capped exponential backoff.
// DOM is created only with createElement / textContent / appendChild.

import {
  backoffDelay,
  clampWait,
  emoteUrl,
  fontScale,
  isValidCursor,
  resolveLink,
} from './overlay-core.js';

const FETCH_TIMEOUT_MS = 20000;
const FEED_WAIT_S = 10;
const UNAUTHORIZED_RETRY_MS = 60000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function quietLog(message) {
  try {
    // Never logs the token or event data.
    console.warn(`[acosmibot overlay] ${message}`);
  } catch {
    /* ignore */
  }
}

class RequestFailed extends Error {
  constructor(status, retryAfterMs = 0) {
    super(`request failed (${status})`);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function makeClient(api, token) {
  return async function get(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(`${api}/api/twitch-bot/overlay${path}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        mode: 'cors',
        signal: controller.signal,
      });
    } catch {
      throw new RequestFailed(0);
    } finally {
      clearTimeout(timer);
    }
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok || !body || body.success !== true) {
      const header = Number(response.headers.get('Retry-After'));
      throw new RequestFailed(response.status, Number.isFinite(header) ? header * 1000 : 0);
    }
    return body;
  };
}

function safeCall(fn, ...args) {
  if (typeof fn !== 'function') return;
  try {
    fn(...args);
  } catch {
    quietLog('a render step failed');
  }
}

/**
 * Start a widget page. Handlers: `onConfig(config, channel)`, `onState(state)`,
 * `onEvent(envelope)`. Returns `{refreshState()}` (or null when the URL is not
 * a valid overlay link, in which case the page stays empty).
 */
export function startOverlay(widget, handlers = {}) {
  // The token stays in this browser source: the fragment (never sent to the website host), then
  // memory, plus a sessionStorage copy so an OBS reload of the fragment-less address still works.
  const storageKey = `acosmibot-overlay:${widget}`;
  let stored = null;
  try {
    stored = window.sessionStorage.getItem(storageKey);
  } catch {
    stored = null;
  }
  const { link: parsed, store } = resolveLink(window.location.hash, stored);
  if (store) {
    try {
      window.sessionStorage.setItem(storageKey, store);
    } catch {
      /* storage blocked: the link still works until the page reloads */
    }
  }
  try {
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch {
    /* ignore */
  }
  if (!parsed.ok) {
    quietLog(`overlay link is incomplete (${parsed.reason}); copy it again from the dashboard`);
    return null;
  }
  const get = makeClient(parsed.api, parsed.token);
  let configured = false;
  let stateLoading = false;

  async function loadState() {
    const body = await get('/state');
    safeCall(handlers.onState, body.state && typeof body.state === 'object' ? body.state : null);
  }

  async function refreshState() {
    if (!configured || stateLoading) return;
    stateLoading = true;
    try {
      await loadState();
    } catch {
      /* the feed loop retries; keep what is shown */
    } finally {
      stateLoading = false;
    }
  }

  async function run() {
    let attempt = 0;
    let needConfig = true;
    let needState = true;
    let cursor = null;
    for (;;) {
      try {
        if (needConfig) {
          const body = await get('/config');
          if (body.widget !== widget || !body.config || typeof body.config !== 'object') {
            quietLog('this link belongs to another widget');
            await sleep(UNAUTHORIZED_RETRY_MS);
            continue;
          }
          document.documentElement.style.setProperty('--scale', String(fontScale(body.config.font_scale)));
          safeCall(handlers.onConfig, body.config, body.channel || {});
          configured = true;
          needConfig = false;
        }
        if (needState) {
          await loadState();
          needState = false;
        }
        const started = Date.now();
        const query = cursor ? `?cursor=${encodeURIComponent(cursor)}&wait=${FEED_WAIT_S}` : '?wait=0';
        const body = await get(`/feed${query}`);
        if (isValidCursor(body.cursor)) cursor = body.cursor;
        const events = Array.isArray(body.events) ? body.events.slice(0, 100) : [];
        for (const envelope of events) {
          if (envelope && typeof envelope === 'object' && typeof envelope.type === 'string') safeCall(handlers.onEvent, envelope);
        }
        attempt = 0;
        const wait = clampWait(body.retry_after_ms);
        if (wait > 0) await sleep(wait);
        else if (!events.length && Date.now() - started < 500) await sleep(1000); // never spin on empty answers
      } catch (error) {
        const status = error instanceof RequestFailed ? error.status : 0;
        if (status === 401) {
          // Unknown or revoked link: show nothing and check again slowly.
          needConfig = true;
          needState = true;
          configured = false;
          safeCall(handlers.onRevoked);
          await sleep(UNAUTHORIZED_RETRY_MS);
          continue;
        }
        const serverWait = error instanceof RequestFailed ? clampWait(error.retryAfterMs) : 0;
        const delay = Math.max(serverWait, backoffDelay(attempt));
        attempt += 1;
        needState = configured; // re-sync after a reconnect; the cursor is kept
        await sleep(delay);
      }
    }
  }

  void run();
  return { refreshState };
}

// ── DOM helpers (text only) ──────────────────────────────────────────────

/** `<tag class=…>text</tag>` built with textContent. */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null && text !== '') node.textContent = String(text);
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Render chat message parts: text nodes and validated emote images. */
export function renderParts(container, parts) {
  for (const part of parts) {
    if (part.kind === 'emote') {
      const url = emoteUrl(part.id);
      if (url) {
        const img = document.createElement('img');
        img.className = 'emote';
        img.src = url;
        img.alt = part.text;
        img.decoding = 'async';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', () => img.replaceWith(document.createTextNode(part.text)), { once: true });
        container.appendChild(img);
        continue;
      }
    }
    container.appendChild(document.createTextNode(part.text));
  }
}

/** Show or hide the widget root (empty pages stay transparent). */
export function setVisible(node, visible) {
  node.hidden = !visible;
}
