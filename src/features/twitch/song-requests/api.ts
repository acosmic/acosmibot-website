/** Endpoint calls of the Song requests pages (§10.7.7). */
import { channelPath, twitchApi } from '../shared/api';
import type {
  BlockKind, FallbackItem, HistoryResponse, PublicSongsResponse, QueueResponse, SongBlock, SongRequest,
} from './model';

export const songsApi = {
  queue: (channelId: string) => twitchApi.get<QueueResponse>(channelPath(channelId, '/songs/queue')),
  add: (channelId: string, input: string) =>
    twitchApi.post<{ success: true; request: SongRequest }>(channelPath(channelId, '/songs/queue'), { input }),
  move: (channelId: string, id: number, beforeId: number | null) =>
    twitchApi.patch<{ success: true; request: SongRequest | null }>(channelPath(channelId, `/songs/queue/${id}`), { before_id: beforeId }),
  remove: (channelId: string, id: number) => twitchApi.del(channelPath(channelId, `/songs/queue/${id}`)),
  clear: (channelId: string) => twitchApi.post<{ success: true; removed: number }>(channelPath(channelId, '/songs/queue/clear'), {}),
  player: (channelId: string, event: 'started' | 'ended' | 'skipped' | 'error', requestId: number | null) =>
    twitchApi.post<{ success: true; current: SongRequest | null }>(channelPath(channelId, '/songs/player'), { event, request_id: requestId }),
  history: (channelId: string, beforeId: number | null) =>
    twitchApi.get<HistoryResponse>(channelPath(channelId, `/songs/history${beforeId ? `?before_id=${beforeId}` : ''}`)),
  blocklist: (channelId: string) =>
    twitchApi.get<{ success: true; items: SongBlock[]; limit: number }>(channelPath(channelId, '/songs/blocklist')),
  addBlock: (channelId: string, kind: BlockKind, value: string) =>
    twitchApi.post<{ success: true; block: Pick<SongBlock, 'id' | 'kind' | 'value'> }>(channelPath(channelId, '/songs/blocklist'), { kind, value }),
  removeBlock: (channelId: string, id: number) => twitchApi.del(channelPath(channelId, `/songs/blocklist/${id}`)),
  fallback: (channelId: string) =>
    twitchApi.get<{ success: true; items: FallbackItem[]; limit: number }>(channelPath(channelId, '/songs/fallback')),
  addFallback: (channelId: string, input: string) =>
    twitchApi.post<{ success: true; item: FallbackItem }>(channelPath(channelId, '/songs/fallback'), { input }),
  removeFallback: (channelId: string, id: number) => twitchApi.del(channelPath(channelId, `/songs/fallback/${id}`)),
  orderFallback: (channelId: string, ids: number[]) =>
    twitchApi.put<{ success: true; items: FallbackItem[] }>(channelPath(channelId, '/songs/fallback/order'), { ids }),
};

export const publicSongsApi = {
  queue: (login: string) => twitchApi.get<PublicSongsResponse>(`/api/twitch-bot/public/${encodeURIComponent(login)}/songs`),
};
