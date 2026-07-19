import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configApi } from '@/api/config';
import type { BetterEmbedsConfig } from '@/types/features';

const DEFAULT_BETTER_EMBEDS: BetterEmbedsConfig = {
  enabled: true,
  instagram: { enabled: true },
  twitter: { enabled: true },
  bluesky: { enabled: true },
  tiktok: { enabled: true },
  reddit: { enabled: true },
};

export function useBetterEmbedsConfig(guildId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['guild', guildId, 'config-hybrid'],
    queryFn: () => configApi.getHybridConfig(guildId),
    enabled: !!guildId,
  });

  const mutation = useMutation({
    mutationFn: (betterEmbeds: BetterEmbedsConfig) =>
      configApi.upsertHybridSections(guildId, {
        better_embeds: { ...betterEmbeds, enabled: true },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'config-hybrid'] });
    },
  });

  const raw = query.data?.data?.settings?.better_embeds;
  const data = useMemo<BetterEmbedsConfig | undefined>(() => {
    if (!query.data) return undefined;
    return {
      ...(raw || {}),
      enabled: true,
      instagram: {
        ...DEFAULT_BETTER_EMBEDS.instagram,
        ...(raw?.instagram || {}),
      },
      twitter: {
        ...DEFAULT_BETTER_EMBEDS.twitter,
        ...(raw?.twitter || {}),
      },
      bluesky: {
        ...DEFAULT_BETTER_EMBEDS.bluesky,
        ...(raw?.bluesky || {}),
      },
      tiktok: {
        ...DEFAULT_BETTER_EMBEDS.tiktok,
        ...(raw?.tiktok || {}),
      },
      reddit: {
        ...DEFAULT_BETTER_EMBEDS.reddit,
        ...(raw?.reddit || {}),
      },
    };
  }, [query.data, raw]);

  return {
    data,
    isLoading: query.isLoading,
    save: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error as Error | null,
  };
}
