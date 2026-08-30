import type { Guild } from '@/types/guild';

const ANALYTICS_TIERS = new Set(['plus', 'pro', 'max', 'premium', 'premium_plus_ai']);

export const getGuildTier = (guild: Guild | undefined): string | null => {
  if (!guild) return null;
  return String(guild.premium_entitlement?.tier ?? guild.premium_tier ?? 'free').toLowerCase();
};

export const hasGuildAnalyticsAccess = (tier: string | null) =>
  tier !== null && ANALYTICS_TIERS.has(tier);
