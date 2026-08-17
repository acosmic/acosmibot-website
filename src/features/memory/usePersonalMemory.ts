import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { memoryApi } from '@/api/memory';

export const personalMemoryKey = ['personal-memory'];

export function usePersonalMemory() {
  const queryClient = useQueryClient();
  const facts = useQuery({ queryKey: [...personalMemoryKey, 'facts'], queryFn: () => memoryApi.listFacts().then((result) => result.data) });
  const proposals = useQuery({ queryKey: [...personalMemoryKey, 'proposals'], queryFn: () => memoryApi.proposals().then((result) => result.data) });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: personalMemoryKey });
  };
  const create = useMutation({ mutationFn: memoryApi.createFact, onSuccess: refresh });
  const update = useMutation({ mutationFn: ({ publicId, payload }: { publicId: string; payload: Parameters<typeof memoryApi.updateFact>[1] }) => memoryApi.updateFact(publicId, payload), onSuccess: refresh });
  const remove = useMutation({ mutationFn: ({ publicId, confirmation }: { publicId: string; confirmation: string }) => memoryApi.deleteFact(publicId, confirmation), onSuccess: refresh });
  const restore = useMutation({ mutationFn: ({ publicId, version }: { publicId: string; version: number }) => memoryApi.restore(publicId, version), onSuccess: refresh });
  const accept = useMutation({ mutationFn: ({ publicId, visibility }: { publicId: string; visibility: 'private' | 'shared_guilds' }) => memoryApi.acceptProposal(publicId, visibility), onSuccess: refresh });
  const reject = useMutation({ mutationFn: memoryApi.rejectProposal, onSuccess: refresh });
  const clearPreview = useMutation({ mutationFn: memoryApi.clearPreview });
  const clear = useMutation({ mutationFn: memoryApi.clear, onSuccess: refresh });
  return { facts, proposals, create, update, remove, restore, accept, reject, clearPreview, clear };
}
