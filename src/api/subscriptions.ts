import { api } from './client';

export type PremiumTier = 'free' | 'plus' | 'pro' | 'max';
export type BillingInterval = 'monthly' | 'annual';

export interface SubscriptionRecord {
  id: number;
  guild_id: string;
  tier: PremiumTier;
  billing_interval?: BillingInterval | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  stripe_subscription_id?: string | null;
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
}

export const subscriptionsApi = {
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
    api.fetch<{ success: boolean; checkout_url: string | null; message?: string }>(
      '/api/subscriptions/create-checkout',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  previewChange: (body: { guild_id: string; tier: PremiumTier; interval?: BillingInterval }) =>
    api.fetch<{
      success: boolean;
      net_amount?: number;
      is_charge?: boolean;
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
};
