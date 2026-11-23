/** Endpoint calls of the Loyalty and Store pages and their public pages (§10.7.4). */
import { channelPath, twitchApi } from '../shared/api';
import type {
  CursorPage,
} from '../types';
import type {
  LeaderboardBy,
  PointTransaction,
  PublicLeaderboardResponse,
  PublicStoreResponse,
  Redemption,
  RedemptionAction,
  RedemptionPage,
  StoreItem,
  StoreItemInput,
  StoreItemListResponse,
  ViewerListResponse,
  ViewerResponse,
} from './model';
import { leaderboardQuery } from './model';

export const loyaltyApi = {
  viewers: (channelId: string, query: string) => twitchApi.get<ViewerListResponse>(channelPath(channelId, `/viewers${query}`)),
  viewer: (channelId: string, userId: string) =>
    twitchApi.get<ViewerResponse>(channelPath(channelId, `/viewers/${encodeURIComponent(userId)}`)),
  patchViewer: (channelId: string, userId: string, body: { points?: number; points_delta?: number; excluded?: boolean }) =>
    twitchApi.patch<ViewerResponse>(channelPath(channelId, `/viewers/${encodeURIComponent(userId)}`), body),
  exclude: (channelId: string, login: string, excluded: boolean) =>
    twitchApi.post<ViewerResponse>(channelPath(channelId, '/viewers/exclusions'), { login, excluded }),
  reset: (channelId: string) =>
    twitchApi.post<{ success: true; reset: number }>(channelPath(channelId, '/loyalty/reset'), { confirm: 'RESET' }),
  transactions: (channelId: string, userId: string) =>
    twitchApi.get<CursorPage<PointTransaction> & { success: true }>(
      channelPath(channelId, `/point-transactions?user_id=${encodeURIComponent(userId)}&limit=20`)),
};

export const storeApi = {
  items: (channelId: string) => twitchApi.get<StoreItemListResponse>(channelPath(channelId, '/store/items')),
  create: (channelId: string, input: StoreItemInput) =>
    twitchApi.post<{ success: true; item: StoreItem }>(channelPath(channelId, '/store/items'), input),
  update: (channelId: string, itemId: number, input: StoreItemInput) =>
    twitchApi.put<{ success: true; item: StoreItem }>(channelPath(channelId, `/store/items/${itemId}`), input),
  remove: (channelId: string, itemId: number) => twitchApi.del(channelPath(channelId, `/store/items/${itemId}`)),
  redemptions: (channelId: string, query: string) =>
    twitchApi.get<RedemptionPage>(channelPath(channelId, `/store/redemptions${query}`)),
  setStatus: (channelId: string, redemptionId: number, status: RedemptionAction) =>
    twitchApi.patch<{ success: true; redemption: Redemption; balance: number | null }>(
      channelPath(channelId, `/store/redemptions/${redemptionId}`), { status }),
};

export const publicLoyaltyApi = {
  leaderboard: (login: string, by: LeaderboardBy) =>
    twitchApi.get<PublicLeaderboardResponse>(`/api/twitch-bot/public/${encodeURIComponent(login)}/leaderboard${leaderboardQuery(by)}`),
  store: (login: string) => twitchApi.get<PublicStoreResponse>(`/api/twitch-bot/public/${encodeURIComponent(login)}/store`),
};
