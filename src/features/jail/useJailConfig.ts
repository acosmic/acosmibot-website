import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configApi } from '@/api/config';
import { JailConfig } from '@/types/features';

export const DEFAULT_JAIL_CONFIG: JailConfig = {
  enabled: false,
  channel_id: null,
  trigger_emoji: '🚔',
  required_votes: 5,
  vote_window_seconds: 600,
  sentence_minutes: 15,
  target_cooldown_minutes: 30,
  allowed_channel_ids: [],
  protected_role_ids: [],
  mod_log_channel_id: null,
};

export interface JailChannel { id: string; name: string; type: number }
export interface JailRole { id: string; name: string; color?: number; managed?: boolean }
export interface JailEmoji { id: string; name: string; animated: boolean; url: string }

export function useJailConfig(guildId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['guild', guildId, 'config-hybrid'],
    queryFn: () => configApi.getHybridConfig(guildId),
    enabled: !!guildId,
  });

  const mutation = useMutation({
    mutationFn: (jail: JailConfig) => configApi.upsertHybridSections(guildId, { jail }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'config-hybrid'] });
    },
  });

  const raw = query.data?.data?.settings?.jail;
  const data = useMemo<JailConfig | undefined>(
    () => query.data
      ? { ...DEFAULT_JAIL_CONFIG, ...(raw && typeof raw === 'object' ? raw : {}) }
      : undefined,
    [query.data, raw],
  );

  return {
    data,
    channels: (query.data?.data?.available_channels ?? []) as JailChannel[],
    roles: (query.data?.data?.available_roles ?? []) as JailRole[],
    emojis: (query.data?.data?.available_emojis ?? []) as JailEmoji[],
    isLoading: query.isLoading,
    loadError: query.error as Error | null,
    save: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error as Error | null,
  };
}
