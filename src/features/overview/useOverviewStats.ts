import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';

export interface UserStats {
  level: number;
  credits: number;
  rank: number;
  messages: number;
  reactions: number;
  experience: number;
  member_since: string;
}

export interface GuildStats {
  total_members: number;
  active_members: number;
  total_messages: number;
  total_reactions: number;
  total_commands: number;
  top_active_channels: Array<{ id: string; name: string; count: number }>;
}

export function useOverviewStats(guildId: string, userId: string) {
  const userStatsQuery = useQuery({
    queryKey: ['guild', guildId, 'user', userId, 'stats'],
    queryFn: () => api.fetch<any>(`/api/guilds/${guildId}/user/${userId}/stats`),
    enabled: !!guildId && !!userId,
  });

  const guildStatsQuery = useQuery({
    queryKey: ['guild', guildId, 'stats'],
    queryFn: () => api.fetch<any>(`/api/guilds/${guildId}/stats-db`),
    enabled: !!guildId,
  });

  return {
    userStats: userStatsQuery.data?.success ? userStatsQuery.data.data : userStatsQuery.data,
    guildStats: guildStatsQuery.data?.success ? guildStatsQuery.data.data : guildStatsQuery.data,
    isLoading: userStatsQuery.isLoading || guildStatsQuery.isLoading,
    error: userStatsQuery.error || guildStatsQuery.error,
  };
}
