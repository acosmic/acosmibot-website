import { api } from './client';
import { configApi } from './config';
import type { StreamPlatformConfig, UpdateStreamPlatformConfigRequest } from '@/types/features';

export type Platform = 'twitch' | 'youtube' | 'kick';

export interface StreamerValidationResult {
  success: boolean;
  valid: boolean;
  message?: string;
  channel_id?: string | null;
  channel_info?: {
    title?: string;
  };
}

const DEFAULT_CONFIG: StreamPlatformConfig = {
  enabled: false,
  announcement_channel_id: null,
  announcement_message: null,
  vod_settings: {
    enabled: true,
    vod_message_suffix: '[Watch VOD]({vod_url})',
    edit_message_when_vod_available: true,
  },
  tracked_streamers: [],
  premium_tier: 'free',
  max_streamers: 1,
};

const STREAMER_LIMITS: Record<string, number> = {
  free: 1,
  premium: 5,
  premium_plus_ai: 5,
};

export const streamingApi = {
  getConfig: async (guildId: string, platform: Platform): Promise<StreamPlatformConfig> => {
    const res = await api.fetch<any>(`/api/guilds/${guildId}/config-hybrid`);
    const platformSettings = res?.data?.settings?.[platform] ?? {};
    const premiumTier = res?.data?.premium_tier ?? 'free';
    return {
      ...DEFAULT_CONFIG,
      ...platformSettings,
      premium_tier: premiumTier,
      max_streamers: STREAMER_LIMITS[premiumTier] ?? STREAMER_LIMITS.free,
      vod_settings: {
        ...DEFAULT_CONFIG.vod_settings,
        ...(platformSettings.vod_settings ?? {}),
      },
    };
  },

  updateConfig: async (guildId: string, platform: Platform, data: UpdateStreamPlatformConfigRequest): Promise<StreamPlatformConfig> => {
    const current = await configApi.getHybridConfig(guildId);
    const currentPlatform = current?.data?.settings?.[platform] ?? {};
    const premiumTier = current?.data?.premium_tier ?? 'free';
    const nextPlatform = {
      ...currentPlatform,
      ...data,
      vod_settings: {
        ...DEFAULT_CONFIG.vod_settings,
        ...(currentPlatform.vod_settings ?? {}),
        ...(data.vod_settings ?? {}),
      },
    };
    await configApi.upsertHybridSections(guildId, { [platform]: nextPlatform });
    return {
      ...DEFAULT_CONFIG,
      ...nextPlatform,
      premium_tier: premiumTier,
      max_streamers: STREAMER_LIMITS[premiumTier] ?? STREAMER_LIMITS.free,
    };
  },

  validateStreamer: async (platform: Platform, identifier: string): Promise<StreamerValidationResult> => {
    const value = identifier.trim();

    if (platform === 'youtube') {
      return api.fetch<StreamerValidationResult>('/api/youtube/validate-channel', {
        method: 'POST',
        body: JSON.stringify({ identifier: value }),
      });
    }

    return api.fetch<StreamerValidationResult>(`/api/${platform}/validate-username`, {
      method: 'POST',
      body: JSON.stringify({ username: value }),
    });
  },
};
