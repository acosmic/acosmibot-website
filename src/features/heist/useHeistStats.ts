import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { heistApi } from '@/api/heist';

export function useHeistOverview(guildId: string) {
  const query = useQuery({
    queryKey: ['guild', guildId, 'heist', 'overview'],
    queryFn: () => heistApi.getOverview(guildId),
    enabled: !!guildId,
  });
  return {
    data: query.data?.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useResetHeistCooldown(guildId: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => heistApi.resetCooldown(guildId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'heist', 'overview'] });
    },
  });
  return {
    reset: mutation.mutate,
    isResetting: mutation.isPending,
    error: mutation.error instanceof Error ? mutation.error.message : null,
    didReset: mutation.isSuccess,
  };
}

export function useHeistLeaderboard(guildId: string) {
  const query = useQuery({
    queryKey: ['guild', guildId, 'heist', 'leaderboard'],
    queryFn: () => heistApi.getLeaderboard(guildId),
    enabled: !!guildId,
  });
  return {
    data: query.data?.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
