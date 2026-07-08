import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiMemoriesApi } from '@/api/aiMemories';

const usersKey = (guildId: string) => ['guild', guildId, 'ai-memory-users'];
const docKey = (guildId: string, userId: string) =>
  ['guild', guildId, 'ai-memory-doc', userId];
const serverDocKey = (guildId: string) => ['guild', guildId, 'ai-server-memory'];

export function useAiMemoryUsers(guildId: string, enabled = true) {
  return useQuery({
    queryKey: usersKey(guildId),
    queryFn: () => aiMemoriesApi.listUsers(guildId).then(r => r.data),
    enabled: !!guildId && enabled,
  });
}

export function useAiMemoryDoc(guildId: string, userId: string | null) {
  return useQuery({
    queryKey: docKey(guildId, userId ?? ''),
    queryFn: () => aiMemoriesApi.getDoc(guildId, userId!).then(r => r.data),
    enabled: !!guildId && !!userId,
  });
}

export function useAiServerMemory(guildId: string, enabled = true) {
  return useQuery({
    queryKey: serverDocKey(guildId),
    queryFn: () => aiMemoriesApi.getServerDoc(guildId).then(r => r.data),
    enabled: !!guildId && enabled,
  });
}

export function useAiMemoryMutations(guildId: string) {
  const queryClient = useQueryClient();

  const invalidateUser = (userId?: string) => {
    queryClient.invalidateQueries({ queryKey: usersKey(guildId) });
    if (userId) {
      queryClient.invalidateQueries({ queryKey: docKey(guildId, userId) });
    }
  };

  const invalidateServer = () => {
    queryClient.invalidateQueries({ queryKey: serverDocKey(guildId) });
  };

  const saveDoc = useMutation({
    mutationFn: ({ userId, content, expectedVersion }: {
      userId: string;
      content: string;
      expectedVersion?: number;
    }) => aiMemoriesApi.saveDoc(guildId, userId, content, expectedVersion),
    onSuccess: (_d, vars) => invalidateUser(vars.userId),
  });

  const appendFact = useMutation({
    mutationFn: ({ userId, content }: { userId: string; content: string }) =>
      aiMemoriesApi.appendFact(guildId, userId, content),
    onSuccess: (_d, vars) => invalidateUser(vars.userId),
  });

  const clearUser = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      aiMemoriesApi.clearUser(guildId, userId),
    onSuccess: (_d, vars) => invalidateUser(vars.userId),
  });

  const saveServerDoc = useMutation({
    mutationFn: ({ content, expectedVersion }: { content: string; expectedVersion?: number }) =>
      aiMemoriesApi.saveServerDoc(guildId, content, expectedVersion),
    onSuccess: invalidateServer,
  });

  const clearServerDoc = useMutation({
    mutationFn: () => aiMemoriesApi.clearServerDoc(guildId),
    onSuccess: invalidateServer,
  });

  return { saveDoc, appendFact, clearUser, saveServerDoc, clearServerDoc };
}
