import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configApi } from '@/api/config';
import { ModerationConfig } from '@/types/features';

const DEFAULT_MODERATION: ModerationConfig = {
  enabled: false,
  mod_log_channel_id: null,
  member_activity_channel_id: null,
  events: {},
};

export function useModerationConfig(guildId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['guild', guildId, 'config-hybrid'],
    queryFn: () => configApi.getHybridConfig(guildId),
    enabled: !!guildId,
  });

  const mutation = useMutation({
    mutationFn: (moderation: Partial<ModerationConfig>) =>
      configApi.upsertHybridSections(guildId, { moderation }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'config-hybrid'] });
    },
  });

  const raw = query.data?.data?.settings?.moderation;
  const data = useMemo<ModerationConfig | undefined>(
    () => query.data ? { ...DEFAULT_MODERATION, ...(raw || {}) } : undefined,
    [query.data, raw],
  );

  return {
    data,
    isLoading: query.isLoading,
    save: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error as Error | null,
  };
}
