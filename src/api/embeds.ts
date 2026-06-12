import { api } from './client';
import { useAuthStore } from '@/store/auth';
import type { EmbedConfig, EmbedButton } from '@/components/ui/DiscordEmbedPreview';

export interface GuildEmbed {
  id: number;
  name: string;
  message_text: string | null;
  channel_id: string | null;
  embed_config: EmbedConfig;
  buttons: EmbedButton[];
  is_sent: boolean;
}

export interface EmbedStats {
  total: number;
  limit: number;
  can_create_more: boolean;
}

export interface EmbedPayload {
  name: string;
  message_text: string;
  channel_id: string | null;
  embed_config: EmbedConfig;
  buttons: EmbedButton[];
}

export type UploadImageType = 'author_icon' | 'footer_icon' | 'thumbnail' | 'image';

export const embedsApi = {
  list: (guildId: string) =>
    api.fetch<{ success: boolean; embeds: GuildEmbed[] }>(`/api/guilds/${guildId}/embeds`)
      .then((r) => r.embeds ?? []),

  stats: (guildId: string) =>
    api.fetch<{ success: boolean; stats: EmbedStats }>(`/api/guilds/${guildId}/embeds/stats`)
      .then((r) => r.stats),

  get: (guildId: string, embedId: string | number) =>
    api.fetch<{ success: boolean; embed: GuildEmbed }>(`/api/guilds/${guildId}/embeds/${embedId}`)
      .then((r) => r.embed),

  create: (guildId: string, payload: EmbedPayload) =>
    api.fetch<{ success: boolean; embed: GuildEmbed }>(`/api/guilds/${guildId}/embeds`, {
      method: 'POST', body: JSON.stringify(payload),
    }).then((r) => r.embed),

  update: (guildId: string, embedId: string | number, payload: EmbedPayload) =>
    api.fetch<{ success: boolean; embed: GuildEmbed }>(`/api/guilds/${guildId}/embeds/${embedId}`, {
      method: 'PUT', body: JSON.stringify(payload),
    }).then((r) => r.embed),

  remove: (guildId: string, embedId: number) =>
    api.fetch<{ success: boolean }>(`/api/guilds/${guildId}/embeds/${embedId}`, { method: 'DELETE' }),

  send: (guildId: string, embedId: string | number) =>
    api.fetch<{ success: boolean }>(`/api/guilds/${guildId}/embeds/${embedId}/send`, { method: 'POST' }),

  duplicate: (guildId: string, embedId: number) =>
    api.fetch<{ success: boolean }>(`/api/guilds/${guildId}/embeds/${embedId}/duplicate`, { method: 'POST' }),

  // Multipart upload — raw fetch because api.fetch forces a JSON Content-Type.
  uploadImage: async (guildId: string, file: File, imageType: UploadImageType): Promise<string> => {
    const token = useAuthStore.getState().token;
    const apiBase = (window as any).AppConfig?.apiBaseUrl ?? 'https://api.acosmibot.com';
    const formData = new FormData();
    formData.append('image', file);
    formData.append('image_type', imageType);

    const response = await fetch(`${apiBase}/api/guilds/${guildId}/embeds/upload-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Failed to upload image');
    }
    return data.url as string;
  },
};
