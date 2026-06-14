import { api } from './client';
import type { TopCommand, TopReaction } from './profile';

export interface GuildCommandAnalytics {
  top_commands: Array<TopCommand & { users?: number }>;
  least_used: TopCommand[];
  never_used: string[];
}

export interface GuildReactionAnalytics {
  top_reactions: TopReaction[];
}

export interface HourBucket {
  hour: number;
  count: number;
}

export interface TopGuild {
  guild_id: string;
  name: string;
  count: number;
  users: number;
}

export interface GlobalCommandAnalytics {
  top_commands: Array<TopCommand & { users?: number; guilds?: number }>;
  top_guilds: TopGuild[];
  hourly_distribution: HourBucket[];
}

export interface GlobalReactionAnalytics {
  top_reactions: TopReaction[];
}

export type VolumeGranularity = 'hour' | 'day';

export interface VolumeBucket {
  bucket: string;
  count: number;
}

export interface CommandVolume {
  granularity: VolumeGranularity;
  days: number;
  buckets: VolumeBucket[];
}

export const analyticsApi = {
  guildCommands: (guildId: string): Promise<GuildCommandAnalytics> =>
    api.fetch<GuildCommandAnalytics>(`/api/guilds/${guildId}/analytics/commands`),

  guildReactions: (guildId: string): Promise<GuildReactionAnalytics> =>
    api.fetch<GuildReactionAnalytics>(`/api/guilds/${guildId}/analytics/reactions`),

  globalCommands: (): Promise<GlobalCommandAnalytics> =>
    api.fetch<GlobalCommandAnalytics>('/api/admin/analytics/commands'),

  globalReactions: (): Promise<GlobalReactionAnalytics> =>
    api.fetch<GlobalReactionAnalytics>('/api/admin/analytics/reactions'),

  globalVolume: (granularity: VolumeGranularity, days: number): Promise<CommandVolume> =>
    api.fetch<CommandVolume>(
      `/api/admin/analytics/volume?granularity=${granularity}&days=${days}`,
    ),
};
