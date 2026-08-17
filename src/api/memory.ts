import { api } from './client';

export type MemoryVisibility = 'private' | 'shared_guilds';

export interface UserFact {
  public_id: string;
  namespace: string;
  fact_key: string;
  value: unknown;
  display_text: string;
  visibility: MemoryVisibility;
  source: string;
  version: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface UserFactHistory {
  version: number;
  value: unknown;
  display_text: string;
  visibility: MemoryVisibility;
  replaced_at: string | null;
}

export interface MemoryProposal {
  public_id: string;
  namespace: string;
  fact_key: string;
  value?: unknown;
  display_text: string;
  expires_at: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'canceled';
}

export interface MemoryClearPreview {
  fact_count?: number;
  history_count?: number;
  proposal_count?: number;
  community_count?: number;
  confirmation_token?: string;
  confirmation?: string;
  [key: string]: unknown;
}

export interface MemoryParticipationPreference {
  guild_id: string;
  user_id: string;
  participation: 'inherit' | 'enabled' | 'paused';
  version: number;
  updated_at: string | null;
  cleared_at: string | null;
}

export const memoryApi = {
  listFacts: () => api.fetch<{ success: boolean; data: UserFact[] }>('/api/me/facts'),
  createFact: (payload: { namespace: string; fact_key: string; value: unknown; display_text?: string; visibility?: MemoryVisibility }) =>
    api.fetch<{ success: boolean; data: UserFact }>('/api/me/facts', { method: 'POST', body: JSON.stringify(payload) }),
  updateFact: (publicId: string, payload: { namespace: string; fact_key: string; value: unknown; display_text?: string; visibility?: MemoryVisibility; expected_version?: number }) =>
    api.fetch<{ success: boolean; data: UserFact }>(`/api/me/facts/${encodeURIComponent(publicId)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteFact: (publicId: string, confirmation: string) =>
    api.fetch<{ success: boolean; deleted: boolean }>(`/api/me/facts/${encodeURIComponent(publicId)}`, { method: 'DELETE', body: JSON.stringify({ confirmation }) }),
  history: (publicId: string) =>
    api.fetch<{ success: boolean; data: UserFactHistory[] }>(`/api/me/facts/${encodeURIComponent(publicId)}/history`),
  restore: (publicId: string, version: number) =>
    api.fetch<{ success: boolean; data: UserFact }>(`/api/me/facts/${encodeURIComponent(publicId)}/history/${version}/restore`, { method: 'POST' }),
  proposals: () => api.fetch<{ success: boolean; data: MemoryProposal[] }>('/api/me/memory-proposals'),
  acceptProposal: (publicId: string, visibility: MemoryVisibility) => api.fetch<{ success: boolean; data: UserFact }>(`/api/me/memory-proposals/${encodeURIComponent(publicId)}/accept`, { method: 'POST', body: JSON.stringify({ visibility }) }),
  rejectProposal: (publicId: string) => api.fetch<{ success: boolean; data: MemoryProposal }>(`/api/me/memory-proposals/${encodeURIComponent(publicId)}/reject`, { method: 'POST' }),
  exportMemory: () => api.fetch<{ success: boolean; data: Record<string, unknown> }>('/api/me/memory/export'),
  clearPreview: () => api.fetch<{ success: boolean; data: MemoryClearPreview }>('/api/me/memory/clear-preview', { method: 'POST' }),
  clear: (payload: { confirmation_token?: string; confirmation?: string }) => api.fetch<{ success: boolean; data: Record<string, unknown> }>('/api/me/memory', { method: 'DELETE', body: JSON.stringify(payload) }),
  deletionStatus: (operationId?: string) => api.fetch<{ success: boolean; data: Record<string, unknown> }>(`/api/me/memory/deletion-status${operationId ? `?operation_id=${encodeURIComponent(operationId)}` : ''}`),
  getParticipation: (guildId: string) => api.fetch<{ success: boolean; data: MemoryParticipationPreference }>(`/api/guilds/${encodeURIComponent(guildId)}/memory/me/preferences`),
  setParticipation: (guildId: string, participation: MemoryParticipationPreference['participation'], expectedVersion?: number) => api.fetch<{ success: boolean; data: MemoryParticipationPreference }>(`/api/guilds/${encodeURIComponent(guildId)}/memory/me/preferences`, { method: 'PUT', body: JSON.stringify({ participation, ...(expectedVersion != null ? { expected_version: expectedVersion } : {}) }) }),
  removeParticipation: (guildId: string) => api.fetch<{ success: boolean; data: Record<string, unknown> }>(`/api/guilds/${encodeURIComponent(guildId)}/memory/me`, { method: 'DELETE' }),
  reportNode: (guildId: string, publicId: string, reason = 'member_report') => api.fetch<{ success: boolean; data: Record<string, unknown> }>(`/api/guilds/${encodeURIComponent(guildId)}/memory/facts/${encodeURIComponent(publicId)}/report`, { method: 'POST', body: JSON.stringify({ reason }) }),
  managerDeleteFact: (guildId: string, publicId: string) => api.fetch<{ success: boolean; deleted: boolean }>(`/api/guilds/${encodeURIComponent(guildId)}/ai/memory/facts/${encodeURIComponent(publicId)}`, { method: 'DELETE' }),
  managerDeleteEpisode: (guildId: string, publicId: string) => api.fetch<{ success: boolean; deleted: boolean }>(`/api/guilds/${encodeURIComponent(guildId)}/ai/memory/episodes/${encodeURIComponent(publicId)}`, { method: 'DELETE' }),
  pauseGuildMemory: (guildId: string) => api.fetch<{ success: boolean; data: Record<string, unknown> }>(`/api/guilds/${encodeURIComponent(guildId)}/ai/memory/pause`, { method: 'POST' }),
  resumeGuildMemory: (guildId: string) => api.fetch<{ success: boolean; data: Record<string, unknown> }>(`/api/guilds/${encodeURIComponent(guildId)}/ai/memory/resume`, { method: 'POST' }),
};
