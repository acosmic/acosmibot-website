import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { giveawayApi } from '@/api/giveaway';
import type { UpdateGiveawayConfigRequest } from '@/types/features';

export function useGiveawayConfig(guildId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['giveaway', guildId],
    queryFn: () => giveawayApi.getConfig(guildId),
    enabled: !!guildId,
  });

  const mutation = useMutation({
    mutationFn: (data: UpdateGiveawayConfigRequest) =>
      giveawayApi.updateConfig(guildId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['giveaway', guildId], updated);
    },
  });

  return {
    ...query,
    save: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error as Error | null,
  };
}
