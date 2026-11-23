// Pure helpers shared by the OBS overlay pages (TWITCH_BOT_SPEC.md §12.9.2).
//
// No DOM access and no globals at import time, so tests/twitch-overlay.test.ts
// can import this module from node. Everything that touches viewer-controlled
// data (names, chat text, reward input, song titles) goes through cleanText()
// here and is later rendered with textContent only (see overlay.js).

/** Widgets served from /twitch-overlay/<widget>.html. */
export const WIDGETS = Object.freeze(['alerts', 'chat', 'events', 'goal', 'label', 'leaderboard', 'giveaway', 'nowplaying']);

/** Activity kinds an alert box / event list can show. */
export const ALERT_KINDS = Object.freeze([
  'follow', 'sub', 'resub', 'gift_sub', 'community_gift', 'cheer', 'raid', 'redemption', 'hype_train',
]);

const API_PATTERNS = [/^https:\/\/api(-test)?\.acosmibot\.com$/, /^http:\/\/(localhost|127\.0\.0\.1):5000$/];
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const EMOTE_ID_RE = /^[A-Za-z0-9_]+$/;
const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const CURSOR_RE = /^\d{1,20}-\d{1,20}$/;
const SET_ID_RE = /^[a-z0-9_-]{1,32}$/;
const SOUND_RE = /\.(mp3|ogg|wav)$/i;
export const EMOTE_CDN = 'https://static-cdn.jtvnw.net/emoticons/v2/';
export const MAX_EMOTE_ID_CHARS = 64;
export const MAX_SOUND_URL_CHARS = 512;

// ── API base and fragment ────────────────────────────────────────────────

/** True only for the exact allowlisted API origins (no path, query, userinfo or other port). */
export function isAllowedApiBase(value) {
  if (typeof value !== 'string' || value.length > 64) return false;
  return API_PATTERNS.some((pattern) => pattern.test(value));
}

export function isValidToken(value) {
  return typeof value === 'string' && TOKEN_RE.test(value);
}

export function isValidCursor(value) {
  return typeof value === 'string' && CURSOR_RE.test(value);
}

/**
 * Parse `#token=<t>&api=<url-encoded base>`.
 * Returns `{ok: true, token, api}` or `{ok: false, reason}`; the reason is for
 * the console only and never contains the token.
 */
export function parseFragment(hash) {
  if (typeof hash !== 'string' || hash.length > 1024) return { ok: false, reason: 'missing' };
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return { ok: false, reason: 'missing' };
  let params;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const tokens = params.getAll('token');
  const apis = params.getAll('api');
  if (tokens.length !== 1 || !isValidToken(tokens[0])) return { ok: false, reason: 'token' };
  if (apis.length !== 1) return { ok: false, reason: 'api' };
  const api = apis[0].replace(/\/$/, '');
  if (!isAllowedApiBase(api)) return { ok: false, reason: 'api' };
  return { ok: true, token: tokens[0], api };
}

/**
 * The overlay link to use: the fragment when present, else the copy kept in
 * this browser source's sessionStorage (so OBS "refresh" / "refresh when the
 * scene becomes active", which reload the address without the fragment, keep
 * working). The stored copy is validated exactly like a fragment.
 * Returns `{link, store}`: `store` is the JSON to keep, or null.
 */
export function resolveLink(hash, storedJson) {
  const fromHash = parseFragment(hash);
  if (fromHash.ok) {
    return { link: fromHash, store: JSON.stringify({ token: fromHash.token, api: fromHash.api }) };
  }
  if (typeof hash === 'string' && hash.replace(/^#/, '') !== '') return { link: fromHash, store: null };
  if (typeof storedJson !== 'string' || storedJson.length > 512) return { link: fromHash, store: null };
  let stored;
  try {
    stored = JSON.parse(storedJson);
  } catch {
    return { link: fromHash, store: null };
  }
  if (!stored || typeof stored.token !== 'string' || typeof stored.api !== 'string') return { link: fromHash, store: null };
  const link = parseFragment(`#token=${encodeURIComponent(stored.token)}&api=${encodeURIComponent(stored.api)}`);
  return { link, store: null };
}

// ── Untrusted values ─────────────────────────────────────────────────────

// C0/C1 controls, bidi embeddings/overrides/isolates and marks, BOM, line/paragraph separators.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS_RE = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u061c\\u200e\\u200f\\u2028\\u2029\\u202a-\\u202e\\u2066-\\u2069\\ufeff]', 'g');

/** A plain one-line string: unsafe characters removed, whitespace collapsed, at most `max` code points. */
export function cleanText(value, max = 200) {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'string' ? value : (typeof value === 'number' && Number.isFinite(value) ? String(value) : '');
  if (!text) return '';
  if (text.length > max * 4 + 16) text = text.slice(0, max * 4 + 16);
  text = text.replace(UNSAFE_CHARS_RE, ' ').replace(/\s+/g, ' ').trim();
  const points = Array.from(text);
  if (points.length <= max) return text;
  return `${points.slice(0, Math.max(0, max - 1)).join('').trimEnd()}…`;
}

/** A non-negative integer or `fallback`. */
export function cleanInt(value, fallback = 0, max = 1_000_000_000_000) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const n = Math.trunc(value);
  if (n < 0) return fallback;
  return Math.min(n, max);
}

/** The Twitch emote CDN URL for a validated id, else null. */
export function emoteUrl(id) {
  if (typeof id !== 'string' || id.length > MAX_EMOTE_ID_CHARS || !EMOTE_ID_RE.test(id)) return null;
  return `${EMOTE_CDN}${id}/default/dark/2.0`;
}

/** `#RRGGBB` or '' (never any other CSS). */
export function safeColor(value) {
  return typeof value === 'string' && COLOR_RE.test(value) ? value.toLowerCase() : '';
}

/** https URL ≤ 512 chars whose path ends .mp3/.ogg/.wav, with no credentials. */
export function isSafeSoundUrl(value) {
  if (typeof value !== 'string' || value.length > MAX_SOUND_URL_CHARS) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && !url.username && !url.password && SOUND_RE.test(url.pathname);
}

// ── Retry timing ─────────────────────────────────────────────────────────

export const BACKOFF_BASE_MS = 2000;
export const BACKOFF_MAX_MS = 30000;

/**
 * Capped exponential backoff with jitter: the cap for attempt n is
 * min(30 s, 2 s × 2^n); the delay is uniformly drawn from [cap/2, cap].
 */
export function backoffDelay(attempt, random = Math.random, base = BACKOFF_BASE_MS, max = BACKOFF_MAX_MS) {
  const n = Math.max(0, Math.min(Number.isFinite(attempt) ? Math.trunc(attempt) : 0, 16));
  const cap = Math.min(max, base * 2 ** n);
  let r = Number(random());
  if (!Number.isFinite(r) || r < 0) r = 0;
  if (r > 1) r = 1;
  return Math.round(cap / 2 + (cap / 2) * r);
}

/** Server-provided waits (`retry_after_ms`, `Retry-After`) clamped to [0, 60 s]. */
export function clampWait(ms, max = 60000) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return 0;
  return Math.min(Math.trunc(ms), max);
}

/**
 * "At most every interval": `request(now)` answers how many ms to wait before
 * running (0 = run now); call `ran(now)` when the run starts.
 */
export function createThrottle(intervalMs = 30000) {
  let last = -Infinity;
  return {
    request(now) {
      const wait = last + intervalMs - now;
      return wait > 0 ? wait : 0;
    },
    ran(now) {
      last = now;
    },
  };
}

// ── Bounded containers ───────────────────────────────────────────────────

/** FIFO queue that drops its oldest item beyond `max`. */
export class BoundedQueue {
  constructor(max = 50) {
    this.max = Math.max(1, Math.trunc(max));
    this.items = [];
    this.dropped = 0;
  }

  push(item) {
    this.items.push(item);
    while (this.items.length > this.max) {
      this.items.shift();
      this.dropped += 1;
    }
  }

  shift() {
    return this.items.shift();
  }

  get size() {
    return this.items.length;
  }

  clear() {
    this.items.length = 0;
  }
}

/** A new array with `item` appended, keeping the last `max` items. */
export function appendBounded(list, item, max) {
  const next = [...list, item];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** A new array with `item` first, keeping the first `max` items. */
export function prependBounded(list, item, max) {
  return [item, ...list].slice(0, Math.max(0, max));
}

// ── Formatting ───────────────────────────────────────────────────────────

export function formatCount(value) {
  return cleanInt(value).toLocaleString('en-US');
}

const plural = (n, word) => `${formatCount(n)} ${word}${n === 1 ? '' : 's'}`;

export function tierLabel(tier, isPrime) {
  if (isPrime || tier === 'prime') return 'Prime';
  if (tier === '2000') return 'Tier 2';
  if (tier === '3000') return 'Tier 3';
  return 'Tier 1';
}

/** `m:ss` (or `h:mm:ss`) for a number of seconds. */
export function formatClock(seconds) {
  const total = cleanInt(seconds, 0, 359_999);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// ── Alerts and event list ────────────────────────────────────────────────

const NAME_MAX = 40;
const MESSAGE_MAX = 300;

function kindOf(type) {
  if (typeof type !== 'string' || !type.startsWith('activity.')) return null;
  const kind = type.slice('activity.'.length);
  return ALERT_KINDS.includes(kind) ? kind : null;
}

function describeKind(kind, data) {
  const d = data && typeof data === 'object' ? data : {};
  const name = cleanText(d.display_name, NAME_MAX);
  switch (kind) {
    case 'follow':
      return { kicker: 'New follower', name: name || 'Someone', detail: '', message: '' };
    case 'sub':
    case 'resub': {
      const months = cleanInt(d.months, 0, 10000);
      const streak = cleanInt(d.streak_months, 0, 10000);
      const tier = tierLabel(d.tier, d.is_prime === true);
      const isResub = kind === 'resub' || d.kind === 'resub';
      const parts = [tier];
      if (isResub && months > 1) parts.push(plural(months, 'month'));
      if (isResub && streak > 1) parts.push(`${formatCount(streak)}-month streak`);
      return {
        kicker: isResub ? 'Resubscribed' : (d.is_gift === true ? 'Gifted sub' : 'New subscriber'),
        name: name || 'Someone',
        detail: parts.join(' · '),
        message: cleanText(d.message, MESSAGE_MAX),
      };
    }
    case 'gift_sub': {
      const gifter = cleanText(d.gifter_display_name, NAME_MAX) || 'An anonymous gifter';
      const recipient = cleanText(d.recipient_display_name, NAME_MAX);
      return {
        kicker: 'Gift sub',
        name: gifter,
        detail: [recipient ? `to ${recipient}` : '', tierLabel(d.tier, false)].filter(Boolean).join(' · '),
        message: '',
      };
    }
    case 'community_gift': {
      const gifter = cleanText(d.gifter_display_name, NAME_MAX) || 'An anonymous gifter';
      const total = cleanInt(d.total, 1, 100000);
      return { kicker: 'Community gift', name: gifter, detail: `${plural(total, 'gift sub')} · ${tierLabel(d.tier, false)}`, message: '' };
    }
    case 'cheer': {
      const bits = cleanInt(d.bits, 0, 10_000_000);
      return { kicker: 'Cheer', name: name || 'Someone', detail: plural(bits, 'bit'), message: cleanText(d.message, MESSAGE_MAX) };
    }
    case 'raid': {
      const viewers = cleanInt(d.viewers, 0, 10_000_000);
      return { kicker: 'Raid', name: name || 'Someone', detail: `with ${plural(viewers, 'viewer')}`, message: '' };
    }
    case 'redemption':
      return {
        kicker: 'Redeemed',
        name: name || 'Someone',
        detail: cleanText(d.reward_title, 60) || 'a reward',
        message: cleanText(d.user_input, MESSAGE_MAX),
      };
    case 'hype_train': {
      const level = cleanInt(d.level, 1, 1000) || 1;
      const phase = d.phase === 'end' ? 'ended' : d.phase === 'begin' ? 'started' : 'in progress';
      return { kicker: 'Hype Train', name: `Level ${level}`, detail: `Hype Train ${phase}`, message: '' };
    }
    default:
      return null;
  }
}

/**
 * The alert card for a projected feed envelope (alerts and events widgets):
 * `{kind, kicker, name, detail, message, test, soundUrl}` or null when the
 * envelope is not an alert.
 */
export function describeAlert(envelope) {
  if (!envelope || typeof envelope !== 'object') return null;
  const type = envelope.type;
  const data = envelope.data && typeof envelope.data === 'object' ? envelope.data : {};
  if (type === 'alert.test') {
    const kind = ALERT_KINDS.includes(data.kind) ? data.kind : null;
    if (!kind) return null;
    const card = describeKind(kind, data.data);
    return card ? { kind, ...card, test: true, soundUrl: null } : null;
  }
  if (type === 'alert.sound') {
    const soundUrl = isSafeSoundUrl(data.sound_url) ? data.sound_url : null;
    return {
      kind: 'sound',
      kicker: 'Redeemed',
      name: cleanText(data.display_name, NAME_MAX) || 'Someone',
      detail: cleanText(data.item_name, 60) || 'a sound',
      message: '',
      test: false,
      soundUrl,
    };
  }
  const kind = kindOf(type);
  if (!kind) return null;
  const card = describeKind(kind, data);
  return card ? { kind, ...card, test: false, soundUrl: null } : null;
}

/** One line of the recent-events list: `{id, name, text, test}` or null. */
export function eventLine(envelope) {
  if (envelope && envelope.type === 'alert.sound') return null;
  const card = describeAlert(envelope);
  if (!card) return null;
  const id = typeof envelope.id === 'string' ? envelope.id.slice(0, 64) : '';
  let text;
  switch (card.kind) {
    case 'follow': text = 'followed'; break;
    case 'sub': text = `subscribed (${card.detail})`; break;
    case 'resub': text = `resubscribed (${card.detail})`; break;
    case 'gift_sub': text = `gifted a sub ${card.detail}`; break;
    case 'community_gift': text = `gifted ${card.detail}`; break;
    case 'cheer': text = `cheered ${card.detail}`; break;
    case 'raid': text = `raided ${card.detail}`; break;
    case 'redemption': text = `redeemed ${card.detail}`; break;
    case 'hype_train': text = card.detail; break;
    default: text = card.detail;
  }
  return { id, name: card.name, text: cleanText(text, 120), test: card.test };
}

/** Recent events, newest first, at most `max` (duplicate ids ignored). */
export function addEventLine(list, envelope, max) {
  const line = eventLine(envelope);
  if (!line) return list;
  if (line.id && list.some((item) => item.id === line.id)) return list;
  return prependBounded(list, line, max);
}

/** `state.items` (newest first) as event lines. */
export function eventLinesFromState(state, max) {
  const items = state && Array.isArray(state.items) ? state.items.slice(0, 50) : [];
  const lines = [];
  for (const item of items) {
    const line = eventLine(item);
    if (line) lines.push(line);
    if (lines.length >= max) break;
  }
  return lines;
}

// ── Chat box ─────────────────────────────────────────────────────────────

const BADGE_LABELS = { broadcaster: 'Host', moderator: 'Mod', lead_moderator: 'Mod', vip: 'VIP', subscriber: 'Sub', founder: 'Sub' };
export const MAX_FRAGMENTS = 60;
export const MAX_CHAT_CHARS = 500;

/** Short text labels for known badges (unknown sets ignored, duplicates removed). */
export function badgeLabels(badges) {
  if (!Array.isArray(badges)) return [];
  const out = [];
  for (const badge of badges.slice(0, 10)) {
    const setId = badge && typeof badge.set_id === 'string' && SET_ID_RE.test(badge.set_id) ? badge.set_id : '';
    const label = Object.prototype.hasOwnProperty.call(BADGE_LABELS, setId) ? BADGE_LABELS[setId] : '';
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}

/** Message parts: `{kind: 'text', text}` or `{kind: 'emote', text, id, url}`; at most 500 characters in total. */
export function messageParts(fragments) {
  const parts = [];
  if (!Array.isArray(fragments)) return parts;
  let budget = MAX_CHAT_CHARS;
  for (const fragment of fragments.slice(0, MAX_FRAGMENTS)) {
    if (budget <= 0 || !fragment || typeof fragment !== 'object') continue;
    const raw = typeof fragment.text === 'string' ? fragment.text.replace(UNSAFE_CHARS_RE, ' ') : '';
    if (!raw) continue;
    const url = fragment.type === 'emote' ? emoteUrl(fragment.emote_id) : null;
    const text = Array.from(raw).slice(0, budget).join('');
    budget -= Array.from(text).length;
    if (url) parts.push({ kind: 'emote', text: text.trim().slice(0, 100), id: fragment.emote_id, url });
    else if (parts.length && parts[parts.length - 1].kind === 'text') parts[parts.length - 1].text += text;
    else parts.push({ kind: 'text', text });
  }
  return parts;
}

/** The chat-box model of a `chat.message`, or null when it is unusable. */
export function chatMessageModel(data, options = {}) {
  if (!data || typeof data !== 'object') return null;
  const id = typeof data.message_id === 'string' ? data.message_id.slice(0, 64) : '';
  const userId = typeof data.user_id === 'string' ? data.user_id.slice(0, 32) : '';
  if (!id) return null;
  const parts = messageParts(data.fragments);
  if (!parts.length) return null;
  return {
    id,
    userId,
    name: cleanText(data.display_name, NAME_MAX) || 'viewer',
    color: safeColor(data.color),
    badges: options.showBadges === false ? [] : badgeLabels(data.badges),
    parts,
  };
}

/** Apply one chat feed envelope to the message list (oldest first, at most `maxMessages`). */
export function applyChatEvent(list, envelope, options = {}) {
  const max = Math.max(1, Math.min(cleanInt(options.maxMessages, 15, 50) || 15, 50));
  if (!envelope || typeof envelope !== 'object') return list;
  const data = envelope.data && typeof envelope.data === 'object' ? envelope.data : {};
  switch (envelope.type) {
    case 'chat.message': {
      const model = chatMessageModel(data, options);
      if (!model || list.some((m) => m.id === model.id)) return list;
      return appendBounded(list, model, max);
    }
    case 'chat.delete': {
      const id = typeof data.message_id === 'string' ? data.message_id : '';
      return id ? list.filter((m) => m.id !== id) : list;
    }
    case 'chat.clear_user': {
      const userId = typeof data.user_id === 'string' ? data.user_id : '';
      return userId ? list.filter((m) => m.userId !== userId) : list;
    }
    case 'chat.clear':
      return [];
    default:
      return list;
  }
}

// ── Goal bar ─────────────────────────────────────────────────────────────

function pollModel(poll) {
  if (!poll || typeof poll !== 'object' || typeof poll.id !== 'string') return null;
  const choices = Array.isArray(poll.choices) ? poll.choices.slice(0, 5).map((c) => ({
    id: typeof c?.id === 'string' ? c.id.slice(0, 64) : '',
    title: cleanText(c?.title, 25),
    votes: cleanInt(c?.votes),
  })) : [];
  return { id: poll.id.slice(0, 64), title: cleanText(poll.title, 60), status: cleanText(poll.status, 20).toUpperCase(), choices };
}

/** The goal state from `/state`. */
export function goalFromState(state) {
  const s = state && typeof state === 'object' ? state : {};
  return {
    source: typeof s.source === 'string' ? s.source : 'followers',
    title: cleanText(s.title, 60),
    current: cleanInt(s.current),
    target: Math.max(1, cleanInt(s.target, 1)),
    poll: pollModel(s.poll),
  };
}

/** Apply one goal feed envelope; `configTitle` (if set) always wins over Twitch descriptions. */
export function applyGoalEvent(goal, envelope, configTitle = '') {
  if (!envelope || typeof envelope !== 'object') return goal;
  const data = envelope.data && typeof envelope.data === 'object' ? envelope.data : {};
  const type = envelope.type;
  if (type === 'activity.follow' || type === 'activity.sub' || type === 'activity.gift_sub' || type === 'activity.community_gift') {
    const amount = cleanInt(data.amount, 0, 1_000_000);
    return amount ? { ...goal, current: goal.current + amount } : goal;
  }
  if (type === 'goal.update') {
    const target = cleanInt(data.target, 0);
    return {
      ...goal,
      current: cleanInt(data.current, goal.current),
      target: target > 0 ? target : goal.target,
      title: cleanText(configTitle, 60) || cleanText(data.description, 60) || goal.title,
    };
  }
  if (type === 'poll.update') {
    return { ...goal, poll: pollModel(data) };
  }
  return goal;
}

/** Progress in percent, clamped to 0..100. */
export function goalPercent(current, target) {
  const t = cleanInt(target);
  if (t <= 0) return 0;
  return Math.max(0, Math.min(100, (cleanInt(current) / t) * 100));
}

/** Poll choices with their share of all votes (percent, 0..100). */
export function pollShares(poll) {
  if (!poll) return [];
  const total = poll.choices.reduce((sum, c) => sum + c.votes, 0);
  return poll.choices.map((c) => ({ ...c, percent: total > 0 ? (c.votes / total) * 100 : 0 }));
}

// ── Label ────────────────────────────────────────────────────────────────

export function labelText(prefix, text) {
  const p = cleanText(prefix, 40);
  const t = cleanText(text, 140);
  if (!t) return '';
  return p ? `${p} ${t}` : t;
}

/** `{text}` for `label.text`, `{refresh: true}` for `label.refresh`, else null. */
export function applyLabelEvent(envelope) {
  if (!envelope || typeof envelope !== 'object') return null;
  if (envelope.type === 'label.text') return { text: cleanText(envelope.data?.text, 140) };
  if (envelope.type === 'label.refresh') return { refresh: true };
  return null;
}

// ── Leaderboard ──────────────────────────────────────────────────────────

export function leaderboardRows(state, count) {
  const items = state && Array.isArray(state.items) ? state.items : [];
  const max = Math.max(1, Math.min(cleanInt(count, 5), 10));
  return items.slice(0, max).map((row, index) => ({
    rank: cleanInt(row?.rank, index + 1) || index + 1,
    name: cleanText(row?.display_name, NAME_MAX) || 'viewer',
    value: formatCount(row?.value),
  }));
}

// ── Giveaway ─────────────────────────────────────────────────────────────

function giveawayModel(g) {
  if (!g || typeof g !== 'object') return null;
  const id = cleanInt(g.giveaway_id, 0);
  if (!id) return null;
  return {
    id,
    status: cleanText(g.status, 20),
    title: cleanText(g.title, 100),
    entryMode: cleanText(g.entry_mode, 20),
    keyword: cleanText(g.keyword, 40),
    entryCount: typeof g.entry_count === 'number' ? cleanInt(g.entry_count) : null,
    ticketCost: cleanInt(g.ticket_cost, 0),
  };
}

function winnerModel(w) {
  if (!w || typeof w !== 'object') return null;
  return {
    giveawayId: cleanInt(w.giveaway_id, 0),
    name: cleanText(w.display_name, NAME_MAX) || 'viewer',
    status: cleanText(w.status, 20),
    claimDeadline: typeof w.claim_deadline === 'string' ? w.claim_deadline.slice(0, 40) : null,
  };
}

export function giveawayFromState(state) {
  const s = state && typeof state === 'object' ? state : {};
  return { giveaway: giveawayModel(s.giveaway), winner: winnerModel(s.winner) };
}

export function applyGiveawayEvent(current, envelope) {
  if (!envelope || typeof envelope !== 'object') return current;
  if (envelope.type === 'giveaway.update') {
    const giveaway = giveawayModel(envelope.data);
    if (!giveaway) return current;
    const sameGiveaway = current.giveaway && current.giveaway.id === giveaway.id;
    const keepWinner = sameGiveaway && current.winner && giveaway.status !== 'open';
    return { giveaway, winner: keepWinner ? current.winner : null };
  }
  if (envelope.type === 'giveaway.winner') {
    const winner = winnerModel(envelope.data);
    return winner ? { ...current, winner } : current;
  }
  return current;
}

/** The status line of a giveaway. */
export function giveawayStatusText(giveaway) {
  if (!giveaway) return '';
  if (giveaway.status === 'open') {
    if (giveaway.entryMode === 'keyword' && giveaway.keyword) return `Type ${giveaway.keyword} to enter`;
    if (giveaway.entryMode === 'tickets') return giveaway.ticketCost ? `Buy tickets for ${formatCount(giveaway.ticketCost)} points each` : 'Buy tickets to enter';
    if (giveaway.entryMode === 'active') return 'Chat to be entered';
    return 'Entries are open';
  }
  if (giveaway.status === 'closed') return 'Entries are closed';
  if (giveaway.status === 'drawn') return 'Winner drawn';
  return '';
}

/** Whole seconds until an ISO deadline (0 when passed or invalid). */
export function secondsUntil(iso, nowMs) {
  if (typeof iso !== 'string') return 0;
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, Math.ceil((at - nowMs) / 1000));
}

// ── Now playing ──────────────────────────────────────────────────────────

function songModel(song) {
  if (!song || typeof song !== 'object' || typeof song.title !== 'string' || !song.title) return null;
  return {
    title: cleanText(song.title, 120),
    channel: cleanText(song.channel_title, 80),
    requester: typeof song.requested_by_display_name === 'string' ? cleanText(song.requested_by_display_name, NAME_MAX) || null : null,
    duration: cleanInt(song.duration_s, 0, 86400),
    startedAt: typeof song.started_at === 'string' ? song.started_at.slice(0, 40) : null,
  };
}

export function nowPlayingFromState(state) {
  const s = state && typeof state === 'object' ? state : {};
  return { current: songModel(s.current), length: cleanInt(s.length) };
}

export function applyNowPlayingEvent(current, envelope) {
  if (!envelope || typeof envelope !== 'object') return current;
  if (envelope.type === 'song.now_playing') return { ...current, current: songModel(envelope.data) };
  if (envelope.type === 'song.queue') return { ...current, length: cleanInt(envelope.data?.length, current.length) };
  return current;
}

/** `{elapsed, duration, fraction}` for the current song, or null when unknown. */
export function songProgress(song, nowMs) {
  if (!song || !song.duration || !song.startedAt) return null;
  const started = Date.parse(song.startedAt);
  if (!Number.isFinite(started)) return null;
  const elapsed = Math.max(0, Math.min(song.duration, Math.floor((nowMs - started) / 1000)));
  return { elapsed, duration: song.duration, fraction: elapsed / song.duration };
}

// ── Config helpers ───────────────────────────────────────────────────────

/** `font_scale` clamped to 0.5..2.0 (default 1). */
export function fontScale(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  return Math.max(0.5, Math.min(2, value));
}

/** An integer config value clamped to [min, max]. */
export function configInt(value, fallback, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}
