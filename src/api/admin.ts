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
};
