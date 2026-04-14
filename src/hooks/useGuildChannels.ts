import { useQuery } from '@tanstack/react-query';
import { guildApi } from '@/api/guilds';

export function useGuildChannels(guildId: string) {
  return useQuery({
    queryKey: ['guild', guildId, 'channels'],
    queryFn: () => guildApi.getChannels(guildId),
    enabled: !!guildId,
  });
}
