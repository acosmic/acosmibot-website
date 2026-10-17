import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { emojiPacksApi, SEVENTV_BATCH, type ImportResult, type NewPackSource, type SevenTvSort } from '@/api/emojiPacks';

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

  const addSevenTv = useMutation({
    /** Imports in batches the API can download within one request. */
    mutationFn: async (input: { packId: number; emotes: { id: string; name?: string }[] }) => {
      const total: ImportResult = { added: [], errors: [] };
      for (let start = 0; start < input.emotes.length; start += SEVENTV_BATCH) {
        const batch = input.emotes.slice(start, start + SEVENTV_BATCH);
        const result = await emojiPacksApi.addSevenTv(guildId, input.packId, batch);
        total.added.push(...result.added);
        total.errors.push(...result.errors);
      }
      return total;
    },
    onSettled: invalidate,
  });
  const addSevenTvToServer = useMutation({
    mutationFn: (emote: { id: string; name?: string }) => emojiPacksApi.addSevenTvToServer(guildId, emote),
    onSuccess: invalidate,
  });

  return {
    query, enable, createPack, renamePack, deletePack, addItems, renameItem, deleteItem, apply, capture, setKeep,
    addSevenTv, addSevenTvToServer,
  };
}

const SEVENTV_STALE_MS = 5 * 60 * 1000;
const retryUnlessClientError = (count: number, error: unknown) =>
  count < 1 && !(error instanceof Error && 'status' in error && Number(error.status) < 500);

export function useSevenTvSearch(guildId: string, input: { q: string; sort: SevenTvSort; animated: '' | 'true' | 'false'; page: number }) {
  return useQuery({
    queryKey: ['seventv', 'emotes', guildId, input] as const,
    queryFn: () => emojiPacksApi.searchSevenTv(guildId, input),
    placeholderData: keepPreviousData,
    staleTime: SEVENTV_STALE_MS,
    retry: retryUnlessClientError,
  });
}

export function useSevenTvUsers(guildId: string, q: string) {
  return useQuery({
    queryKey: ['seventv', 'users', guildId, q] as const,
    queryFn: () => emojiPacksApi.searchSevenTvUsers(guildId, q),
    enabled: q.trim().length >= 2,
    staleTime: SEVENTV_STALE_MS,
    retry: retryUnlessClientError,
  });
}

export function useSevenTvSet(guildId: string, setId: string | null, page: number) {
  return useQuery({
    queryKey: ['seventv', 'set', guildId, setId, page] as const,
    queryFn: () => emojiPacksApi.sevenTvSet(guildId, setId as string, page),
    enabled: Boolean(setId),
    placeholderData: keepPreviousData,
    staleTime: SEVENTV_STALE_MS,
    retry: retryUnlessClientError,
  });
}
