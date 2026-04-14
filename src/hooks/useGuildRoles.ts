import { useQuery } from '@tanstack/react-query';
import { guildApi } from '@/api/guilds';

export function useGuildRoles(guildId: string) {
  return useQuery({
    queryKey: ['guild', guildId, 'roles'],
    queryFn: () => guildApi.getRoles(guildId),
    enabled: !!guildId,
  });
}
