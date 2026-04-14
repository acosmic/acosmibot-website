import { api } from './client';
import type { StreamPlatformConfig, UpdateStreamPlatformConfigRequest } from '@/types/features';

export type Platform = 'twitch' | 'youtube' | 'kick';

const DEFAULT_CONFIG: StreamPlatformConfig = {
  enabled: false,
  announcement_channel_id: null,
  announcement_message: null,
  tracked_streamers: [],
};

export const streamingApi = {
  getConfig: async (guildId: string, platform: Platform): Promise<StreamPlatformConfig> => {
    const res = await api.fetch<any>(`/api/guilds/${guildId}/config-hybrid`);
    const platformSettings = res?.data?.settings?.[platform] ?? {};
    return { ...DEFAULT_CONFIG, ...platformSettings };
  },

  updateConfig: async (guildId: string, platform: Platform, data: UpdateStreamPlatformConfigRequest): Promise<StreamPlatformConfig> => {
    const current = await api.fetch<any>(`/api/guilds/${guildId}/config-hybrid`);
    const currentSettings = current?.data?.settings ?? {};
    const updatedSettings = {
      ...currentSettings,
      [platform]: {
        ...(currentSettings[platform] ?? {}),
        ...data,
      },
    };
    await api.fetch<any>(`/api/guilds/${guildId}/config-hybrid`, {
      method: 'POST',
      body: JSON.stringify({ settings: updatedSettings }),
    });
    return { ...DEFAULT_CONFIG, ...updatedSettings[platform] };
  },
};
