import { api } from './client';

/** A row on a global leaderboard (XP, economy, or Event Horizon). */
export interface GlobalEntry {
  rank: number;
  user_id: string;
  discord_username: string | null;
  global_name: string | null;
  avatar_url: string | null;
  global_level: number;
  // Present on the XP board.
  global_exp?: number;
  // Present on the economy board.
  total_currency?: number;
  bank_balance?: number;
  economy_total?: number;
  // Present on the Event Horizon board: best flight score and seconds survived.
  score?: number;
  survival?: number;
  deaths?: number;
  attempts?: number;
  average_score?: number;
  // Server-decided: true when this person should be masked from the viewer
  // (not them, not opted-public, no shared server).
  masked?: boolean;
}

/** A row on a per-server leaderboard. */
export interface GuildEntry {
  rank: number;
  user_id: string;
  discord_username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  level: number;
  exp: number;
}

/** A row on a per-server Event Horizon board. */
export interface GuildEventHorizonEntry {
  rank: number;
  user_id: string;
  discord_username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  score?: number;
  survival?: number;
  deaths?: number;
  attempts?: number;
  average_score?: number;
}

export interface GlobalLeaderboard {
  entries: GlobalEntry[];
  limit: number;
  offset: number;
}

export interface GuildLeaderboard {
  entries: GuildEntry[];
  limit: number;
  offset: number;
  guild: { id: string; name: string | null };
}

export interface GuildEventHorizonLeaderboard extends Omit<GuildLeaderboard, 'entries'> {
  entries: GuildEventHorizonEntry[];
}

export type GlobalMetric = 'xp' | 'economy' | 'event-horizon' | 'event-horizon-deaths' | 'event-horizon-average';
export type GuildMetric = 'level' | 'event-horizon' | 'event-horizon-deaths' | 'event-horizon-average';

const GLOBAL_PATHS: Record<GlobalMetric, string> = {
  xp: 'global-xp',
  economy: 'global-currency',
  'event-horizon': 'global-event-horizon',
  'event-horizon-deaths': 'global-event-horizon/deaths',
  'event-horizon-average': 'global-event-horizon/average',
};

const PAGE = 50;

export const leaderboardApi = {
  /** Public global board for the chosen metric. */
  getGlobal: (metric: GlobalMetric, offset = 0, limit = PAGE): Promise<GlobalLeaderboard> =>
    api.fetch<GlobalLeaderboard>(`/api/leaderboard/${GLOBAL_PATHS[metric]}?limit=${limit}&offset=${offset}`),

  /** Per-server board (members only — requires auth). */
  getGuild: (guildId: string, offset = 0, limit = PAGE): Promise<GuildLeaderboard> =>
    api.fetch<GuildLeaderboard>(`/api/guilds/${encodeURIComponent(guildId)}/leaderboard?limit=${limit}&offset=${offset}`),

  /** Per-server Event Horizon high scores (members only — requires auth). */
  getGuildEventHorizon: (guildId: string, offset = 0, limit = PAGE, metric: GuildMetric = 'event-horizon'): Promise<GuildEventHorizonLeaderboard> =>
    api.fetch<GuildEventHorizonLeaderboard>(`/api/guilds/${encodeURIComponent(guildId)}/leaderboard/event-horizon${metric === 'event-horizon-deaths' ? '/deaths' : metric === 'event-horizon-average' ? '/average' : ''}?limit=${limit}&offset=${offset}`),
};
