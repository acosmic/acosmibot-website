import { api } from './client';
import { configApi } from './config';
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
    const current = await configApi.getHybridConfig(guildId);
    const currentPlatform = current?.data?.settings?.[platform] ?? {};
    const nextPlatform = { ...currentPlatform, ...data };
    await configApi.upsertHybridSections(guildId, { [platform]: nextPlatform });
    return { ...DEFAULT_CONFIG, ...nextPlatform };
  },
};
