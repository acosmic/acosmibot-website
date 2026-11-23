/** Endpoint calls of the Overlays and Activity pages (§10.7.9). */
import { channelPath, twitchApi } from '../shared/api';
import type { ActivityRow } from '../shared/ui/activity';
import type { CursorPage } from '../types';
import { activityQuery, type AlertKind, type Overlay, type OverlayInput, type OverlayListResponse, type OverlayTokenResponse } from './model';

export const overlaysApi = {
  list: (channelId: string) => twitchApi.get<OverlayListResponse>(channelPath(channelId, '/overlays')),
  create: (channelId: string, input: OverlayInput) =>
    twitchApi.post<OverlayTokenResponse>(channelPath(channelId, '/overlays'), input),
  update: (channelId: string, overlayId: number, input: Omit<OverlayInput, 'widget'>) =>
    twitchApi.put<{ success: true; overlay: Overlay }>(channelPath(channelId, `/overlays/${overlayId}`), input),
  remove: (channelId: string, overlayId: number) => twitchApi.del(channelPath(channelId, `/overlays/${overlayId}`)),
  rotate: (channelId: string, overlayId: number) =>
    twitchApi.post<OverlayTokenResponse>(channelPath(channelId, `/overlays/${overlayId}/rotate`)),
  test: (channelId: string, kind: AlertKind) =>
    twitchApi.post<{ success: true; published: boolean }>(channelPath(channelId, '/overlays/test'), { kind }),
};

export const activityApi = {
  list: (channelId: string, types: readonly string[], beforeId: number | null) =>
    twitchApi.get<CursorPage<ActivityRow> & { success: true }>(
      channelPath(channelId, `/activity${activityQuery({ types, beforeId })}`)),
};
