/**
 * Azure SWA managed function — renders a rank card to PNG.
 *
 * Pipeline: RankCardData (JSON body) -> <RankCard> (the SAME component the
 * website renders live) -> Satori (SVG, fonts embedded as paths) -> resvg-wasm
 * (PNG). This is the canonical image the Discord bot fetches.
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
import type { RankCardData } from '../../src/cards/types';

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

// SSRF guard: only ever fetch avatars from Discord's CDN over HTTPS. Without
// this, a leaked/abused shared secret could turn this function into a request
// proxy against internal Azure endpoints (e.g. the instance metadata service).
const ALLOWED_AVATAR_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function isAllowedAvatarUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && ALLOWED_AVATAR_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

// Satori needs the avatar bytes, not a bare URL — inline it as a data URI.
async function avatarToDataUri(url: string): Promise<string> {
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
    if (declaredLen && declaredLen > MAX_AVATAR_BYTES) throw new Error('avatar too large');

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_AVATAR_BYTES) throw new Error('avatar too large');

    return `data:${contentType};base64,${buf.toString('base64')}`;
  } finally {
    clearTimeout(timer);
  }
}

async function renderPng(data: RankCardData): Promise<Buffer> {
  // Resolve the avatar to a data URI; on any failure fall back to no avatar
  // (the component draws a gray circle instead).
  let avatarUrl = '';
  if (data.avatarUrl && isAllowedAvatarUrl(data.avatarUrl)) {
    try {
      avatarUrl = await avatarToDataUri(data.avatarUrl);
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
  if (!isValid(data)) {
    // TEMP DIAGNOSTIC — reveals how Azure delivers the body in production.
    // Remove once the parsing path is confirmed.
    const previewOf = (v: any) =>
      typeof v === 'string'
        ? v.slice(0, 300)
        : Buffer.isBuffer(v)
          ? `<Buffer ${v.length}b> ${v.toString('utf8').slice(0, 300)}`
          : v && typeof v === 'object'
            ? Object.keys(v).slice(0, 25)
            : String(v);
    context.res = {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        error: 'Invalid rank card payload',
        debug: {
          bodyType: typeof req.body,
          bodyIsBuffer: Buffer.isBuffer(req.body),
          bodyPreview: previewOf(req.body),
          hasRawBody: req.rawBody != null,
          rawBodyType: typeof req.rawBody,
          rawBodyPreview: previewOf(req.rawBody),
          contentType: req.headers?.['content-type'],
          parsedType: typeof data,
          parsedKeys: data && typeof data === 'object' ? Object.keys(data as any) : null,
        },
      },
    };
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
