import { SlotSymbolSet, SlotsConfig, SlotsTier } from '@/types/features';

export const ACOSMIBOT_SLOT_SET_ID = 'acosmibot';
export const MAX_CUSTOM_SLOT_SETS = 10;

export const SLOT_TIERS: SlotsTier[] = [
  'common', 'uncommon', 'rare', 'legendary', 'scatter',
];

export const SLOT_TIER_LIMITS: Record<SlotsTier, number> = {
  common: 6,
  uncommon: 3,
  rare: 2,
  legendary: 1,
  scatter: 1,
};

export interface SlotCatalogEmoji {
  value: string;
  name: string;
  image: string;
}

const catalog = (name: string, label: string): SlotCatalogEmoji => ({
  value: `app:${name}`,
  name: label,
  image: `/images/slots/acosmibot/${name}.png`,
});

export const ACOSMIBOT_SLOT_CATALOG: SlotCatalogEmoji[] = [
  catalog('sl_coin', 'Aco Coin'),
  catalog('sl_chip', 'AI Chip'),
  catalog('sl_battery', 'Power Cell'),
  catalog('sl_gear', 'Cyber Gear'),
  catalog('sl_core', 'Energy Core'),
  catalog('sl_satellite', 'Satellite'),
  catalog('sl_mug', 'Cozy Mug'),
  catalog('sl_heart', 'Power Heart'),
  catalog('sl_bolt', 'Cyber Bolt'),
  catalog('sl_star', 'Orbit Star'),
  catalog('sl_gem', 'Space Crystal'),
  catalog('sl_darkn1de', 'DARKN1DE'),
  catalog('sl_portal', 'Cyberspace Portal'),
];

const ACO_BY_VALUE = new Map(ACOSMIBOT_SLOT_CATALOG.map(item => [item.value, item]));

export const getAcosmibotSlotEmoji = (value: string): SlotCatalogEmoji | undefined =>
  ACO_BY_VALUE.get(value);

export const emptySlotTiers = (): Record<SlotsTier, string[]> => ({
  common: [],
  uncommon: [],
  rare: [],
  legendary: [],
  scatter: [],
});

const acoTierValues: Record<SlotsTier, string[]> = {
  common: ['app:sl_coin', 'app:sl_chip', 'app:sl_battery', 'app:sl_gear', 'app:sl_core', 'app:sl_satellite'],
  uncommon: ['app:sl_mug', 'app:sl_heart', 'app:sl_bolt'],
  rare: ['app:sl_star', 'app:sl_gem'],
  legendary: ['app:sl_darkn1de'],
  scatter: ['app:sl_portal'],
};

const legacyDefaults: Record<SlotsTier, string[]> = {
  common: ['🐒', '🐢', '🦉', '🦏', '🦖'],
  uncommon: ['🍾', '🍸', '🍺'],
  rare: ['🍑', '🫃'],
  legendary: ['🍆'],
  scatter: ['💎'],
};

export const cloneSlotTiers = (
  tiers: Partial<Record<SlotsTier, string[]>>,
): Record<SlotsTier, string[]> =>
  SLOT_TIERS.reduce((result, tier) => {
    result[tier] = [...(tiers[tier] ?? [])].slice(0, SLOT_TIER_LIMITS[tier]);
    return result;
  }, emptySlotTiers());

export const createAcosmibotSlotSet = (): SlotSymbolSet => ({
  id: ACOSMIBOT_SLOT_SET_ID,
  name: 'Acosmibot',
  built_in: true,
  tier_emojis: cloneSlotTiers(acoTierValues),
});

const isLegacyDefault = (tiers: Record<SlotsTier, string[]>): boolean =>
  SLOT_TIERS.every(tier => JSON.stringify(tiers[tier]) === JSON.stringify(legacyDefaults[tier]));

const normalizeCustomSet = (raw: any): SlotSymbolSet | null => {
  const id = String(raw?.id ?? '').trim().toLowerCase();
  const name = String(raw?.name ?? '').trim();
  if (!id || id === ACOSMIBOT_SLOT_SET_ID || !name) return null;
  const tier_emojis = cloneSlotTiers(raw?.tier_emojis ?? {});
  const reelCount = SLOT_TIERS
    .filter(tier => tier !== 'scatter')
    .reduce((count, tier) => count + tier_emojis[tier].length, 0);
  if (reelCount === 0) return null;
  return { id, name, built_in: false, tier_emojis };
};

export function buildSlotsConfig(raw: any): SlotsConfig {
  const rawSets: any[] = Array.isArray(raw?.symbol_sets) ? raw.symbol_sets : [];
  const customSets = rawSets
    .map(normalizeCustomSet)
    .filter((set): set is SlotSymbolSet => set !== null)
    .slice(0, MAX_CUSTOM_SLOT_SETS);

  if (customSets.length === 0 && raw?.tier_emojis && typeof raw.tier_emojis === 'object') {
    const previous = cloneSlotTiers(raw.tier_emojis);
    const reelCount = SLOT_TIERS
      .filter(tier => tier !== 'scatter')
      .reduce((count, tier) => count + previous[tier].length, 0);
    if (reelCount > 0 && !isLegacyDefault(previous)) {
      customSets.push({
        id: 'previous-custom',
        name: 'Previous Custom',
        built_in: false,
        tier_emojis: previous,
      });
    }
  }

  const symbol_sets = [createAcosmibotSlotSet(), ...customSets];
  const requestedActive = String(raw?.active_set_id ?? ACOSMIBOT_SLOT_SET_ID).toLowerCase();
  const active_set_id = symbol_sets.some(set => set.id === requestedActive)
    ? requestedActive
    : ACOSMIBOT_SLOT_SET_ID;

  return {
    enabled: raw?.enabled !== false,
    active_set_id,
    symbol_sets,
  };
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'custom-set';

export function uniqueSlotSetIdentity(
  baseName: string,
  sets: SlotSymbolSet[],
): { id: string; name: string } {
  const existingNames = new Set(sets.map(set => set.name.toLowerCase()));
  const existingIds = new Set(sets.map(set => set.id));
  let name = baseName;
  let suffix = 2;
  while (existingNames.has(name.toLowerCase())) {
    name = `${baseName} ${suffix}`;
    suffix += 1;
  }
  const idBase = slugify(name);
  let id = idBase;
  let idSuffix = 2;
  while (existingIds.has(id)) {
    id = `${idBase}-${idSuffix}`;
    idSuffix += 1;
  }
  return { id, name };
}

export function validateSlotsConfig(value: SlotsConfig): string[] {
  const errors: string[] = [];
  if (value.symbol_sets[0]?.id !== ACOSMIBOT_SLOT_SET_ID) {
    errors.push('The Acosmibot set must remain first.');
  }
  if (!value.symbol_sets.some(set => set.id === value.active_set_id)) {
    errors.push('Choose an existing active slot set.');
  }
  if (value.symbol_sets.length > MAX_CUSTOM_SLOT_SETS + 1) {
    errors.push(`A server can save up to ${MAX_CUSTOM_SLOT_SETS} custom sets.`);
  }
  const names = new Set<string>();
  const ids = new Set<string>();
  value.symbol_sets.forEach(set => {
    const name = set.name.trim().toLowerCase();
    if (!name) errors.push('Every slot set needs a name.');
    if (set.name.length > 40) errors.push(`“${set.name}” must be 40 characters or fewer.`);
    if (names.has(name)) errors.push(`Slot set names must be unique: “${set.name}”.`);
    if (ids.has(set.id)) errors.push(`Slot set IDs must be unique: “${set.id}”.`);
    names.add(name);
    ids.add(set.id);
    if (!set.built_in) {
      const reelCount = SLOT_TIERS
        .filter(tier => tier !== 'scatter')
        .reduce((count, tier) => count + set.tier_emojis[tier].length, 0);
      if (reelCount === 0) errors.push(`“${set.name}” needs at least one reel symbol.`);
    }
  });
  return [...new Set(errors)];
}
