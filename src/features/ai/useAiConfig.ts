import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configApi } from '@/api/config';

export interface AiConfig {
  enabled: boolean;
  personality_name: string;
  personality_description: string;
  behavior_rules: string[];
  max_memory_messages: number;
}

export function useAiConfig(guildId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['guild', guildId, 'hybrid-config'],
    queryFn: () => configApi.getHybridConfig(guildId),
    enabled: !!guildId,
  });

  const mutation = useMutation({
    mutationFn: (ai: Partial<AiConfig>) =>
      configApi.updateHybridConfig(guildId, { ai }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['guild', guildId, 'hybrid-config'], updated);
    },
  });

  const tier = query.data?.data?.premium_tier || 'free';
  const hasAccess = tier === 'premium_plus_ai';

  return { 
    data: query.data?.data?.settings?.ai as AiConfig, 
    hasAccess,
    tier,
    isLoading: query.isLoading, 
    save: mutation.mutate, 
    isSaving: mutation.isPending 
  };
}
