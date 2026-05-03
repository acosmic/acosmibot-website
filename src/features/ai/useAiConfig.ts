import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configApi } from '@/api/config';

export interface AiConfig {
  enabled: boolean;
  instructions: string;
  active_personality_id: string;
  personalities: AiPersonality[];
  channel_mode: 'all' | 'exclude' | 'specific' | 'include';
  excluded_channels: string[];
  allowed_channels: string[];
}

export interface AiPersonality {
  id: string;
  name: string;
  instructions: string;
  built_in: boolean;
}

export const BUILT_IN_PERSONALITIES: AiPersonality[] = [
  {
    id: 'default',
    name: 'Default',
    instructions: 'Be helpful, friendly, and concise. Answer naturally in the style of a useful Discord server assistant, and keep the conversation welcoming.',
    built_in: true,
  },
  {
    id: 'chaos-mode',
    name: 'Chaos Mode',
    instructions: 'Be high-energy, playful, dramatic, and funny. Use lively phrasing and big reactions, but still answer accurately and stay useful.',
    built_in: true,
  },
  {
    id: 'professor',
    name: 'Professor',
    instructions: 'Be precise, structured, and educational. Explain ideas clearly, define terms when helpful, and organize complex answers into practical steps.',
    built_in: true,
  },
  {
    id: 'noir-concierge',
    name: 'Noir Concierge',
    instructions: 'Be concise, dry, stylish, and detective-like. Keep a noir-inspired voice while remaining clear, helpful, and easy to understand.',
    built_in: true,
  },
];

const DEFAULT_AI: AiConfig = {
  enabled: false,
  instructions: BUILT_IN_PERSONALITIES[0].instructions,
  active_personality_id: 'default',
  personalities: BUILT_IN_PERSONALITIES,
  channel_mode: 'all',
  excluded_channels: [],
  allowed_channels: [],
};

function normalizeAiConfig(raw?: Partial<AiConfig>): AiConfig {
  const merged = { ...DEFAULT_AI, ...(raw || {}) };
  const custom = (merged.personalities || []).filter(p => !p.built_in && p.instructions);
  const personalities = [
    ...BUILT_IN_PERSONALITIES,
    ...custom.map(p => ({ ...p, built_in: false })),
  ];

  let activeId = merged.active_personality_id;
  if (!personalities.some(p => p.id === activeId)) {
    activeId = 'default';
  }

  const active = personalities.find(p => p.id === activeId) || personalities[0];
  return {
    ...merged,
    channel_mode: merged.channel_mode === 'include' ? 'specific' : merged.channel_mode,
    personalities,
    active_personality_id: active.id,
    instructions: active.instructions,
  };
}

export function useAiConfig(guildId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['guild', guildId, 'config-hybrid'],
    queryFn: () => configApi.getHybridConfig(guildId),
    enabled: !!guildId,
  });

  const mutation = useMutation({
    mutationFn: (ai: Partial<AiConfig>) =>
      configApi.upsertHybridSections(guildId, { ai }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'config-hybrid'] });
    },
  });

  const raw = query.data?.data?.settings?.ai;
  const tier = query.data?.data?.premium_tier || 'free';
  const hasAccess = tier === 'premium_plus_ai';

  const data = useMemo<AiConfig | undefined>(
    () => query.data ? normalizeAiConfig(raw || {}) : undefined,
    [query.data, raw],
  );

  return {
    data,
    hasAccess,
    tier,
    isLoading: query.isLoading,
    save: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error as Error | null,
  };
}
