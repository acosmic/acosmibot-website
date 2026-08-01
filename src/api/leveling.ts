import { api } from './client';
import { configApi } from './config';
import type { LevelingConfig, UpdateLevelingConfigRequest } from '@/types/features';

// Map snake_case settings dict → camelCase LevelingConfig
function fromSettings(settings: any): LevelingConfig {
  const l = settings?.leveling ?? {};
  return {
    enabled: l.enabled ?? true,
    xpRate: l.exp_per_message ?? 10,
    multiplier: l.multiplier ?? 1.0,
    cooldownSeconds: l.exp_cooldown_seconds ?? 60,
    announcementChannelId: l.announcement_channel_id ?? null,
    ignoredChannelIds: l.ignored_channel_ids ?? [],
    ignoredRoleIds: l.ignored_role_ids ?? [],
    rewards: l.rewards ?? [],
  };
}

// Map camelCase UpdateLevelingConfigRequest → snake_case settings keys
function toSettingsPartial(data: UpdateLevelingConfigRequest): Record<string, unknown> {
  const l: Record<string, unknown> = {};
  if ('enabled' in data) l.enabled = data.enabled;
  if ('xpRate' in data) l.exp_per_message = data.xpRate;
  if ('multiplier' in data) l.multiplier = data.multiplier;
  if ('cooldownSeconds' in data) l.exp_cooldown_seconds = data.cooldownSeconds;
  if ('announcementChannelId' in data) l.announcement_channel_id = data.announcementChannelId;
  if ('ignoredChannelIds' in data) l.ignored_channel_ids = data.ignoredChannelIds;
  if ('ignoredRoleIds' in data) l.ignored_role_ids = data.ignoredRoleIds;
  if ('rewards' in data) l.rewards = data.rewards;
  return l;
}

export const levelingApi = {
  getConfig: async (guildId: string): Promise<LevelingConfig> => {
    const res = await api.fetch<any>(`/api/guilds/${guildId}/config-hybrid`);
    return fromSettings(res?.data?.settings);
  },

  updateConfig: async (guildId: string, data: UpdateLevelingConfigRequest): Promise<LevelingConfig> => {
    // Preserve unedited leveling fields, then patch only this feature section.
    const current = await configApi.getHybridConfig(guildId);
    const currentSettings = current?.data?.settings ?? {};
    const leveling = {
      ...(currentSettings.leveling ?? {}),
      ...toSettingsPartial(data),
    };
    await configApi.upsertHybridSections(guildId, { leveling });
    return fromSettings({ leveling });
  },
};
