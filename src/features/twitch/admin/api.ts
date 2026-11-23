/** Endpoint calls of the Managers, Import & export, Analytics and Channel settings pages (§10.6, §10.7.10). */
import { apiBase } from '@/lib/runtimeConfig';
import { TwitchApiError, channelPath, twitchApi } from '../shared/api';
import type {
  AnalyticsResponse, DeletionRequest, ImportApplyResponse, ImportJob, ImportPreviewResponse, ManagerRole,
  ManagersResponse, ManualManager, OnConflict, StreamRow,
} from './model';

export const managersApi = {
  list: (channelId: string) => twitchApi.get<ManagersResponse>(channelPath(channelId, '/managers')),
  add: (channelId: string, login: string, role: ManagerRole) =>
    twitchApi.post<{ success: true; manager: ManualManager; updated: boolean }>(channelPath(channelId, '/managers'), { login, role }),
  remove: (channelId: string, userId: string) =>
    twitchApi.del<{ success: true }>(channelPath(channelId, `/managers/${encodeURIComponent(userId)}`)),
  sync: (channelId: string) =>
    twitchApi.post<{ success: true; editors: number; moderators: number }>(channelPath(channelId, '/roles/sync')),
};

export const importsApi = {
  preview: (channelId: string, body: Record<string, unknown>) =>
    twitchApi.post<ImportPreviewResponse>(channelPath(channelId, '/imports/preview'), body),
  apply: (channelId: string, jobId: number, selected: number[], onConflict: OnConflict) =>
    twitchApi.post<ImportApplyResponse>(channelPath(channelId, `/imports/${jobId}/apply`), { selected, on_conflict: onConflict }),
  jobs: (channelId: string) => twitchApi.get<{ success: true; items: ImportJob[] }>(channelPath(channelId, '/imports')),
};

export const analyticsApi = {
  days: (channelId: string, from: string, to: string) =>
    twitchApi.get<AnalyticsResponse>(channelPath(channelId, `/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)),
  streams: (channelId: string, limit = 10) =>
    twitchApi.get<{ success: true; items: StreamRow[]; next_before_id: number | null }>(channelPath(channelId, `/analytics/streams?limit=${limit}`)),
};

export const channelAdminApi = {
  pause: (channelId: string) => twitchApi.post<{ success: true; status: string }>(channelPath(channelId, '/pause')),
  resume: (channelId: string) => twitchApi.post<{ success: true; status: string }>(channelPath(channelId, '/resume')),
  removeCustomBot: (channelId: string) => twitchApi.del<{ success: true }>(channelPath(channelId, '/custom-bot')),
  deleteChannel: (channelId: string, confirmLogin: string) =>
    twitchApi.del<{ success: true; deletion_request_id: number }>(channelPath(channelId), { confirm_login: confirmLogin }),
  /** `null` request → nothing pending; a 404 after a removal means the purge completed (W1(c) note). */
  deletion: async (channelId: string): Promise<{ request: DeletionRequest | null } | 'not_found'> => {
    try {
      return await twitchApi.get<{ success: true; request: DeletionRequest | null }>(channelPath(channelId, '/deletion'));
    } catch (error) {
      if (error instanceof TwitchApiError && error.status === 404) return 'not_found';
      throw error;
    }
  },
  deleteMyData: () =>
    twitchApi.del<{ success: true; deletion_request_id: number }>('/api/twitch-bot/me/data', { confirm: true }),
};

/**
 * Download the export through the API with the session cookie (a plain link
 * would also work, but fetching lets the page show errors instead of a JSON
 * error file). The browser saves the response as the file the API names.
 */
export async function downloadExport(channelId: string, login: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${apiBase()}${channelPath(channelId, '/export')}`, { credentials: 'include' });
  } catch {
    throw new TwitchApiError(0, 'network_error', 'Acosmibot could not be reached. Check your connection and try again.');
  }
  if (!response.ok) {
    let message = 'The export could not be created. Try again.';
    let code = `http_${response.status}`;
    try {
      const body = await response.json() as { error?: string; code?: string };
      if (typeof body.error === 'string') message = body.error;
      if (typeof body.code === 'string') code = body.code;
    } catch { /* keep the default sentence */ }
    throw new TwitchApiError(response.status, code, message);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const named = /filename="([A-Za-z0-9._-]{1,120})"/.exec(disposition)?.[1];
  const filename = named ?? `acosmibot-twitch-${login}.json`;
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
