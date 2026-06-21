import { api } from './client';

export interface HeistCrewMember {
  user_id: string;
  name: string;
  amount: number; // positive = cut, negative = fine
}

export interface HeistEvent {
  id: number;
  ringleader_id: string;
  ringleader_name: string;
  crew_size: number;
  success: boolean;
  flavor: string | null;
  total_loot: number;
  total_fines: number;
  crew: HeistCrewMember[];
  created_at: string | null;
}

export interface HeistSummary {
  total_heists: number;
  successes: number;
  total_loot: number;
  biggest_loot: number;
}

export interface HeistOverview {
  vault_currency: number;
  summary: HeistSummary;
  recent: HeistEvent[];
}

export interface HeistLeaderboardEntry {
  rank: number;
  user_id: string;
  name: string;
  heists_led: number;
  successes: number;
  success_rate: number;
  total_loot: number;
  biggest_loot: number;
}

export const heistApi = {
  getOverview: (guildId: string, limit = 10) =>
    api.fetch<{ success: boolean; data: HeistOverview }>(
      `/api/guilds/${guildId}/heist/overview?limit=${limit}`,
    ),

  getLeaderboard: (guildId: string, limit = 10) =>
    api.fetch<{ success: boolean; data: HeistLeaderboardEntry[] }>(
      `/api/guilds/${guildId}/heist/leaderboard?limit=${limit}`,
    ),
};
