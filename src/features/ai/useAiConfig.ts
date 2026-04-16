import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configApi } from '@/api/config';

export interface AiConfig {
  enabled: boolean;
  model: string;
  instructions: string;
  channel_mode: 'all' | 'exclude' | 'include';
  excluded_channels: string[];
  allowed_channels: string[];
}

const DEFAULT_AI: AiConfig = {
  enabled: false,
  model: 'gpt-4o-mini',
  instructions: '',
  channel_mode: 'all',
  excluded_channels: [],
  allowed_channels: [],
};

export function useAiConfig(guildId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['guild', guildId, 'config-hybrid'],
    queryFn: () => configApi.getHybridConfig(guildId),
    enabled: !!guildId,
  });

  const mutation = useMutation({
    mutationFn: (ai: Partial<AiConfig>) =>
      configApi.updateHybridConfig(guildId, { ai }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'config-hybrid'] });
    },
  });

  const raw = query.data?.data?.settings?.ai;
  const tier = query.data?.data?.premium_tier || 'free';
  const hasAccess = tier === 'premium_plus_ai';

  const data = useMemo<AiConfig | undefined>(
    () => raw ? { ...DEFAULT_AI, ...raw } : undefined,
    [raw],
  );

  return {
    data,
    hasAccess,
    tier,
    isLoading: query.isLoading,
    save: mutation.mutate,
    isSaving: mutation.isPending,
  };
}
