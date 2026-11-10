/**
 * Shared palette and helpers for the WoW profile family of cards
 * (overview, gear, talents, professions).
 */

export const WOW_FONT_STACK = 'Urbanist, sans-serif';

export const CLASS_COLORS: Record<string, string> = {
  'death knight': '#C41E3A',
  'demon hunter': '#A330C9',
  druid: '#FF7C0A',
  evoker: '#33937F',
  hunter: '#AAD372',
  mage: '#3FC7EB',
  monk: '#00FF98',
  paladin: '#F48CBA',
  priest: '#F4FBFF',
  rogue: '#FFF468',
  shaman: '#0070DD',
  warlock: '#8788EE',
  warrior: '#C69B6D',
};

export const FACTION_COLORS: Record<string, string> = {
  alliance: '#4A8BFF',
  horde: '#E44A4A',
};

/** Blizzard item-quality colors as the Armory draws them on black. */
export const QUALITY_COLORS: Record<string, string> = {
  POOR: '#9D9D9D',
  COMMON: '#FFFFFF',
  UNCOMMON: '#1EFF00',
  RARE: '#0080FF',
  EPIC: '#A335EE',
  LEGENDARY: '#FF8000',
  ARTIFACT: '#E6CC80',
  HEIRLOOM: '#00CCFF',
  WOW_TOKEN: '#00CCFF',
};

/** Armory gold used for item level, guild, and talent names. */
export const ARMORY_GOLD = '#F8B400';
/** Armory green used for "Active Specialization". */
export const ARMORY_GREEN = '#1EFF00';
export const ARMORY_GREY = '#B4B4B4';
export const ACOSMIBOT_CYAN = '#67ECFF';

export const EMBER_BACKGROUND =
  'radial-gradient(ellipse at 50% 42%, #3A1A0C 0%, #1C0B05 42%, #0A0402 72%, #050201 100%)';

export const compact = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, Math.max(1, max - 1))}…` : value;

export const classColor = (characterClass: string, fallback = '#9F8BFF'): string =>
  CLASS_COLORS[characterClass.toLowerCase()] || fallback;

export const factionColor = (faction: string, fallback = ARMORY_GOLD): string =>
  FACTION_COLORS[faction.toLowerCase()] || fallback;
