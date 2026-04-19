import { api } from './client';
import type { GiveawayConfig, UpdateGiveawayConfigRequest } from '@/types/features';

function fromSettings(raw: any): GiveawayConfig {
  return {
    enabled: raw?.enabled ?? false,
    defaultEmoji: raw?.default_emoji ?? '🎉',
    winnerLogChannelId: raw?.winner_log_channel_id ?? null,
    dmWinner: raw?.dm_winner ?? true,
    recentWinnerLockoutCount: raw?.recent_winner_lockout_count ?? 0,
    boosterMultiplierEnabled: raw?.booster_multiplier_enabled ?? false,
    boosterMultiplier: raw?.booster_multiplier ?? 2,
    minAccountAgeDays: raw?.min_account_age_days ?? 0,
    minServerJoinDays: raw?.min_server_join_days ?? 0,
    requiredRoleIds: raw?.required_role_ids ?? [],
    excludedRoleIds: raw?.excluded_role_ids ?? [],
    roleMultipliers: raw?.role_multipliers ?? {},
    bannedUserIds: raw?.banned_user_ids ?? [],
  };
}

function toSettings(data: UpdateGiveawayConfigRequest, existing: any = {}): any {
  const out = { ...existing };
  if ('enabled' in data) out.enabled = data.enabled;
  if ('defaultEmoji' in data) out.default_emoji = data.defaultEmoji;
  if ('winnerLogChannelId' in data) out.winner_log_channel_id = data.winnerLogChannelId;
  if ('dmWinner' in data) out.dm_winner = data.dmWinner;
  if ('recentWinnerLockoutCount' in data) out.recent_winner_lockout_count = data.recentWinnerLockoutCount;
  if ('boosterMultiplierEnabled' in data) out.booster_multiplier_enabled = data.boosterMultiplierEnabled;
  if ('boosterMultiplier' in data) out.booster_multiplier = data.boosterMultiplier;
  if ('minAccountAgeDays' in data) out.min_account_age_days = data.minAccountAgeDays;
  if ('minServerJoinDays' in data) out.min_server_join_days = data.minServerJoinDays;
  if ('requiredRoleIds' in data) out.required_role_ids = data.requiredRoleIds;
  if ('excludedRoleIds' in data) out.excluded_role_ids = data.excludedRoleIds;
  if ('roleMultipliers' in data) out.role_multipliers = data.roleMultipliers;
  if ('bannedUserIds' in data) out.banned_user_ids = data.bannedUserIds;
  return out;
}

export const giveawayApi = {
  getConfig: async (guildId: string): Promise<GiveawayConfig> => {
    const res = await api.fetch<any>(`/api/guilds/${guildId}/giveaway-config`);
    return fromSettings(res?.data);
  },

  updateConfig: async (guildId: string, data: UpdateGiveawayConfigRequest): Promise<GiveawayConfig> => {
    const current = await api.fetch<any>(`/api/guilds/${guildId}/giveaway-config`);
    const merged = toSettings(data, current?.data ?? {});
    await api.fetch<any>(`/api/guilds/${guildId}/giveaway-config`, {
      method: 'PATCH',
      body: JSON.stringify({ giveaway: merged }),
    });
    return fromSettings(merged);
  },

  getActiveGiveaways: (guildId: string) =>
    api.fetch<any>(`/api/guilds/${guildId}/giveaways?status=active&limit=10`)
      .then(r => r?.data ?? []),

  getRecentGiveaways: (guildId: string) =>
    api.fetch<any>(`/api/guilds/${guildId}/giveaways?status=ended`)
      .then(r => r?.data ?? []),

  cancelGiveaway: (guildId: string, giveawayId: number) =>
    api.fetch<any>(`/api/guilds/${guildId}/giveaways/${giveawayId}/cancel`, { method: 'POST' }),
};
