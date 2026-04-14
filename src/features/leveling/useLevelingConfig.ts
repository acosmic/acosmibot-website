import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { levelingApi } from '@/api/leveling';
import type { UpdateLevelingConfigRequest } from '@/types/features';

export function useLevelingConfig(guildId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['leveling', guildId],
    queryFn: () => levelingApi.getConfig(guildId),
    enabled: !!guildId,
  });

  const mutation = useMutation({
    mutationFn: (data: UpdateLevelingConfigRequest) =>
      levelingApi.updateConfig(guildId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['leveling', guildId], updated);
    },
  });

  return { ...query, save: mutation.mutate, isSaving: mutation.isPending };
}
