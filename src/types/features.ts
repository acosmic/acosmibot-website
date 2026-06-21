export interface GiveawayConfig {
  enabled: boolean;
  defaultEmoji: string;
  winnerLogChannelId: string | null;
  eventLogChannelId: string | null;
  dmWinner: boolean;
  recentWinnerLockoutCount: number;
  boosterMultiplierEnabled: boolean;
  boosterMultiplier: number;
  minAccountAgeDays: number;
  minServerJoinDays: number;
  requiredRoleIds: string[];
  excludedRoleIds: string[];
  roleMultipliers: Record<string, number>;
  bannedUserIds: string[];
}

export interface UpdateGiveawayConfigRequest extends Partial<GiveawayConfig> {}

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
  vod_settings: VodSettings;
  tracked_streamers: Streamer[];
}

export interface VodSettings {
  enabled: boolean;
  vod_message_suffix?: string;
  edit_message_when_vod_available: boolean;
}

export interface Streamer {
  platform: string;
  username: string;
  channel_id?: string | null;
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
  vod_settings?: Partial<VodSettings>;
  tracked_streamers?: Streamer[];
}

export interface ModerationConfig {
  enabled: boolean;
  mod_log_channel_id: string | null;
  member_activity_channel_id: string | null;
  events: {
    on_member_join?: { enabled: boolean; channel_id: string | null };
    on_member_remove?: { enabled: boolean; channel_id: string | null };
    on_message_edit?: { enabled: boolean; channel_id: string | null; ignored_channel_ids: string[] };
    on_message_delete?: { enabled: boolean; channel_id: string | null; ignored_channel_ids: string[] };
    on_audit_log_entry?: Record<string, { enabled: boolean; channel_id: string | null }>;
    on_member_update?: Record<string, { enabled: boolean; channel_id: string | null }>;
  };
}

export interface UpdateModerationConfigRequest {
  moderation?: Partial<ModerationConfig>;
}

export type SlotsTier = 'common' | 'uncommon' | 'rare' | 'legendary' | 'scatter';

export interface SlotsConfig {
  enabled: boolean;
  tier_emojis: Record<SlotsTier, string[]>;
}

export interface PolymorphConfig {
  enabled: boolean;
  cost: number;
  duration_minutes: number;
  mode?: 'manual' | 'ai_random';
  allow_ai_random_names: boolean;
}

/** Mini-games whose only server-configurable field is the enable toggle. */
export interface SimpleGameConfig {
  enabled: boolean;
}

/** Blackjack stores tunables the website doesn't surface yet; preserve them on save. */
export interface BlackjackConfig {
  enabled: boolean;
  [key: string]: unknown;
}

/**
 * The consolidated `games` block. `enabled` is the master toggle that gates every
 * game; each child is a per-game config. Heist lives at the top-level `heist` key
 * but is edited alongside these on the Games page.
 */
export interface GamesConfig {
  enabled: boolean;
  slots: SlotsConfig;
  blackjack: BlackjackConfig;
  coinflip: SimpleGameConfig;
  mines: SimpleGameConfig;
  deathroll: SimpleGameConfig;
  rps: SimpleGameConfig;
  heist: HeistConfig;
}

export interface HeistConfig {
  enabled: boolean;
  cooldown_hours: number;
  join_window_seconds: number;
  base_success: number;       // 0..1
  per_member_success: number; // 0..1 added per crew member
  success_cap: number;        // 0..1
  base_loot_percent: number;  // % of vault (solo)
  pie_growth_k: number;       // loot growth per extra member
  max_loot_percent: number;   // % of vault cap
  min_vault: number;          // minimum vault to start a heist
  fine_percent: number;       // % of wallet fined when caught
}
