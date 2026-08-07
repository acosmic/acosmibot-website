import { api } from './client';

export type AdminAiTier = 'free' | 'plus' | 'pro' | 'max';

export type AdminAiTierLimits = Record<AdminAiTier, {
  daily_limit: number;
  monthly_limit: number;
  image_monthly_limit: number;
  image_analysis_monthly_limit: number;
}>;

export type AiProvider = 'openai' | 'gemini';
export interface AdminAiProviderLayer {
  label: string;
  provider: AiProvider;
  openai_model: string;
  gemini_model: string;
  available_models: Record<AiProvider, string[]>;
}

export interface AdminAiSettings {
  enabled: boolean;
  /** Show the disclaimer + "Used X Tool" subtext under AI replies. */
  response_notice: boolean;
  model: string;
  polymorph_model: string;
  /** Bot-wide fallback timezone (IANA) for the AI clock. */
  timezone: string;
  web_search_provider: string;
  tier_limits: AdminAiTierLimits;
  provider_layers: Record<string, AdminAiProviderLayer>;
  available_models: string[];
  available_web_search_providers: string[];
}

export interface AdminAiSettingsResponse {
  success: boolean;
  data: AdminAiSettings;
}

export interface AdminAiLabCase {
  key: string;
  label: string;
  description: string;
  layer: string;
  kind: 'text' | 'structured' | 'vision' | 'tool' | 'image';
  timeout_seconds: number;
  max_output_tokens: number;
  estimated_max_cost_usd: string;
  requires_image_confirmation: boolean;
}

export interface AdminAiLabJob {
  job_id: string;
  case_key: string;
  provider: AiProvider;
  model: string;
  layer: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  response_text: string | null;
  error_type: string | null;
  input_tokens: number | null;
  cached_input_tokens: number | null;
  visible_output_tokens: number | null;
  thought_tokens: number | null;
  provider_total_tokens: number | null;
  cost_usd: string | null;
  cost_estimate_quality: string | null;
  pricing_effective_date: string | null;
  automatic_pass: boolean | null;
  result_metadata: Record<string, unknown>;
  quality_rating: -1 | 1 | null;
  quality_note: string | null;
}

export type InterestInterval = 'daily' | 'weekly' | 'monthly';

export interface AdminEconomySettings {
  deposit_fee_percent: number;
  withdraw_fee_percent: number;
  transaction_limits_enabled: boolean;
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

export type StripeMode = 'test' | 'live';

export interface AdminFeatureSettings {
  use_satori_rank_card: boolean;
  use_satori_weather_card: boolean;
  billing_enabled: boolean;
  stripe_mode: StripeMode;
  stripe_test_configured: boolean;
  stripe_live_configured: boolean;
}

export interface AdminFeatureSettingsResponse {
  success: boolean;
  data: AdminFeatureSettings;
}

export interface AdminStripeReadinessRow {
  tier: string;
  cadence: string;
  price_id: string | null;
  lookup_key: string;
  status: 'valid' | 'missing' | 'mismatched' | 'unavailable';
  reasons: string[];
}

export interface AdminStripeReadiness {
  mode: StripeMode;
  configured: boolean;
  rows: AdminStripeReadinessRow[];
  missing?: string[];
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
  is_equippable: boolean;
  equip_slot: string | null;
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

  updateFeatureSettings: (payload: Partial<Pick<AdminFeatureSettings,
    'use_satori_rank_card' | 'billing_enabled' | 'stripe_mode'>>) =>
    api.fetch<{
      success: boolean;
      message: string;
      updated_count: number;
      stripe_mode: StripeMode;
      billing_enabled: boolean;
    }>(
      '/api/admin/feature-settings',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  getStripeReadiness: () =>
    api.fetch<{ success: boolean; data: Record<StripeMode, AdminStripeReadiness> }>('/api/admin/stripe-readiness'),

  getAiSettings: () =>
    api.fetch<AdminAiSettingsResponse>('/api/admin/ai-settings'),

  updateAiSettings: (
    payload: Partial<Omit<AdminAiSettings, 'available_models' | 'available_web_search_providers'>>,
  ) =>
    api.fetch<{ success: boolean; updated_count: number }>(
      '/api/admin/ai-settings',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  getAiLabCases: () =>
    api.fetch<{ success: boolean; cases: AdminAiLabCase[] }>('/api/admin/ai-lab/cases'),

  getAiLabJobs: () =>
    api.fetch<{ success: boolean; jobs: AdminAiLabJob[] }>('/api/admin/ai-lab/jobs'),

  createAiLabJob: (payload: { case_key: string; provider: AiProvider; model: string; confirm: true; confirm_image?: true }) =>
    api.fetch<{ success: boolean; job: AdminAiLabJob }>('/api/admin/ai-lab/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  rateAiLabJob: (jobId: string, rating: -1 | 1, note = '') =>
    api.fetch<{ success: boolean; job: AdminAiLabJob }>(`/api/admin/ai-lab/jobs/${jobId}/rating`, {
      method: 'PATCH',
      body: JSON.stringify({ rating, note }),
    }),

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
