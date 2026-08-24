import { api } from './client';

export type AdminAiTier = 'free' | 'plus' | 'pro' | 'max';
export type PremiumGrantTier = 'plus' | 'pro' | 'max';
export type PremiumGrantSource = 'support_server' | 'partner' | 'promotion' | 'giveaway' | 'internal' | 'test';
export type PremiumGrantStatus = 'active' | 'scheduled' | 'expired' | 'revoked';

export interface PremiumGrant {
  id: string;
  guild_id: string;
  guild_name: string | null;
  tier: PremiumGrantTier;
  source: PremiumGrantSource;
  reason: string;
  granted_by_user_id: string;
  starts_at: string;
  expires_at: string | null;
  permanent: boolean;
  revoked_at: string | null;
  revoked_by_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  status: PremiumGrantStatus;
}

export interface PremiumGrantInput {
  guild_id: string;
  tier: PremiumGrantTier;
  source: PremiumGrantSource;
  reason: string;
  starts_at: string;
  expires_at: string | null;
}

export interface AdminGuildOption {
  id: string;
  name: string;
  owner_id: string;
}

export type SocialFormatting = 'plain_text' | 'facets' | 'rich_text';
export type SocialEmojiPolicy = 'none' | 'light' | 'expressive';

export interface SocialPlatformSpec {
  key: string;
  label: string;
  reviewed_at: string;
  enabled?: boolean;
  character_limit: number;
  counting: string;
  formatting: SocialFormatting;
  markdown: false;
  max_media: number;
  media_types: string[];
  max_image_mb: number;
  aspect_ratios: string[];
  notes: string;
  source_urls: string[];
}

export interface SocialPlatformOverride {
  enabled?: boolean;
  character_limit?: number;
  max_media?: number;
  media_types?: string[];
  formatting?: SocialFormatting;
  notes?: string;
  max_image_mb?: number;
  aspect_ratios?: string[];
}

export interface SocialStudioSettings {
  enabled: boolean;
  destination: { guild_id: string; channel_id: string };
  brand_voice: string;
  default_call_to_action: string;
  default_platforms: string[];
  emoji_policy: SocialEmojiPolicy;
  max_hashtags: number;
  image_aspect_ratio: '1:1' | '4:5' | '16:9';
  platform_overrides: Record<string, SocialPlatformOverride>;
}

export interface SocialDraftJob {
  job_id: string;
  campaign_name: string;
  platforms: string[];
  generate_image: boolean;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  error_type: string | null;
  delivery_channel_id: string | null;
  discord_message_id: string | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export type AdminAiTierLimits = Record<AdminAiTier, {
  daily_limit: number;
  monthly_limit: number;
  image_monthly_limit: number;
  image_analysis_monthly_limit: number;
  image_search_monthly_limit: number;
  /** Omitted by older admin API payloads during the summary rollout. */
  channel_summary_monthly_limit?: number;
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

export type AdminAiTraceStatus = 'in_progress' | 'success' | 'failed' | 'cancelled';

export interface AdminAiTraceSummary {
  trace_id: string;
  entrypoint: string | null;
  context_type: string | null;
  status: AdminAiTraceStatus;
  outcome: string | null;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  delivery_outcome: string | null;
  provider_call_count: number;
  failed_call_count: number;
  provider_total_tokens: number;
  cost_usd: string;
  span_count: number;
}

export interface AdminAiTraceSpan {
  span_id: string;
  parent_span_id: string | null;
  span_type: 'root' | 'routing' | 'provider' | 'tool' | 'safety' | 'delivery' | 'credit' | string;
  layer: string;
  name: string;
  status: string;
  error_category: string | null;
  error_code: string | null;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  provider: string;
  model: string;
  input_tokens: number | null;
  cached_input_tokens: number | null;
  visible_output_tokens: number | null;
  thought_tokens: number | null;
  provider_total_tokens: number | null;
  cost_usd: string | null;
  cost_estimate_quality: string | null;
  provider_response_id: string | null;
  provider_http_request_id: string | null;
  client_request_id: string | null;
  build_sha: string | null;
  template_hash: string | null;
  tool_schema_hash: string | null;
  config_version: string | null;
  routing_policy_version: string | null;
  safety_policy_version: string | null;
  metadata: Record<string, unknown>;
}

export interface AdminAiTraceDetail {
  success: boolean;
  trace: AdminAiTraceSummary & {
    input_tokens: number;
    cached_input_tokens: number;
    visible_output_tokens: number;
    thought_tokens: number;
    build_sha: string | null;
    routing_summary: Record<string, unknown>;
    feedback_rating: -1 | 1 | null;
    feedback_reason_code: string | null;
    feedback_at: string | null;
  };
  spans: AdminAiTraceSpan[];
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
  ai_credit_sales_enabled: boolean;
  ai_credit_spending_enabled: boolean;
  ai_credit_dm_enabled: boolean;
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
  promotion?: {
    version: string;
    active: boolean;
    percent_off: number;
    duration_in_months: number;
    redeem_by: string;
    eligible_cadences: string[];
    status: 'valid' | 'missing' | 'mismatched' | 'unavailable' | 'ended';
    reasons: string[];
  };
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
  source: 'shop' | 'achievement' | 'admin';
  achievement_key: string | null;
  asset_key: string | null;
  asset_url: string | null;
  layout_preset: 'standard' | 'artwork';
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

export interface RankCardBackgroundUpload {
  file: File;
  name: string;
  description: string;
  rarity: string;
  price: number;
  isAvailable: boolean;
}

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
  getSocialStudioSettings: () =>
    api.fetch<{ success: boolean; data: SocialStudioSettings; platforms: SocialPlatformSpec[] }>(
      '/api/admin/social-studio/settings',
    ),

  updateSocialStudioSettings: (payload: SocialStudioSettings) =>
    api.fetch<{ success: boolean; data: SocialStudioSettings }>(
      '/api/admin/social-studio/settings',
      { method: 'PUT', body: JSON.stringify(payload) },
    ),

  getSocialStudioChannels: (guildId: string) =>
    api.fetch<{ success: boolean; channels: Array<{ id: string; name: string }> }>(
      `/api/admin/social-studio/guilds/${encodeURIComponent(guildId)}/channels`,
    ),

  getSocialDraftJobs: () =>
    api.fetch<{
      success: boolean;
      jobs: SocialDraftJob[];
      limits: { active: number; per_24_hours: number };
    }>('/api/admin/social-studio/jobs'),

  createSocialDraftJob: (payload: {
    campaign_name: string;
    brief: string;
    platforms: string[];
    generate_image: boolean;
    confirm: true;
  }) => api.fetch<{ success: boolean; job: SocialDraftJob }>('/api/admin/social-studio/jobs', {
    method: 'POST', body: JSON.stringify(payload),
  }),

  cancelSocialDraftJob: (jobId: string) =>
    api.fetch<{ success: boolean }>(
      `/api/admin/social-studio/jobs/${encodeURIComponent(jobId)}/cancel`,
      { method: 'POST' },
    ),

  getPremiumGrants: (params: {
    status?: PremiumGrantStatus | 'all'; search?: string; limit?: number; offset?: number;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    query.set('limit', String(params.limit ?? 200));
    query.set('offset', String(params.offset ?? 0));
    return api.fetch<{ success: boolean; grants: PremiumGrant[]; total: number }>(
      `/api/admin/premium-grants?${query.toString()}`,
    );
  },

  createPremiumGrant: (payload: PremiumGrantInput) =>
    api.fetch<{ success: boolean; grant: PremiumGrant }>('/api/admin/premium-grants', {
      method: 'POST', body: JSON.stringify(payload),
    }),

  updatePremiumGrant: (id: string, payload: Partial<PremiumGrantInput>) =>
    api.fetch<{ success: boolean; grant: PremiumGrant }>(
      `/api/admin/premium-grants/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
    ),

  revokePremiumGrant: (id: string) =>
    api.fetch<{ success: boolean; grant: PremiumGrant }>(
      `/api/admin/premium-grants/${encodeURIComponent(id)}/revoke`,
      { method: 'POST' },
    ),

  restorePremiumGrant: (id: string) =>
    api.fetch<{ success: boolean; grant: PremiumGrant }>(
      `/api/admin/premium-grants/${encodeURIComponent(id)}/restore`,
      { method: 'POST' },
    ),

  getGuildOptions: () =>
    api.fetch<{ success: boolean; guilds: AdminGuildOption[] }>(
      '/api/admin/guild-options',
    ),

  getFeatureSettings: () =>
    api.fetch<AdminFeatureSettingsResponse>('/api/admin/feature-settings'),

  updateFeatureSettings: (payload: Partial<Pick<AdminFeatureSettings,
    'use_satori_rank_card' | 'use_satori_weather_card' | 'billing_enabled' |
    'ai_credit_sales_enabled' | 'ai_credit_spending_enabled' | 'ai_credit_dm_enabled' |
    'stripe_mode'>>) =>
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

  getAiTraces: (days = 7, status?: AdminAiTraceStatus) => {
    const params = new URLSearchParams({ days: String(days), limit: '100' });
    if (status) params.set('status', status);
    return api.fetch<{ success: boolean; days: number; traces: AdminAiTraceSummary[] }>(
      `/api/admin/ai-traces?${params.toString()}`,
    );
  },

  getAiTrace: (traceId: string) =>
    api.fetch<AdminAiTraceDetail>(`/api/admin/ai-traces/${encodeURIComponent(traceId)}`),

  rateAiTrace: (traceId: string, rating: -1 | 1, reasonCode: string) =>
    api.fetch<{ success: boolean }>(`/api/admin/ai-traces/${encodeURIComponent(traceId)}/feedback`, {
      method: 'PATCH',
      body: JSON.stringify({ rating, reason_code: reasonCode }),
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

  // Multipart upload uses raw fetch because api.fetch sets JSON Content-Type.
  uploadRankCardBackground: async (payload: RankCardBackgroundUpload) => {
    const apiBase = (window as any).AppConfig?.apiBaseUrl ?? 'https://api.acosmibot.com';
    const form = new FormData();
    form.append('background', payload.file);
    form.append('name', payload.name);
    form.append('description', payload.description);
    form.append('rarity', payload.rarity);
    form.append('price', String(payload.price));
    form.append('is_available', String(payload.isAvailable));

    const response = await fetch(`${apiBase}/api/admin/cosmetics/backgrounds`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Background upload failed');
    }
    return data as { success: true; message: string; cosmetic: AdminCosmetic };
  },

  grantRankCardBackground: (discordUserId: string, cosmeticId: number) =>
    api.fetch<{ success: boolean; message: string; already_owned: boolean }>(
      '/api/admin/cosmetics/grant',
      {
        method: 'POST',
        body: JSON.stringify({
          discord_user_id: discordUserId,
          cosmetic_id: cosmeticId,
        }),
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
