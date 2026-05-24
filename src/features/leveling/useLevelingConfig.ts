import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configApi } from '@/api/config';

export interface LevelingConfig {
  enabled: boolean;
  exp_per_message: number;
  exp_per_reaction: number;
  exp_per_command: number;
  reaction_xp_enabled: boolean;
  command_xp_enabled: boolean;
  level_up_announcements: boolean;
  announcement_channel_id: string | null;
  level_up_message: string;
  level_up_message_with_streak: string;
  daily_announcements_enabled: boolean;
  daily_announcement_channel_id: string | null;
  daily_announcement_message: string;
  daily_announcement_message_with_streak: string;
}

// Allowed ranges for per-guild XP rates. Mirrors GUILD_XP_RATE_BOUNDS in
// acosmibot-core; the API clamps to these server-side as well.
export const XP_RATE_BOUNDS = {
  exp_per_message: { min: 1, max: 100 },
  exp_per_reaction: { min: 0, max: 50 },
  exp_per_command: { min: 0, max: 100 },
} as const;

export interface RolesConfig {
  enabled: boolean;
  mode: string;
  announcement_channel_id: string | null;
  role_announcement: boolean;
  role_announcement_message: string;
  role_mappings: Record<string, { role_ids: string[]; announcement_message?: string }>;
}

const DEFAULT_LEVELING: LevelingConfig = {
  enabled: true,
  exp_per_message: 10,
  exp_per_reaction: 2,
  exp_per_command: 5,
  reaction_xp_enabled: true,
  command_xp_enabled: true,
  level_up_announcements: true,
  announcement_channel_id: null,
  level_up_message: '{username}, you have reached level {level}!',
  level_up_message_with_streak: '{mention} reached level {level}! +{credits} Credits! ({base_credits} + {streak_bonus} from {streak}x streak!)',
  daily_announcements_enabled: true,
  daily_announcement_channel_id: null,
  daily_announcement_message: '{username} claimed their daily reward!',
  daily_announcement_message_with_streak: '{mention} claimed their daily reward! +{credits} Credits! ({base_credits} + {streak_bonus} from {streak}x streak!)',
};

const DEFAULT_ROLES: RolesConfig = {
  enabled: false,
  mode: 'additive',
  announcement_channel_id: null,
  role_announcement: true,
  role_announcement_message: 'Congratulations {user}! You reached level {level} and earned the {role} role!',
  role_mappings: {},
};

export function useLevelingConfig(guildId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['guild', guildId, 'config-hybrid'],
    queryFn: () => configApi.getHybridConfig(guildId),
    enabled: !!guildId,
  });

  const mutation = useMutation({
    mutationFn: (data: { leveling: Partial<LevelingConfig>; roles: Partial<RolesConfig> }) =>
      configApi.upsertHybridSections(guildId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'config-hybrid'] });
    },
  });

  const settings = query.data?.data?.settings;
  const leveling = useMemo<LevelingConfig | undefined>(
    () => query.data ? { ...DEFAULT_LEVELING, ...(settings?.leveling || {}) } : undefined,
    [query.data, settings?.leveling],
  );
  const roles = useMemo<RolesConfig | undefined>(
    () => query.data ? { ...DEFAULT_ROLES, ...(settings?.roles || {}) } : undefined,
    [query.data, settings?.roles],
  );

  return {
    leveling,
    roles,
    isLoading: query.isLoading,
    save: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error as Error | null,
  };
}
