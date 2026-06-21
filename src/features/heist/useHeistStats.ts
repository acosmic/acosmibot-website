import { useQuery } from '@tanstack/react-query';
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
