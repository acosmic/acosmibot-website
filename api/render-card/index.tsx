/**
 * Azure SWA managed function — renders a card to PNG.
 *
 * Pipeline: card data (JSON body) -> shared card component (the SAME
 * components the website renders live) -> Satori (SVG, fonts embedded as paths)
 * -> resvg-wasm (PNG). This is the canonical image the Discord bot fetches.
 *
 * One endpoint serves every card type: `card: 'weather'` and
 * `card: 'wow-profile'` and `card: 'ai-status'` select their components, while
 * anything else falls through to the rank card. That keeps a single
 * CARD_RENDER_URL / RENDER_SHARED_SECRET pair in production.
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
import {
  AIStatusCard,
  CARD_WIDTH as AI_STATUS_WIDTH,
  CARD_HEIGHT as AI_STATUS_HEIGHT,
} from '../../src/cards/AIStatusCard';
import type {
  AIStatusCardData,
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

// Static Acosmibot artwork is shipped beside the managed function and inlined
// before Satori renders. Keeping it local avoids a new remote-image trust path.
let aiStatusMascotCache: string | null = null;
async function loadAIStatusMascot(): Promise<string> {
  if (!aiStatusMascotCache) {
    const imagePath = join(__dirname, 'assets', 'ai-status-mascot.png');
    const image = await readFile(imagePath);
    aiStatusMascotCache = `data:image/png;base64,${image.toString('base64')}`;
  }
  return aiStatusMascotCache;
}

// SSRF guard: each card may fetch only its purpose-specific CDN over HTTPS.
// Without this, a leaked/abused shared secret could turn this function into a
// request proxy against internal Azure endpoints (e.g. instance metadata).
const ALLOWED_AVATAR_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);
const ALLOWED_WOW_RENDER_HOSTS = new Set(['render.worldofwarcraft.com']);
const RANK_BACKGROUND_HOST = 'cdn.acosmibot.com';
const RANK_BACKGROUND_PATH_PREFIX = '/embed-images/rank-card-backgrounds/';
const MAX_REMOTE_IMAGE_BYTES = 8 * 1024 * 1024;

function isAllowedImageUrl(raw: string, allowedHosts: Set<string>): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && allowedHosts.has(u.hostname);
  } catch {
    return false;
  }
}

function isAllowedRankBackgroundUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    const filename = u.pathname.slice(RANK_BACKGROUND_PATH_PREFIX.length);
    return (
      u.protocol === 'https:' &&
      u.hostname === RANK_BACKGROUND_HOST &&
      u.port === '' &&
      u.username === '' &&
      u.password === '' &&
      u.search === '' &&
      u.hash === '' &&
      u.pathname.startsWith(RANK_BACKGROUND_PATH_PREFIX) &&
      /^[a-z0-9][a-z0-9-]{0,99}\.png$/.test(filename)
    );
  } catch {
    return false;
  }
}

// Satori needs remote image bytes, not a bare URL — inline them as a data URI.
async function imageToDataUri(url: string, requiredContentType?: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    // `redirect: 'error'` stops an allowlisted host from bouncing us to an
    // internal address.
    const res = await fetch(url, { signal: controller.signal, redirect: 'error' });
    if (!res.ok) throw new Error(`image fetch failed: ${res.status}`);

    const contentType = res.headers.get('content-type') || 'image/png';
    if (!/^image\//i.test(contentType)) throw new Error('response is not an image');
    if (
      requiredContentType &&
      contentType.split(';', 1)[0].trim().toLowerCase() !== requiredContentType
    ) throw new Error('image has an unexpected content type');

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
  // Resolve purpose-allowlisted remote assets in parallel. Any fetch failure
  // falls back to the ordinary card/avatar placeholders.
  const avatarSource = (
    data.avatarUrl && isAllowedImageUrl(data.avatarUrl, ALLOWED_AVATAR_HOSTS)
  ) ? data.avatarUrl : '';
  const backgroundSource = (
    data.loadout?.backgroundImageUrl &&
    isAllowedRankBackgroundUrl(data.loadout.backgroundImageUrl)
  ) ? data.loadout.backgroundImageUrl : '';
  const [avatarUrl, backgroundImageUrl] = await Promise.all([
    avatarSource ? imageToDataUri(avatarSource).catch(() => '') : Promise.resolve(''),
    backgroundSource
      ? imageToDataUri(backgroundSource, 'image/png').catch(() => '')
      : Promise.resolve(''),
  ]);

  const loadout = data.loadout
    ? { ...data.loadout, backgroundImageUrl }
    : undefined;

  const fonts = await loadFonts();
  const svg = await satori(<RankCard data={{ ...data, avatarUrl, loadout }} />, {
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

async function renderAIStatusPng(data: AIStatusCardData): Promise<Buffer> {
  const [fonts, mascotImageUrl] = await Promise.all([
    loadFonts(),
    loadAIStatusMascot(),
  ]);
  const svg = await satori(
    <AIStatusCard data={data} mascotImageUrl={mascotImageUrl} />,
    {
      width: AI_STATUS_WIDTH,
      height: AI_STATUS_HEIGHT,
      fonts,
    },
  );

  await ensureWasm();
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: AI_STATUS_WIDTH },
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
  const loadout = d.loadout;
  const validLoadout = loadout === undefined || (
    loadout !== null &&
    typeof loadout === 'object' &&
    !Array.isArray(loadout) &&
    (() => {
      const value = loadout as Record<string, unknown>;
      const optionalStrings = ['accentColor', 'background', 'ringColor', 'backgroundKey'];
      if (optionalStrings.some((key) => (
        value[key] !== undefined &&
        (typeof value[key] !== 'string' || (value[key] as string).length > 1024)
      ))) return false;
      if (
        value.layoutPreset !== undefined &&
        value.layoutPreset !== 'standard' &&
        value.layoutPreset !== 'artwork'
      ) return false;
      if (
        value.backgroundImageUrl !== undefined &&
        (
          typeof value.backgroundImageUrl !== 'string' ||
          !isAllowedRankBackgroundUrl(value.backgroundImageUrl)
        )
      ) return false;
      return true;
    })()
  );
  return (
    typeof d.displayName === 'string' &&
    typeof d.guildName === 'string' &&
    typeof d.rank === 'number' &&
    typeof d.level === 'number' &&
    validLoadout
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

function isValidAIStatus(data: unknown): data is AIStatusCardData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  const validStatuses = new Set([
    'enabled',
    'server-disabled',
    'globally-disabled',
    'not-configured',
  ]);
  const validUsageKeys = new Set([
    'chat-daily',
    'chat-monthly',
    'images',
    'analysis',
    'image-search',
    'summary',
  ]);
  return (
    d.card === 'ai-status' &&
    typeof d.guildName === 'string' &&
    typeof d.status === 'string' &&
    validStatuses.has(d.status) &&
    typeof d.statusLabel === 'string' &&
    typeof d.statusDetail === 'string' &&
    typeof d.tierName === 'string' &&
    typeof d.monthlyReset === 'string' &&
    typeof d.accessLabel === 'string' &&
    typeof d.accessTerm === 'string' &&
    Array.isArray(d.usage) &&
    d.usage.length <= 6 &&
    d.usage.every((entry) => {
      if (!entry || typeof entry !== 'object') return false;
      const u = entry as Record<string, unknown>;
      return (
        typeof u.key === 'string' &&
        validUsageKeys.has(u.key) &&
        typeof u.label === 'string' &&
        typeof u.used === 'number' &&
        Number.isFinite(u.used) &&
        typeof u.limit === 'number' &&
        Number.isFinite(u.limit) &&
        typeof u.detail === 'string' &&
        typeof u.locked === 'boolean'
      );
    }) &&
    typeof d.guildCreditImages === 'number' &&
    typeof d.personalCreditImages === 'number' &&
    typeof d.serverCredits === 'number' &&
    typeof d.ambientAvailable === 'boolean' &&
    typeof d.ambientRepliesEnabled === 'boolean' &&
    typeof d.ambientImagesEnabled === 'boolean' &&
    typeof d.personalityName === 'string' &&
    typeof d.personalityTraits === 'string' &&
    typeof d.personalityTemporary === 'boolean' &&
    typeof d.customPersonalityLocked === 'boolean'
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
  const wantsAIStatus =
    !!data && typeof data === 'object' && (data as Record<string, unknown>).card === 'ai-status';

  if (wantsAIStatus) {
    if (!isValidAIStatus(data)) {
      context.res = { status: 400, body: 'Invalid AI status card payload' };
      return;
    }
    try {
      const png = await renderAIStatusPng(data);
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
        body: png,
        isRaw: true,
      };
    } catch (err) {
      context.log?.error?.('AI status card render failed', err);
      context.res = { status: 500, body: 'Render failed' };
    }
    return;
  }

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
