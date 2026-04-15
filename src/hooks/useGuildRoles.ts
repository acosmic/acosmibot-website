import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';

// Roles come from config-hybrid, same as the old site.
// Sharing the query key with useGuildChannels means only one network request fires per guild.
export function useGuildRoles(guildId: string) {
  return useQuery({
    queryKey: ['guild', guildId, 'config-hybrid'],
    queryFn: () => api.fetch<any>(`/api/guilds/${guildId}/config-hybrid`),
    enabled: !!guildId,
    select: (data) => (data?.data?.available_roles ?? []) as { id: string; name: string; color: number; managed: boolean }[],
  });
}
