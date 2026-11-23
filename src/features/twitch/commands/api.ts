/** Endpoint calls of the Commands section and the public command list (§10.7.1). */
import { channelPath, twitchApi } from '../shared/api';
import type {
  Command, CommandInput, CommandListResponse, DefaultCommandInput, DefaultCommandState, DefaultCommandsResponse,
  PublicCommandsResponse, Regular, RegularsResponse, TemplateIssue,
} from './model';

interface Saved<T> { success: true; live_applied?: boolean; command: T }

export const commandsApi = {
  list: (channelId: string) => twitchApi.get<CommandListResponse>(channelPath(channelId, '/commands')),
  create: (channelId: string, input: CommandInput) =>
    twitchApi.post<Saved<Command>>(channelPath(channelId, '/commands'), input),
  update: (channelId: string, id: number, input: CommandInput) =>
    twitchApi.put<Saved<Command>>(channelPath(channelId, `/commands/${id}`), input),
  setEnabled: (channelId: string, id: number, enabled: boolean) =>
    twitchApi.patch<Saved<Command>>(channelPath(channelId, `/commands/${id}`), { enabled }),
  remove: (channelId: string, id: number) =>
    twitchApi.del<{ success: true }>(channelPath(channelId, `/commands/${id}`)),
  /** Template issues for a response (`key` validates a built-in's response override). */
  validate: (channelId: string, response: string, key?: string) =>
    twitchApi.post<{ success: true; issues: TemplateIssue[] }>(channelPath(channelId, '/commands/validate'),
      key ? { response, key } : { response }),
};

export const defaultCommandsApi = {
  list: (channelId: string) => twitchApi.get<DefaultCommandsResponse>(channelPath(channelId, '/default-commands')),
  save: (channelId: string, key: string, input: DefaultCommandInput) =>
    twitchApi.put<Saved<DefaultCommandState>>(channelPath(channelId, `/default-commands/${encodeURIComponent(key)}`), input),
  reset: (channelId: string, key: string) =>
    twitchApi.del<Saved<DefaultCommandState>>(channelPath(channelId, `/default-commands/${encodeURIComponent(key)}`)),
};

export const regularsApi = {
  list: (channelId: string) => twitchApi.get<RegularsResponse>(channelPath(channelId, '/regulars')),
  add: (channelId: string, login: string) =>
    twitchApi.post<{ success: true; regular: Regular; already?: boolean }>(channelPath(channelId, '/regulars'), { login }),
  remove: (channelId: string, userId: string) =>
    twitchApi.del<{ success: true }>(channelPath(channelId, `/regulars/${encodeURIComponent(userId)}`)),
};

export const publicCommandsApi = {
  list: (login: string) =>
    twitchApi.get<PublicCommandsResponse>(`/api/twitch-bot/public/${encodeURIComponent(login)}/commands`),
};
