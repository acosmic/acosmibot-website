import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configApi } from '@/api/config';
import { ModerationConfig } from '@/types/features';

export function useModerationConfig(guildId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['guild', guildId, 'config-hybrid'],
    queryFn: () => configApi.getHybridConfig(guildId),
    enabled: !!guildId,
  });

  const mutation = useMutation({
    mutationFn: (moderation: Partial<ModerationConfig>) =>
      configApi.updateHybridConfig(guildId, { moderation }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'config-hybrid'] });
    },
  });

  return {
    data: query.data?.data?.settings?.moderation as ModerationConfig,
    isLoading: query.isLoading,
    save: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error as Error | null,
  };
}
