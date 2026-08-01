import { api } from './client';

export const configApi = {
  getHybridConfig: (guildId: string) =>
    api.fetch<any>(`/api/guilds/${guildId}/config-hybrid`),

  updateHybridConfig: (guildId: string, settings: any) =>
    api.fetch<any>(`/api/guilds/${guildId}/config-hybrid`, {
      method: 'POST',
      body: JSON.stringify({ settings }),
    }),

  // The API atomically replaces only these top-level sections, so unrelated
  // features are neither revalidated nor exposed to client-side merge races.
  upsertHybridSections: (
    guildId: string,
    partial: Record<string, unknown>,
  ) =>
    api.fetch<any>(`/api/guilds/${guildId}/config-hybrid`, {
      method: 'POST',
      body: JSON.stringify({ settings: partial }),
    }),
};
