import { api } from './client';

export interface AiMemoryUser {
  user_id: string;
  discord_username: string | null;
  global_name: string | null;
  avatar_url: string | null;
  fact_count: number;
  last_created_at: string | null;
}

export interface AiMemoryFact {
  id: number;
  content: string;
  source: 'auto' | 'manual';
  created_at: string | null;
}

export const aiMemoriesApi = {
  listUsers: (guildId: string) =>
    api.fetch<{ success: boolean; data: AiMemoryUser[] }>(
      `/api/guilds/${guildId}/ai/memories`,
    ),

  getFacts: (guildId: string, userId: string) =>
    api.fetch<{ success: boolean; data: AiMemoryFact[] }>(
      `/api/guilds/${guildId}/ai/memories/${userId}`,
    ),

  addFact: (guildId: string, userId: string, content: string) =>
    api.fetch<{ success: boolean; message: string }>(
      `/api/guilds/${guildId}/ai/memories/${userId}`,
      { method: 'POST', body: JSON.stringify({ content }) },
    ),

  deleteFact: (guildId: string, userId: string, memoryId: number) =>
    api.fetch<{ success: boolean; message: string }>(
      `/api/guilds/${guildId}/ai/memories/${userId}/${memoryId}`,
      { method: 'DELETE' },
    ),

  clearUser: (guildId: string, userId: string) =>
    api.fetch<{ success: boolean; message: string }>(
      `/api/guilds/${guildId}/ai/memories/${userId}`,
      { method: 'DELETE' },
    ),
};
