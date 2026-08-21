import { api } from './client';
import type { JailConfig } from '@/types/features';

export interface JailSetupResponse {
  success: boolean;
  message?: string;
  data: {
    guild_id: string;
    settings: {
      jail: JailConfig;
      [key: string]: unknown;
    };
    setup: {
      channel_id: string;
      inmate_role_id: string;
      created_channel: boolean;
      created_role: boolean;
      staff_role_ids: string[];
      warning: string;
    };
  };
}

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

  setupJail: (guildId: string, setup: {
    channel_name: string;
    inmate_role_name: string;
    staff_role_ids: string[];
    enable: boolean;
  }) =>
    api.fetch<JailSetupResponse>(`/api/guilds/${guildId}/jail/setup`, {
      method: 'POST',
      body: JSON.stringify(setup),
    }),
};
