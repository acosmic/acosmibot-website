import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configApi } from '@/api/config';

export interface MusicGuildConfig {
  // On by default: members' "Listening to Spotify" presence is recorded in every
  // server unless an admin turns this off (mirrors the bot's /music config command).
  scrobble_enabled: boolean;
}

const DEFAULT_MUSIC: MusicGuildConfig = {
  scrobble_enabled: true,
};

export function useMusicGuildConfig(guildId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['guild', guildId, 'config-hybrid'],
    queryFn: () => configApi.getHybridConfig(guildId),
    enabled: !!guildId,
  });

  const mutation = useMutation({
    // Section-scoped save: merges only the `spotify` slice, leaving other
    // features' settings untouched.
    mutationFn: (spotify: Partial<MusicGuildConfig>) =>
      configApi.upsertHybridSections(guildId, { spotify }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'config-hybrid'] });
    },
  });

  const raw = query.data?.data?.settings?.spotify;
  const data = useMemo<MusicGuildConfig | undefined>(
    () => (query.data ? { ...DEFAULT_MUSIC, ...(raw || {}) } : undefined),
    [query.data, raw],
  );

  return {
    data,
    isLoading: query.isLoading,
    save: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error as Error | null,
  };
}
