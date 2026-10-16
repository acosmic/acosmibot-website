import { apiBase } from '@/lib/runtimeConfig';
import { request } from './serverImages';

export interface EmojiPackItem {
  id: number;
  pack_id: number;
  name: string;
  url: string;
  mime: string;
  animated: boolean;
  byte_size: number;
  discord_emoji_id: string | null;
  created_at: string | null;
}

export interface EmojiPack {
  id: number;
  name: string;
  kind: 'original' | 'custom';
  created_at: string | null;
  updated_at: string | null;
  applied_at: string | null;
  live: boolean;
  /** False when the plan no longer covers this pack (kept, but read-only). */
  usable: boolean;
  counts: { static: number; animated: number; total: number };
  items: EmojiPackItem[];
}

export interface LiveEmoji {
  id: string;
  name: string;
  animated: boolean;
  managed: boolean;
  url: string;
  kept: boolean;
  reaction_role: boolean;
}

export type EmojiPackJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface EmojiPackJob {
  id: number;
  kind: 'snapshot' | 'capture' | 'apply';
  pack_id: number | null;
  status: EmojiPackJobStatus;
  progress_done: number;
  progress_total: number;
  message: string | null;
  error_code: string | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface EmojiPacksOverview {
  locked: boolean;
  tier: string;
  enabled: boolean;
  pack_limit: number;
  custom_pack_count: number;
  packs: EmojiPack[];
  live: { emojis: LiveEmoji[]; limit: number; static: number; animated: number };
  job: EmojiPackJob | null;
}

export type NewPackSource = 'empty' | 'live' | 'duplicate';

const base = (guildId: string) => `/api/guilds/${guildId}/emoji-packs`;
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const emojiPacksApi = {
  overview: (guildId: string) => request<EmojiPacksOverview>(base(guildId)),

  enable: (guildId: string) => request<{ job: EmojiPackJob | null }>(`${base(guildId)}/enable`, json('POST')),

  createPack: (guildId: string, input: { name: string; source: NewPackSource; from_pack_id?: number }) =>
    request<{ pack: EmojiPack; job: EmojiPackJob | null }>(`${base(guildId)}/packs`, json('POST', input)),

  renamePack: (guildId: string, packId: number, name: string) =>
    request<{ pack: EmojiPack }>(`${base(guildId)}/packs/${packId}`, json('PATCH', { name })),

  deletePack: (guildId: string, packId: number) =>
    request<{ success: boolean }>(`${base(guildId)}/packs/${packId}`, json('DELETE')),

  addItems: (guildId: string, packId: number, files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    return request<{ added: EmojiPackItem[]; errors: { file: string; message: string }[] }>(
      `${base(guildId)}/packs/${packId}/items`,
      { method: 'POST', body: form },
    );
  },

  renameItem: (guildId: string, packId: number, itemId: number, name: string) =>
    request<{ item: EmojiPackItem }>(`${base(guildId)}/packs/${packId}/items/${itemId}`, json('PATCH', { name })),

  deleteItem: (guildId: string, packId: number, itemId: number) =>
    request<{ success: boolean }>(`${base(guildId)}/packs/${packId}/items/${itemId}`, json('DELETE')),

  apply: (guildId: string, packId: number) =>
    request<{ job: EmojiPackJob }>(`${base(guildId)}/packs/${packId}/apply`, json('POST')),

  capture: (guildId: string, packId: number) =>
    request<{ job: EmojiPackJob }>(`${base(guildId)}/packs/${packId}/capture`, json('POST')),

  setKeep: (guildId: string, emojiIds: string[]) =>
    request<{ keep_emoji_ids: string[] }>(`${base(guildId)}/keep`, json('PUT', { emoji_ids: emojiIds })),

  downloadUrl: (guildId: string, packId: number) => `${apiBase()}${base(guildId)}/packs/${packId}/download`,
};
