import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configApi } from '@/api/config';

export interface RecapConfig {
  enabled: boolean;
  channel_id: string | null;
}

const DEFAULT_RECAP: RecapConfig = {
  enabled: false,
  channel_id: null,
};

/**
 * Weekly Recap configuration, stored under the `recap` key of the guild's
 * hybrid settings blob. Disabled by default — a server must opt in and pick a
 * channel before the bot posts the Monday recap.
 */
export function useRecapConfig(guildId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['guild', guildId, 'config-hybrid'],
    queryFn: () => configApi.getHybridConfig(guildId),
    enabled: !!guildId,
  });

  const mutation = useMutation({
    mutationFn: (recap: RecapConfig) => configApi.upsertHybridSections(guildId, { recap }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'config-hybrid'] });
    },
  });

  const settings = query.data?.data?.settings;
  const recap = useMemo<RecapConfig | undefined>(
    () => (query.data ? { ...DEFAULT_RECAP, ...(settings?.recap || {}) } : undefined),
    [query.data, settings?.recap],
  );

  return {
    recap,
    isLoading: query.isLoading,
    save: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error as Error | null,
  };
}
