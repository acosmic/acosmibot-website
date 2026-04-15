import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';

// Channels come from config-hybrid, same as the old site.
// Sharing the query key with useGuildRoles means only one network request fires per guild.
export function useGuildChannels(guildId: string) {
  return useQuery({
    queryKey: ['guild', guildId, 'config-hybrid'],
    queryFn: () => api.fetch<any>(`/api/guilds/${guildId}/config-hybrid`),
    enabled: !!guildId,
    select: (data) => (data?.data?.available_channels ?? []) as { id: string; name: string; type: number }[],
  });
}
