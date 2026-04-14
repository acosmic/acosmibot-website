import { api } from './client';
import type { StreamPlatformConfig, UpdateStreamPlatformConfigRequest } from '@/types/features';

export type Platform = 'twitch' | 'youtube' | 'kick';

export const streamingApi = {
  getConfig: (guildId: string, platform: Platform) =>
    api.fetch<StreamPlatformConfig>(`/api/${platform}/${guildId}`),

  updateConfig: (guildId: string, platform: Platform, data: UpdateStreamPlatformConfigRequest) =>
    api.fetch<StreamPlatformConfig>(`/api/${platform}/${guildId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
