/**
 * Color-coded stat icons for the WoW overview card, in the spirit of the
 * Armory's stat row: a square frame, a circle frame, and a filled glyph, all
 * in the stat's color. Our own inline SVG (no Blizzard site art), returned as
 * data URIs because Satori renders emoji and icon fonts as tofu.
 */

type Glyph = (color: string) => string;

const fill = (d: string): Glyph => (color) => `<path d="${d}" fill="${color}"/>`;
const stroke = (d: string, width = 2.6): Glyph => (color) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;

const GLYPHS: Record<string, Glyph> = {
  heart: fill(
    'M24 33.5C12.5 25.8 13.6 15.4 19.8 15.6C21.8 15.7 23.3 17 24 18.6C24.7 17 26.2 15.7 28.2 15.6C34.4 15.4 35.5 25.8 24 33.5Z',
  ),
  flask: fill(
    'M20 13.5H28V16H26.8V21.6L33.6 32.4C34.5 33.9 33.5 35.5 31.8 35.5H16.2C14.5 35.5 13.5 33.9 14.4 32.4L21.2 21.6V16H20Z',
  ),
  dumbbell: (color) =>
    `<rect x="16" y="22" width="16" height="4" fill="${color}"/>` +
    `<rect x="12.5" y="16.5" width="4.5" height="15" rx="1" fill="${color}"/>` +
    `<rect x="31" y="16.5" width="4.5" height="15" rx="1" fill="${color}"/>` +
    `<rect x="9.5" y="19.5" width="3" height="9" rx="1" fill="${color}"/>` +
    `<rect x="35.5" y="19.5" width="3" height="9" rx="1" fill="${color}"/>`,
  bulb: (color) =>
    `<circle cx="24" cy="21" r="7.5" fill="${color}"/>` +
    `<rect x="20.8" y="26.5" width="6.4" height="4.5" rx="1" fill="${color}"/>` +
    `<rect x="21.4" y="32.2" width="5.2" height="1.8" rx="0.9" fill="${color}"/>`,
  paw: (color) =>
    `<ellipse cx="24" cy="29" rx="6.2" ry="5.2" fill="${color}"/>` +
    `<circle cx="16.8" cy="22" r="2.8" fill="${color}"/>` +
    `<circle cx="21.4" cy="17.2" r="2.8" fill="${color}"/>` +
    `<circle cx="26.6" cy="17.2" r="2.8" fill="${color}"/>` +
    `<circle cx="31.2" cy="22" r="2.8" fill="${color}"/>`,
  diamondPlus: (color) =>
    stroke('M24 12.5L35.5 24L24 35.5L12.5 24Z')(color) + stroke('M24 19V29M19 24H29')(color),
  crosshair: (color) =>
    `<circle cx="24" cy="24" r="7.5" fill="none" stroke="${color}" stroke-width="2.2"/>` +
    `<circle cx="24" cy="24" r="2.6" fill="${color}"/>` +
    stroke('M24 11.5V17.5M24 30.5V36.5M11.5 24H17.5M30.5 24H36.5', 2.2)(color),
  sparkle: (color) =>
    fill('M24 11.5L26.6 21.4L36.5 24L26.6 26.6L24 36.5L21.4 26.6L11.5 24L21.4 21.4Z')(color) +
    fill('M33 13L33.8 15.2L36 16L33.8 16.8L33 19L32.2 16.8L30 16L32.2 15.2Z')(color),
  shield: fill('M24 12.5L33.5 15.8V23.2C33.5 29.2 29.4 33.6 24 35.5C18.6 33.6 14.5 29.2 14.5 23.2V15.8Z'),
  bolt: fill('M26.5 11.5L16.5 26H23L21 36.5L31.5 21.5H25Z'),
  droplet: fill('M24 12.5C24 12.5 15.8 21.6 15.8 27.2A8.2 8.2 0 0 0 32.2 27.2C32.2 21.6 24 12.5 24 12.5Z'),
  sword: (color) =>
    fill('M30.5 12.5H35.5V17.5L23.5 29.5L18.5 24.5Z')(color) +
    stroke('M16 26.5L21.5 32M18.2 30L13.5 34.7')(color),
  chevrons: stroke('M14.5 15.5L22.5 24L14.5 32.5M24.5 15.5L32.5 24L24.5 32.5', 3),
  flame: fill(
    'M24 11.5C28.4 17.6 33.4 20.6 31.4 28.2A7.6 7.6 0 0 1 16.6 28.2C15.8 23.2 19.4 20.8 20.6 16.8C21.8 19.8 22.8 20.8 24 21.8C25.2 17.8 24.4 14.8 24 11.5Z',
  ),
};

interface StatStyle {
  color: string;
  glyph: keyof typeof GLYPHS;
}

const STAT_STYLES: Record<string, StatStyle> = {
  health: { color: '#2BD24F', glyph: 'heart' },
  mana: { color: '#2B8CFF', glyph: 'flask' },
  rage: { color: '#E8402F', glyph: 'flame' },
  energy: { color: '#FFE04A', glyph: 'bolt' },
  focus: { color: '#FF9A3C', glyph: 'crosshair' },
  'runic power': { color: '#22D3FF', glyph: 'sparkle' },
  fury: { color: '#C44DFF', glyph: 'flame' },
  pain: { color: '#FF8A2B', glyph: 'flame' },
  insanity: { color: '#A05CFF', glyph: 'sparkle' },
  maelstrom: { color: '#2F8DFF', glyph: 'bolt' },
  'astral power': { color: '#5FA8FF', glyph: 'sparkle' },
  essence: { color: '#4FD6C8', glyph: 'droplet' },
  strength: { color: '#F23C3C', glyph: 'dumbbell' },
  agility: { color: '#FFD447', glyph: 'paw' },
  intellect: { color: '#D96FE0', glyph: 'bulb' },
  stamina: { color: '#FF8C2B', glyph: 'diamondPlus' },
  spirit: { color: '#8DB6FF', glyph: 'sparkle' },
  armor: { color: '#C7CDD4', glyph: 'shield' },
  'spell power': { color: '#A985FF', glyph: 'bolt' },
  'spell crit': { color: '#F23C3C', glyph: 'crosshair' },
  'melee crit': { color: '#F23C3C', glyph: 'crosshair' },
  'ranged crit': { color: '#F23C3C', glyph: 'crosshair' },
  'critical strike': { color: '#F23C3C', glyph: 'crosshair' },
  'mana regen': { color: '#43C6F2', glyph: 'droplet' },
  'attack power': { color: '#FF6A3D', glyph: 'sword' },
  'melee haste': { color: '#FFC94A', glyph: 'chevrons' },
  'ranged haste': { color: '#FFC94A', glyph: 'chevrons' },
  haste: { color: '#FFC94A', glyph: 'chevrons' },
};

const FALLBACK: StatStyle = { color: '#9FB3C8', glyph: 'sparkle' };

export function statStyle(label: string): { color: string; iconUrl: string } {
  const style = STAT_STYLES[label.trim().toLowerCase()] || FALLBACK;
  const { color } = style;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">` +
    `<rect x="4.5" y="6.5" width="39" height="35" fill="none" stroke="${color}" stroke-width="1.6"/>` +
    `<circle cx="24" cy="24" r="20.2" fill="#0D0B0A" stroke="${color}" stroke-width="1.8"/>` +
    GLYPHS[style.glyph](color) +
    `</svg>`;
  return { color, iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` };
}
