import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';

export interface GuildEmoji {
  id: string;
  name: string;
  animated: boolean;
  url: string;
}

// Emojis come from config-hybrid, same query key as useGuildChannels/useGuildRoles
// so only one network request fires per guild.
export function useGuildEmojis(guildId: string) {
  return useQuery({
    queryKey: ['guild', guildId, 'config-hybrid'],
    queryFn: () => api.fetch<any>(`/api/guilds/${guildId}/config-hybrid`),
    enabled: !!guildId,
    select: (data) => (data?.data?.available_emojis ?? []) as GuildEmoji[],
  });
}
