import { api } from './client';

export interface MemoryRolloutFlags {
  member: boolean;
  home: boolean;
  manager: boolean;
  admin: boolean;
}

export type MemoryGraphScope = 'public' | 'personal' | 'guild_member' | 'guild_manager' | 'owner_operations';

export interface MemoryGraphNode {
  id: string;
  type?: string;
  label?: string;
  summary?: string;
  visibility?: string;
  owned?: boolean;
  live?: boolean;
  status?: string;
  namespace?: string;
  key?: string;
  confidence?: number;
  importance?: number;
  first_seen_at?: string;
  last_reinforced_at?: string;
  evidence_count?: number;
  reinforcement_bucket?: string;
}

export interface MemoryGraphEdge {
  id: string;
  source: string;
  target: string;
  predicate?: string;
  strength_bucket?: string;
  status?: string;
}

export interface MemoryGraphResponse {
  schema_version?: number;
  revision?: string;
  generated_at?: string;
  scope: MemoryGraphScope | string;
  viewer?: { focus_node_id?: string | null; capabilities?: string[] };
  nodes: MemoryGraphNode[];
  edges: MemoryGraphEdge[];
  veil?: { seed?: string | null; expires_at?: string | null; density_bands?: unknown[] };
  summary?: Record<string, unknown>;
  next_cursor?: string | null;
}

const withCursor = (path: string, cursor?: string) => cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path;

export const memoryGraphApi = {
  flags: () => api.fetch<{ success: boolean; data: MemoryRolloutFlags }>('/api/memory/flags'),
  publicConstellation: () => api.fetch<MemoryGraphResponse>('/api/constellation/public'),
  personalConstellation: (cursor?: string) => api.fetch<MemoryGraphResponse>(withCursor('/api/me/constellation', cursor)),
  memberConstellation: (guildId: string, cursor?: string) => api.fetch<MemoryGraphResponse>(withCursor(`/api/guilds/${encodeURIComponent(guildId)}/memory/constellation`, cursor)),
  memberTimeline: (guildId: string, cursor?: string) => api.fetch<MemoryGraphResponse>(withCursor(`/api/guilds/${encodeURIComponent(guildId)}/memory/timeline`, cursor)),
  node: (guildId: string, publicId: string) => api.fetch<{ success: boolean; data: MemoryGraphNode }>(`/api/guilds/${encodeURIComponent(guildId)}/memory/nodes/${encodeURIComponent(publicId)}`),
  managerNode: (guildId: string, publicId: string) => api.fetch<{ success: boolean; data: MemoryGraphNode }>(`/api/guilds/${encodeURIComponent(guildId)}/ai/memory/nodes/${encodeURIComponent(publicId)}`),
  managerReview: (guildId: string, cursor?: string) => api.fetch<MemoryGraphResponse>(withCursor(`/api/guilds/${encodeURIComponent(guildId)}/ai/memory/review`, cursor)),
  managerConstellation: (guildId: string, cursor?: string) => api.fetch<MemoryGraphResponse>(withCursor(`/api/guilds/${encodeURIComponent(guildId)}/ai/memory/constellation`, cursor)),
  managerTimeline: (guildId: string, cursor?: string) => api.fetch<MemoryGraphResponse>(withCursor(`/api/guilds/${encodeURIComponent(guildId)}/ai/memory/timeline`, cursor)),
  ownerConstellation: (cursor?: string) => api.fetch<MemoryGraphResponse>(withCursor('/api/admin/ai-memory/constellation', cursor)),
  ownerGuildConstellation: (guildId: string, cursor?: string) => api.fetch<MemoryGraphResponse>(withCursor(`/api/admin/ai-memory/guilds/${encodeURIComponent(guildId)}/constellation`, cursor)),
};
