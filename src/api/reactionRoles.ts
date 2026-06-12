import { api } from './client';

export interface RRButtonConfig {
  label: string;
  style: number; // 1 Primary, 2 Secondary, 3 Success, 4 Danger
  emoji?: string;
  role_ids: string[];
}

export interface RRDropdownOption {
  label: string;
  description?: string;
  emoji?: string;
  role_ids: string[];
}

export interface RRDropdownConfig {
  placeholder?: string;
  options: RRDropdownOption[];
}

/** Reaction-role embed config — flat strings, color is hex WITHOUT '#'
 *  (different shape from the embeds feature's nested config with int color). */
export interface RREmbedConfig {
  title?: string;
  description?: string;
  color?: string;
  thumbnail?: string;
  image?: string;
  footer?: string;
}

export type RRInteractionType = 'emoji' | 'button' | 'dropdown';

export interface ReactionRole {
  id: number;
  name: string;
  channel_id: string | null;
  text_content: string | null;
  allow_removal: boolean;
  interaction_type: RRInteractionType;
  embed_config?: RREmbedConfig | null;
  emoji_role_mappings?: Record<string, string[]>;
  button_configs?: RRButtonConfig[];
  dropdown_config?: RRDropdownConfig;
  is_sent: boolean;
}

export interface RRStats {
  total: number;
  max: number;
  remaining: number;
}

export type RRPayload = Omit<ReactionRole, 'id' | 'is_sent'> & { suppress_role_pings?: boolean };

const unwrap = <T>(p: Promise<{ success: boolean; data?: T; message?: string }>): Promise<T> =>
  p.then((r) => {
    if (!r.success) throw new Error(r.message || 'Request failed');
    return r.data as T;
  });

export const reactionRolesApi = {
  list: (guildId: string) =>
    unwrap<ReactionRole[]>(api.fetch(`/api/guilds/${guildId}/reaction-roles`)).then((d) => d ?? []),

  stats: (guildId: string) =>
    api.fetch<{ success: boolean; stats: RRStats }>(`/api/guilds/${guildId}/reaction-roles/stats`)
      .then((r) => r.stats),

  get: (guildId: string, rrId: string | number) =>
    unwrap<ReactionRole>(api.fetch(`/api/guilds/${guildId}/reaction-roles/${rrId}`)),

  create: (guildId: string, payload: RRPayload) =>
    unwrap<ReactionRole>(api.fetch(`/api/guilds/${guildId}/reaction-roles`, {
      method: 'POST', body: JSON.stringify(payload),
    })),

  update: (guildId: string, rrId: string | number, payload: RRPayload) =>
    unwrap<ReactionRole>(api.fetch(`/api/guilds/${guildId}/reaction-roles/${rrId}`, {
      method: 'PUT', body: JSON.stringify(payload),
    })),

  remove: (guildId: string, rrId: number) =>
    api.fetch<{ success: boolean }>(`/api/guilds/${guildId}/reaction-roles/${rrId}`, { method: 'DELETE' }),

  send: (guildId: string, rrId: string | number, suppressRolePings: boolean) =>
    api.fetch<{ success: boolean; message?: string }>(`/api/guilds/${guildId}/reaction-roles/${rrId}/send`, {
      method: 'POST', body: JSON.stringify({ suppress_role_pings: suppressRolePings }),
    }),

  duplicate: (guildId: string, rrId: number) =>
    api.fetch<{ success: boolean }>(`/api/guilds/${guildId}/reaction-roles/${rrId}/duplicate`, { method: 'POST' }),
};
