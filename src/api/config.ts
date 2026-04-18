import { api } from './client';

export const configApi = {
  getHybridConfig: (guildId: string) =>
    api.fetch<any>(`/api/guilds/${guildId}/config-hybrid`),

  updateHybridConfig: (guildId: string, settings: any) =>
    api.fetch<any>(`/api/guilds/${guildId}/config-hybrid`, {
      method: 'POST',
      body: JSON.stringify({ settings }),
    }),

  // Refetch current settings, shallow-merge the provided top-level sections,
  // and POST the full merged object. Use this to save a single feature's
  // slice without clobbering other sections saved concurrently or from
  // another page.
  upsertHybridSections: async (
    guildId: string,
    partial: Record<string, unknown>,
  ) => {
    const current = await api.fetch<any>(`/api/guilds/${guildId}/config-hybrid`);
    const currentSettings = current?.data?.settings ?? {};
    const merged = { ...currentSettings, ...partial };
    return api.fetch<any>(`/api/guilds/${guildId}/config-hybrid`, {
      method: 'POST',
      body: JSON.stringify({ settings: merged }),
    });
  },
};
