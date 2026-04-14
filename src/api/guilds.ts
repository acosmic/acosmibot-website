import { api } from './client';
import type { Guild, Channel, Role } from '@/types/guild';

export const guildApi = {
  getGuilds: () =>
    api.fetch<{ success: boolean; guilds: Guild[] }>('/api/user/guilds')
      .then(r => r.guilds ?? []),

  getGuild: (guildId: string) =>
    api.fetch<Guild>(`/api/guilds/${guildId}`),

  getChannels: (guildId: string) =>
    api.fetch<Channel[]>(`/api/guilds/${guildId}/channels`),

  getRoles: (guildId: string) =>
    api.fetch<Role[]>(`/api/guilds/${guildId}/roles`),
};
