import { api } from './client';
import type { TopCommand, TopReaction } from './profile';

export interface GuildCommandAnalytics {
  days: number;
  top_commands: Array<TopCommand & { users?: number }>;
  least_used: TopCommand[];
  never_used: string[];
}

export interface GuildReactionAnalytics {
  days: number;
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

// --- AI usage ---
export interface AiUsageTypeStat {
  count: number;
  total_tokens: number;
  total_cost: number;
}
export interface AiModelUsage {
  model: string;
  usage_count: number;
  total_tokens: number;
  total_cost: number;
}
export interface AiTopGuild {
  guild_id: string;
  name: string;
  usage_count: number;
  total_tokens: number;
  total_cost: number;
}
export interface GuildAiTopUser {
  user_id: string;
  username: string;
  total_usage: number;
}
export interface GlobalAiUsage {
  days: number;
  stats_by_type: Record<string, AiUsageTypeStat>;
  by_model: AiModelUsage[];
  top_guilds: AiTopGuild[];
}
export interface GlobalAiCallAggregate {
  days: number;
  call_count: number;
  success_count: number;
  error_count: number;
  input_tokens: number;
  cached_input_tokens: number;
  visible_output_tokens: number;
  thought_tokens: number;
  tool_use_prompt_tokens: number;
  provider_total_tokens: number;
  cost_usd: string;
  unknown_cost_count: number;
  fallback_cost_count: number;
  latency_ms: { p50: number | null; p95: number | null };
  spend_by_day: Array<{ date: string; call_count: number; cost_usd: string }>;
}
export interface GuildAiUsage {
  days: number;
  stats_by_type: Record<string, { count: number }>;
  top_users: GuildAiTopUser[];
}

// --- Channel message activity ---
export interface ChannelActivity {
  channel_id: string;
  name: string;
  count: number;
  series: Array<{ date: string; count: number }>;
}
export interface GuildChannelActivity {
  days: number;
  channels: ChannelActivity[];
}
export interface GlobalMessages {
  days: number;
  top_guilds: Array<{ guild_id: string; name: string; count: number; channels: number }>;
  volume: VolumeBucket[];
}

// --- Member growth ---
export interface MemberFlowDay {
  date: string;
  joins: number;
  leaves: number;
  kicks: number;
  bans: number;
  departures: number;
  net: number;
}
export interface MemberFlowTotals {
  joins: number;
  leaves: number;
  kicks: number;
  bans: number;
  departures: number;
  net: number;
}
export interface MemberFlow {
  days: number;
  flow: MemberFlowDay[];
  totals: MemberFlowTotals;
}

export interface BetterEmbedsAnalytics {
  days: number;
  tracking_started_at: string | null;
  totals: {
    eligible_messages: number;
    replacements_posted: number;
    blocked_permissions: number;
    failed_transactions: number;
    detected_links: number;
    links_replaced: number;
    completion_rate: number;
  };
  outcomes: Record<string, number>;
  daily: Array<{ date: string; replacements_posted: number; links_replaced: number }>;
  platforms: Array<{ platform: string; detected: number; replaced: number }>;
  providers?: Array<{ platform: string; provider: string; status: string; count: number }>;
}

export interface GlobalBetterEmbedsAnalytics extends BetterEmbedsAnalytics {
  providers: Array<{ platform: string; provider: string; status: string; count: number }>;
  active_guilds: number;
  top_guilds: Array<{
    guild_id: string;
    name: string;
    replacements_posted: number;
  }>;
}

export const analyticsApi = {
  guildCommands: (guildId: string, days: number): Promise<GuildCommandAnalytics> =>
    api.fetch<GuildCommandAnalytics>(`/api/guilds/${guildId}/analytics/commands?days=${days}`),

  guildReactions: (guildId: string, days: number): Promise<GuildReactionAnalytics> =>
    api.fetch<GuildReactionAnalytics>(`/api/guilds/${guildId}/analytics/reactions?days=${days}`),

  globalCommands: (): Promise<GlobalCommandAnalytics> =>
    api.fetch<GlobalCommandAnalytics>('/api/admin/analytics/commands'),

  globalReactions: (): Promise<GlobalReactionAnalytics> =>
    api.fetch<GlobalReactionAnalytics>('/api/admin/analytics/reactions'),

  globalVolume: (granularity: VolumeGranularity, days: number): Promise<CommandVolume> =>
    api.fetch<CommandVolume>(
      `/api/admin/analytics/volume?granularity=${granularity}&days=${days}`,
    ),

  globalAiUsage: (days: number): Promise<GlobalAiUsage> =>
    api.fetch<GlobalAiUsage>(`/api/admin/analytics/ai-usage?days=${days}`),

  globalAiCalls: (days: number): Promise<GlobalAiCallAggregate> =>
    api.fetch<GlobalAiCallAggregate>(`/api/admin/analytics/ai-calls?days=${days}`),

  guildAiUsage: (guildId: string, days: number): Promise<GuildAiUsage> =>
    api.fetch<GuildAiUsage>(`/api/guilds/${guildId}/analytics/ai-usage?days=${days}`),

  guildChannels: (guildId: string, days: number): Promise<GuildChannelActivity> =>
    api.fetch<GuildChannelActivity>(`/api/guilds/${guildId}/analytics/channels?days=${days}`),

  globalMessages: (days: number): Promise<GlobalMessages> =>
    api.fetch<GlobalMessages>(`/api/admin/analytics/messages?days=${days}`),

  guildMemberFlow: (guildId: string, days: number): Promise<MemberFlow> =>
    api.fetch<MemberFlow>(`/api/guilds/${guildId}/analytics/member-flow?days=${days}`),

  guildBetterEmbeds: (guildId: string, days: number): Promise<BetterEmbedsAnalytics> =>
    api.fetch<BetterEmbedsAnalytics>(`/api/guilds/${guildId}/analytics/better-embeds?days=${days}`),

  globalBetterEmbeds: (days: number): Promise<GlobalBetterEmbedsAnalytics> =>
    api.fetch<GlobalBetterEmbedsAnalytics>(`/api/admin/analytics/better-embeds?days=${days}`),
};
