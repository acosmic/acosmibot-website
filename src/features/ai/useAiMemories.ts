import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiMemoriesApi } from '@/api/aiMemories';

const usersKey = (guildId: string) => ['guild', guildId, 'ai-memory-users'];
const factsKey = (guildId: string, userId: string) =>
  ['guild', guildId, 'ai-memory-facts', userId];

export function useAiMemoryUsers(guildId: string, enabled = true) {
  return useQuery({
    queryKey: usersKey(guildId),
    queryFn: () => aiMemoriesApi.listUsers(guildId).then(r => r.data),
    enabled: !!guildId && enabled,
  });
}

export function useAiMemoryFacts(guildId: string, userId: string | null) {
  return useQuery({
    queryKey: factsKey(guildId, userId ?? ''),
    queryFn: () => aiMemoriesApi.getFacts(guildId, userId!).then(r => r.data),
    enabled: !!guildId && !!userId,
  });
}

export function useAiMemoryMutations(guildId: string) {
  const queryClient = useQueryClient();

  const invalidate = (userId?: string) => {
    queryClient.invalidateQueries({ queryKey: usersKey(guildId) });
    if (userId) {
      queryClient.invalidateQueries({ queryKey: factsKey(guildId, userId) });
    }
  };

  const addFact = useMutation({
    mutationFn: ({ userId, content }: { userId: string; content: string }) =>
      aiMemoriesApi.addFact(guildId, userId, content),
    onSuccess: (_d, vars) => invalidate(vars.userId),
  });

  const deleteFact = useMutation({
    mutationFn: ({ userId, memoryId }: { userId: string; memoryId: number }) =>
      aiMemoriesApi.deleteFact(guildId, userId, memoryId),
    onSuccess: (_d, vars) => invalidate(vars.userId),
  });

  const clearUser = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      aiMemoriesApi.clearUser(guildId, userId),
    onSuccess: (_d, vars) => invalidate(vars.userId),
  });

  return { addFact, deleteFact, clearUser };
}
