/**
 * Pure helpers for the alert box pages: which page the address points at, the alert and
 * general settings drafts and how they compare with what is saved, variation ids and order,
 * the condition rules of each kind, the checks the API would make, and the config the preview
 * overlay gets through `AcosmicFX.applyConfig`. Nothing here touches the page.
 */
import type {
  StreamAlertAsset,
  StreamAlertAnimationNames,
  StreamAlertCondition,
  StreamAlertConditionType,
  StreamAlertDefaultsField,
  StreamAlertGeneral,
  StreamAlertKindSettings,
  StreamAlertLayout,
  StreamAlertLook,
  StreamAlertMediaFacts,
  StreamAlertMessageMinimumKind,
  StreamAlertMinimumKind,
  StreamAlertResolvedDesign,
  StreamAlertResolvedKind,
  StreamAlertResolvedLook,
  StreamAlertStyle,
  StreamAlertTier,
  StreamAlertType,
  StreamAlertDesign,
} from '../api/streamAlerts';
import {
  DESIGN_FONTS,
  fontAssetId,
  KIND_LABELS,
  KIND_VARIABLES,
  normalizeDesign,
  normalizeField,
  resolveDraft,
  templateProblem,
  uploadedFontFamily,
  validateDesign,
  variablesFor,
} from './streamAlertDesigns.ts';

/** React Query keys, each carrying the account id so one account's settings never show for another. */
export const alertsQueryKey = (accountId: number) => ['stream-alerts', accountId, 'alerts'] as const;
export const alertSettingsQueryKey = (accountId: number) => ['stream-alerts', accountId, 'alert-settings'] as const;

export const ALERT_KINDS: StreamAlertType[] = ['follow', 'sub', 'resub', 'gift', 'cheer', 'raid', 'hypetrain', 'donation'];

/** Kinds the viewer's message comes with. */
export const MESSAGE_KINDS: StreamAlertType[] = ['donation', 'resub', 'cheer'];
export const hasMessage = (kind: StreamAlertType) => MESSAGE_KINDS.includes(kind);

/* ---- Which page: ?view= ---- */

export type AlertBoxView =
  | { page: 'general' }
  | { page: 'global' }
  | { page: 'alert'; kind: StreamAlertType; variation: string | null }
  | { page: 'channel-points' }
  | { page: 'media' }
  | { page: 'activity' }
  | { page: 'connections' };

export const VIEW_PARAM = 'view';
const PLAIN_PAGES = ['general', 'global', 'channel-points', 'media', 'activity', 'connections'] as const;
export const DEFAULT_VIEW: AlertBoxView = { page: 'general' };
export const VARIATION_ID = /^v_[0-9a-f]{8}$/;

/** Donations exist only on the account that drives the overlay already installed in OBS. */
export const kindsFor = (legacy: boolean): StreamAlertType[] => (legacy ? ALERT_KINDS : ALERT_KINDS.filter((kind) => kind !== 'donation'));

/** "general", "follow" or "follow:v_3fa9c1d2" to a page. Anything unknown, or a kind this account lacks, is General settings. */
export function parseView(value: string | null | undefined, options: { legacy: boolean }): AlertBoxView {
  const text = String(value ?? '').trim();
  if ((PLAIN_PAGES as readonly string[]).includes(text)) return { page: text as (typeof PLAIN_PAGES)[number] } as AlertBoxView;
  const [kind, variation, ...rest] = text.split(':');
  if (rest.length || !kindsFor(options.legacy).includes(kind as StreamAlertType)) return DEFAULT_VIEW;
  if (variation === undefined) return { page: 'alert', kind: kind as StreamAlertType, variation: null };
  return VARIATION_ID.test(variation) ? { page: 'alert', kind: kind as StreamAlertType, variation } : { page: 'alert', kind: kind as StreamAlertType, variation: null };
}

export function viewParam(view: AlertBoxView): string {
  if (view.page !== 'alert') return view.page;
  return view.variation ? `${view.kind}:${view.variation}` : view.kind;
}

export const sameView = (a: AlertBoxView, b: AlertBoxView) => viewParam(a) === viewParam(b);

/** A variation page whose variation is not in the alert any more shows the alert itself. */
export function settleView(view: AlertBoxView, alert: Pick<StreamAlertKindSettings, 'variations'> | null): AlertBoxView {
  if (view.page !== 'alert' || !view.variation || !alert) return view;
  return alert.variations.some((item) => item.id === view.variation) ? view : { ...view, variation: null };
}

export interface MenuGroup {
  label: string | null;
  items: { label: string; view: AlertBoxView }[];
}

/** The left menu, in order. Kinds also list their variations, which the page adds itself. */
export function menuGroups(legacy: boolean): MenuGroup[] {
  const alert = (kind: StreamAlertType, label: string) => ({ label, view: { page: 'alert', kind, variation: null } as AlertBoxView });
  const groups: MenuGroup[] = [
    { label: null, items: [{ label: 'General settings', view: { page: 'general' } }, { label: 'Global editing', view: { page: 'global' } }] },
    { label: null, items: [alert('follow', 'Follows')] },
    { label: 'Subscriptions', items: [alert('sub', 'New subs'), alert('resub', 'Resubs'), alert('gift', 'Gift subs')] },
    { label: null, items: [alert('cheer', 'Bits'), alert('raid', 'Raids'), alert('hypetrain', 'Hype train')] },
  ];
  if (legacy) groups.push({ label: null, items: [alert('donation', 'Donations')] });
  groups.push({
    label: null,
    items: [
      { label: 'Channel points', view: { page: 'channel-points' } },
      { label: 'Media library', view: { page: 'media' } },
      { label: 'Activity', view: { page: 'activity' } },
      { label: 'Connections', view: { page: 'connections' } },
    ],
  });
  return groups;
}

/** The menu's name for a page, as the unsaved-changes step and the narrow menu say it. */
export function viewLabel(view: AlertBoxView, alert?: Pick<StreamAlertKindSettings, 'variations'> | null): string {
  for (const group of menuGroups(true)) {
    for (const item of group.items) {
      if (item.view.page === 'alert' && view.page === 'alert' && item.view.kind === view.kind) {
        const variation = view.variation ? alert?.variations.find((entry) => entry.id === view.variation) : null;
        return variation ? `${item.label}: ${variation.name || 'Variation'}` : item.label;
      }
      if (item.view.page !== 'alert' && item.view.page === view.page) return item.label;
    }
  }
  return 'this page';
}

/* ---- Names offered by the forms ---- */

export const ANIMATION_NAMES: StreamAlertAnimationNames = {
  show: ['none', 'fade', 'rise', 'drop', 'slide-left', 'slide-right', 'zoom', 'pop', 'flip', 'glitch'],
  hide: ['none', 'fade', 'rise', 'drop', 'slide-left', 'slide-right', 'zoom', 'shrink', 'flip', 'glitch'],
  intro: ['none', 'fade', 'typewriter', 'letters-rise', 'letters-pop', 'slide'],
  loop: ['none', 'wave', 'wiggle', 'pulse', 'bounce', 'glow', 'shimmer'],
  outro: ['none', 'fade', 'letters-fall', 'shrink'],
};

const NAME_LABELS: Record<string, string> = {
  none: 'None',
  fade: 'Fade',
  rise: 'Rise up',
  drop: 'Drop down',
  'slide-left': 'Slide from the left',
  'slide-right': 'Slide from the right',
  zoom: 'Zoom',
  pop: 'Pop',
  flip: 'Flip',
  glitch: 'Glitch',
  shrink: 'Shrink',
  typewriter: 'Typewriter',
  'letters-rise': 'Letters rise',
  'letters-pop': 'Letters pop',
  slide: 'Slide in',
  wave: 'Wave',
  wiggle: 'Wiggle',
  pulse: 'Pulse',
  bounce: 'Bounce',
  glow: 'Glow',
  shimmer: 'Shimmer',
  'letters-fall': 'Letters fall',
};
export const nameLabel = (name: string) => NAME_LABELS[name] ?? name.replace(/-/g, ' ');

/** The API's lists when it sends them, else the built-in ones. */
export function animationNames(fromApi?: Partial<StreamAlertAnimationNames> | null): StreamAlertAnimationNames {
  const pick = (key: keyof StreamAlertAnimationNames) => (Array.isArray(fromApi?.[key]) && fromApi![key]!.length ? fromApi![key]! : ANIMATION_NAMES[key]);
  return { show: pick('show'), hide: pick('hide'), intro: pick('intro'), loop: pick('loop'), outro: pick('outro') };
}

export const STYLES: { value: StreamAlertStyle; label: string; about: string }[] = [
  { value: 'classic', label: 'Classic', about: 'The built-in Acosmibot card.' },
  { value: 'preset', label: 'Preset', about: 'A video or picture with your text, in a ready layout.' },
  { value: 'custom', label: 'Custom', about: 'Place the media and up to four texts yourself.' },
];

export const LAYOUTS: { value: StreamAlertLayout; label: string }[] = [
  { value: 'above', label: 'Media above the text' },
  { value: 'over', label: 'Text over the media' },
  { value: 'side', label: 'Media left of the text' },
];

/* ---- Looks and alerts: defaults, normalising and comparing ---- */

export const DEFAULT_TEMPLATES: Record<StreamAlertType, string> = {
  follow: '{name} is now following!',
  sub: '{name} just subscribed!',
  resub: '{name} resubscribed for {months} months!',
  gift: '{name} gifted {count} subs!',
  cheer: '{name} cheered {bits} bits!',
  raid: '{name} is raiding with {viewers} viewers!',
  hypetrain: 'Hype train level {level}!',
  donation: '{name} donated {amount}!',
};

export function defaultLook(kind?: StreamAlertType): StreamAlertLook {
  return {
    style: 'classic',
    layout: 'above',
    media: { video: null, image: null },
    size: 100,
    volume: 0.8,
    sound: 'builtin',
    sound_volume: 0.8,
    template: kind ? DEFAULT_TEMPLATES[kind] : DEFAULT_TEMPLATES.follow,
    show_message: true,
    duration_ms: 6000,
    text_delay_ms: 0,
    animation: { show: 'fade', hide: 'fade' },
    text: { intro: 'none', loop: 'none', outro: 'none' },
    font: { family: 'Poppins', size: 48, weight: 700, color: '#ffffff', highlight: '#61daf1', shadow: true },
    custom: null,
  };
}

type Loose = Record<string, unknown>;
const isObject = (value: unknown): value is Loose => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const num = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const str = (value: unknown, fallback: string) => (typeof value === 'string' ? value : fallback);
const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
const assetId = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null);
const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T => (options.includes(value as T) ? (value as T) : fallback);

/** A look from the API (or nothing) with every field present in a fixed order, so two copies compare by JSON. */
export function normalizeLook(raw: unknown, kind?: StreamAlertType): StreamAlertLook {
  const base = defaultLook(kind);
  const source = isObject(raw) ? raw : {};
  const media = isObject(source.media) ? source.media : {};
  const animation = isObject(source.animation) ? source.animation : {};
  const text = isObject(source.text) ? source.text : {};
  const font = isObject(source.font) ? source.font : {};
  const sound = source.sound === 'builtin' || source.sound === 'none' ? source.sound : assetId(source.sound) ?? base.sound;
  return {
    style: oneOf(source.style, ['classic', 'preset', 'custom'] as const, base.style),
    layout: oneOf(source.layout, ['above', 'over', 'side'] as const, base.layout),
    media: { video: assetId(media.video), image: assetId(media.image) },
    size: num(source.size, base.size),
    volume: num(source.volume, base.volume),
    sound,
    sound_volume: num(source.sound_volume, base.sound_volume),
    template: str(source.template, base.template),
    show_message: bool(source.show_message, base.show_message),
    duration_ms: source.duration_ms === null ? null : num(source.duration_ms, base.duration_ms as number),
    text_delay_ms: num(source.text_delay_ms, base.text_delay_ms),
    animation: { show: str(animation.show, base.animation.show), hide: str(animation.hide, base.animation.hide) },
    text: { intro: str(text.intro, base.text.intro), loop: str(text.loop, base.text.loop), outro: str(text.outro, base.text.outro) },
    font: {
      family: str(font.family, base.font.family) || base.font.family,
      size: num(font.size, base.font.size),
      weight: num(font.weight, base.font.weight),
      color: str(font.color, base.font.color),
      highlight: str(font.highlight, base.font.highlight),
      shadow: bool(font.shadow, base.font.shadow),
    },
    custom: isObject(source.custom) ? normalizeDesign(source.custom as Partial<StreamAlertDesign>) : null,
  };
}

const CONDITION_TYPES: StreamAlertConditionType[] = ['random', 'viewer', 'amount_at_least', 'amount_exactly', 'months_at_least', 'months_exactly', 'tier'];

function normalizeCondition(raw: unknown, kind: StreamAlertType): StreamAlertCondition {
  const source = isObject(raw) ? raw : {};
  const type = oneOf(source.type, CONDITION_TYPES, conditionTypesFor(kind)[0]);
  const fallback = defaultCondition(kind, type).value;
  const value = typeof source.value === 'number' || typeof source.value === 'string' ? source.value : fallback;
  return { type, value };
}

/**
 * A kind's settings from the API, filled in. Nothing saved yet reads as on, classic, no
 * variations; a phase 4 design saved for the kind reads as the custom style with that design.
 */
export function normalizeAlert(raw: unknown, kind: StreamAlertType, legacyDesign?: StreamAlertDesign | null): StreamAlertKindSettings {
  if (!isObject(raw)) {
    const look = defaultLook(kind);
    if (legacyDesign) {
      look.style = 'custom';
      look.custom = normalizeDesign(legacyDesign);
    }
    return { enabled: true, look, variations: [] };
  }
  const variations = Array.isArray(raw.variations) ? raw.variations : [];
  return {
    enabled: bool(raw.enabled, true),
    look: normalizeLook(raw.look, kind),
    variations: variations.filter(isObject).slice(0, MAX_VARIATIONS).map((item, index) => ({
      id: typeof item.id === 'string' ? item.id : `v_${index.toString(16).padStart(8, '0')}`,
      name: str(item.name, ''),
      enabled: bool(item.enabled, true),
      condition: normalizeCondition(item.condition, kind),
      look: normalizeLook(item.look, kind),
    })),
  };
}

/** True when the two would save the same. */
export function sameAlert(a: StreamAlertKindSettings | null | undefined, b: StreamAlertKindSettings | null | undefined, kind: StreamAlertType): boolean {
  if (!a || !b) return !a && !b;
  return JSON.stringify(normalizeAlert(a, kind)) === JSON.stringify(normalizeAlert(b, kind));
}

/** What PUT /alerts/<kind> is sent: the whole kind, filled in. */
export const alertForApi = (alert: StreamAlertKindSettings, kind: StreamAlertType): StreamAlertKindSettings => normalizeAlert(alert, kind);

/* ---- Variations ---- */

export const MAX_VARIATIONS = 10;

/** A new "v_" + 8 hex id that no variation of the kind has yet. */
export function newVariationId(taken: readonly string[], random: () => number = Math.random): string {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    let hex = '';
    for (let i = 0; i < 8; i += 1) hex += Math.floor(Math.min(0.9999999, Math.max(0, random())) * 16).toString(16);
    const id = `v_${hex}`;
    if (!taken.includes(id)) return id;
  }
  // A random source that keeps repeating itself: count upwards instead.
  for (let n = 0; ; n += 1) {
    const id = `v_${n.toString(16).padStart(8, '0')}`;
    if (!taken.includes(id)) return id;
  }
}

/** Adds a variation at the end, starting from the alert's own look. Null when the kind already has 10. */
export function addVariation(
  alert: StreamAlertKindSettings,
  kind: StreamAlertType,
  random: () => number = Math.random,
): { alert: StreamAlertKindSettings; id: string } | null {
  if (alert.variations.length >= MAX_VARIATIONS) return null;
  const id = newVariationId(alert.variations.map((item) => item.id), random);
  const used = new Set(alert.variations.map((item) => item.name));
  let number = alert.variations.length + 1;
  while (used.has(`Variation ${number}`)) number += 1;
  const variation = {
    id,
    name: `Variation ${number}`,
    enabled: true,
    condition: defaultCondition(kind),
    look: JSON.parse(JSON.stringify(alert.look)) as StreamAlertLook,
  };
  return { alert: { ...alert, variations: [...alert.variations, variation] }, id };
}

export function updateVariation(alert: StreamAlertKindSettings, id: string, patch: Partial<StreamAlertKindSettings['variations'][number]>): StreamAlertKindSettings {
  return { ...alert, variations: alert.variations.map((item) => (item.id === id ? { ...item, ...patch, id: item.id } : item)) };
}

/** Moves a variation one place up (-1) or down (+1). The first enabled match wins, so order matters. */
export function moveVariation(alert: StreamAlertKindSettings, id: string, delta: -1 | 1): StreamAlertKindSettings {
  const from = alert.variations.findIndex((item) => item.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= alert.variations.length) return alert;
  const variations = alert.variations.slice();
  const [moved] = variations.splice(from, 1);
  variations.splice(to, 0, moved);
  return { ...alert, variations };
}

export function removeVariation(alert: StreamAlertKindSettings, id: string): StreamAlertKindSettings {
  return { ...alert, variations: alert.variations.filter((item) => item.id !== id) };
}

/* ---- Conditions ---- */

const AMOUNT_KINDS: StreamAlertType[] = ['donation', 'cheer', 'raid', 'hypetrain', 'gift'];
const TIER_KINDS: StreamAlertType[] = ['sub', 'resub', 'gift'];
export const TIERS: { value: StreamAlertTier; label: string }[] = [
  { value: '1000', label: 'Tier 1' },
  { value: '2000', label: 'Tier 2' },
  { value: '3000', label: 'Tier 3' },
  { value: 'prime', label: 'Prime' },
];

/** The condition types each kind allows. The API's list wins when it sends one. */
export function conditionTypesFor(kind: StreamAlertType, fromApi?: readonly string[] | null): StreamAlertConditionType[] {
  if (fromApi?.length) return CONDITION_TYPES.filter((type) => fromApi.includes(type));
  const types: StreamAlertConditionType[] = [];
  if (AMOUNT_KINDS.includes(kind)) types.push('amount_at_least', 'amount_exactly');
  if (kind === 'resub') types.push('months_at_least', 'months_exactly');
  if (TIER_KINDS.includes(kind)) types.push('tier');
  types.push('random', 'viewer');
  return types;
}

/** What the kind's amount counts, in the words the form uses. */
export const AMOUNT_WORDS: Partial<Record<StreamAlertType, { one: string; many: string }>> = {
  donation: { one: 'dollar', many: 'dollars' },
  cheer: { one: 'bit', many: 'bits' },
  raid: { one: 'viewer', many: 'viewers' },
  hypetrain: { one: 'level', many: 'levels' },
  gift: { one: 'gifted sub', many: 'gifted subs' },
};

export function conditionTypeLabel(kind: StreamAlertType, type: StreamAlertConditionType): string {
  const amount = AMOUNT_WORDS[kind]?.many ?? 'amount';
  switch (type) {
    case 'random': return 'Random chance';
    case 'viewer': return 'A certain viewer';
    case 'amount_at_least': return kind === 'hypetrain' ? 'Level is at least' : `${capital(amount)} at least`;
    case 'amount_exactly': return kind === 'hypetrain' ? 'Level is exactly' : `${capital(amount)} exactly`;
    case 'months_at_least': return 'Months at least';
    case 'months_exactly': return 'Months exactly';
    case 'tier': return 'Sub tier';
    default: return type;
  }
}
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const STARTING_AMOUNT: Partial<Record<StreamAlertType, number>> = { donation: 1000, cheer: 1000, raid: 50, hypetrain: 3, gift: 5 };

/** A starting condition for the kind, or for one type of it. */
export function defaultCondition(kind: StreamAlertType, type?: StreamAlertConditionType): StreamAlertCondition {
  const pick = type ?? conditionTypesFor(kind)[0];
  switch (pick) {
    case 'random': return { type: pick, value: 50 };
    case 'viewer': return { type: pick, value: '' };
    case 'tier': return { type: pick, value: '1000' };
    case 'months_at_least':
    case 'months_exactly': return { type: pick, value: 12 };
    default: return { type: pick, value: STARTING_AMOUNT[kind] ?? 1 };
  }
}

/** Changing the type starts its value over, since a percent is not a bit count. */
export const changeConditionType = (kind: StreamAlertType, type: StreamAlertConditionType) => defaultCondition(kind, type);

/** The text in the value input: donations show dollars, while the API counts cents. */
export function conditionInput(kind: StreamAlertType, condition: StreamAlertCondition): string {
  if ((condition.type === 'amount_at_least' || condition.type === 'amount_exactly') && kind === 'donation' && typeof condition.value === 'number') {
    return (condition.value / 100).toFixed(2).replace(/\.00$/, '');
  }
  return String(condition.value);
}

/** The value typed into the input, as the API takes it. Text that is not a number stays text so the check can name it. */
export function conditionFromInput(kind: StreamAlertType, type: StreamAlertConditionType, text: string): StreamAlertCondition {
  if (type === 'viewer' || type === 'tier') return { type, value: text };
  const trimmed = text.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return { type, value: trimmed };
  const number = Number(trimmed);
  if (kind === 'donation' && (type === 'amount_at_least' || type === 'amount_exactly')) return { type, value: Math.round(number * 100) };
  return { type, value: number };
}

/** What the API would say about this condition, or null. */
export function conditionProblem(kind: StreamAlertType, condition: StreamAlertCondition, allowed?: readonly string[] | null): string | null {
  const types = conditionTypesFor(kind, allowed);
  if (!types.includes(condition.type)) return `${KIND_LABELS[kind]} alerts cannot use that condition. Pick another one.`;
  const { value } = condition;
  switch (condition.type) {
    case 'random':
      return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 100 ? null : 'The chance must be a whole number from 1 to 100.';
    case 'viewer': {
      const name = String(value).trim();
      return name.length >= 1 && name.length <= 32 ? null : 'Type the viewer name, up to 32 characters.';
    }
    case 'tier':
      return TIERS.some((tier) => tier.value === value) ? null : 'Pick a sub tier.';
    default:
      if (kind === 'donation' && (condition.type === 'amount_at_least' || condition.type === 'amount_exactly')) {
        return Number.isInteger(value) && (value as number) >= 1 ? null : 'Type an amount of at least $0.01.';
      }
      return Number.isInteger(value) && (value as number) >= 1 ? null : 'Type a whole number of 1 or more.';
  }
}

const counted = (value: number) => value.toLocaleString('en-US');

/** "Bits at least 1,000", "50% chance", "Viewer is Nova". */
export function describeCondition(kind: StreamAlertType, condition: StreamAlertCondition): string {
  const { type, value } = condition;
  if (type === 'random') return `${value}% chance`;
  if (type === 'viewer') return String(value).trim() ? `Viewer is ${String(value).trim()}` : 'Viewer not set';
  if (type === 'tier') return TIERS.find((tier) => tier.value === value)?.label ?? 'Tier not set';
  const exact = type.endsWith('exactly');
  const amount = typeof value === 'number' ? value : Number.NaN;
  const shown = !Number.isFinite(amount) ? String(value)
    : kind === 'donation' && type.startsWith('amount') ? `$${(amount / 100).toFixed(2)}`
      : counted(amount);
  const what = type.startsWith('months') ? 'Months' : kind === 'hypetrain' ? 'Level' : capital(AMOUNT_WORDS[kind]?.many ?? 'amount');
  return `${what} ${exact ? 'exactly' : 'at least'} ${shown}`;
}

/* ---- Checks before saving ---- */

export interface FieldProblem {
  /** Dotted path, as `normalizeField` writes the API's own: "variations.1.look.font.family". */
  field: string;
  error: string;
}

type LibraryAsset = Pick<StreamAlertAsset, 'id' | 'kind' | 'status' | 'url' | 'width' | 'height' | 'duration_ms' | 'has_alpha' | 'has_audio' | 'font_family'>;

export interface LookContext {
  assets: readonly LibraryAsset[];
  fonts?: readonly string[];
  variables?: readonly string[];
  names?: StreamAlertAnimationNames;
}

const HEX = /^#[0-9a-f]{6}$/i;
const between = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

function assetProblem(id: number | null, kinds: readonly string[], assets: readonly LibraryAsset[], word: string): string | null {
  if (id === null) return null;
  const asset = assets.find((item) => item.id === id);
  if (!asset || !kinds.includes(asset.kind)) return `That ${word} is no longer in your media library. Pick another one.`;
  if (asset.status !== 'ready') return `That ${word} is not ready yet. Wait until it has finished converting.`;
  return null;
}

/** Everything the API would refuse in one look, each with its field under `prefix` ("look." or "variations.0.look."). */
export function validateLook(look: StreamAlertLook, kind: StreamAlertType, prefix: string, context: LookContext): FieldProblem[] {
  const problems: FieldProblem[] = [];
  const add = (field: string, error: string | null) => { if (error) problems.push({ field: `${prefix}${field}`, error }); };
  const names = context.names ?? ANIMATION_NAMES;
  const fonts = context.fonts ?? DESIGN_FONTS;
  const variables = context.variables ?? variablesFor(kind);

  if (!names.show.includes(look.animation.show)) add('animation.show', 'Pick how the alert comes in.');
  if (!names.hide.includes(look.animation.hide)) add('animation.hide', 'Pick how the alert goes away.');
  if (!between(look.sound_volume, 0, 1)) add('sound_volume', 'Sound volume must be from 0% to 100%.');
  if (typeof look.sound === 'number') add('sound', assetProblem(look.sound, ['sound'], context.assets, 'sound'));

  if (look.style === 'preset') {
    if (look.media.video !== null) add('media.video', assetProblem(look.media.video, ['video'], context.assets, 'video'));
    else if (look.media.image !== null) add('media.image', assetProblem(look.media.image, ['image'], context.assets, 'picture'));
    if (!between(look.size, 10, 200)) add('size', 'Size must be from 10% to 200%.');
    if (!between(look.volume, 0, 1)) add('volume', 'Video volume must be from 0% to 100%.');
    add('template', templateProblem(look.template, kind, variables));
    if (look.duration_ms === null) {
      if (look.media.video === null) add('duration_ms', 'Only a video can set the length. Type how many seconds to show it.');
    } else if (!between(look.duration_ms, 2000, 30000)) add('duration_ms', 'Show the alert for 2 to 30 seconds.');
    if (!between(look.text_delay_ms, 0, 10000)) add('text_delay_ms', 'The text can wait 0 to 10 seconds.');
    if (!names.intro.includes(look.text.intro)) add('text.intro', 'Pick how the text comes in.');
    if (!names.loop.includes(look.text.loop)) add('text.loop', 'Pick a letter animation.');
    if (!names.outro.includes(look.text.outro)) add('text.outro', 'Pick how the text goes away.');
    const fontId = fontAssetId(look.font.family);
    if (fontId !== null) add('font.family', assetProblem(fontId, ['font'], context.assets, 'font'));
    else if (!fonts.includes(look.font.family)) add('font.family', 'Pick a font from the list.');
    if (!(Number.isInteger(look.font.size) && look.font.size >= 8 && look.font.size <= 400)) add('font.size', 'Font size must be a whole number from 8 to 400.');
    if (!HEX.test(look.font.color)) add('font.color', 'Pick a text colour.');
    if (!HEX.test(look.font.highlight)) add('font.highlight', 'Pick a highlight colour.');
  }

  if (look.style === 'custom') {
    if (!look.custom) add('custom', 'Make the custom design first, or pick another style.');
    else {
      for (const problem of validateDesign(look.custom, kind, context.assets, { variables, fonts })) {
        add(`custom.${problem.field}`, problem.error);
      }
    }
  }
  return problems;
}

/** Everything the API would refuse in a kind's settings. */
export function validateAlert(
  alert: StreamAlertKindSettings,
  kind: StreamAlertType,
  context: LookContext & { conditions?: readonly string[] | null },
): FieldProblem[] {
  const problems = validateLook(alert.look, kind, 'look.', context);
  if (alert.variations.length > MAX_VARIATIONS) problems.push({ field: 'variations', error: `An alert can have up to ${MAX_VARIATIONS} variations.` });
  const ids = new Set<string>();
  alert.variations.forEach((variation, index) => {
    const at = `variations.${index}.`;
    if (!VARIATION_ID.test(variation.id) || ids.has(variation.id)) problems.push({ field: `${at}id`, error: 'This variation has a broken id. Delete it and add it again.' });
    ids.add(variation.id);
    const name = variation.name.trim();
    if (name.length < 1 || name.length > 40) problems.push({ field: `${at}name`, error: 'Give the variation a name of up to 40 characters.' });
    const condition = conditionProblem(kind, variation.condition, context.conditions);
    if (condition) problems.push({ field: `${at}condition.value`, error: condition });
    problems.push(...validateLook(variation.look, kind, `${at}look.`, context));
  });
  return problems;
}

/** Which variation a field is about (by position), and the rest of the path. */
export function fieldScope(field: string): { variation: number | null; rest: string } {
  const match = /^variations\.(\d+)\.(.*)$/.exec(field);
  return match ? { variation: Number(match[1]), rest: match[2] } : { variation: null, rest: field };
}

/** The API's field ("variations[1].look.font.family") in the dotted form the pages look fields up by. */
export const apiField = (field: unknown) => normalizeField(field) ?? '';

/* ---- General settings ---- */

export const MINIMUM_KINDS: { kind: StreamAlertMinimumKind; label: string; unit: string }[] = [
  { kind: 'cheer', label: 'Bits', unit: 'bits' },
  { kind: 'raid', label: 'Raids', unit: 'viewers' },
  { kind: 'gift', label: 'Gift subs', unit: 'gifted subs' },
  { kind: 'resub', label: 'Resubs', unit: 'months' },
  { kind: 'donation', label: 'Donations', unit: 'cents' },
  { kind: 'hypetrain', label: 'Hype train', unit: 'level' },
];

export const MESSAGE_MINIMUM_KINDS: { kind: StreamAlertMessageMinimumKind; label: string; unit: string }[] = [
  { kind: 'cheer', label: 'Bits', unit: 'bits' },
  { kind: 'donation', label: 'Donations', unit: 'cents' },
  { kind: 'resub', label: 'Resubs', unit: 'months' },
];

export const MAX_MINIMUM = 1_000_000;
export const MAX_WORDS = 500;
export const MAX_ALLOWED_WORDS = 200;
export const MAX_WORD_LENGTH = 40;

export function defaultGeneral(): StreamAlertGeneral {
  return {
    profanity: { mode: 'off', builtin: true, words: [], allow: [] },
    minimums: { cheer: 1, raid: 1, gift: 1, resub: 1, donation: 0, hypetrain: 1 },
    message_minimums: { cheer: 0, donation: 0, resub: 0 },
    delay_ms: 0,
    interrupt: false,
    moderation: { mode: 'off', seconds: 10 },
    defaults: defaultLook(),
  };
}

const words = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

export function normalizeGeneral(raw: unknown): StreamAlertGeneral {
  const base = defaultGeneral();
  const source = isObject(raw) ? raw : {};
  const profanity = isObject(source.profanity) ? source.profanity : {};
  const minimums = isObject(source.minimums) ? source.minimums : {};
  const messageMinimums = isObject(source.message_minimums) ? source.message_minimums : {};
  const moderation = isObject(source.moderation) ? source.moderation : {};
  return {
    profanity: {
      mode: oneOf(profanity.mode, ['off', 'replace', 'hide_message', 'skip_alert'] as const, 'off'),
      builtin: bool(profanity.builtin, true),
      words: words(profanity.words),
      allow: words(profanity.allow),
    },
    minimums: Object.fromEntries(MINIMUM_KINDS.map(({ kind }) => [kind, num(minimums[kind], base.minimums[kind])])) as StreamAlertGeneral['minimums'],
    message_minimums: Object.fromEntries(MESSAGE_MINIMUM_KINDS.map(({ kind }) => [kind, num(messageMinimums[kind], base.message_minimums[kind])])) as StreamAlertGeneral['message_minimums'],
    delay_ms: num(source.delay_ms, 0),
    interrupt: bool(source.interrupt, false),
    moderation: { mode: oneOf(moderation.mode, ['off', 'hold', 'manual'] as const, 'off'), seconds: num(moderation.seconds, 10) },
    defaults: normalizeLook(source.defaults),
  };
}

/** The General settings page's own part (everything but the defaults). */
export function generalSettingsPart(general: StreamAlertGeneral): Omit<StreamAlertGeneral, 'defaults'> {
  const { defaults: _defaults, ...rest } = normalizeGeneral(general);
  return rest;
}

export const sameGeneralSettings = (a: StreamAlertGeneral, b: StreamAlertGeneral) => JSON.stringify(generalSettingsPart(a)) === JSON.stringify(generalSettingsPart(b));
export const sameDefaults = (a: StreamAlertLook, b: StreamAlertLook) => JSON.stringify(normalizeLook(a)) === JSON.stringify(normalizeLook(b));

export function validateGeneral(general: StreamAlertGeneral): FieldProblem[] {
  const problems: FieldProblem[] = [];
  const add = (field: string, error: string) => problems.push({ field, error });
  const { profanity } = general;
  if (profanity.words.length > MAX_WORDS) add('profanity.words', `Up to ${MAX_WORDS} words.`);
  if (profanity.allow.length > MAX_ALLOWED_WORDS) add('profanity.allow', `Up to ${MAX_ALLOWED_WORDS} allowed words.`);
  if (profanity.words.some((word) => word.length < 1 || word.length > MAX_WORD_LENGTH)) add('profanity.words', `Each word can have up to ${MAX_WORD_LENGTH} characters.`);
  if (profanity.allow.some((word) => word.length < 1 || word.length > MAX_WORD_LENGTH)) add('profanity.allow', `Each word can have up to ${MAX_WORD_LENGTH} characters.`);
  const whole = (value: number) => Number.isInteger(value) && value >= 0 && value <= MAX_MINIMUM;
  for (const { kind } of MINIMUM_KINDS) if (!whole(general.minimums[kind])) add(`minimums.${kind}`, 'Type a whole number from 0 to 1000000.');
  for (const { kind } of MESSAGE_MINIMUM_KINDS) if (!whole(general.message_minimums[kind])) add(`message_minimums.${kind}`, 'Type a whole number from 0 to 1000000.');
  if (!between(general.delay_ms, 0, 30000)) add('delay_ms', 'The gap between alerts can be 0 to 30 seconds.');
  if (general.moderation.mode === 'hold' && !(Number.isInteger(general.moderation.seconds) && general.moderation.seconds >= 5 && general.moderation.seconds <= 60)) {
    add('moderation.seconds', 'Hold alerts for 5 to 60 seconds.');
  }
  return problems;
}

/**
 * Adds typed words to a chip list: split on commas and new lines, trimmed, lowercase, no
 * repeats. Says why when nothing could be added.
 */
export function addWords(list: readonly string[], typed: string, max: number): { list: string[]; error: string | null } {
  const next = list.slice();
  let error: string | null = null;
  for (const part of typed.split(/[,\n]/)) {
    const word = part.trim().toLowerCase();
    if (!word) continue;
    if (word.length > MAX_WORD_LENGTH) { error = `"${word.slice(0, 20)}…" is longer than ${MAX_WORD_LENGTH} characters.`; continue; }
    if (next.includes(word)) continue;
    if (next.length >= max) { error = `The list is full (${max} words).`; break; }
    next.push(word);
  }
  return { list: next, error };
}

/* ---- Global editing ---- */

export const APPLY_PARTS: { key: string; label: string; fields: StreamAlertDefaultsField[] }[] = [
  { key: 'layout', label: 'Layout', fields: ['layout'] },
  { key: 'size', label: 'Size', fields: ['size'] },
  { key: 'volume', label: 'Video volume', fields: ['volume'] },
  { key: 'sound_volume', label: 'Sound volume', fields: ['sound_volume'] },
  { key: 'duration_ms', label: 'Duration', fields: ['duration_ms'] },
  { key: 'text_delay_ms', label: 'Text delay', fields: ['text_delay_ms'] },
  { key: 'animations', label: 'Animations', fields: ['animation', 'text'] },
  { key: 'font', label: 'Font', fields: ['font'] },
];

/** The API's field names for the ticked parts, in a fixed order. */
export function applyFields(ticked: readonly string[]): StreamAlertDefaultsField[] {
  return APPLY_PARTS.filter((part) => ticked.includes(part.key)).flatMap((part) => part.fields);
}

/* ---- The preview overlay's config ---- */

export interface PreviewConfig {
  designs: Partial<Record<StreamAlertType, StreamAlertResolvedDesign>>;
  alerts: Partial<Record<StreamAlertType, StreamAlertResolvedKind>>;
  general: StreamAlertGeneral | Record<string, never>;
}

const mediaFacts = (asset: LibraryAsset): StreamAlertMediaFacts => ({
  url: asset.url ?? '',
  width: asset.width,
  height: asset.height,
  duration_ms: asset.duration_ms,
  has_audio: asset.has_audio,
  has_alpha: asset.has_alpha,
});

/**
 * One look as the overlay gets it, from the library's facts. Null when a file it needs is not
 * ready or gone (the API then sends the classic look instead).
 */
export function resolveLook(look: StreamAlertLook, assets: readonly LibraryAsset[]): StreamAlertResolvedLook | null {
  const ready = (id: number | null, kind: string) => (id === null ? null : assets.find((item) => item.id === id && item.kind === kind && item.status === 'ready' && item.url) ?? undefined);
  const { custom, media, sound, ...rest } = normalizeLook(look);
  let resolvedSound: StreamAlertResolvedLook['sound'] = sound === 'none' ? 'none' : 'builtin';
  if (typeof sound === 'number') {
    const file = ready(sound, 'sound');
    if (!file) return null;
    resolvedSound = { url: file.url ?? '', duration_ms: file.duration_ms };
  }
  const resolved: StreamAlertResolvedLook = { ...rest, media: { video: null, image: null }, sound: resolvedSound, custom: null, fonts: [] };
  if (look.style === 'preset') {
    const video = ready(media.video, 'video');
    const image = media.video === null ? ready(media.image, 'image') : null;
    if (video === undefined || image === undefined) return null;
    resolved.media = { video: video ? mediaFacts(video) : null, image: image ? mediaFacts(image) : null };
    const fontId = fontAssetId(look.font.family);
    if (fontId !== null) {
      const font = ready(fontId, 'font');
      if (!font) return null;
      const family = uploadedFontFamily(fontId);
      resolved.font = { ...resolved.font, family };
      resolved.fonts = [{ family, url: font.url ?? '' }];
    }
  }
  if (look.style === 'custom') {
    if (!custom) return null;
    const design = resolveDraft(custom, assets);
    if (!design) return null;
    resolved.custom = design;
  }
  return resolved;
}

/** The classic look the overlay falls back to, keeping the parts classic honours. */
function classicFallback(look: StreamAlertLook): StreamAlertResolvedLook {
  const { custom: _custom, media: _media, sound, ...rest } = normalizeLook(look);
  return { ...rest, style: 'classic', media: { video: null, image: null }, sound: sound === 'none' ? 'none' : 'builtin', custom: null, fonts: [] };
}

/** A kind's settings as the overlay gets them. A look that cannot resolve becomes classic, as the API does. */
export function resolveAlert(alert: StreamAlertKindSettings, assets: readonly LibraryAsset[]): StreamAlertResolvedKind {
  const look = (item: StreamAlertLook) => resolveLook(item, assets) ?? classicFallback(item);
  return {
    enabled: alert.enabled,
    look: look(alert.look),
    variations: alert.variations.map((variation) => ({ ...variation, look: look(variation.look) })),
  };
}

/**
 * General settings as the preview uses them: it always shows the card, so minimums, the gap
 * between cards and moderation are off; the profanity filter and message minimums stay.
 */
export function previewGeneral(general: StreamAlertGeneral | null | undefined): StreamAlertGeneral | Record<string, never> {
  if (!general) return {};
  const normalized = normalizeGeneral(general);
  return {
    ...normalized,
    minimums: Object.fromEntries(Object.keys(normalized.minimums).map((key) => [key, 0])) as StreamAlertGeneral['minimums'],
    delay_ms: 0,
    moderation: { mode: 'off', seconds: normalized.moderation.seconds },
  };
}

/** Phase 4 designs for an older overlay copy: each kind whose own look is a resolved custom design. */
function designsOf(alerts: PreviewConfig['alerts']): PreviewConfig['designs'] {
  const designs: PreviewConfig['designs'] = {};
  for (const [kind, alert] of Object.entries(alerts) as [StreamAlertType, StreamAlertResolvedKind][]) {
    if (alert?.look?.style === 'custom' && alert.look.custom) designs[kind] = alert.look.custom;
  }
  return designs;
}

/** What the preview frame keeps between previews: the saved settings, as the API resolved them. */
export function savedPreviewConfig(
  resolved: Partial<Record<StreamAlertType, StreamAlertResolvedKind>> | null | undefined,
  general: StreamAlertGeneral | null | undefined,
): PreviewConfig {
  const alerts = { ...(resolved ?? {}) };
  return { designs: designsOf(alerts), alerts, general: previewGeneral(general) };
}

/**
 * The saved config with one kind replaced by its unsaved draft, for "Preview". Says what is in
 * the way when the look being previewed needs a file that is not ready.
 */
export function draftPreviewConfig(input: {
  saved: PreviewConfig;
  kind: StreamAlertType;
  draft: StreamAlertKindSettings;
  /** The look on screen: null for the alert's own look, else a variation id. */
  variation: string | null;
  assets: readonly LibraryAsset[];
}): { config: PreviewConfig; problem: string | null } {
  const { saved, kind, draft, variation, assets } = input;
  const shown = variation ? draft.variations.find((item) => item.id === variation)?.look ?? draft.look : draft.look;
  const problem = resolveLook(shown, assets) === null
    ? 'This look needs a file that is not ready yet (or was deleted), so it cannot be previewed. Pick another file or wait for it to finish converting.'
    : null;
  const alerts = { ...saved.alerts, [kind]: resolveAlert(draft, assets) };
  return { config: { designs: designsOf(alerts), alerts, general: saved.general }, problem };
}

/**
 * The defaults look, previewed as one kind's own look: the kind keeps its media, template and
 * sound, takes the defaults' copyable parts, and shows in the preset style so they all show.
 */
export function defaultsPreviewConfig(saved: PreviewConfig, kind: StreamAlertType, defaults: StreamAlertLook, current: StreamAlertKindSettings, assets: readonly LibraryAsset[]): PreviewConfig {
  const look: StreamAlertLook = {
    ...current.look,
    style: 'preset',
    layout: defaults.layout,
    size: defaults.size,
    volume: defaults.volume,
    sound_volume: defaults.sound_volume,
    duration_ms: defaults.duration_ms,
    text_delay_ms: defaults.text_delay_ms,
    animation: defaults.animation,
    text: defaults.text,
    font: defaults.font,
  };
  const alerts = { ...saved.alerts, [kind]: resolveAlert({ ...current, enabled: true, look, variations: [] }, assets) };
  return { designs: designsOf(alerts), alerts, general: saved.general };
}

/** The variables a kind's template may use, as chips. */
export const templateVariables = (kind: StreamAlertType, fromApi?: readonly string[] | null) => variablesFor(kind, fromApi ?? KIND_VARIABLES[kind]);
