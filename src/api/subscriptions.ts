import { api } from './client';

export type PremiumTier = 'free' | 'premium' | 'premium_plus_ai';

export interface GuildSubscription {
  subscription?: unknown;
  tier: PremiumTier;
  status: string;
}

export const subscriptionsApi = {
  getGuildSubscription: (guildId: string) =>
    api.fetch<GuildSubscription>(`/api/guilds/${guildId}/subscription`),

  createCheckout: (body: {
    guild_id: string;
    tier: PremiumTier;
    success_url: string;
    cancel_url: string;
  }) =>
    api.fetch<{ success: boolean; checkout_url: string; message?: string }>(
      '/api/subscriptions/create-checkout',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  openPortal: (body: { guild_id: string; return_url: string }) =>
    api.fetch<{ success: boolean; portal_url: string }>(
      '/api/subscriptions/portal',
      { method: 'POST', body: JSON.stringify(body) },
    ),
};
