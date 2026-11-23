/** Endpoint calls of the Timers and Chat alerts pages (§10.7.2). */
import { channelPath, twitchApi } from '../shared/api';
import type {
  AlertKey, GroupListResponse, RunResponse, TimerGroupInput, TimerInput, TimerListResponse,
} from './model';

export const timersApi = {
  list: (channelId: string) => twitchApi.get<TimerListResponse>(channelPath(channelId, '/timers')),
  create: (channelId: string, input: TimerInput) => twitchApi.post(channelPath(channelId, '/timers'), input),
  update: (channelId: string, id: number, input: TimerInput) =>
    twitchApi.put(channelPath(channelId, `/timers/${id}`), input),
  setEnabled: (channelId: string, id: number, enabled: boolean) =>
    twitchApi.patch(channelPath(channelId, `/timers/${id}`), { enabled }),
  remove: (channelId: string, id: number) => twitchApi.del(channelPath(channelId, `/timers/${id}`)),
  run: (channelId: string, id: number) => twitchApi.post<RunResponse>(channelPath(channelId, `/timers/${id}/run`), {}),

  listGroups: (channelId: string) => twitchApi.get<GroupListResponse>(channelPath(channelId, '/timer-groups')),
  createGroup: (channelId: string, input: TimerGroupInput) =>
    twitchApi.post(channelPath(channelId, '/timer-groups'), input),
  updateGroup: (channelId: string, id: number, input: TimerGroupInput) =>
    twitchApi.put(channelPath(channelId, `/timer-groups/${id}`), input),
  removeGroup: (channelId: string, id: number) => twitchApi.del(channelPath(channelId, `/timer-groups/${id}`)),
};

export const alertsApi = {
  test: (channelId: string, kind: AlertKey) =>
    twitchApi.post<{ success: true; sent: boolean; reason: string | null }>(
      channelPath(channelId, '/chat-alerts/test'), { kind }),
};
