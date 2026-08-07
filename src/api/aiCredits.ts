import { api } from './client';

export type CreditTarget = 'personal' | 'guild';
export type CreditPolicyKey =
  | 'allow_dm_spending'
  | 'allow_guild_spending'
  | 'low_balance_notifications'
  | 'personal_daily_credit_cap'
  | 'personal_monthly_credit_cap'
  | 'low_balance_threshold';

export interface CreditPack {
  sku: string;
  name: string;
  description: string;
  amount_cents: number;
  currency: string;
  credits: number;
  lookup_key: string;
  active: boolean;
  promotional_credits: number;
  promotional_expires_at: string | null;
  catalog_version: string;
  terms_version: string;
}

export interface CreditCatalog {
  catalog_version: string;
  terms_version: string;
  credit_value_usd: string;
  currency: string;
  packs: CreditPack[];
  sales_enabled: boolean;
  purchased_credits_expire: boolean;
  promotional_credits_may_expire: boolean;
  non_transferable: boolean;
}

export interface CreditRateRow {
  operation: string;
  minimum_credits: number;
  input_credits_per_1k: number;
  cached_input_credits_per_1k: number;
  output_credits_per_1k: number;
  thought_credits_per_1k: number;
  fixed_credits: number;
  maximum_credits: number;
  description: string;
}

export interface CreditWalletSummary {
  wallet_id: number;
  owner_type: 'user' | 'guild';
  owner_id: string;
  stripe_mode: 'test' | 'live';
  available_credits: number;
  reserved_credits: number;
  total_credits: number;
  status: 'active' | 'frozen' | 'closed' | string;
  version: number;
  updated_at: string | null;
}

export interface CreditUserPolicy {
  user_id: string;
  allow_dm_spending: boolean;
  allow_guild_spending: boolean;
  personal_daily_credit_cap: number;
  personal_monthly_credit_cap: number;
  low_balance_threshold: number;
  low_balance_notifications: boolean;
  version: number;
  updated_at: string | null;
}

export interface CreditGuildPolicy {
  guild_id: string;
  server_pool_enabled: boolean;
  personal_fallback_allowed: boolean;
  allowed_operations: Record<string, boolean> | null;
  guild_daily_credit_cap: number;
  member_daily_credit_cap: number;
  maximum_credits_per_request: number;
  role_mode: 'all' | 'allow' | 'deny' | string;
  role_ids: string[] | null;
  channel_mode: 'all' | 'allow' | 'deny' | string;
  channel_ids: string[] | null;
  low_balance_threshold: number;
  notifications_enabled: boolean;
  notification_channel_id: string | null;
  version: number;
  updated_by: string | null;
  updated_at: string | null;
}

export interface CreditGuildConsent {
  user_id: string;
  guild_id: string;
  enabled: boolean;
  daily_cap_override: number;
  monthly_cap_override: number;
  expires_at: string | null;
  updated_at: string | null;
}

export interface CreditPurchase {
  id: string;
  purchaser_user_id: string;
  target_owner_type: 'user' | 'guild';
  target_owner_id: string;
  stripe_mode: 'test' | 'live';
  catalog_version: string;
  pack_sku: string;
  amount_cents: number;
  granted_credits: number;
  checkout_session_id: string | null;
  payment_intent_id: string | null;
  stripe_customer_id: string | null;
  status: 'pending' | 'processing' | 'fulfilled' | 'failed' | 'expired' | 'refunded' | 'disputed' | string;
  terms_version: string;
  fulfilled_at: string | null;
  reversed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreditLedgerEntry {
  id: number;
  wallet_id: number;
  direction: string;
  available_delta: number;
  reserved_delta: number;
  available_balance_after: number;
  reserved_balance_after: number;
  purchase_id: string | null;
  reservation_id: string | null;
  action_id: string | null;
  call_id: string | null;
  turn_id: string | null;
  rate_card_version: string | null;
  charged_credits: number;
  provider_cost_usd: string | null;
  provider: string | null;
  model: string | null;
  layer: string | null;
  operation: string | null;
  actor_type: string | null;
  actor_id: string | null;
  consumer_user_id: string | null;
  consumer_guild_id: string | null;
  idempotency_key: string;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

export interface CreditLedgerPage {
  success?: boolean;
  entries: CreditLedgerEntry[];
  next_cursor: number | null;
}

export interface CreditUsageSummary {
  days?: number;
  total_credits: number;
  total_calls: number;
  by_operation?: Record<string, { credits: number; calls: number }>;
  [key: string]: unknown;
}

export interface PersonalCreditsResponse {
  success: boolean;
  mode: 'test' | 'live';
  wallet: CreditWalletSummary;
  policy: CreditUserPolicy;
  sales_enabled: boolean;
  spending_enabled: boolean;
  terms_version: string;
}

export interface GuildCreditsResponse {
  success: boolean;
  mode: 'test' | 'live';
  wallet: CreditWalletSummary;
  policy: CreditGuildPolicy;
  usage: CreditUsageSummary;
}

export interface CreditCatalogResponse {
  success: boolean;
  mode: 'test' | 'live';
  catalog: CreditCatalog;
  rate_card: { version: string; credit_value_usd: string; rows: CreditRateRow[] };
  readiness: { ready: boolean; configured: boolean; missing?: string[] };
  spending_enabled: boolean;
  dm_enabled: boolean;
}

export const aiCreditsApi = {
  getCatalog: () => api.fetch<CreditCatalogResponse>('/api/ai-credits/catalog'),

  getPersonal: () => api.fetch<PersonalCreditsResponse>('/api/ai-credits/me'),

  getPersonalLedger: (cursor?: number) => api.fetch<CreditLedgerPage>(
    `/api/ai-credits/me/ledger?limit=50${cursor ? `&cursor=${cursor}` : ''}`,
  ),

  updatePersonalPolicy: (values: Partial<CreditUserPolicy>) =>
    api.fetch<{ success: boolean; policy: CreditUserPolicy }>('/api/ai-credits/me/policy', {
      method: 'PUT',
      body: JSON.stringify(values),
    }),

  getGuildConsent: (guildId: string) => api.fetch<{ success: boolean; consent: CreditGuildConsent }>(
    `/api/ai-credits/me/guilds/${guildId}/policy`,
  ),

  updateGuildConsent: (guildId: string, values: Partial<CreditGuildConsent>) =>
    api.fetch<{ success: boolean; consent: CreditGuildConsent }>(
      `/api/ai-credits/me/guilds/${guildId}/policy`,
      { method: 'PUT', body: JSON.stringify(values) },
    ),

  createCheckout: (body: {
    pack_sku: string;
    target_type: CreditTarget;
    guild_id?: string;
    accepted_terms_version: string;
  }) =>
    api.fetch<{
      success: boolean;
      checkout_url: string;
      session_id: string;
      purchase: CreditPurchase;
    }>('/api/ai-credits/checkout', { method: 'POST', body: JSON.stringify(body) }),

  getPurchase: (purchaseId: string) => api.fetch<{ success: boolean; purchase: CreditPurchase }>(
    `/api/ai-credits/purchases/${purchaseId}`,
  ),

  getGuild: (guildId: string) => api.fetch<GuildCreditsResponse>(
    `/api/guilds/${guildId}/ai-credits`,
  ),

  getGuildLedger: (guildId: string, cursor?: number) => api.fetch<CreditLedgerPage>(
    `/api/guilds/${guildId}/ai-credits/ledger?limit=50${cursor ? `&cursor=${cursor}` : ''}`,
  ),

  updateGuildPolicy: (guildId: string, values: Partial<CreditGuildPolicy>) =>
    api.fetch<{ success: boolean; policy: CreditGuildPolicy }>(
      `/api/guilds/${guildId}/ai-credits/policy`,
      { method: 'PUT', body: JSON.stringify(values) },
    ),
};
