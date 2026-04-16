import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configApi } from '@/api/config';
import { SlotsConfig, SlotsTier } from '@/types/features';

const DEFAULT_SLOTS: SlotsConfig = {
  enabled: false,
  tier_emojis: {
    common: [],
    uncommon: [],
    rare: [],
    legendary: [],
    scatter: [],
  },
};

export interface GuildEmoji {
  id: string;
  name: string;
  animated: boolean;
  url: string;
}

export function useSlotsConfig(guildId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['guild', guildId, 'config-hybrid'],
    queryFn: () => configApi.getHybridConfig(guildId),
    enabled: !!guildId,
  });

  const raw = query.data?.data?.settings?.games?.['slots-config'];
  const allSettings = query.data?.data?.settings;
  const availableEmojis: GuildEmoji[] = query.data?.data?.available_emojis ?? [];

  const data = useMemo<SlotsConfig | undefined>(() => {
    if (!query.data) return undefined;
    const tiers: SlotsTier[] = ['common', 'uncommon', 'rare', 'legendary', 'scatter'];
    const tier_emojis = tiers.reduce((acc, t) => {
      acc[t] = Array.isArray(raw?.tier_emojis?.[t]) ? [...raw.tier_emojis[t]] : [];
      return acc;
    }, {} as Record<SlotsTier, string[]>);
    return {
      enabled: raw?.enabled === true,
      tier_emojis: { ...DEFAULT_SLOTS.tier_emojis, ...tier_emojis },
    };
  }, [query.data, raw]);

  const mutation = useMutation({
    mutationFn: async (slots: SlotsConfig) => {
      const currentGames = allSettings?.games ?? {};
      const mergedSettings = {
        ...(allSettings ?? {}),
        games: {
          ...currentGames,
          enabled: currentGames.enabled !== false,
          'slots-config': slots,
        },
      };
      return configApi.updateHybridConfig(guildId, mergedSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'config-hybrid'] });
    },
  });

  return {
    data,
    availableEmojis,
    isLoading: query.isLoading,
    save: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error as Error | null,
  };
}
