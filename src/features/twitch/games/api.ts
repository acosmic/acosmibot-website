/** Endpoint calls of the Games page (§10.7.5). */
import { channelPath, twitchApi } from '../shared/api';
import type { ActionRequest, GameName, QuestionInput, RoundListResponse, TriviaListResponse, TriviaQuestion } from './model';

export const gamesApi = {
  questions: (channelId: string) => twitchApi.get<TriviaListResponse>(channelPath(channelId, '/trivia/questions')),
  createQuestion: (channelId: string, input: QuestionInput) =>
    twitchApi.post<{ success: true; question: TriviaQuestion }>(channelPath(channelId, '/trivia/questions'), input),
  updateQuestion: (channelId: string, id: number, input: QuestionInput) =>
    twitchApi.put<{ success: true; question: TriviaQuestion }>(channelPath(channelId, `/trivia/questions/${id}`), input),
  removeQuestion: (channelId: string, id: number) => twitchApi.del(channelPath(channelId, `/trivia/questions/${id}`)),
  importQuestions: (channelId: string, questions: unknown[]) =>
    twitchApi.post<{ success: true; created: number; skipped: number }>(channelPath(channelId, '/trivia/questions/import'), { questions }),
  rounds: (channelId: string, game: GameName | '', limit = 50) =>
    twitchApi.get<RoundListResponse>(channelPath(channelId, `/games/rounds?limit=${limit}${game ? `&game=${game}` : ''}`)),
  act: (channelId: string, request: ActionRequest) =>
    twitchApi.post<Record<string, unknown>>(channelPath(channelId, '/games/actions'), request),
};
