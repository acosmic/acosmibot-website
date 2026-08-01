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

  const clearUser = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      aiMemoriesApi.clearUser(guildId, userId),
    onSuccess: (_d, vars) => invalidateUser(vars.userId),
  });

  const clearServerDoc = useMutation({
    mutationFn: () => aiMemoriesApi.clearServerDoc(guildId),
    onSuccess: invalidateServer,
  });

  return { clearUser, clearServerDoc };
}
