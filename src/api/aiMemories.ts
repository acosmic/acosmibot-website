import { api } from './client';

export interface AiMemoryUser {
  user_id: string;
  discord_username: string | null;
  global_name: string | null;
  avatar_url: string | null;
  doc_length: number;
  updated_at: string | null;
}

export interface AiMemoryDoc {
  content: string;
  version: number;
  updated_at: string | null;
}

export const aiMemoriesApi = {
  listUsers: (guildId: string) =>
    api.fetch<{ success: boolean; data: AiMemoryUser[] }>(
      `/api/guilds/${guildId}/ai/memories`,
    ),

  getDoc: (guildId: string, userId: string) =>
    api.fetch<{ success: boolean; data: AiMemoryDoc }>(
      `/api/guilds/${guildId}/ai/memories/${userId}`,
    ),

  clearUser: (guildId: string, userId: string) =>
    api.fetch<{ success: boolean; message: string }>(
      `/api/guilds/${guildId}/ai/memories/${userId}`,
      { method: 'DELETE' },
    ),

  getServerDoc: (guildId: string) =>
    api.fetch<{ success: boolean; data: AiMemoryDoc }>(
      `/api/guilds/${guildId}/ai/server-memory`,
    ),

  clearServerDoc: (guildId: string) =>
    api.fetch<{ success: boolean; message: string }>(
      `/api/guilds/${guildId}/ai/server-memory`,
      { method: 'DELETE' },
    ),
};
