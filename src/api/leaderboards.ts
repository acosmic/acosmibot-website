import { api } from './client';

export interface GlobalLeaderboardEntry {
  rank: number;
  user_id: string;
  discord_username: string | null;
  global_name: string | null;
  avatar_url: string | null;
  global_level: number;
  global_exp: number;
}

export interface GlobalLeaderboardResponse {
  entries: GlobalLeaderboardEntry[];
  limit: number;
  offset: number;
}

export const leaderboardsApi = {
  getGlobalXp: (limit = 25, offset = 0) =>
    api.fetch<GlobalLeaderboardResponse>(
      `/api/leaderboard/global-xp?limit=${limit}&offset=${offset}`,
    ),
};
