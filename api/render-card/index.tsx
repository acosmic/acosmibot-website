/**
 * Azure SWA managed function — renders a card to PNG.
 *
 * Pipeline: card data (JSON body) -> shared card component (the SAME
 * components the website renders live) -> Satori (SVG, fonts embedded as paths)
 * -> resvg-wasm (PNG). This is the canonical image the Discord bot fetches.
 *
 * One endpoint serves every card type: `card: 'weather'` and
 * `card: 'wow-profile'` select their components, while anything else falls
 * through to the rank card. That keeps a single CARD_RENDER_URL /
 * RENDER_SHARED_SECRET pair in production.
 *
 * Auth: callers must send the shared secret in `X-Render-Key`, matched against
 * the `RENDER_SHARED_SECRET` app setting. The bot (and, later, a Flask proxy)
 * hold this secret; the browser configurator never calls here (it renders the
 * component in the DOM directly).
 *
 * Build: bundled by esbuild (see api/package.json `build`) into index.js, which
 * function.json loads via entryPoint `run`.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';

import { RankCard, CARD_WIDTH, CARD_HEIGHT } from '../../src/cards/RankCard';
import {
  WeatherCard,
  CARD_WIDTH as WEATHER_WIDTH,
  CARD_HEIGHT as WEATHER_HEIGHT,
} from '../../src/cards/WeatherCard';
import {
  WowProfileCard,
  CARD_WIDTH as WOW_PROFILE_WIDTH,
  CARD_HEIGHT as WOW_PROFILE_HEIGHT,
} from '../../src/cards/WowProfileCard';
import type {
  RankCardData,
  WeatherCardData,
  WowProfileCardData,
} from '../../src/cards/types';

// ---- one-time wasm init (per cold start) -----------------------------------
let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    // `@resvg/resvg-wasm` is left external by esbuild, so require.resolve runs
    // at runtime and points at the installed package in node_modules.
    const wasmPath = join(
      dirname(require.resolve('@resvg/resvg-wasm')),
      'index_bg.wasm',
    );
    wasmReady = readFile(wasmPath).then((bytes) => initWasm(bytes));
  }
  return wasmReady;
}

// ---- fonts (bundled alongside the function) --------------------------------
let fontsCache: { name: string; data: Buffer; weight: 400 | 700; style: 'normal' }[] | null = null;
async function loadFonts() {
  if (!fontsCache) {
    const fontsDir = join(__dirname, 'fonts');
    const [regular, bold] = await Promise.all([
      readFile(join(fontsDir, 'Urbanist-Regular.ttf')),
      readFile(join(fontsDir, 'Urbanist-Bold.ttf')),
    ]);
    fontsCache = [
      { name: 'Urbanist', data: regular, weight: 400, style: 'normal' },
      { name: 'Urbanist', data: bold, weight: 700, style: 'normal' },
    ];
  }
  return fontsCache;
}

// SSRF guard: each card may fetch only its purpose-specific CDN over HTTPS.
// Without this, a leaked/abused shared secret could turn this function into a
// request proxy against internal Azure endpoints (e.g. instance metadata).
const ALLOWED_AVATAR_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);
const ALLOWED_WOW_RENDER_HOSTS = new Set(['render.worldofwarcraft.com']);
const MAX_REMOTE_IMAGE_BYTES = 8 * 1024 * 1024;

function isAllowedImageUrl(raw: string, allowedHosts: Set<string>): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && allowedHosts.has(u.hostname);
  } catch {
    return false;
  }
}

// Satori needs remote image bytes, not a bare URL — inline them as a data URI.
async function imageToDataUri(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    // `redirect: 'error'` stops an allowlisted host from bouncing us to an
    // internal address.
    const res = await fetch(url, { signal: controller.signal, redirect: 'error' });
    if (!res.ok) throw new Error(`avatar fetch failed: ${res.status}`);

    const contentType = res.headers.get('content-type') || 'image/png';
    if (!/^image\//i.test(contentType)) throw new Error('avatar is not an image');

    const declaredLen = Number(res.headers.get('content-length') || 0);
    if (declaredLen && declaredLen > MAX_REMOTE_IMAGE_BYTES) throw new Error('image too large');

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_REMOTE_IMAGE_BYTES) throw new Error('image too large');

    return `data:${contentType};base64,${buf.toString('base64')}`;
  } finally {
    clearTimeout(timer);
  }
}

async function renderPng(data: RankCardData): Promise<Buffer> {
  // Resolve the avatar to a data URI; on any failure fall back to no avatar
  // (the component draws a gray circle instead).
  let avatarUrl = '';
  if (data.avatarUrl && isAllowedImageUrl(data.avatarUrl, ALLOWED_AVATAR_HOSTS)) {
    try {
      avatarUrl = await imageToDataUri(data.avatarUrl);
    } catch {
      avatarUrl = '';
    }
  }

  const fonts = await loadFonts();
  const svg = await satori(<RankCard data={{ ...data, avatarUrl }} />, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts,
  });

  await ensureWasm();
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: CARD_WIDTH } });
  return Buffer.from(resvg.render().asPng());
}

async function renderWeatherPng(data: WeatherCardData): Promise<Buffer> {
  // No remote assets here: condition artwork is inline SVG data URIs, so there
  // is no host to allowlist and no fetch to guard.
  const fonts = await loadFonts();
  const svg = await satori(<WeatherCard data={data} />, {
    width: WEATHER_WIDTH,
    height: WEATHER_HEIGHT,
    fonts,
  });

  await ensureWasm();
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: WEATHER_WIDTH } });
  return Buffer.from(resvg.render().asPng());
}

async function renderWowProfilePng(data: WowProfileCardData): Promise<Buffer> {
  let characterImageUrl = '';
  if (
    data.characterImageUrl &&
    isAllowedImageUrl(data.characterImageUrl, ALLOWED_WOW_RENDER_HOSTS)
  ) {
    try {
      characterImageUrl = await imageToDataUri(data.characterImageUrl);
    } catch {
      characterImageUrl = '';
    }
  }

  if (!characterImageUrl) throw new Error('WoW character render unavailable');

  const fonts = await loadFonts();
  const svg = await satori(
    <WowProfileCard data={{ ...data, characterImageUrl }} />,
    {
      width: WOW_PROFILE_WIDTH,
      height: WOW_PROFILE_HEIGHT,
      fonts,
    },
  );

  await ensureWasm();
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: WOW_PROFILE_WIDTH },
  });
  return Buffer.from(resvg.render().asPng());
}

// Azure SWA managed functions may deliver the request body as a string (or a
// Buffer), not a parsed object — normalize it here.
function parseBody(req: any): unknown {
  let b = req.body;
  if (b == null && req.rawBody != null) b = req.rawBody;
  if (Buffer.isBuffer(b)) b = b.toString('utf8');
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch {
      return null;
    }
  }
  return b;
}

function isValid(data: unknown): data is RankCardData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.displayName === 'string' &&
    typeof d.guildName === 'string' &&
    typeof d.rank === 'number' &&
    typeof d.level === 'number'
  );
}

function isValidWeather(data: unknown): data is WeatherCardData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.location === 'string' &&
    typeof d.temperature === 'string' &&
    typeof d.condition === 'string' &&
    typeof d.detail === 'string' &&
    typeof d.iconCode === 'string' &&
    Array.isArray(d.days) &&
    d.days.every(
      (day) =>
        day &&
        typeof day === 'object' &&
        typeof (day as Record<string, unknown>).label === 'string' &&
        typeof (day as Record<string, unknown>).iconCode === 'string' &&
        typeof (day as Record<string, unknown>).high === 'string' &&
        typeof (day as Record<string, unknown>).low === 'string',
    )
  );
}

function isValidWowProfile(data: unknown): data is WowProfileCardData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    d.card === 'wow-profile' &&
    typeof d.characterName === 'string' &&
    typeof d.realmName === 'string' &&
    typeof d.region === 'string' &&
    typeof d.versionLabel === 'string' &&
    typeof d.level === 'number' &&
    typeof d.race === 'string' &&
    typeof d.characterClass === 'string' &&
    typeof d.faction === 'string' &&
    typeof d.guildName === 'string' &&
    typeof d.itemLevel === 'number' &&
    typeof d.isRetail === 'boolean' &&
    typeof d.activeSpec === 'string' &&
    typeof d.characterImageUrl === 'string' &&
    Array.isArray(d.stats) &&
    d.stats.every(
      (stat) =>
        !!stat &&
        typeof stat === 'object' &&
        typeof (stat as Record<string, unknown>).label === 'string' &&
        typeof (stat as Record<string, unknown>).value === 'string',
    ) &&
    Array.isArray(d.talents) &&
    d.talents.every(
      (talent) =>
        !!talent &&
        typeof talent === 'object' &&
        typeof (talent as Record<string, unknown>).name === 'string' &&
        typeof (talent as Record<string, unknown>).points === 'number',
    ) &&
    typeof d.footer === 'string'
  );
}

function secretsMatch(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual requires equal lengths; the length check itself is not
  // secret-dependent (the expected length is fixed config).
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function run(context: any, req: any): Promise<void> {
  const secret = process.env.RENDER_SHARED_SECRET;
  const provided = req.headers?.['x-render-key'];
  if (!secret || !secretsMatch(provided, secret)) {
    context.res = { status: 401, body: 'Unauthorized' };
    return;
  }

  const data = parseBody(req);
  const wantsWeather =
    !!data && typeof data === 'object' && (data as Record<string, unknown>).card === 'weather';
  const wantsWowProfile =
    !!data && typeof data === 'object' && (data as Record<string, unknown>).card === 'wow-profile';

  if (wantsWowProfile) {
    if (!isValidWowProfile(data)) {
      context.res = { status: 400, body: 'Invalid WoW profile card payload' };
      return;
    }
    try {
      const png = await renderWowProfilePng(data);
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
        body: png,
        isRaw: true,
      };
    } catch (err) {
      context.log?.error?.('WoW profile card render failed', err);
      context.res = { status: 500, body: 'Render failed' };
    }
    return;
  }

  if (wantsWeather) {
    if (!isValidWeather(data)) {
      context.res = { status: 400, body: 'Invalid weather card payload' };
      return;
    }
    try {
      const png = await renderWeatherPng(data);
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
        body: png,
        isRaw: true,
      };
    } catch (err) {
      context.log?.error?.('weather card render failed', err);
      context.res = { status: 500, body: 'Render failed' };
    }
    return;
  }

  if (!isValid(data)) {
    context.res = { status: 400, body: 'Invalid rank card payload' };
    return;
  }

  try {
    const png = await renderPng(data);
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
      body: png,
      isRaw: true,
    };
  } catch (err) {
    context.log?.error?.('rank card render failed', err);
    context.res = { status: 500, body: 'Render failed' };
  }
}
