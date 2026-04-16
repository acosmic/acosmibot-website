import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { streamingApi, Platform } from '@/api/streaming';
import type { UpdateStreamPlatformConfigRequest } from '@/types/features';

export function useStreamPlatformConfig(guildId: string, platform: Platform) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['streaming', platform, guildId],
    queryFn: () => streamingApi.getConfig(guildId, platform),
    enabled: !!guildId && !!platform,
  });

  const mutation = useMutation({
    mutationFn: (data: UpdateStreamPlatformConfigRequest) =>
      streamingApi.updateConfig(guildId, platform, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['streaming', platform, guildId], updated);
    },
  });

  return {
    ...query,
    save: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error as Error | null,
  };
}
