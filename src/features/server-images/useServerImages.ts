import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { serverImagesApi, type ServerImageKind } from '@/api/serverImages';

export function useServerImages(guildId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['server-images', guildId] as const;
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const query = useQuery({
    queryKey,
    queryFn: () => serverImagesApi.overview(guildId),
    enabled: Boolean(guildId),
    retry: (count, error) => count < 2 && !(error instanceof Error && 'status' in error && Number(error.status) < 500),
  });

  const upload = useMutation({
    mutationFn: (input: { kind: ServerImageKind; file: File; label?: string }) =>
      serverImagesApi.upload(guildId, input.kind, input.file, input.label),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: (input: { id: number; label?: string; pinned?: boolean }) =>
      serverImagesApi.update(guildId, input.id, { label: input.label, pinned: input.pinned }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => serverImagesApi.remove(guildId, id),
    onSuccess: invalidate,
  });
  const apply = useMutation({
    mutationFn: (id: number) => serverImagesApi.apply(guildId, id),
    onSuccess: invalidate,
  });
  const removeCurrent = useMutation({
    mutationFn: (kind: ServerImageKind) => serverImagesApi.removeCurrent(guildId, kind),
    onSuccess: invalidate,
  });

  return { query, upload, update, remove, apply, removeCurrent };
}
