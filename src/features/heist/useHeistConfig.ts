import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configApi } from '@/api/config';
import { HeistConfig } from '@/types/features';

// Mirrors DEFAULT_HEIST_SETTINGS in the API (api/blueprints/guilds.py) and the bot's
// fallback_config (Cogs/Heist.py).
const DEFAULT_HEIST: HeistConfig = {
  enabled: true,
  cooldown_hours: 4,
  join_window_seconds: 60,
  base_success: 0.25,
  per_member_success: 0.12,
  success_cap: 0.85,
  base_loot_percent: 12.0,
  pie_growth_k: 0.35,
  max_loot_percent: 45.0,
  min_vault: 1000,
  fine_percent: 5.0,
};

export function useHeistConfig(guildId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['guild', guildId, 'config-hybrid'],
    queryFn: () => configApi.getHybridConfig(guildId),
    enabled: !!guildId,
  });

  const raw = query.data?.data?.settings?.heist;

  const data = useMemo<HeistConfig | undefined>(() => {
    if (!query.data) return undefined;
    return {
      ...DEFAULT_HEIST,
      ...(raw || {}),
      enabled: raw?.enabled !== false,
    };
  }, [query.data, raw]);

  const mutation = useMutation({
    mutationFn: (heist: HeistConfig) =>
      configApi.upsertHybridSections(guildId, { heist }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'config-hybrid'] });
    },
  });

  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    save: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error as Error | null,
  };
}
