import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configApi } from '@/api/config';

const AMBIENT_IMAGE_DAILY_MAX = 5;

export interface AiConfig {
  enabled: boolean;
  instructions: string;
  active_personality_id: string;
  personalities: AiPersonality[];
  channel_mode: 'all' | 'exclude' | 'specific' | 'include';
  excluded_channels: string[];
  allowed_channels: string[];
  web_search: boolean;
  memory_enabled: boolean;
  ambient_enabled: boolean;
  /** Probability (0–0.25) of chiming in on an eligible message. */
  ambient_frequency: number;
  /** Per-channel quiet period after an ambient reply, in seconds (120–86400). */
  ambient_cooldown_seconds: number;
  /** Max ambient replies per server per day (tier-capped). */
  ambient_daily_limit: number;
  /** Opt-in: ambient replies may occasionally generate a meme/image. */
  ambient_images_enabled: boolean;
  /** Share (0.01–0.25) of ambient replies that may include a generated image. */
  ambient_image_chance: number;
  /** Per-channel quiet period after an ambient meme image, in seconds. */
  ambient_image_cooldown_seconds: number;
  /** Max ambient meme images per server per day (tier-capped). */
  ambient_image_daily_limit: number;
  /** Guild default IANA timezone for the AI's date/time awareness. */
  timezone: string;
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
  enabled: true,
  instructions: BUILT_IN_PERSONALITIES[0].instructions,
  active_personality_id: 'default',
  personalities: BUILT_IN_PERSONALITIES,
  channel_mode: 'all',
  excluded_channels: [],
  allowed_channels: [],
  web_search: false,
  memory_enabled: true,
  ambient_enabled: false,
  ambient_frequency: 0.03,
  ambient_cooldown_seconds: 600,
  ambient_daily_limit: 25,
  ambient_images_enabled: false,
  ambient_image_chance: 0.15,
  ambient_image_cooldown_seconds: 600,
  ambient_image_daily_limit: AMBIENT_IMAGE_DAILY_MAX,
  timezone: 'UTC',
};

function normalizeAiConfig(raw?: Partial<AiConfig>, tier = 'free'): AiConfig {
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
  const ambientFrequency = Number(merged.ambient_frequency);
  const ambientDailyMax = tier === 'max' ? 100 : 25;
  const ambientDailyLimit = Number(merged.ambient_daily_limit);
  const ambientImageChance = Number(merged.ambient_image_chance);
  const ambientImageCooldown = Number(
    raw?.ambient_image_cooldown_seconds ?? merged.ambient_cooldown_seconds,
  );
  const ambientImageDailyLimit = Number(
    raw?.ambient_image_daily_limit ?? merged.ambient_daily_limit,
  );
  return {
    ...merged,
    channel_mode: merged.channel_mode === 'include' ? 'specific' : merged.channel_mode,
    personalities,
    active_personality_id: active.id,
    instructions: active.instructions,
    ambient_frequency: Math.min(
      Math.max(Number.isFinite(ambientFrequency) ? ambientFrequency : 0.03, 0.01),
      0.25,
    ),
    ambient_cooldown_seconds: Math.min(
      Math.max(Number(merged.ambient_cooldown_seconds) || 600, 120),
      86400,
    ),
    ambient_daily_limit: Math.min(
      Math.max(Number.isFinite(ambientDailyLimit) ? Math.trunc(ambientDailyLimit) : 25, 1),
      ambientDailyMax,
    ),
    ambient_image_chance: Math.min(
      Math.max(Number.isFinite(ambientImageChance) ? ambientImageChance : 0.15, 0.01),
      0.25,
    ),
    ambient_image_cooldown_seconds: Math.min(
      Math.max(Number.isFinite(ambientImageCooldown) ? ambientImageCooldown : 600, 120),
      86400,
    ),
    ambient_image_daily_limit: Math.min(
      Math.max(
        Number.isFinite(ambientImageDailyLimit)
          ? Math.trunc(ambientImageDailyLimit)
          : AMBIENT_IMAGE_DAILY_MAX,
        1,
      ),
      AMBIENT_IMAGE_DAILY_MAX,
    ),
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
  const hasAccess = tier === 'pro' || tier === 'max' || tier === 'premium_plus_ai';

  const data = useMemo<AiConfig | undefined>(
    () => query.data ? normalizeAiConfig(raw || {}, tier) : undefined,
    [query.data, raw, tier],
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
