import type { PremiumTier } from '@/api/subscriptions';
import { normalizePremiumTier } from '@/components/ui/PremiumTierIcon';

/**
 * The one place the dashboard looks up which plan a sidebar feature needs, and
 * where "upgrade" links go. Keep this in step with the API/bot gates
 * (acosmibot-core `premium_checker.TIER_LIMITS` and decision-premium-gating);
 * it only drives badges and links, never authorization.
 */

const TIER_RANK: Record<PremiumTier, number> = { free: 0, plus: 1, pro: 2, max: 3 };

export const PLAN_LABEL: Record<Exclude<PremiumTier, 'free'>, string> = {
  plus: 'Plus',
  pro: 'Pro',
  max: 'Max',
};

export interface FeaturePlanRequirement {
  /** Lowest plan that unlocks the gated part of the feature. */
  tier: Exclude<PremiumTier, 'free'>;
  /** 'feature': the whole page is locked below this plan. 'advanced': the page works, its advanced settings are locked. */
  scope: 'feature' | 'advanced';
}

/** Keyed by the dashboard route segment (`/server/:guildId/<feature>`). */
export const FEATURE_PLAN_REQUIREMENTS: Record<string, FeaturePlanRequirement> = {
  'server-branding': { tier: 'plus', scope: 'feature' },
  analytics: { tier: 'plus', scope: 'feature' },
  'x-alerts': { tier: 'plus', scope: 'feature' },
  ai: { tier: 'pro', scope: 'advanced' },
};

/**
 * The plan badge to show for a feature on a server's current tier, or null when
 * the server already has access (or the tier is not yet known).
 */
export const lockedPlanFor = (
  feature: string,
  guildTier: string | null | undefined,
): FeaturePlanRequirement | null => {
  const requirement = FEATURE_PLAN_REQUIREMENTS[feature];
  if (!requirement || guildTier == null) return null;
  const current = normalizePremiumTier(guildTier);
  return TIER_RANK[current] < TIER_RANK[requirement.tier] ? requirement : null;
};

/** Every dashboard upgrade link goes to plan comparison with this server preselected. */
export const upgradePath = (guildId: string | undefined): string =>
  guildId ? `/pricing?guild=${encodeURIComponent(guildId)}` : '/pricing';
