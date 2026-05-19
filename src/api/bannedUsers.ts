import { api } from './client';

export interface BannedUserEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  banned_at: string;
  banned_by: string;
}

export interface BannedUsersConfig {
  enabled: boolean;
  response_mode: 'ignore' | 'dm' | 'channel';
  dm_message: string;
  channel_message: string;
  users: BannedUserEntry[];
}

export interface MemberSearchResult {
  user_id: string;
  username: string;
  nickname: string | null;
  avatar_url: string | null;
}

export const bannedUsersApi = {
  getConfig: (guildId: string) =>
    api.fetch<{ success: boolean; data: BannedUsersConfig }>(
      `/api/guilds/${guildId}/banned-users`,
    ),

  saveConfig: (guildId: string, config: BannedUsersConfig) =>
    api.fetch<{ success: boolean; data: BannedUsersConfig }>(
      `/api/guilds/${guildId}/banned-users`,
      { method: 'POST', body: JSON.stringify(config) },
    ),

  searchMembers: (guildId: string, query: string) =>
    api.fetch<{ success: boolean; data: MemberSearchResult[] }>(
      `/api/guilds/${guildId}/members/search?q=${encodeURIComponent(query)}&limit=25`,
    ),
};
