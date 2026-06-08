import { api } from './client';

export interface AdminAiSettings {
  enabled: boolean;
  model: string;
  polymorph_model: string;
  daily_limit: number;
  monthly_limit: number;
  available_models: string[];
}

export interface AdminAiSettingsResponse {
  success: boolean;
  data: AdminAiSettings;
}

export type InterestInterval = 'daily' | 'weekly' | 'monthly';

export interface AdminEconomySettings {
  deposit_fee_percent: number;
  withdraw_fee_percent: number;
  min_transaction: number;
  max_transaction: number;
  daily_transfer_limit: number;
  interest_enabled: boolean;
  interest_rate_percent: number;
  interest_interval: InterestInterval;
  interest_intervals: InterestInterval[];
}

export interface AdminEconomySettingsResponse {
  success: boolean;
  data: AdminEconomySettings;
}

export interface AdminFeatureSettings {
  use_satori_rank_card: boolean;
}

export interface AdminFeatureSettingsResponse {
  success: boolean;
  data: AdminFeatureSettings;
}

export interface AdminCosmetic {
  id: number;
  name: string;
  description: string;
  type: 'background' | 'ring' | 'accent';
  rarity: string;
  price: number;
  value: string;
  is_available: boolean;
  sort_order: number;
}

export interface AdminCosmeticsResponse {
  success: boolean;
  data: AdminCosmetic[];
}

/** Editable subset of a cosmetic an admin can patch. */
export type AdminCosmeticUpdate = Partial<
  Pick<AdminCosmetic, 'price' | 'is_available' | 'name' | 'description' | 'rarity' | 'sort_order'>
>;

export interface AdminAchievement {
  key: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'legendary';
  condition_type: 'metric' | 'event';
  metric: string | null;
  threshold: number;
  reward_credits: number;
  reward_cosmetic_id: number | null;
  reward_item_id: number | null;
  is_secret: boolean;
  is_available: boolean;
  sort_order: number;
  // ISO datetime cutoff after which the achievement can no longer be earned.
  available_until: string | null;
}

/** A cosmetic option for the reward dropdown. */
export interface AdminCosmeticOption {
  id: number;
  name: string;
  type: string;
}

/** An item option for the reward dropdown. */
export interface AdminItemOption {
  id: number;
  name: string;
  slug: string;
}

export interface AdminAchievementsResponse {
  success: boolean;
  data: AdminAchievement[];
  cosmetics: AdminCosmeticOption[];
  items: AdminItemOption[];
  metrics: string[];
}

/** Fields an admin can set when creating or editing an achievement. */
export type AdminAchievementInput = Partial<Omit<AdminAchievement, never>> & {
  /** On update only: rename the achievement's key (cascades server-side). */
  new_key?: string;
};

// --- Items -----------------------------------------------------------------
/** One effect an item grants when used (additive bonus fraction). */
export interface AdminItemEffect {
  type: string;
  scope: 'global' | 'guild';
  magnitude: number;
  duration_seconds: number | null;
}

export interface AdminItem {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  item_type: string;
  effects: AdminItemEffect[];
  is_consumable: boolean;
  max_stack: number;
  is_giftable: boolean;
  is_tradeable: boolean;
  price_credits: number | null;
  price_usd_cents: number | null;
  is_purchasable: boolean;
  is_available: boolean;
  sort_order: number;
  available_until: string | null;
}

export interface AdminItemsResponse {
  success: boolean;
  data: AdminItem[];
  effect_types: string[];
  effect_scopes: string[];
  rarities: string[];
  item_types: string[];
}

/** Fields an admin can set when creating or editing an item. */
export type AdminItemInput = Partial<Omit<AdminItem, 'id'>> & {
  /** On update only: rename the item's slug. */
  new_slug?: string;
};

export const adminApi = {
  getFeatureSettings: () =>
    api.fetch<AdminFeatureSettingsResponse>('/api/admin/feature-settings'),

  updateFeatureSettings: (payload: Partial<AdminFeatureSettings>) =>
    api.fetch<{ success: boolean; updated_count: number }>(
      '/api/admin/feature-settings',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  getAiSettings: () =>
    api.fetch<AdminAiSettingsResponse>('/api/admin/ai-settings'),

  updateAiSettings: (payload: Partial<Omit<AdminAiSettings, 'available_models'>>) =>
    api.fetch<{ success: boolean; updated_count: number }>(
      '/api/admin/ai-settings',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  getEconomySettings: () =>
    api.fetch<AdminEconomySettingsResponse>('/api/admin/economy-settings'),

  updateEconomySettings: (
    payload: Partial<Omit<AdminEconomySettings, 'interest_intervals'>>,
  ) =>
    api.fetch<{ success: boolean; updated_count: number }>(
      '/api/admin/economy-settings',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  getCosmetics: () =>
    api.fetch<AdminCosmeticsResponse>('/api/admin/cosmetics'),

  updateCosmetic: (id: number, payload: AdminCosmeticUpdate) =>
    api.fetch<{ success: boolean; message: string }>(
      `/api/admin/cosmetics/${id}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  getAchievements: () =>
    api.fetch<AdminAchievementsResponse>('/api/admin/achievements'),

  createAchievement: (payload: AdminAchievementInput) =>
    api.fetch<{ success: boolean; message: string }>('/api/admin/achievements', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAchievement: (key: string, payload: AdminAchievementInput) =>
    api.fetch<{ success: boolean; message: string }>(
      `/api/admin/achievements/${encodeURIComponent(key)}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  deleteAchievement: (key: string) =>
    api.fetch<{ success: boolean; message: string }>(
      `/api/admin/achievements/${encodeURIComponent(key)}`,
      { method: 'DELETE' },
    ),

  getItems: () => api.fetch<AdminItemsResponse>('/api/admin/items'),

  createItem: (payload: AdminItemInput) =>
    api.fetch<{ success: boolean; message: string; id?: number }>('/api/admin/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateItem: (slug: string, payload: AdminItemInput) =>
    api.fetch<{ success: boolean; message: string; slug?: string }>(
      `/api/admin/items/${encodeURIComponent(slug)}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  deleteItem: (slug: string) =>
    api.fetch<{ success: boolean; message: string }>(
      `/api/admin/items/${encodeURIComponent(slug)}`,
      { method: 'DELETE' },
    ),

  grantItem: (payload: { user_id: string; slug: string; quantity: number }) =>
    api.fetch<{ success: boolean; message: string }>('/api/admin/items/grant', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
