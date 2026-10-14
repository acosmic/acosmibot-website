import { clearExpiredSession } from '@/lib/auth';
import { apiBase } from '@/lib/runtimeConfig';

export type ServerImageKind = 'icon' | 'banner' | 'splash';

export interface ServerImage {
  id: number;
  kind: ServerImageKind;
  label: string;
  url: string;
  mime: string;
  width: number;
  height: number;
  animated: boolean;
  byte_size: number;
  source: 'previous' | 'applied' | 'upload' | string;
  discord_asset_key: string | null;
  created_by_user_id: string | null;
  pinned: boolean;
  created_at: string | null;
  applied_at: string | null;
  current: boolean;
}

export interface ServerImagePerks {
  animated_icon: boolean;
  banner: boolean;
  animated_banner: boolean;
  invite_background: boolean;
  custom_invite_link: boolean;
}

export interface ServerImagesOverview {
  images: ServerImage[];
  current: Record<ServerImageKind, { key: string | null; url: string | null }>;
  perks: ServerImagePerks;
  max_unpinned_per_kind: number;
}

export interface ApplyResult {
  kind: ServerImageKind;
  key: string | null;
  url: string | null;
  archived_previous: boolean;
  notes?: string[];
}

/** Keeps the API's machine-readable `code` (e.g. `tier_required`). */
export class ServerImagesError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    credentials: 'include',
    headers: isForm ? init?.headers : { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    if (response.status === 401) clearExpiredSession();
    throw new ServerImagesError(
      body.message ?? body.error ?? `API error ${response.status}`,
      response.status,
      body.code,
    );
  }
  return body as T;
}

const base = (guildId: string) => `/api/guilds/${guildId}/server-images`;

export const serverImagesApi = {
  overview: (guildId: string) => request<ServerImagesOverview>(base(guildId)),

  upload: (guildId: string, kind: ServerImageKind, file: File, label?: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    if (label?.trim()) form.append('label', label.trim());
    return request<{ image: ServerImage; notes: string[] }>(base(guildId), { method: 'POST', body: form });
  },

  update: (guildId: string, imageId: number, changes: { label?: string; pinned?: boolean }) =>
    request<{ image: ServerImage }>(`${base(guildId)}/${imageId}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    }),

  remove: (guildId: string, imageId: number) =>
    request<{ success: boolean }>(`${base(guildId)}/${imageId}`, { method: 'DELETE' }),

  apply: (guildId: string, imageId: number) =>
    request<ApplyResult>(`${base(guildId)}/${imageId}/apply`, { method: 'POST' }),

  removeCurrent: (guildId: string, kind: ServerImageKind) =>
    request<ApplyResult>(`${base(guildId)}/current/${kind}`, { method: 'DELETE' }),
};
