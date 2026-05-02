import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configApi } from '@/api/config';
import { PolymorphConfig } from '@/types/features';

const DEFAULT_POLYMORPH: PolymorphConfig = {
  enabled: false,
  cost: 10000,
  duration_minutes: 60,
  mode: 'manual',
  allow_ai_random_names: false,
};

export function usePolymorphConfig(guildId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['guild', guildId, 'config-hybrid'],
    queryFn: () => configApi.getHybridConfig(guildId),
    enabled: !!guildId,
  });

  const raw = query.data?.data?.settings?.polymorph;

  const data = useMemo<PolymorphConfig | undefined>(() => {
    if (!query.data) return undefined;
    return {
      ...DEFAULT_POLYMORPH,
      ...(raw || {}),
      enabled: raw?.enabled === true,
      cost: Number(raw?.cost ?? DEFAULT_POLYMORPH.cost),
      duration_minutes: Number(raw?.duration_minutes ?? DEFAULT_POLYMORPH.duration_minutes),
      mode: raw?.mode === 'ai_random' ? 'ai_random' : 'manual',
      allow_ai_random_names: raw?.allow_ai_random_names === true || raw?.mode === 'ai_random',
    };
  }, [query.data, raw]);

  const mutation = useMutation({
    mutationFn: (polymorph: PolymorphConfig) =>
      configApi.upsertHybridSections(guildId, { polymorph }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'config-hybrid'] });
    },
  });

  return {
    data,
    isLoading: query.isLoading,
    save: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error as Error | null,
  };
}
