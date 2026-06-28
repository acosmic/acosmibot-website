import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configApi } from '@/api/config';
import { GuildEmoji } from '@/hooks/useGuildEmojis';
import { GamesConfig, HeistConfig, SlotsConfig, SlotsTier } from '@/types/features';

// Mirrors the bot's heist fallback_config (Cogs/Heist.py) and the API defaults.
const DEFAULT_HEIST: HeistConfig = {
  enabled: true,
  cooldown_hours: 4,
  join_window_seconds: 60,
  max_crew: 5,
  base_success: 0.25,
  per_member_success: 0.12,
  success_cap: 0.85,
  base_loot_percent: 12.0,
  pie_growth_k: 0.35,
  max_loot_percent: 45.0,
  min_vault: 1000,
  fine_percent: 5.0,
  minigames_enabled: true,
  turn_seconds: 20,
  success_per_pass: 0.13,
  success_per_fail: 0.07,
  success_floor: 0.05,
};

const TIER_LIMITS: Record<SlotsTier, number> = {
  common: 5,
  uncommon: 3,
  rare: 2,
  legendary: 1,
  scatter: 1,
};

const EMPTY_TIERS: Record<SlotsTier, string[]> = {
  common: [],
  uncommon: [],
  rare: [],
  legendary: [],
  scatter: [],
};

function buildSlots(raw: any): SlotsConfig {
  const tiers: SlotsTier[] = ['common', 'uncommon', 'rare', 'legendary', 'scatter'];
  const tier_emojis = tiers.reduce((acc, t) => {
    acc[t] = Array.isArray(raw?.tier_emojis?.[t]) ? [...raw.tier_emojis[t]].slice(0, TIER_LIMITS[t]) : [];
    return acc;
  }, {} as Record<SlotsTier, string[]>);
  return {
    enabled: raw?.enabled === true,
    tier_emojis: { ...EMPTY_TIERS, ...tier_emojis },
  };
}

/**
 * Single source of truth for the consolidated Games page. Reads the whole `games`
 * block plus top-level `heist`, and saves them in one POST so a single SaveBar
 * drives every section. Per-game `enabled` defaults to True; the master defaults
 * to True (only False when explicitly disabled).
 */
export function useGamesConfig(guildId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['guild', guildId, 'config-hybrid'],
    queryFn: () => configApi.getHybridConfig(guildId),
    enabled: !!guildId,
  });

  const settings = query.data?.data?.settings;
  const availableEmojis: GuildEmoji[] = query.data?.data?.available_emojis ?? [];

  const data = useMemo<GamesConfig | undefined>(() => {
    if (!query.data) return undefined;
    const g = settings?.games ?? {};
    const heist = settings?.heist ?? {};
    return {
      enabled: g.enabled !== false,
      slots: buildSlots(g['slots-config']),
      blackjack: { ...(g['blackjack-config'] ?? {}), enabled: g['blackjack-config']?.enabled !== false },
      coinflip: { enabled: g['coinflip-config']?.enabled !== false },
      mines: { enabled: g['mines-config']?.enabled !== false },
      deathroll: { enabled: g['deathroll-config']?.enabled !== false },
      rps: { enabled: g['rps-config']?.enabled !== false },
      heist: { ...DEFAULT_HEIST, ...heist, enabled: heist.enabled !== false },
    };
  }, [query.data, settings]);

  const mutation = useMutation({
    mutationFn: async (cfg: GamesConfig) => {
      // Re-fetch so we preserve any games fields the page doesn't model.
      const fresh = await configApi.getHybridConfig(guildId);
      const currentGames = fresh?.data?.settings?.games ?? {};
      const games = {
        ...currentGames,
        enabled: cfg.enabled,
        'slots-config': cfg.slots,
        'blackjack-config': cfg.blackjack,
        'coinflip-config': cfg.coinflip,
        'mines-config': cfg.mines,
        'deathroll-config': cfg.deathroll,
        'rps-config': cfg.rps,
      };
      return configApi.upsertHybridSections(guildId, { games, heist: cfg.heist });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'config-hybrid'] });
    },
  });

  return {
    data,
    availableEmojis,
    isLoading: query.isLoading,
    isError: query.isError,
    save: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error as Error | null,
  };
}
