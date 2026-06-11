import { api } from './client';

/** A row on a global leaderboard (XP or economy). */
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

export type GlobalMetric = 'xp' | 'economy';

const PAGE = 50;

export const leaderboardApi = {
  /** Public global board. metric 'xp' → /global-xp, 'economy' → /global-currency. */
  getGlobal: (metric: GlobalMetric, offset = 0, limit = PAGE): Promise<GlobalLeaderboard> => {
    const path = metric === 'economy' ? 'global-currency' : 'global-xp';
    return api.fetch<GlobalLeaderboard>(`/api/leaderboard/${path}?limit=${limit}&offset=${offset}`);
  },

  /** Per-server board (members only — requires auth). */
  getGuild: (guildId: string, offset = 0, limit = PAGE): Promise<GuildLeaderboard> =>
    api.fetch<GuildLeaderboard>(`/api/guilds/${encodeURIComponent(guildId)}/leaderboard?limit=${limit}&offset=${offset}`),
};
