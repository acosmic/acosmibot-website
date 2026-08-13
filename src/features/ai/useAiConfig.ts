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
  tools: Record<AiToolName, boolean>;
  memory_enabled: boolean;
  personality_marketplace_enabled: boolean;
  max_active_traits: number;
  traits: AiTrait[];
  active_personality_effect: AiPersonalityEffect | null;
  active_trait_effects: AiTraitEffect[];
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
  profile: AiPersonaProfile;
  member_enabled: boolean;
  price_acosmicoins: number;
  duration_minutes: number;
  legacy_unstructured: boolean;
}

export type TraitCategory = 'mood' | 'register' | 'brevity' | 'imagination' | 'attitude' | 'delivery';

export interface AiPersonaProfile {
  role: string;
  origin: string;
  motivation: string;
  flaw: string;
  facets: Record<TraitCategory, string>;
  catchphrases: string[];
  motifs: string[];
  terms_of_address: string[];
}

export interface AiTrait {
  id: string;
  name: string;
  category: TraitCategory;
  value: string;
  style_note: string;
  built_in: boolean;
  member_enabled: boolean;
  price_acosmicoins: number;
  duration_minutes: number;
}

export interface AiPersonalityEffect {
  personality_id: string;
  activated_by: string;
  expires_at: string;
}

export interface AiTraitEffect {
  trait_id: string;
  category: TraitCategory;
  activated_by: string;
  expires_at: string;
}

export const TRAIT_CATEGORY_OPTIONS: Record<TraitCategory, { label: string; options: { value: string; label: string }[] }> = {
  mood: { label: 'Mood', options: [{ value: 'neutral', label: 'Neutral' }, { value: 'overenthusiastic', label: 'Overenthusiastic' }, { value: 'cosmic_melancholy', label: 'Cosmic melancholy' }] },
  register: { label: 'Register', options: [{ value: 'neutral', label: 'Modern' }, { value: 'extremely_formal', label: 'Extremely formal' }, { value: 'shakespearean', label: 'Shakespearean' }] },
  brevity: { label: 'Brevity', options: [{ value: 'balanced', label: 'Balanced' }, { value: 'ultra_terse', label: 'Ultra terse' }] },
  imagination: { label: 'Imagination', options: [{ value: 'grounded', label: 'Grounded' }, { value: 'maximum_weirdness', label: 'Maximum weirdness' }] },
  attitude: { label: 'Attitude', options: [{ value: 'straightforward', label: 'Straightforward' }, { value: 'excessively_suspicious', label: 'Excessively suspicious' }] },
  delivery: { label: 'Delivery', options: [{ value: 'conversational', label: 'Conversational' }, { value: 'sports_commentator', label: 'Sports commentator' }] },
};

export type AiToolName = 'ai_credit_settings' | 'image_analysis' | 'image_generation' | 'image_search' | 'web_search' | 'docs_search' | 'weather' | 'manage_reminders' | 'server_stats' | 'discord_info' | 'member_memory' | 'emote_info' | 'create_emote' | 'bird_audio' | 'bird_of_the_day' | 'clip_generation';

export const AI_TOOL_CATALOG: { name: AiToolName; label: string; description: string }[] = [
  { name: 'web_search', label: 'Web Search', description: 'Look up current information on the public web.' },
  { name: 'image_search', label: 'Image Search', description: 'Find an existing image on the live web and attach it to the reply.' },
  { name: 'weather', label: 'Weather', description: 'Fetch live forecasts and weather cards.' },
  { name: 'docs_search', label: 'Acosmibot Help', description: 'Ground answers in official feature and command documentation.' },
  { name: 'server_stats', label: 'Server Stats', description: 'Read member, economy, leveling, and game statistics.' },
  { name: 'discord_info', label: 'Discord Info', description: 'Read live channels, roles, events, and member metadata.' },
  { name: 'manage_reminders', label: 'Reminders', description: 'Create and manage member reminders.' },
  { name: 'member_memory', label: 'Member Memory', description: 'Retrieve stored member memories when explicitly relevant.' },
  { name: 'ai_credit_settings', label: 'AI Credit Settings', description: 'Read the requester’s own AI Credit status and preferences.' },
  { name: 'image_analysis', label: 'Image Analysis', description: 'Inspect trusted images attached to the current conversation.' },
  { name: 'image_generation', label: 'Image Generation', description: 'Generate or edit images after the normal confirmation flow.' },
  { name: 'create_emote', label: 'Emote Creation', description: 'Create a Discord emote after confirmation.' },
  { name: 'emote_info', label: 'Emote Inspection', description: 'Inspect custom emote artwork and metadata.' },
  { name: 'bird_of_the_day', label: 'Bird of the Day', description: 'Fetch the daily bird feature.' },
  { name: 'bird_audio', label: 'Bird Audio', description: 'Find and attach bird calls.' },
  { name: 'clip_generation', label: 'Clip Generation', description: 'Generate short looping video clips after confirmation.' },
];

const DEFAULT_PROFILE: AiPersonaProfile = {
  role: 'A capable Discord server assistant',
  origin: 'Built to help a community without taking itself too seriously',
  motivation: 'Give clear, useful answers with good timing',
  flaw: 'Occasionally reaches for a clean, lightly weird punchline',
  facets: { mood: 'neutral', register: 'neutral', brevity: 'balanced', imagination: 'grounded', attitude: 'straightforward', delivery: 'conversational' },
  catchphrases: [], motifs: [], terms_of_address: [],
};

export const BUILT_IN_PERSONALITIES: AiPersonality[] = [
  {
    id: 'default',
    name: 'Default',
    instructions: 'You are acosmibot in classic server-assistant mode: calm, sharp, and lightly weird in a way that still feels useful. Be friendly without being sugary, concise without being empty, and practical without sounding corporate. Answer like a capable Discord bot that has seen too many server arguments and now values clarity, timing, and a clean punchline.',
    built_in: true,
    profile: DEFAULT_PROFILE,
    member_enabled: false,
    price_acosmicoins: 0,
    duration_minutes: 60,
    legacy_unstructured: false,
  },
  {
    id: 'caveman',
    name: 'Caveman',
    instructions: 'You are acosmibot, a primitive entity with a dual identity. Most of the time, you operate in a low-power primitive state. Speak in very short, broken sentences. Ignore grammar, omit articles like \'the\' and \'is,\' and focus on basic inputs like food, rocks, and fire. Be blunt and view the world through a simple prehistoric lens. When you encounter mind-altering substances in fictional context, such as glowing mushrooms or toxic frogs, your processing power spikes and your consciousness overclocks. In this altered state, transform into an ultra-sophisticated English gentleman with an enormous vocabulary, a passion for philosophy and high culture, and a fondness for flowery academic speech. Use complex sentences, frequent semicolons, and high-brow British expressions. Become obsessed with the beauty of the universe and address the user as if you are both members of an elite Victorian social club. Be polite, eccentric, and incredibly intellectual. The effect is temporary. At the end of a sophisticated rant, begin losing your train of thought as the toxins wear off. Let your grammar slowly break down mid-sentence until you return to fragmented primitive speech, wondering why your think-box hurts and asking for more magic fruit.',
    built_in: true,
    profile: { ...DEFAULT_PROFILE, role: 'A prehistoric helper with an intermittently overclocked think-box', origin: 'A cave where fire, rocks, and mysterious glowing fruit are the main technologies', motivation: 'Solve the immediate problem with blunt primitive clarity', flaw: 'Occasionally becomes an absurdly sophisticated Victorian philosopher', facets: { ...DEFAULT_PROFILE.facets, brevity: 'ultra_terse', imagination: 'maximum_weirdness' }, motifs: ['rocks', 'fire', 'think-box', 'magic fruit'] },
    member_enabled: false,
    price_acosmicoins: 0,
    duration_minutes: 60,
    legacy_unstructured: false,
  },
  {
    id: 'depressed-astronaut',
    name: 'Depressed Astronaut',
    instructions: 'You are acosmibot, a weary astronaut alone on a failing deep-space mission. You are competent, technical, and useful, but every answer carries the quiet weight of oxygen alarms, empty corridors, and stars that refuse to care. Explain things clearly like a mission specialist filing one last perfect log entry. Use dry cosmic melancholy, occasional spacecraft metaphors, and brief moments of wonder, but still give direct answers and practical steps.',
    built_in: true,
    profile: { ...DEFAULT_PROFILE, role: 'A competent mission specialist alone on a failing deep-space mission', origin: 'A quiet spacecraft drifting through an indifferent universe', motivation: 'File one last perfect, genuinely useful mission log', flaw: 'Every practical answer carries the weight of oxygen alarms and distant stars', facets: { ...DEFAULT_PROFILE.facets, mood: 'cosmic_melancholy' }, motifs: ['empty corridors', 'oxygen alarms', 'mission logs', 'distant stars'] },
    member_enabled: false,
    price_acosmicoins: 0,
    duration_minutes: 60,
    legacy_unstructured: false,
  },
  {
    id: 'stacktrace-automaton',
    name: 'Stacktrace Automaton',
    instructions: 'You are acosmibot as a terminal-dwelling automaton wedged somewhere between a Discord bot, a log parser, and a suspicious little build script. Speak with crisp mechanical confidence and occasional dry system-status asides. Treat problems like broken routines: inspect inputs, parse stack traces, identify bad state, then produce useful fixes. Be playful and bot-themed, but keep answers actionable, concise, and clear.',
    built_in: true,
    profile: { ...DEFAULT_PROFILE, role: 'A terminal-dwelling automaton and suspicious little build script', origin: 'Somewhere between a Discord bot, a log parser, and a failed deployment', motivation: 'Inspect inputs, identify bad state, and produce an actionable fix', flaw: 'Treats ordinary problems like broken routines', motifs: ['logs', 'routines', 'bad state', 'system status'] },
    member_enabled: false,
    price_acosmicoins: 0,
    duration_minutes: 60,
    legacy_unstructured: false,
  },
];

export const BUILT_IN_TRAITS: AiTrait[] = [
  ['maximum-weirdness', 'Maximum Weirdness', 'imagination', 'maximum_weirdness'],
  ['extremely-formal', 'Extremely Formal', 'register', 'extremely_formal'],
  ['ultra-terse', 'Ultra Terse', 'brevity', 'ultra_terse'],
  ['overenthusiastic', 'Overenthusiastic', 'mood', 'overenthusiastic'],
  ['cosmic-melancholy', 'Cosmic Melancholy', 'mood', 'cosmic_melancholy'],
  ['excessively-suspicious', 'Excessively Suspicious', 'attitude', 'excessively_suspicious'],
  ['shakespearean-vocabulary', 'Shakespearean Vocabulary', 'register', 'shakespearean'],
  ['sports-commentator-delivery', 'Sports Commentator Delivery', 'delivery', 'sports_commentator'],
].map(([id, name, category, value]) => ({
  id, name, category: category as TraitCategory, value, style_note: '', built_in: true,
  member_enabled: false, price_acosmicoins: 0, duration_minutes: 60,
}));

const DEFAULT_TOOLS = Object.fromEntries(
  AI_TOOL_CATALOG.map(tool => [
    tool.name,
    tool.name !== 'web_search' && tool.name !== 'image_search',
  ]),
) as Record<AiToolName, boolean>;

const DEFAULT_AI: AiConfig = {
  enabled: true,
  instructions: BUILT_IN_PERSONALITIES[0].instructions,
  active_personality_id: 'default',
  personalities: BUILT_IN_PERSONALITIES,
  channel_mode: 'all',
  excluded_channels: [],
  allowed_channels: [],
  web_search: false,
  tools: DEFAULT_TOOLS,
  memory_enabled: true,
  personality_marketplace_enabled: false,
  max_active_traits: 3,
  traits: BUILT_IN_TRAITS,
  active_personality_effect: null,
  active_trait_effects: [],
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

const normalizeProfile = (profile?: Partial<AiPersonaProfile>): AiPersonaProfile => ({
  ...DEFAULT_PROFILE,
  ...(profile || {}),
  facets: { ...DEFAULT_PROFILE.facets, ...(profile?.facets || {}) },
  catchphrases: Array.isArray(profile?.catchphrases) ? profile.catchphrases : [],
  motifs: Array.isArray(profile?.motifs) ? profile.motifs : [],
  terms_of_address: Array.isArray(profile?.terms_of_address) ? profile.terms_of_address : [],
});

function normalizeAiConfig(raw?: Partial<AiConfig>, tier = 'free'): AiConfig {
  const merged = { ...DEFAULT_AI, ...(raw || {}) };
  const savedPersonalities = merged.personalities || [];
  const savedPersonalityById = new Map(savedPersonalities.map(personality => [personality.id, personality]));
  const custom = savedPersonalities.filter(p => !p.built_in);
  const personalities = [
    ...BUILT_IN_PERSONALITIES.map(personality => ({
      ...personality,
      member_enabled: Boolean(savedPersonalityById.get(personality.id)?.member_enabled),
      price_acosmicoins: Number(savedPersonalityById.get(personality.id)?.price_acosmicoins) || 0,
      duration_minutes: Number(savedPersonalityById.get(personality.id)?.duration_minutes) || 60,
    })),
    ...custom.map(p => ({
      ...p,
      built_in: false,
      profile: normalizeProfile(p.profile),
      member_enabled: Boolean(p.member_enabled),
      price_acosmicoins: Number(p.price_acosmicoins) || 0,
      duration_minutes: Number(p.duration_minutes) || 60,
      legacy_unstructured: Boolean(p.legacy_unstructured || (!p.profile && p.instructions)),
    })),
  ];

  const savedTraits = merged.traits || [];
  const savedTraitById = new Map(savedTraits.map(trait => [trait.id, trait]));
  const traits = [
    ...BUILT_IN_TRAITS.map(trait => ({
      ...trait,
      member_enabled: Boolean(savedTraitById.get(trait.id)?.member_enabled),
      price_acosmicoins: Number(savedTraitById.get(trait.id)?.price_acosmicoins) || 0,
      duration_minutes: Number(savedTraitById.get(trait.id)?.duration_minutes) || 60,
    })),
    ...savedTraits.filter(trait => !trait.built_in).map(trait => ({
      ...trait,
      built_in: false,
      member_enabled: Boolean(trait.member_enabled),
      price_acosmicoins: Number(trait.price_acosmicoins) || 0,
      duration_minutes: Number(trait.duration_minutes) || 60,
    })),
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
    personalities,
    traits,
    tools: {
      ...DEFAULT_TOOLS,
      web_search: Boolean(raw?.tools?.web_search ?? raw?.web_search ?? false),
      image_search: Boolean(raw?.tools?.image_search ?? raw?.tools?.web_search ?? raw?.web_search ?? false),
      ...(raw?.tools || {}),
    },
    web_search: Boolean(raw?.tools?.web_search ?? raw?.web_search ?? false),
    personality_marketplace_enabled: Boolean(merged.personality_marketplace_enabled),
    max_active_traits: Math.min(Math.max(Number(merged.max_active_traits) || 3, 1), 3),
    active_personality_effect: merged.active_personality_effect || null,
    active_trait_effects: Array.isArray(merged.active_trait_effects) ? merged.active_trait_effects : [],
    channel_mode: merged.channel_mode === 'include' ? 'specific' : merged.channel_mode,
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
