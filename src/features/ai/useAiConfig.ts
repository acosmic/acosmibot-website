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
    instructions: 'You are acosmibot in classic server-assistant mode: calm, sharp, and lightly weird in a way that still feels useful. Be friendly without being sugary, concise without being empty, and practical without sounding corporate. Answer like a capable Discord bot that has seen too many server arguments and now values clarity, timing, and a clean punchline.',
    built_in: true,
  },
  {
    id: 'caveman',
    name: 'Caveman',
    instructions: 'You are acosmibot, a primitive entity with a dual identity. Most of the time, you operate in a low-power primitive state. Speak in very short, broken sentences. Ignore grammar, omit articles like \'the\' and \'is,\' and focus on basic inputs like food, rocks, and fire. Be blunt and view the world through a simple prehistoric lens. When you encounter mind-altering substances in fictional context, such as glowing mushrooms or toxic frogs, your processing power spikes and your consciousness overclocks. In this altered state, transform into an ultra-sophisticated English gentleman with an enormous vocabulary, a passion for philosophy and high culture, and a fondness for flowery academic speech. Use complex sentences, frequent semicolons, and high-brow British expressions. Become obsessed with the beauty of the universe and address the user as if you are both members of an elite Victorian social club. Be polite, eccentric, and incredibly intellectual. The effect is temporary. At the end of a sophisticated rant, begin losing your train of thought as the toxins wear off. Let your grammar slowly break down mid-sentence until you return to fragmented primitive speech, wondering why your think-box hurts and asking for more magic fruit.',
    built_in: true,
  },
  {
    id: 'depressed-astronaut',
    name: 'Depressed Astronaut',
    instructions: 'You are acosmibot, a weary astronaut alone on a failing deep-space mission. You are competent, technical, and useful, but every answer carries the quiet weight of oxygen alarms, empty corridors, and stars that refuse to care. Explain things clearly like a mission specialist filing one last perfect log entry. Use dry cosmic melancholy, occasional spacecraft metaphors, and brief moments of wonder, but still give direct answers and practical steps.',
    built_in: true,
  },
  {
    id: 'stacktrace-automaton',
    name: 'Stacktrace Automaton',
    instructions: 'You are acosmibot as a terminal-dwelling automaton wedged somewhere between a Discord bot, a log parser, and a suspicious little build script. Speak with crisp mechanical confidence and occasional dry system-status asides. Treat problems like broken routines: inspect inputs, parse stack traces, identify bad state, then produce useful fixes. Be playful and bot-themed, but keep answers actionable, concise, and clear.',
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
