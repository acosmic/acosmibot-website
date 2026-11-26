/**
 * Pure helpers for the media library and the alert designer: which variables each alert kind
 * may use, template checks, sample values, the stage and text box maths, and the resolved
 * design the preview overlay gets. Nothing here touches the page, so it is unit tested as is.
 */
import type {
  StreamAlertAsset,
  StreamAlertAssetKind,
  StreamAlertDesign,
  StreamAlertDesignText,
  StreamAlertMediaFacts,
  StreamAlertResolvedDesign,
  StreamAlertTier,
  StreamAlertType,
} from '../api/streamAlerts';

/** React Query keys, each carrying the account id so one account's files never show for another. */
export const assetsQueryKey = (accountId: number) => ['stream-alerts', accountId, 'assets'] as const;
export const designsQueryKey = (accountId: number) => ['stream-alerts', accountId, 'designs'] as const;

/* ---- Alert kinds, variables and fonts ---- */

export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;
export const MAX_TEXTS = 4;
export const MAX_TEMPLATE_LENGTH = 200;

export const DESIGN_KINDS: StreamAlertType[] = ['follow', 'sub', 'resub', 'gift', 'cheer', 'raid', 'hypetrain', 'donation'];

export const KIND_LABELS: Record<StreamAlertType, string> = {
  donation: 'Donation',
  follow: 'Follow',
  sub: 'New sub',
  resub: 'Resub',
  gift: 'Gift subs',
  cheer: 'Cheer',
  raid: 'Raid',
  hypetrain: 'Hype train',
};

export type TemplateVariable = 'name' | 'amount' | 'message' | 'tier' | 'months' | 'count' | 'bits' | 'viewers' | 'level';

/** The variables a template may use, per alert kind. Anything else is refused by the API. */
export const KIND_VARIABLES: Record<StreamAlertType, TemplateVariable[]> = {
  follow: ['name'],
  donation: ['name', 'amount', 'message'],
  sub: ['name', 'tier'],
  resub: ['name', 'months', 'tier', 'message'],
  gift: ['name', 'count', 'tier'],
  cheer: ['name', 'bits', 'message'],
  raid: ['name', 'viewers'],
  hypetrain: ['name', 'level'],
};

/** What each variable is, in the words the page uses. */
export const VARIABLE_LABELS: Record<TemplateVariable, string> = {
  name: 'Name',
  amount: 'Amount',
  message: 'Message',
  tier: 'Sub tier',
  months: 'Months',
  count: 'Gifted subs',
  bits: 'Bits',
  viewers: 'Raiders',
  level: 'Level',
};

/** The Google Fonts every part of stream alerts knows (API, overlay and this page). */
export const DESIGN_FONTS = [
  'Poppins', 'Montserrat', 'Bebas Neue', 'Oswald', 'Playfair Display', 'Lora', 'Merriweather', 'Roboto Slab',
  'Pacifico', 'Caveat', 'Permanent Marker', 'Righteous', 'Bangers', 'Orbitron', 'Press Start 2P',
];

/** The styles each listed font really has on Google Fonts. Asking for one it lacks fails the whole stylesheet. */
const FONT_AXES: Record<string, string> = {
  Poppins: 'ital,wght@0,400;0,700;1,400;1,700',
  Montserrat: 'ital,wght@0,400;0,700;1,400;1,700',
  Oswald: 'wght@400;700',
  'Playfair Display': 'ital,wght@0,400;0,700;1,400;1,700',
  Lora: 'ital,wght@0,400;0,700;1,400;1,700',
  Merriweather: 'ital,wght@0,400;0,700;1,400;1,700',
  'Roboto Slab': 'wght@400;700',
  Caveat: 'wght@400;700',
  Orbitron: 'wght@400;700',
};

/** One Google Fonts stylesheet for the given fonts (unknown names are left out). */
export function googleFontsHref(fonts: readonly string[] = DESIGN_FONTS): string | null {
  const known = fonts.filter((font) => DESIGN_FONTS.includes(font));
  if (known.length === 0) return null;
  const families = known.map((font) => {
    const name = font.replace(/ /g, '+');
    return `family=${FONT_AXES[font] ? `${name}:${FONT_AXES[font]}` : name}`;
  });
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}

/** The family name an uploaded font is loaded under, here and in the resolved design. */
export const uploadedFontFamily = (assetId: number) => `acosmic-font-${assetId}`;

/** The asset id in "asset:<id>", or null for a listed font. */
export function fontAssetId(font: string): number | null {
  const match = /^asset:([1-9]\d{0,15})$/.exec(font);
  return match ? Number(match[1]) : null;
}

/** The CSS font-family for a text box's font. */
export function fontCss(font: string): string {
  const id = fontAssetId(font);
  if (id !== null) return `"${uploadedFontFamily(id)}", sans-serif`;
  return `"${font.replace(/"/g, '')}", sans-serif`;
}

/** "{amount}" or "amount" from the API, as a bare name. */
const bareVariable = (value: string) => value.trim().replace(/^\{/, '').replace(/\}$/, '');

/**
 * The variables a kind may use: the API's list when it sent one, else the fixed table.
 * `name` is always first.
 */
export function variablesFor(kind: StreamAlertType, fromApi?: readonly string[] | null): string[] {
  const list = fromApi && fromApi.length > 0 ? fromApi.map(bareVariable).filter(Boolean) : KIND_VARIABLES[kind] ?? ['name'];
  const unique = [...new Set(list)];
  return ['name', ...unique.filter((name) => name !== 'name')];
}

export const variableLabel = (name: string) => VARIABLE_LABELS[name as TemplateVariable] ?? name;

/** The variables a template uses, in order, each once. */
export function templateVariables(template: string): string[] {
  return [...new Set([...template.matchAll(/\{([^{}]*)\}/g)].map((match) => match[1]))];
}

/** The template's problem in a sentence, or null when it can be saved. */
export function templateProblem(template: string, kind: StreamAlertType, allowed: readonly string[]): string | null {
  if (template.trim() === '') return 'Type some text, or add a variable such as {name}.';
  if (template.length > MAX_TEMPLATE_LENGTH) return `Keep the text to ${MAX_TEMPLATE_LENGTH} characters or fewer.`;
  const unknown = templateVariables(template).filter((name) => !allowed.includes(name));
  if (unknown.length > 0) {
    const label = KIND_LABELS[kind] ?? kind;
    const can = allowed.map((name) => `{${name}}`).join(', ');
    return `{${unknown[0]}} cannot be used in a ${label} alert. You can use ${can}.`;
  }
  const withoutVariables = template.replace(/\{[^{}]*\}/g, '');
  if (/[{}]/.test(withoutVariables)) return 'Each { needs a } after it, like {name}.';
  return null;
}

/** The text with each known variable filled in. Unknown ones stay as typed. */
export function fillTemplate(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{([^{}]*)\}/g, (whole, name: string) => (name in values ? values[name] : whole));
}

/** Puts `insert` where the cursor is (replacing a selection) and says where the cursor goes after it. */
export function insertAtCursor(value: string, start: number | null, end: number | null, insert: string): { value: string; caret: number } {
  const from = Math.max(0, Math.min(start ?? value.length, value.length));
  const to = Math.max(from, Math.min(end ?? from, value.length));
  return { value: value.slice(0, from) + insert + value.slice(to), caret: from + insert.length };
}

/* ---- Sample values ---- */

export interface SampleValues {
  name: string;
  amount: string;
  message: string;
  tier: StreamAlertTier;
  months: string;
  count: string;
  bits: string;
  viewers: string;
  level: string;
}

export const DEFAULT_SAMPLES: SampleValues = {
  name: 'Nova',
  amount: '$5.00',
  message: 'Love the stream, keep building.',
  tier: '1000',
  months: '14',
  count: '5',
  bits: '500',
  viewers: '42',
  level: '2',
};

export function tierLabel(tier: string | null | undefined): string {
  const value = String(tier ?? '1000').toLowerCase();
  if (value === 'prime') return 'Prime';
  if (value === '3000') return 'Tier 3';
  if (value === '2000') return 'Tier 2';
  return 'Tier 1';
}

/** The kind's number variable (months, gifted subs, bits, raiders, level), if it has one. */
export const NUMBER_VARIABLE: Partial<Record<StreamAlertType, 'months' | 'count' | 'bits' | 'viewers' | 'level'>> = {
  resub: 'months', gift: 'count', cheer: 'bits', raid: 'viewers', hypetrain: 'level',
};

const wholeOr = (text: string, fallback: number) => {
  const number = Number(String(text).trim());
  return Number.isFinite(number) && number >= 1 ? Math.round(number) : fallback;
};

/** "$5.00" -> 500 cents. Anything unreadable is $5.00. */
export function amountMinor(text: string): number {
  const cleaned = String(text).replace(/[^0-9.]/g, '');
  const number = Number(cleaned);
  if (!cleaned || !Number.isFinite(number) || number <= 0) return 500;
  return Math.min(Math.round(number * 100), 100_000_00);
}

const counted = (value: number) => value.toLocaleString('en-US');

/**
 * The text each variable is filled with on the stage, as the overlay fills it: numbers with
 * thousands commas, and a hype train (which has no viewer) named "Hype Train".
 */
export function sampleTemplateValues(samples: SampleValues, kind?: StreamAlertType): Record<string, string> {
  return {
    name: kind === 'hypetrain' ? 'Hype Train' : samples.name.trim() || 'Nova',
    amount: samples.amount.trim() || '$5.00',
    message: samples.message.slice(0, 220),
    tier: tierLabel(samples.tier),
    months: counted(wholeOr(samples.months, 14)),
    count: counted(wholeOr(samples.count, 5)),
    bits: counted(wholeOr(samples.bits, 500)),
    viewers: counted(wholeOr(samples.viewers, 42)),
    level: counted(wholeOr(samples.level, 2)),
  };
}

/** The kind's sample number as a number (no commas). */
const sampleNumber = (samples: SampleValues, name: 'months' | 'count' | 'bits' | 'viewers' | 'level', fallback: number) => wholeOr(samples[name], fallback);
const NUMBER_FALLBACK = { months: 14, count: 5, bits: 500, viewers: 42, level: 2 } as const;

/** The options the overlay's `AcosmicFX.fire(kind, options)` takes for these sample values. */
export function sampleFireOptions(kind: StreamAlertType, samples: SampleValues): Record<string, unknown> {
  const filled = sampleTemplateValues(samples);
  const options: Record<string, unknown> = { user: filled.name, test: true };
  if (KIND_VARIABLES[kind].includes('message')) options.text = samples.message;
  if (KIND_VARIABLES[kind].includes('tier')) options.tier = samples.tier;
  if (kind === 'donation') options.amount = filled.amount;
  const number = NUMBER_VARIABLE[kind];
  if (number) options.value = sampleNumber(samples, number, NUMBER_FALLBACK[number]);
  return options;
}

/** The test alert ("Send to OBS") for these sample values. */
export function sampleTestInput(kind: StreamAlertType, samples: SampleValues) {
  const filled = sampleTemplateValues(samples);
  const input: { type: StreamAlertType; name: string; message?: string; tier?: StreamAlertTier; value?: number; amount_minor?: number } = {
    type: kind, name: filled.name.slice(0, 32),
  };
  if (KIND_VARIABLES[kind].includes('message') && samples.message.trim()) input.message = samples.message.trim().slice(0, 200);
  if (KIND_VARIABLES[kind].includes('tier')) input.tier = samples.tier;
  if (kind === 'donation') input.amount_minor = amountMinor(samples.amount);
  const number = NUMBER_VARIABLE[kind];
  if (number) input.value = sampleNumber(samples, number, NUMBER_FALLBACK[number]);
  return input;
}

/* ---- Stage and text box maths ---- */

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/** Size of a media file (its own pixels). A file with unknown size counts as 800x600. */
export function mediaNaturalSize(facts: { width?: number | null; height?: number | null } | null | undefined): { width: number; height: number } {
  const width = Number(facts?.width) > 0 ? Number(facts?.width) : 800;
  const height = Number(facts?.height) > 0 ? Number(facts?.height) : 600;
  return { width, height };
}

/** Where the media sits on the 1920x1080 stage: centred on x, y at `scale` times its own size. */
export function mediaRect(design: Pick<StreamAlertDesign, 'x' | 'y' | 'scale'>, facts: { width?: number | null; height?: number | null } | null | undefined): Rect {
  const { width, height } = mediaNaturalSize(facts);
  const w = width * design.scale;
  const h = height * design.scale;
  return { left: design.x - w / 2, top: design.y - h / 2, width: w, height: h };
}

/** The centre after moving by stage pixels, kept on the screen and in whole pixels. */
export function moveMedia(position: { x: number; y: number }, dx: number, dy: number): { x: number; y: number } {
  return {
    x: Math.round(clamp(position.x + dx, 0, STAGE_WIDTH)),
    y: Math.round(clamp(position.y + dy, 0, STAGE_HEIGHT)),
  };
}

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 3;
export const clampScale = (scale: number) => round(clamp(Number.isFinite(scale) ? scale : 1, MIN_SCALE, MAX_SCALE), 2);

/** A good first scale: the file's own size, made smaller when it would cover most of the screen. */
export function fittingScale(facts: { width?: number | null; height?: number | null } | null | undefined): number {
  const { width, height } = mediaNaturalSize(facts);
  return clampScale(Math.min(1, (STAGE_WIDTH * 0.8) / width, (STAGE_HEIGHT * 0.8) / height));
}

/** How far the arrow keys move the alert: 10 px, 50 px with Shift, 1 px with Alt. */
export function arrowStep(key: string, shift: boolean, alt: boolean): { dx: number; dy: number } | null {
  const step = alt ? 1 : shift ? 50 : 10;
  if (key === 'ArrowLeft') return { dx: -step, dy: 0 };
  if (key === 'ArrowRight') return { dx: step, dy: 0 };
  if (key === 'ArrowUp') return { dx: 0, dy: -step };
  if (key === 'ArrowDown') return { dx: 0, dy: step };
  return null;
}

/** The stage's scale for a box this many screen pixels wide. */
export const stageScaleFor = (boxWidth: number) => (boxWidth > 0 ? boxWidth / STAGE_WIDTH : 0);

/** Screen pixels moved over a stage shown at `stageScale`, as stage pixels. */
export const screenToStage = (screenPixels: number, stageScale: number) => (stageScale > 0 ? screenPixels / stageScale : 0);

/** Screen pixels moved over the media, as fractions of the media box. */
export function screenToBoxFraction(dx: number, dy: number, stageScale: number, media: Rect): { dx: number; dy: number } {
  if (stageScale <= 0 || media.width <= 0 || media.height <= 0) return { dx: 0, dy: 0 };
  return { dx: dx / stageScale / media.width, dy: dy / stageScale / media.height };
}

/** Where a text box sits on the stage. */
export function boxRect(box: Pick<StreamAlertDesignText, 'x' | 'y' | 'w' | 'h'>, media: Rect): Rect {
  return { left: media.left + box.x * media.width, top: media.top + box.y * media.height, width: box.w * media.width, height: box.h * media.height };
}

export const MIN_BOX = 0.04;
type BoxGeometry = Pick<StreamAlertDesignText, 'x' | 'y' | 'w' | 'h'>;

/** The box moved by fractions of the media, kept inside the media. */
export function moveBox<B extends BoxGeometry>(box: B, dx: number, dy: number): B {
  return { ...box, x: round(clamp(box.x + dx, 0, 1 - box.w), 4), y: round(clamp(box.y + dy, 0, 1 - box.h), 4) };
}

/** The box resized from its bottom right corner, kept inside the media and at least a little bigger than nothing. */
export function resizeBox<B extends BoxGeometry>(box: B, dw: number, dh: number): B {
  return { ...box, w: round(clamp(box.w + dw, MIN_BOX, 1 - box.x), 4), h: round(clamp(box.h + dh, MIN_BOX, 1 - box.y), 4) };
}

/** True when the box shows at `ms` into the alert. */
export function boxVisibleAt(box: Pick<StreamAlertDesignText, 'appear_ms' | 'disappear_ms'>, ms: number): boolean {
  return ms >= box.appear_ms && (box.disappear_ms === null || ms < box.disappear_ms);
}

/** How long the alert lasts: the video's length, or the image's `duration_ms`. */
export function alertLength(design: Pick<StreamAlertDesign, 'video' | 'duration_ms'>, video: { duration_ms?: number | null } | null | undefined): number {
  if (design.video !== null && Number(video?.duration_ms) > 0) return Number(video?.duration_ms);
  return design.duration_ms;
}

/** Where a time sits on the timeline, 0 to 100. */
export const timelinePercent = (ms: number, length: number) => (length > 0 ? clamp((ms / length) * 100, 0, 100) : 0);

/**
 * The largest font size from `size` down to `min` that `fits`. Halves the gap each step, so a
 * box is measured about eight times rather than once per pixel.
 */
export function shrinkToFit(size: number, fits: (size: number) => boolean, min = 4): number {
  if (fits(size)) return size;
  let low = min;
  let high = size;
  if (!fits(low)) return low;
  while (high - low > 0.5) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle;
    else high = middle;
  }
  return Math.floor(low * 2) / 2;
}

/* ---- Designs ---- */

const SECOND_TEMPLATE: Record<StreamAlertType, string> = {
  follow: 'Thanks for the follow!',
  donation: '{amount}',
  sub: '{tier}',
  resub: '{months} months',
  gift: 'gifted {count} subs',
  cheer: '{bits} bits',
  raid: '{viewers} raiders',
  hypetrain: 'Level {level}',
};
const BOX_TOPS = [0.4, 0.58, 0.74, 0.2];

/** A new text box: the name first, then the kind's own detail, then the message where there is one. */
export function defaultText(kind: StreamAlertType, index: number, media?: { width?: number | null; height?: number | null } | null): StreamAlertDesignText {
  const { height } = mediaNaturalSize(media);
  const template = index === 0 ? '{name}'
    : index === 1 ? SECOND_TEMPLATE[kind]
      : index === 2 && KIND_VARIABLES[kind].includes('message') ? '{message}'
        : 'Thank you!';
  const tall = index === 0 ? 0.16 : 0.12;
  return {
    template,
    x: 0.1,
    y: BOX_TOPS[index % BOX_TOPS.length],
    w: 0.8,
    h: tall,
    font: 'Poppins',
    size: Math.round(clamp(height * (index === 0 ? 0.1 : 0.07), 8, 400)),
    color: '#ffffff',
    weight: index === 0 ? 700 : 400,
    italic: false,
    align: 'center',
    shadow: true,
    appear_ms: 0,
    disappear_ms: null,
    entrance: 'fade',
    fit: 'shrink',
  };
}

/** A first design for a video or picture: in the middle of the screen with the name on it. */
export function newDesign(kind: StreamAlertType, media: Pick<StreamAlertAsset, 'id' | 'kind' | 'width' | 'height' | 'duration_ms'>): StreamAlertDesign {
  return {
    video: media.kind === 'video' ? media.id : null,
    image: media.kind === 'image' ? media.id : null,
    sound: null,
    duration_ms: 6000,
    x: STAGE_WIDTH / 2,
    y: STAGE_HEIGHT / 2,
    scale: fittingScale(media),
    volume: 0.8,
    texts: [defaultText(kind, 0, media)],
  };
}

const numberOr = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const idOrNull = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null);

/** A design from the API with every field present and in a fixed order, so two copies compare by JSON. */
export function normalizeDesign(raw: Partial<StreamAlertDesign> | null | undefined): StreamAlertDesign {
  const source = raw ?? {};
  const texts = Array.isArray(source.texts) ? source.texts : [];
  return {
    video: idOrNull(source.video),
    image: idOrNull(source.image),
    sound: idOrNull(source.sound),
    duration_ms: numberOr(source.duration_ms, 6000),
    x: numberOr(source.x, STAGE_WIDTH / 2),
    y: numberOr(source.y, STAGE_HEIGHT / 2),
    scale: numberOr(source.scale, 1),
    volume: numberOr(source.volume, 0.8),
    texts: texts.slice(0, MAX_TEXTS).map((text) => normalizeText(text)),
  };
}

function normalizeText(raw: Partial<StreamAlertDesignText>): StreamAlertDesignText {
  return {
    template: typeof raw.template === 'string' ? raw.template : '',
    x: numberOr(raw.x, 0.1),
    y: numberOr(raw.y, 0.4),
    w: numberOr(raw.w, 0.8),
    h: numberOr(raw.h, 0.16),
    font: typeof raw.font === 'string' && raw.font ? raw.font : 'Poppins',
    size: numberOr(raw.size, 56),
    color: typeof raw.color === 'string' ? raw.color : '#ffffff',
    weight: raw.weight === 700 ? 700 : 400,
    italic: raw.italic === true,
    align: raw.align === 'left' || raw.align === 'right' ? raw.align : 'center',
    shadow: raw.shadow === true,
    appear_ms: numberOr(raw.appear_ms, 0),
    disappear_ms: typeof raw.disappear_ms === 'number' && Number.isFinite(raw.disappear_ms) ? raw.disappear_ms : null,
    entrance: raw.entrance === 'fade' || raw.entrance === 'typewriter' ? raw.entrance : 'none',
    fit: raw.fit === 'none' ? 'none' : 'shrink',
  };
}

/** True when the two designs would save the same. */
export function sameDesign(a: StreamAlertDesign | null | undefined, b: StreamAlertDesign | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return JSON.stringify(normalizeDesign(a)) === JSON.stringify(normalizeDesign(b));
}

/** "texts[0].template" and "texts.0.template" both become "texts.0.template". */
export function normalizeField(field: unknown): string | null {
  if (typeof field !== 'string' || !field.trim()) return null;
  return field.trim().replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '');
}

/** The text box a field path is about, or null. */
export function fieldTextIndex(field: string | null): number | null {
  const match = /^texts\.(\d+)(\.|$)/.exec(field ?? '');
  return match ? Number(match[1]) : null;
}

export interface DesignProblem {
  field: string;
  error: string;
}

type LibraryAsset = Pick<StreamAlertAsset, 'id' | 'kind' | 'status' | 'url' | 'width' | 'height' | 'duration_ms' | 'has_alpha' | 'has_audio' | 'font_family'>;

const ASSET_WORD: Record<StreamAlertAssetKind, string> = { video: 'video', image: 'picture', sound: 'sound', font: 'font' };

function assetProblem(id: number | null, kind: StreamAlertAssetKind, assets: readonly LibraryAsset[]): string | null {
  if (id === null) return null;
  const asset = assets.find((item) => item.id === id);
  if (!asset) return `That ${ASSET_WORD[kind]} is no longer in your media library. Pick another one.`;
  if (asset.kind !== kind) return `That file is not a ${ASSET_WORD[kind]}. Pick another one.`;
  if (asset.status !== 'ready') return `That ${ASSET_WORD[kind]} is not ready yet. Wait until it has finished converting.`;
  return null;
}

/**
 * Everything the API would refuse, found before sending, each with the field it is about.
 * The API checks again; this only spares a round trip and points at the right input.
 */
export function validateDesign(
  design: StreamAlertDesign,
  kind: StreamAlertType,
  assets: readonly LibraryAsset[],
  options: { variables?: readonly string[]; fonts?: readonly string[] } = {},
): DesignProblem[] {
  const problems: DesignProblem[] = [];
  const add = (field: string, error: string | null) => { if (error) problems.push({ field, error }); };
  const allowed = options.variables ?? variablesFor(kind);
  const fonts = options.fonts ?? DESIGN_FONTS;

  if (design.video === null && design.image === null) add('video', 'Pick a video or a picture for this alert.');
  add('video', assetProblem(design.video, 'video', assets));
  if (design.video === null) add('image', assetProblem(design.image, 'image', assets));
  add('sound', assetProblem(design.sound, 'sound', assets));
  if (design.video === null && !(design.duration_ms >= 1000 && design.duration_ms <= 30000)) {
    add('duration_ms', 'Show a picture for 1 to 30 seconds.');
  }
  if (!(design.x >= 0 && design.x <= STAGE_WIDTH)) add('x', 'The alert has to stay on the screen.');
  if (!(design.y >= 0 && design.y <= STAGE_HEIGHT)) add('y', 'The alert has to stay on the screen.');
  if (!(design.scale >= MIN_SCALE && design.scale <= MAX_SCALE)) add('scale', 'Size must be from 10% to 300%.');
  if (!(design.volume >= 0 && design.volume <= 1)) add('volume', 'Volume must be from 0% to 100%.');
  if (design.texts.length > MAX_TEXTS) add('texts', `An alert can have up to ${MAX_TEXTS} texts.`);

  design.texts.forEach((text, index) => {
    const at = (name: string) => `texts.${index}.${name}`;
    add(at('template'), templateProblem(text.template, kind, allowed));
    const fontId = fontAssetId(text.font);
    if (fontId !== null) add(at('font'), assetProblem(fontId, 'font', assets));
    else if (!fonts.includes(text.font)) add(at('font'), 'Pick a font from the list.');
    if (!(Number.isInteger(text.size) && text.size >= 8 && text.size <= 400)) add(at('size'), 'Text size must be a whole number from 8 to 400.');
    if (!/^#[0-9a-f]{6}$/i.test(text.color)) add(at('color'), 'Pick a colour.');
    if (!(text.appear_ms >= 0 && text.appear_ms <= 30000)) add(at('appear_ms'), 'Appear time must be from 0 to 30 seconds.');
    if (text.disappear_ms !== null && !(text.disappear_ms > text.appear_ms && text.disappear_ms <= 30000)) {
      add(at('disappear_ms'), 'The text has to disappear after it appears, and within 30 seconds.');
    }
    const inside = [text.x, text.y, text.w, text.h].every((value) => value >= 0 && value <= 1)
      && text.w > 0 && text.h > 0 && text.x + text.w <= 1.0001 && text.y + text.h <= 1.0001;
    if (!inside) add(at('x'), 'The text box has to stay on the video or picture.');
  });
  return problems;
}

const facts = (asset: LibraryAsset): StreamAlertMediaFacts => ({
  url: asset.url ?? '',
  width: asset.width,
  height: asset.height,
  duration_ms: asset.duration_ms,
  has_audio: asset.has_audio,
  has_alpha: asset.has_alpha,
});

/**
 * The draft as the overlay would get it once saved: asset ids replaced by the library's facts
 * and uploaded fonts given their family. Null when a file it needs is not ready (or gone).
 */
export function resolveDraft(design: StreamAlertDesign, assets: readonly LibraryAsset[]): StreamAlertResolvedDesign | null {
  const ready = (id: number | null, kind: StreamAlertAssetKind) => {
    if (id === null) return null;
    const asset = assets.find((item) => item.id === id && item.kind === kind && item.status === 'ready' && item.url);
    return asset ?? undefined;
  };
  const video = ready(design.video, 'video');
  const image = design.video === null ? ready(design.image, 'image') : null;
  const sound = ready(design.sound, 'sound');
  if (video === undefined || image === undefined || sound === undefined) return null;
  if (!video && !image) return null;
  const fonts: { family: string; url: string }[] = [];
  const texts: StreamAlertDesignText[] = [];
  for (const text of design.texts) {
    const fontId = fontAssetId(text.font);
    if (fontId === null) {
      texts.push({ ...text });
      continue;
    }
    const font = ready(fontId, 'font');
    if (!font) return null;
    const family = uploadedFontFamily(fontId);
    if (!fonts.some((item) => item.family === family)) fonts.push({ family, url: font.url ?? '' });
    texts.push({ ...text, font: family });
  }
  return {
    video: video ? facts(video) : null,
    image: image ? facts(image) : null,
    sound: sound ? facts(sound) : null,
    duration_ms: design.duration_ms,
    x: design.x,
    y: design.y,
    scale: design.scale,
    volume: design.volume,
    texts,
    fonts,
  };
}

/* ---- Media library ---- */

export const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;

export const ASSET_KIND_LABELS: Record<StreamAlertAssetKind, string> = { video: 'Video', image: 'Picture', sound: 'Sound', font: 'Font' };

/** What the upload button accepts, in plain words. The API decides by the file's content. */
export const ACCEPTED_WORDS = [
  'Videos: MP4, MOV (including ProRes 4444 with transparency), WebM, MKV, and animated GIF, PNG or WebP. Up to 30 seconds.',
  'Pictures: PNG, JPEG, WebP or GIF.',
  'Sounds: MP3, WAV, OGG, FLAC, AAC or M4A. Up to 30 seconds.',
  'Fonts: TTF, OTF, WOFF or WOFF2.',
];

export const UPLOAD_ACCEPT = [
  '.mp4', '.m4v', '.mov', '.webm', '.mkv', '.gif', '.png', '.apng', '.webp', '.jpg', '.jpeg',
  '.mp3', '.wav', '.ogg', '.oga', '.opus', '.flac', '.aac', '.m4a', '.ttf', '.otf', '.woff', '.woff2',
  'video/*', 'image/*', 'audio/*',
].join(',');

/** "812 KB", "4.2 MB". */
export function formatBytes(bytes: number | null | undefined): string {
  const value = Math.max(0, Number(bytes) || 0);
  if (value < 1024) return `${value} bytes`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** "6.0 s", "1:05". */
export function formatLength(ms: number | null | undefined): string {
  const value = Math.max(0, Number(ms) || 0);
  if (value < 60_000) return `${(value / 1000).toFixed(1)} s`;
  const seconds = Math.round(value / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** True while any file is waiting to be converted, so the list is read again every few seconds. */
export const assetsWaiting = (assets: readonly Pick<StreamAlertAsset, 'status'>[] | null | undefined) => (
  (assets ?? []).some((asset) => asset.status === 'queued' || asset.status === 'processing')
);

export function assetStatusText(asset: Pick<StreamAlertAsset, 'status' | 'error'>): string {
  if (asset.status === 'queued') return 'Waiting to convert…';
  if (asset.status === 'processing') return 'Converting…';
  if (asset.status === 'failed') return asset.error?.trim() || 'This file could not be converted.';
  return 'Ready';
}

/** "Transparent" or "Has a background" for videos and pictures; nothing for sounds and fonts. */
export function backgroundText(asset: Pick<StreamAlertAsset, 'kind' | 'status' | 'has_alpha'>): string | null {
  if (asset.status !== 'ready' || (asset.kind !== 'video' && asset.kind !== 'image')) return null;
  return asset.has_alpha ? 'Transparent' : 'Has a background';
}

/** "Used by your Follow alert", "Used by your Follow and Raid alerts". */
export function inUseText(kinds: readonly StreamAlertType[]): string | null {
  if (kinds.length === 0) return null;
  const labels = kinds.map((kind) => KIND_LABELS[kind] ?? kind);
  const words = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  return `Used by your ${words} ${kinds.length === 1 ? 'alert' : 'alerts'}`;
}

/** Only videos and pictures can have their black background removed. Sounds and fonts never send the choice. */
export function canRemoveBlack(file: { name: string; type: string }): boolean {
  if (/^(audio|font)\//.test(file.type)) return false;
  return !/\.(mp3|wav|ogg|oga|opus|flac|aac|m4a|ttf|otf|woff2?)$/i.test(file.name);
}
