import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configApi } from '@/api/config';

export interface SpotifyGuildConfig {
  // On by default: members' "Listening to Spotify" presence is recorded in every
  // server unless an admin turns this off (mirrors the bot's /spotify config command).
  scrobble_enabled: boolean;
}

const DEFAULT_SPOTIFY: SpotifyGuildConfig = {
  scrobble_enabled: true,
};

export function useSpotifyGuildConfig(guildId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['guild', guildId, 'config-hybrid'],
    queryFn: () => configApi.getHybridConfig(guildId),
    enabled: !!guildId,
  });

  const mutation = useMutation({
    // Section-scoped save: merges only the `spotify` slice, leaving other
    // features' settings untouched.
    mutationFn: (spotify: Partial<SpotifyGuildConfig>) =>
      configApi.upsertHybridSections(guildId, { spotify }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'config-hybrid'] });
    },
  });

  const raw = query.data?.data?.settings?.spotify;
  const data = useMemo<SpotifyGuildConfig | undefined>(
    () => (query.data ? { ...DEFAULT_SPOTIFY, ...(raw || {}) } : undefined),
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
