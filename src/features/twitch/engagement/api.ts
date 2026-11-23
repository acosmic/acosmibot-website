/** Endpoint calls of the Giveaways, Polls & predictions and Viewer queue pages (§10.7.6). */
import { channelPath, twitchApi } from '../shared/api';
import type {
  EligibilityResponse, EntriesResponse, Giveaway, GiveawayAction, GiveawayInput, GiveawayListResponse, Poll, Prediction,
  PublicQueueResponse, QueueActionBody, QueueResponse, VerdictStatus, WinnersResponse,
} from './model';

export interface EligibilityQuery { offset: number; limit: number; status?: VerdictStatus | null; search?: string }

export const giveawaysApi = {
  list: (channelId: string) => twitchApi.get<GiveawayListResponse>(channelPath(channelId, '/giveaways?limit=50')),
  create: (channelId: string, input: GiveawayInput) =>
    twitchApi.post<{ success: true; giveaway: Giveaway }>(channelPath(channelId, '/giveaways'), input),
  update: (channelId: string, id: number, input: GiveawayInput) =>
    twitchApi.put<{ success: true; giveaway: Giveaway; live_applied: boolean }>(channelPath(channelId, `/giveaways/${id}`), input),
  remove: (channelId: string, id: number) => twitchApi.del(channelPath(channelId, `/giveaways/${id}`)),
  /** `requestId` (draw/reroll) makes a retried request return the first result instead of drawing again. */
  action: (channelId: string, id: number, action: GiveawayAction, count?: number, requestId?: string) =>
    twitchApi.post<Record<string, unknown> & { success: true }>(
      channelPath(channelId, `/giveaways/${id}/actions`),
      { action, ...(count === undefined ? {} : { count }), ...(requestId === undefined ? {} : { request_id: requestId }) }),
  eligibility: (channelId: string, id: number, query: EligibilityQuery) => {
    const params = new URLSearchParams({ offset: String(query.offset), limit: String(query.limit) });
    if (query.status) params.set('status', query.status);
    if (query.search) params.set('search', query.search);
    return twitchApi.get<EligibilityResponse>(channelPath(channelId, `/giveaways/${id}/eligibility?${params.toString()}`));
  },
  resolveUsers: (channelId: string, logins: string[]) =>
    twitchApi.post<{ success: true; users: Array<{ user_id: string; login: string; display_name: string }>; missing: string[] }>(
      channelPath(channelId, '/giveaways/resolve-users'), { logins }),
  entries: (channelId: string, id: number, offset: number, limit: number) =>
    twitchApi.get<EntriesResponse>(channelPath(channelId, `/giveaways/${id}/entries?offset=${offset}&limit=${limit}`)),
  removeEntry: (channelId: string, id: number, userId: string) =>
    twitchApi.del(channelPath(channelId, `/giveaways/${id}/entries/${encodeURIComponent(userId)}`)),
  winners: (channelId: string, id: number) => twitchApi.get<WinnersResponse>(channelPath(channelId, `/giveaways/${id}/winners`)),
};

export const pollsApi = {
  list: (channelId: string) => twitchApi.get<{ success: true; items: Poll[] }>(channelPath(channelId, '/polls')),
  create: (channelId: string, body: { title: string; choices: string[]; duration_s: number }) =>
    twitchApi.post<{ success: true; poll: Poll }>(channelPath(channelId, '/polls'), body),
  end: (channelId: string, id: string, status: 'TERMINATED' | 'ARCHIVED') =>
    twitchApi.post<{ success: true; poll: Poll }>(channelPath(channelId, `/polls/${encodeURIComponent(id)}/end`), { status }),
};

export const predictionsApi = {
  list: (channelId: string) => twitchApi.get<{ success: true; items: Prediction[] }>(channelPath(channelId, '/predictions')),
  create: (channelId: string, body: { title: string; outcomes: string[]; window_s: number }) =>
    twitchApi.post<{ success: true; prediction: Prediction }>(channelPath(channelId, '/predictions'), body),
  lock: (channelId: string, id: string) =>
    twitchApi.post<{ success: true; prediction: Prediction }>(channelPath(channelId, `/predictions/${encodeURIComponent(id)}/lock`), {}),
  resolve: (channelId: string, id: string, winningOutcomeId: string) =>
    twitchApi.post<{ success: true; prediction: Prediction }>(
      channelPath(channelId, `/predictions/${encodeURIComponent(id)}/resolve`), { winning_outcome_id: winningOutcomeId }),
  cancel: (channelId: string, id: string) =>
    twitchApi.post<{ success: true; prediction: Prediction }>(channelPath(channelId, `/predictions/${encodeURIComponent(id)}/cancel`), {}),
};

export const queueApi = {
  get: (channelId: string) => twitchApi.get<QueueResponse>(channelPath(channelId, '/queue')),
  action: (channelId: string, body: QueueActionBody) =>
    twitchApi.post<Record<string, unknown> & { success: true }>(channelPath(channelId, '/queue/actions'), body),
  remove: (channelId: string, entryId: number) => twitchApi.del(channelPath(channelId, `/queue/${entryId}`)),
  clear: (channelId: string) => twitchApi.post<{ success: true; cleared: number }>(channelPath(channelId, '/queue/clear'), {}),
};

export const publicQueueApi = {
  get: (login: string) => twitchApi.get<PublicQueueResponse>(`/api/twitch-bot/public/${encodeURIComponent(login)}/queue`),
};
