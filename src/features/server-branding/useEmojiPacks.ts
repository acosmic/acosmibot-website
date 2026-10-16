import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { emojiPacksApi, type NewPackSource } from '@/api/emojiPacks';

const JOB_POLL_MS = 2500;

export function useEmojiPacks(guildId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['emoji-packs', guildId] as const;
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const query = useQuery({
    queryKey,
    queryFn: () => emojiPacksApi.overview(guildId),
    enabled: Boolean(guildId),
    // Poll only while the bot is working on a snapshot, capture or apply.
    refetchInterval: (current) => {
      const status = current.state.data?.job?.status;
      return status === 'queued' || status === 'running' ? JOB_POLL_MS : false;
    },
    retry: (count, error) => count < 2 && !(error instanceof Error && 'status' in error && Number(error.status) < 500),
  });

  const enable = useMutation({ mutationFn: () => emojiPacksApi.enable(guildId), onSuccess: invalidate });
  const createPack = useMutation({
    mutationFn: (input: { name: string; source: NewPackSource; from_pack_id?: number }) =>
      emojiPacksApi.createPack(guildId, input),
    onSuccess: invalidate,
  });
  const renamePack = useMutation({
    mutationFn: (input: { packId: number; name: string }) => emojiPacksApi.renamePack(guildId, input.packId, input.name),
    onSuccess: invalidate,
  });
  const deletePack = useMutation({
    mutationFn: (packId: number) => emojiPacksApi.deletePack(guildId, packId),
    onSuccess: invalidate,
  });
  const addItems = useMutation({
    mutationFn: (input: { packId: number; files: File[] }) => emojiPacksApi.addItems(guildId, input.packId, input.files),
    onSuccess: invalidate,
  });
  const renameItem = useMutation({
    mutationFn: (input: { packId: number; itemId: number; name: string }) =>
      emojiPacksApi.renameItem(guildId, input.packId, input.itemId, input.name),
    onSuccess: invalidate,
  });
  const deleteItem = useMutation({
    mutationFn: (input: { packId: number; itemId: number }) =>
      emojiPacksApi.deleteItem(guildId, input.packId, input.itemId),
    onSuccess: invalidate,
  });
  const apply = useMutation({ mutationFn: (packId: number) => emojiPacksApi.apply(guildId, packId), onSuccess: invalidate });
  const capture = useMutation({
    mutationFn: (packId: number) => emojiPacksApi.capture(guildId, packId),
    onSuccess: invalidate,
  });
  const setKeep = useMutation({
    mutationFn: (ids: string[]) => emojiPacksApi.setKeep(guildId, ids),
    onSuccess: invalidate,
  });

  return { query, enable, createPack, renamePack, deletePack, addItems, renameItem, deleteItem, apply, capture, setKeep };
}
