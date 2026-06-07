import { api } from './client';

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'legendary';

/** A catalog achievement annotated with the viewer's unlock state + progress. */
export interface AchievementCatalogEntry {
  key: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  tier: AchievementTier;
  condition_type?: 'metric' | 'event';
  reward_credits?: number;
  reward_cosmetic_id?: number | null;
  secret: boolean;
  unlocked: boolean;
  progress?: {
    current: number;
    threshold: number;
    metric: string;
  } | null;
  // ISO datetime cutoff after which it can no longer be earned (limited-time).
  available_until?: string | null;
}

export interface AchievementCatalog {
  achievements: AchievementCatalogEntry[];
  unlocked_count: number;
}

/** An unlocked achievement as shown on a profile trophy case. */
export interface UnlockedAchievement {
  key: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  tier: AchievementTier;
  unlocked_at: string | null;
}

export const achievementsApi = {
  /** Full catalog with the signed-in user's unlock state + progress. */
  getCatalog: (): Promise<AchievementCatalog> =>
    api.fetch<AchievementCatalog>('/api/achievements'),
};
