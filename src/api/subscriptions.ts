import { api } from './client';

export type PremiumTier = 'free' | 'plus' | 'pro' | 'max';
export type BillingInterval = 'monthly' | 'annual';

export interface SafePremiumEntitlement {
  tier: PremiumTier;
  source: 'free' | 'stripe' | 'complimentary';
  complimentary: boolean;
  grant_source: 'support_server' | 'partner' | 'promotion' | 'giveaway' | 'internal' | 'test' | null;
  starts_at: string | null;
  expires_at: string | null;
  permanent: boolean;
}

export interface SubscriptionRecord {
  id: number;
  guild_id: string;
  tier: PremiumTier;
  billing_interval?: BillingInterval | null;
  pending_tier?: PremiumTier | null;
  pending_billing_interval?: BillingInterval | null;
  pending_change_at?: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  stripe_subscription_id?: string | null;
  stripe_schedule_id?: string | null;
  stripe_customer_id?: string | null;
  cancel_at_period_end?: boolean;
  cancel_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GuildSubscription {
  success?: boolean;
  subscription?: SubscriptionRecord | null;
  tier: PremiumTier;
  stored_tier?: PremiumTier;
  status: string;
  entitlement: SafePremiumEntitlement;
}

export interface SubscriptionCatalogRow {
  tier: Exclude<PremiumTier, 'free'>;
  cadence: BillingInterval;
  unit_amount_cents: number;
  currency: string;
  lookup_key: string;
  quotas: {
    daily_ai_actions: number;
    monthly_ai_actions: number;
    image_monthly_limit: number;
    image_analysis_monthly_limit: number;
    image_search_monthly_limit: number;
  };
}

export interface SubscriptionQuotaCatalog {
  [tier: string]: {
    daily_ai_actions: number;
    monthly_ai_actions: number;
    image_monthly_limit: number;
    image_analysis_monthly_limit: number;
    image_search_monthly_limit: number;
  };
}

export interface SubscriptionLaunchPromotion {
  version: string;
  active: boolean;
  percent_off: number;
  duration_in_months: number;
  redeem_by: string;
  eligible_cadences: BillingInterval[];
  discounted_monthly_amounts_cents: Partial<Record<Exclude<PremiumTier, 'free'>, number>>;
}

export const subscriptionsApi = {
  getCatalog: () =>
    api.fetch<{
      success: boolean;
      catalog_effective_date: string;
      catalog: SubscriptionCatalogRow[];
      launch_promotion: SubscriptionLaunchPromotion;
      quotas: SubscriptionQuotaCatalog;
    }>('/api/subscriptions/catalog'),

  getBillingStatus: () =>
    api.fetch<{ success: boolean; billing_enabled: boolean }>('/api/billing/status'),

  getGuildSubscription: (guildId: string) =>
    api.fetch<GuildSubscription>(`/api/guilds/${guildId}/subscription`),

  createCheckout: (body: {
    guild_id: string;
    tier: PremiumTier;
    interval?: BillingInterval;
    success_url: string;
    cancel_url: string;
  }) =>
    api.fetch<{ success: boolean; checkout_url: string | null; message?: string; change_kind?: 'immediate' | 'scheduled'; effective_at?: string | null }>(
      '/api/subscriptions/create-checkout',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  previewChange: (body: { guild_id: string; tier: PremiumTier; interval?: BillingInterval }) =>
    api.fetch<{
      success: boolean;
      net_amount?: number;
      proration_amount?: number;
      invoice_total?: number;
      account_credit_applied?: number;
      is_charge?: boolean;
      change_kind?: 'immediate' | 'scheduled';
      effective_at?: string | null;
      currency?: string;
      message?: string;
    }>(
      '/api/subscriptions/preview-change',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  openPortal: (body: { guild_id: string; return_url: string }) =>
    api.fetch<{ success: boolean; portal_url: string }>(
      '/api/subscriptions/portal',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  cancel: (body: { guild_id: string; immediately?: boolean }) =>
    api.fetch<{ success: boolean; message: string }>(
      '/api/subscriptions/cancel',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  cancelScheduledChange: (body: { guild_id: string }) =>
    api.fetch<{ success: boolean; message: string }>(
      '/api/subscriptions/cancel-change',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  resume: (body: { guild_id: string }) =>
    api.fetch<{ success: boolean; message: string }>(
      '/api/subscriptions/resume',
      { method: 'POST', body: JSON.stringify(body) },
    ),
};
