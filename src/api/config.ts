import { api } from './client';

export const configApi = {
  getHybridConfig: (guildId: string) =>
    api.fetch<any>(`/api/guilds/${guildId}/config-hybrid`),

  updateHybridConfig: (guildId: string, settings: any) =>
    api.fetch<any>(`/api/guilds/${guildId}/config-hybrid`, {
      method: 'POST',
      body: JSON.stringify({ settings }),
    }),
};
