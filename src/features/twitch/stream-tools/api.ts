/** Endpoint calls of the Quotes, Counters, Stream tools and Channel points pages (§10.7.8). */
import { channelPath, twitchApi } from '../shared/api';
import type {
  Binding, Category, Counter, CounterListResponse, PublicQuote, Quote, QuoteInput, QuoteListResponse, RewardItem,
  RewardListResponse, ShoutoutResult, StreamInfo, Reward,
} from './model';

export const quotesApi = {
  list: (channelId: string, query: string) => twitchApi.get<QuoteListResponse>(channelPath(channelId, `/quotes${query}`)),
  create: (channelId: string, input: QuoteInput) => twitchApi.post<{ success: true; quote: Quote }>(channelPath(channelId, '/quotes'), input),
  update: (channelId: string, number: number, input: QuoteInput) =>
    twitchApi.put<{ success: true; quote: Quote }>(channelPath(channelId, `/quotes/${number}`), input),
  remove: (channelId: string, number: number) => twitchApi.del(channelPath(channelId, `/quotes/${number}`)),
};

export const publicQuotesApi = {
  list: (login: string, query: string) =>
    twitchApi.get<{ success: true; items: PublicQuote[]; total: number }>(`/api/twitch-bot/public/${encodeURIComponent(login)}/quotes${query}`),
};

export const countersApi = {
  list: (channelId: string) => twitchApi.get<CounterListResponse>(channelPath(channelId, '/counters')),
  put: (channelId: string, name: string, value: number) =>
    twitchApi.put<{ success: true; counter: Pick<Counter, 'name' | 'value'> }>(
      channelPath(channelId, `/counters/${encodeURIComponent(name)}`), { value }),
  remove: (channelId: string, name: string) => twitchApi.del(channelPath(channelId, `/counters/${encodeURIComponent(name)}`)),
};

export const streamApi = {
  info: (channelId: string) => twitchApi.get<{ success: true; info: StreamInfo }>(channelPath(channelId, '/stream-info')),
  save: (channelId: string, body: { title?: string; category_id?: string }) =>
    twitchApi.put<{ success: true; info: StreamInfo }>(channelPath(channelId, '/stream-info'), body),
  searchCategories: (channelId: string, query: string) =>
    twitchApi.get<{ success: true; items: Category[] }>(channelPath(channelId, `/categories/search?q=${encodeURIComponent(query)}`)),
  shoutout: (channelId: string, login: string) => twitchApi.post<ShoutoutResult>(channelPath(channelId, '/shoutout'), { login }),
};

export const rewardsApi = {
  list: (channelId: string) => twitchApi.get<RewardListResponse>(channelPath(channelId, '/rewards')),
  create: (channelId: string, body: Record<string, unknown>) =>
    twitchApi.post<{ success: true; reward: Reward; manageable: true }>(channelPath(channelId, '/rewards'), body),
  update: (channelId: string, rewardId: string, body: Record<string, unknown>) =>
    twitchApi.patch<{ success: true; reward: Reward; manageable: true }>(
      channelPath(channelId, `/rewards/${encodeURIComponent(rewardId)}`), body),
  remove: (channelId: string, rewardId: string) => twitchApi.del(channelPath(channelId, `/rewards/${encodeURIComponent(rewardId)}`)),
  putBinding: (channelId: string, rewardId: string, body: Record<string, unknown>) =>
    twitchApi.put<{ success: true; binding: Binding; live_applied: boolean }>(
      channelPath(channelId, `/rewards/${encodeURIComponent(rewardId)}/binding`), body),
  removeBinding: (channelId: string, rewardId: string) =>
    twitchApi.del(channelPath(channelId, `/rewards/${encodeURIComponent(rewardId)}/binding`)),
};

export type { RewardItem };
