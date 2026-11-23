/** Endpoint calls of the moderation pages (§10.7.3). */
import { channelPath, twitchApi } from '../shared/api';
import type {
  BlockedTerm, BlockedTermInput, BlockedTermList, ChatLogEntry, ManualActionInput, ManualActionResult,
  MatchType, ModLogEntry, Page, ProtectionKind, ProtectionResult, TermTestResult, UserLookup,
} from './model';

export const moderationApi = {
  terms: (channelId: string) => twitchApi.get<BlockedTermList>(channelPath(channelId, '/blocked-terms')),
  createTerm: (channelId: string, input: BlockedTermInput) =>
    twitchApi.post<{ success: true; term: BlockedTerm }>(channelPath(channelId, '/blocked-terms'), input),
  updateTerm: (channelId: string, id: number, input: BlockedTermInput) =>
    twitchApi.put<{ success: true; term: BlockedTerm }>(channelPath(channelId, `/blocked-terms/${id}`), input),
  removeTerm: (channelId: string, id: number) => twitchApi.del(channelPath(channelId, `/blocked-terms/${id}`)),
  testTerm: (channelId: string, pattern: string, matchType: MatchType, sample: string) =>
    twitchApi.post<TermTestResult>(channelPath(channelId, '/blocked-terms/test'),
      { pattern, match_type: matchType, sample }),

  modLog: (channelId: string, query: string) =>
    twitchApi.get<Page<ModLogEntry>>(channelPath(channelId, `/moderation-log${query}`)),
  chatLog: (channelId: string, query: string) =>
    twitchApi.get<Page<ChatLogEntry>>(channelPath(channelId, `/chat-log${query}`)),
  user: (channelId: string, userId: string) =>
    twitchApi.get<UserLookup>(channelPath(channelId, `/users/${encodeURIComponent(userId)}`)),

  act: (channelId: string, input: ManualActionInput) =>
    twitchApi.post<ManualActionResult>(channelPath(channelId, '/moderation/actions'), input),
  protection: (channelId: string, kind: ProtectionKind, active: boolean) =>
    twitchApi.post<ProtectionResult>(channelPath(channelId, '/moderation/protection'), { kind, active }),
};
