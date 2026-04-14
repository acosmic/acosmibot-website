export interface GiveawayConfig {
  enabled: boolean;
  maxWinners: number;
  durationMinutes: number;
  announcementChannelId: string | null;
  requiredRoleId: string | null;
  bypassRoleId: string | null;
}

export interface UpdateGiveawayConfigRequest {
  enabled?: boolean;
  maxWinners?: number;
  durationMinutes?: number;
  announcementChannelId?: string | null;
  requiredRoleId?: string | null;
  bypassRoleId?: string | null;
}

export interface LevelingConfig {
  enabled: boolean;
  xpRate: number;
  multiplier: number;
  cooldownSeconds: number;
  announcementChannelId: string | null;
  ignoredChannelIds: string[];
  ignoredRoleIds: string[];
  rewards: LevelingReward[];
}

export interface LevelingReward {
  level: number;
  roleId: string;
}

export interface UpdateLevelingConfigRequest {
  enabled?: boolean;
  xpRate?: number;
  multiplier?: number;
  cooldownSeconds?: number;
  announcementChannelId?: string | null;
  ignoredChannelIds?: string[];
  ignoredRoleIds?: string[];
  rewards?: LevelingReward[];
}

export interface StreamPlatformConfig {
  enabled: boolean;
  announcement_channel_id: string | null;
  announcement_message: string | null;
  tracked_streamers: Streamer[];
}

export interface Streamer {
  platform: string;
  username: string;
  isValid: boolean;
  mention_role_ids: string[];
  mention_everyone: boolean;
  mention_here: boolean;
  custom_message: string | null;
  skip_vod_check: boolean;
}

export interface UpdateStreamPlatformConfigRequest {
  enabled?: boolean;
  announcement_channel_id?: string | null;
  announcement_message?: string | null;
  tracked_streamers?: Streamer[];
}

export interface ModerationConfig {
  enabled: boolean;
  mod_log_channel_id: string | null;
  member_activity_channel_id: string | null;
  events: {
    on_member_join?: { enabled: boolean; channel_id: string | null };
    on_member_remove?: { enabled: boolean; channel_id: string | null };
    on_message_edit?: { enabled: boolean; channel_id: string | null };
    on_message_delete?: { enabled: boolean; channel_id: string | null };
    on_audit_log_entry?: Record<string, { enabled: boolean; channel_id: string | null }>;
    on_member_update?: Record<string, { enabled: boolean; channel_id: string | null }>;
  };
}

export interface UpdateModerationConfigRequest {
  moderation?: Partial<ModerationConfig>;
}
