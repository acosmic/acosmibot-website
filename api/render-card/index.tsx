/**
 * Azure SWA managed function — renders a card to PNG.
 *
 * Pipeline: card data (JSON body) -> shared card component (the SAME
 * components the website renders live) -> Satori (SVG, fonts embedded as paths)
 * -> resvg-wasm (PNG). This is the canonical image the Discord bot fetches.
 *
 * One endpoint serves every card type: `card: 'weather'`, `card: 'wow-profile'`,
 * `card: 'wow-gear'`, `card: 'wow-talents'`, `card: 'wow-professions'` and
 * `card: 'ai-status'` select their components, while
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
  WowGearCard,
  CARD_WIDTH as WOW_GEAR_WIDTH,
  CARD_HEIGHT as WOW_GEAR_HEIGHT,
} from '../../src/cards/WowGearCard';
import {
  WowTalentsCard,
  CARD_WIDTH as WOW_TALENTS_WIDTH,
  talentCardHeight,
} from '../../src/cards/WowTalentsCard';
import {
  WowProfessionsCard,
  CARD_WIDTH as WOW_PROFESSIONS_WIDTH,
  professionsCardHeight,
} from '../../src/cards/WowProfessionsCard';
import {
  AIStatusCard,
  CARD_WIDTH as AI_STATUS_WIDTH,
  CARD_HEIGHT as AI_STATUS_HEIGHT,
} from '../../src/cards/AIStatusCard';
import { isValidLolCard, renderLolPng } from './lol';
export { isAllowedDataDragonAssetUrl, LOL_RENDER_LIMITS } from './lol';
export { compactLolText } from '../../src/cards/LolCards';
import type {
  AIStatusCardData,
  LolCardData,
  RankCardData,
  WeatherCardData,
  WowGearCardData,
  WowGearSlot,
  WowProfessionsCardData,
  WowTalentsCardData,
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
let aiStatusAssetsCache: { frameImageUrl: string; logoImageUrl: string } | null = null;
async function loadAIStatusAssets(): Promise<{ frameImageUrl: string; logoImageUrl: string }> {
  if (!aiStatusAssetsCache) {
    const assetsDir = join(__dirname, 'assets');
    const [frame, logo] = await Promise.all([
      readFile(join(assetsDir, 'ai-status-frame.png')),
      readFile(join(assetsDir, 'ai-status-logo.png')),
    ]);
    aiStatusAssetsCache = {
      frameImageUrl: `data:image/png;base64,${frame.toString('base64')}`,
      logoImageUrl: `data:image/png;base64,${logo.toString('base64')}`,
    };
  }
  return aiStatusAssetsCache;
}

// SSRF guard: each card may fetch only its purpose-specific CDN over HTTPS.
// Without this, a leaked/abused shared secret could turn this function into a
// request proxy against internal Azure endpoints (e.g. instance metadata).
const ALLOWED_AVATAR_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);
const ALLOWED_WOW_RENDER_HOSTS = new Set(['render.worldofwarcraft.com']);
const RANK_BACKGROUND_HOST = 'cdn.acosmibot.com';
const RANK_BACKGROUND_PATH_PREFIX = '/embed-images/rank-card-backgrounds/';
const MAX_REMOTE_IMAGE_BYTES = 8 * 1024 * 1024;

// Blizzard's 56px item icon path, e.g. /forever-eu/icons/56/133149.jpg or
// /classicann-eu/icons/56/inv_helmet_30.jpg. Nothing else on the host is an icon.
const WOW_ICON_PATH_RE = /^\/[a-z0-9-]{1,32}\/icons\/56\/[A-Za-z0-9_-]{1,96}\.jpg$/;
const WOW_GEAR_SLOTS = new Set<WowGearSlot>([
  'HEAD', 'NECK', 'SHOULDER', 'BACK', 'CHEST', 'SHIRT', 'TABARD', 'WRIST',
  'HANDS', 'WAIST', 'LEGS', 'FEET', 'FINGER_1', 'FINGER_2', 'TRINKET_1', 'TRINKET_2',
  'MAIN_HAND', 'OFF_HAND', 'RANGED',
]);
const WOW_GEAR_ICON_CONCURRENCY = 6;

export function isAllowedWowIconUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === 'https:' &&
      ALLOWED_WOW_RENDER_HOSTS.has(u.hostname) &&
      u.port === '' &&
      u.username === '' &&
      u.password === '' &&
      u.search === '' &&
      u.hash === '' &&
      WOW_ICON_PATH_RE.test(u.pathname)
    );
  } catch {
    return false;
  }
}

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

/**
 * Blizzard's per-product icon folders are not always complete (a live Forever
 * EU wand icon returned 403 while the same file id served under the Retail
 * folder). Icons are global file ids or texture names, so retry once under the
 * same region's Retail folder on the same host.
 */
export function wowIconFallbackUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const [, folder, ...rest] = u.pathname.split('/');
    const region = folder.slice(folder.lastIndexOf('-') + 1);
    if (!folder.includes('-') || !['us', 'eu', 'kr', 'tw'].includes(region)) return '';
    const fallback = `https://${u.hostname}/${region}/${rest.join('/')}`;
    return isAllowedWowIconUrl(fallback) ? fallback : '';
  } catch {
    return '';
  }
}

async function wowIconToDataUri(url: string): Promise<string> {
  try {
    return await imageToDataUri(url, 'image/jpeg');
  } catch {
    const fallback = wowIconFallbackUrl(url);
    return fallback ? imageToDataUri(fallback, 'image/jpeg').catch(() => '') : '';
  }
}

/** Fetch allowlisted icons (deduplicated, a few at a time) as data URIs. */
async function inlineWowIcons(urls: string[]): Promise<Map<string, string>> {
  const sources = [...new Set(urls.filter((url) => url && isAllowedWowIconUrl(url)))];
  const inlined = new Map<string, string>();
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(WOW_GEAR_ICON_CONCURRENCY, sources.length) }, async () => {
      while (next < sources.length) {
        const url = sources[next++];
        inlined.set(url, await wowIconToDataUri(url));
      }
    }),
  );
  return inlined;
}

async function svgToPng(svg: string, width: number): Promise<Buffer> {
  await ensureWasm();
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: width } });
  return Buffer.from(resvg.render().asPng());
}

async function renderWowTalentsPng(data: WowTalentsCardData): Promise<Buffer> {
  const trees = data.trees?.length ? data.trees : undefined;
  // The tree grid replaces the list, so only the icons it draws are fetched.
  const inlined = await inlineWowIcons([
    data.specIconUrl,
    ...(trees
      ? trees.flatMap((tree) => [tree.iconUrl, ...tree.nodes.map((node) => node.iconUrl)])
      : data.sections.flatMap((section) => section.talents.map((talent) => talent.iconUrl))),
  ]);
  const resolved: WowTalentsCardData = {
    ...data,
    specIconUrl: inlined.get(data.specIconUrl) || '',
    sections: data.sections.map((section) => ({
      ...section,
      talents: section.talents.map((talent) => ({
        ...talent,
        iconUrl: inlined.get(talent.iconUrl) || '',
      })),
    })),
    trees: trees?.map((tree) => ({
      ...tree,
      iconUrl: inlined.get(tree.iconUrl) || '',
      nodes: tree.nodes.map((node) => ({ ...node, iconUrl: inlined.get(node.iconUrl) || '' })),
    })),
  };
  const fonts = await loadFonts();
  const svg = await satori(<WowTalentsCard data={resolved} />, {
    width: WOW_TALENTS_WIDTH,
    height: talentCardHeight(resolved),
    fonts,
  });
  return svgToPng(svg, WOW_TALENTS_WIDTH);
}

async function renderWowProfessionsPng(data: WowProfessionsCardData): Promise<Buffer> {
  const inlined = await inlineWowIcons(
    [...data.primaries, ...data.secondaries].map((profession) => profession.iconUrl),
  );
  const resolve = (professions: WowProfessionsCardData['primaries']) =>
    professions.map((profession) => ({
      ...profession,
      iconUrl: inlined.get(profession.iconUrl) || '',
    }));
  const resolved = { ...data, primaries: resolve(data.primaries), secondaries: resolve(data.secondaries) };
  const fonts = await loadFonts();
  const svg = await satori(<WowProfessionsCard data={resolved} />, {
    width: WOW_PROFESSIONS_WIDTH,
    height: professionsCardHeight(resolved),
    fonts,
  });
  return svgToPng(svg, WOW_PROFESSIONS_WIDTH);
}

async function renderWowGearPng(data: WowGearCardData): Promise<Buffer> {
  // The character render is optional here: a gear sheet without the center
  // figure is still useful. Icons are deduplicated and fetched a few at a
  // time; a failed icon leaves its quality-framed tile empty.
  const characterPromise = (
    data.characterImageUrl &&
    isAllowedImageUrl(data.characterImageUrl, ALLOWED_WOW_RENDER_HOSTS)
  )
    ? imageToDataUri(data.characterImageUrl).catch(() => '')
    : Promise.resolve('');

  const inlined = await inlineWowIcons(data.items.map((item) => item.iconUrl));
  const characterImageUrl = await characterPromise;
  const items = data.items.map((item) => ({
    ...item,
    iconUrl: inlined.get(item.iconUrl) || '',
  }));

  const fonts = await loadFonts();
  const svg = await satori(
    <WowGearCard data={{ ...data, characterImageUrl, items }} />,
    {
      width: WOW_GEAR_WIDTH,
      height: WOW_GEAR_HEIGHT,
      fonts,
    },
  );

  await ensureWasm();
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: WOW_GEAR_WIDTH },
  });
  return Buffer.from(resvg.render().asPng());
}

async function renderAIStatusPng(data: AIStatusCardData): Promise<Buffer> {
  const [fonts, assets] = await Promise.all([
    loadFonts(),
    loadAIStatusAssets(),
  ]);
  const svg = await satori(
    <AIStatusCard data={data} {...assets} />,
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

async function renderLeaguePng(data: LolCardData): Promise<Buffer> {
  return renderLolPng(data, loadFonts, ensureWasm);
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

const isBoundedString = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max;

function isValidWowGear(data: unknown): data is WowGearCardData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    d.card === 'wow-gear' &&
    isBoundedString(d.characterName, 64) &&
    isBoundedString(d.realmName, 64) &&
    isBoundedString(d.region, 8) &&
    isBoundedString(d.versionLabel, 96) &&
    typeof d.level === 'number' &&
    Number.isFinite(d.level) &&
    isBoundedString(d.race, 48) &&
    isBoundedString(d.characterClass, 48) &&
    isBoundedString(d.faction, 32) &&
    isBoundedString(d.guildName, 64) &&
    isBoundedString(d.ruleset, 32) &&
    typeof d.itemLevel === 'number' &&
    Number.isFinite(d.itemLevel) &&
    typeof d.showRangedSlot === 'boolean' &&
    isBoundedString(d.characterImageUrl, 512) &&
    (d.characterImageUrl === '' ||
      isAllowedImageUrl(d.characterImageUrl, ALLOWED_WOW_RENDER_HOSTS)) &&
    Array.isArray(d.items) &&
    d.items.length <= WOW_GEAR_SLOTS.size &&
    d.items.every((entry) => {
      if (!entry || typeof entry !== 'object') return false;
      const item = entry as Record<string, unknown>;
      return (
        typeof item.slot === 'string' &&
        WOW_GEAR_SLOTS.has(item.slot as WowGearSlot) &&
        isBoundedString(item.name, 96) &&
        isBoundedString(item.quality, 24) &&
        typeof item.itemLevel === 'number' &&
        Number.isFinite(item.itemLevel) &&
        isBoundedString(item.iconUrl, 256) &&
        (item.iconUrl === '' || isAllowedWowIconUrl(item.iconUrl))
      );
    }) &&
    isBoundedString(d.footer, 120)
  );
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isOptionalWowIcon = (value: unknown): boolean =>
  isBoundedString(value, 256) && (value === '' || isAllowedWowIconUrl(value));

function isValidWowCardIdentity(d: Record<string, unknown>): boolean {
  return (
    isBoundedString(d.characterName, 64) &&
    isBoundedString(d.realmName, 64) &&
    isBoundedString(d.region, 8) &&
    isBoundedString(d.versionLabel, 96) &&
    isFiniteNumber(d.level) &&
    isBoundedString(d.race, 48) &&
    isBoundedString(d.characterClass, 48) &&
    isBoundedString(d.faction, 32) &&
    isBoundedString(d.footer, 120)
  );
}

const WOW_TALENTS_MAX = 90;

function isValidWowTalents(data: unknown): data is WowTalentsCardData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (
    d.card !== 'wow-talents' ||
    !isValidWowCardIdentity(d) ||
    !isBoundedString(d.specName, 48) ||
    !isOptionalWowIcon(d.specIconUrl) ||
    !isFiniteNumber(d.pointsSpent) ||
    !isBoundedString(d.heroTree, 48) ||
    !Array.isArray(d.sections) ||
    d.sections.length > 4
  ) return false;
  let total = 0;
  for (const entry of d.sections) {
    if (!entry || typeof entry !== 'object') return false;
    const section = entry as Record<string, unknown>;
    if (
      !isBoundedString(section.title, 48) ||
      !isFiniteNumber(section.points) ||
      !Array.isArray(section.talents)
    ) return false;
    total += section.talents.length;
    if (total > WOW_TALENTS_MAX) return false;
    for (const raw of section.talents) {
      if (!raw || typeof raw !== 'object') return false;
      const talent = raw as Record<string, unknown>;
      if (
        !isBoundedString(talent.name, 64) ||
        !isFiniteNumber(talent.rank) ||
        !isOptionalWowIcon(talent.iconUrl)
      ) return false;
    }
  }
  return d.trees === undefined || isValidWowTalentTrees(d.trees);
}

const WOW_TALENT_TREES_MAX = 4;
const WOW_TALENT_TREE_NODES_MAX = 40;

const isGridIndex = (value: unknown, max: number): boolean =>
  isFiniteNumber(value) && Number.isInteger(value) && value >= 1 && value <= max;

function isValidWowTalentTrees(value: unknown): boolean {
  if (!Array.isArray(value) || value.length > WOW_TALENT_TREES_MAX) return false;
  return value.every((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const tree = entry as Record<string, unknown>;
    if (
      !isBoundedString(tree.title, 48) ||
      !isFiniteNumber(tree.points) ||
      !isOptionalWowIcon(tree.iconUrl) ||
      !Array.isArray(tree.nodes) ||
      tree.nodes.length > WOW_TALENT_TREE_NODES_MAX
    ) return false;
    const count = tree.nodes.length;
    return tree.nodes.every((raw) => {
      if (!raw || typeof raw !== 'object') return false;
      const node = raw as Record<string, unknown>;
      return (
        isGridIndex(node.row, 12) &&
        isGridIndex(node.column, 6) &&
        isFiniteNumber(node.rank) &&
        node.rank >= 0 &&
        isGridIndex(node.maxRank, 10) &&
        isBoundedString(node.name, 64) &&
        isOptionalWowIcon(node.iconUrl) &&
        Array.isArray(node.requires) &&
        node.requires.length <= 2 &&
        node.requires.every(
          (index) => isFiniteNumber(index) && Number.isInteger(index) && index >= 0 && index < count,
        )
      );
    });
  });
}

function isValidWowProfessions(data: unknown): data is WowProfessionsCardData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  const validList = (value: unknown, max: number) =>
    Array.isArray(value) &&
    value.length <= max &&
    value.every((raw) => {
      if (!raw || typeof raw !== 'object') return false;
      const p = raw as Record<string, unknown>;
      return (
        isBoundedString(p.name, 48) &&
        isBoundedString(p.tier, 64) &&
        isFiniteNumber(p.skill) &&
        isFiniteNumber(p.maxSkill) &&
        isOptionalWowIcon(p.iconUrl)
      );
    });
  return (
    d.card === 'wow-professions' &&
    isValidWowCardIdentity(d) &&
    validList(d.primaries, 4) &&
    validList(d.secondaries, 5)
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
  const wantsWowGear =
    !!data && typeof data === 'object' && (data as Record<string, unknown>).card === 'wow-gear';
  const wowCard =
    !!data && typeof data === 'object' ? (data as Record<string, unknown>).card : undefined;
  const wantsAIStatus =
    !!data && typeof data === 'object' && (data as Record<string, unknown>).card === 'ai-status';
  const wantsLeagueCard =
    !!data
    && typeof data === 'object'
    && typeof (data as Record<string, unknown>).card === 'string'
    && (data as Record<string, unknown>).card!.startsWith('lol-');

  if (wantsLeagueCard) {
    if (!isValidLolCard(data)) {
      context.res = { status: 400, body: 'Invalid League card payload' };
      return;
    }
    try {
      const png = await renderLeaguePng(data);
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
        body: png,
        isRaw: true,
      };
    } catch {
      // The payload carries public Riot IDs. Never log it or a renderer error,
      // which may include a string from the SVG tree.
      context.log?.error?.('League card render failed');
      context.res = { status: 500, body: 'Render failed' };
    }
    return;
  }

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

  if (wowCard === 'wow-talents' || wowCard === 'wow-professions') {
    const talents = wowCard === 'wow-talents';
    const valid = talents ? isValidWowTalents(data) : isValidWowProfessions(data);
    if (!valid) {
      context.res = {
        status: 400,
        body: talents ? 'Invalid WoW talents card payload' : 'Invalid WoW professions card payload',
      };
      return;
    }
    try {
      const png = talents
        ? await renderWowTalentsPng(data as WowTalentsCardData)
        : await renderWowProfessionsPng(data as WowProfessionsCardData);
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
        body: png,
        isRaw: true,
      };
    } catch (err) {
      context.log?.error?.(`${String(wowCard)} card render failed`, err);
      context.res = { status: 500, body: 'Render failed' };
    }
    return;
  }

  if (wantsWowGear) {
    if (!isValidWowGear(data)) {
      context.res = { status: 400, body: 'Invalid WoW gear card payload' };
      return;
    }
    try {
      const png = await renderWowGearPng(data);
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
        body: png,
        isRaw: true,
      };
    } catch (err) {
      context.log?.error?.('WoW gear card render failed', err);
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
