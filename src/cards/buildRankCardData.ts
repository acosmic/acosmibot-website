import type { RankCardData } from './types';
import type { PublicProfile } from '@/api/profile';

/** Mirrors the bot's leveling math (exp_for_level = level^2 * 100). */
export const expForLevel = (level: number): number => level * level * 100;

type ProfileLike = Pick<PublicProfile, 'username' | 'global_name' | 'avatar_url' | 'global' | 'guilds'>;

/**
 * Build a `RankCardData` payload from a profile's real stats plus a resolved
 * cosmetic loadout. Used by the profile page (loadout from the API) and the
 * Card Studio preview (loadout from the in-progress selection). The user's
 * highest-XP server drives the rank/level/XP shown; we fall back to global
 * stats when no per-server data is available.
 */
export function buildRankCardData(
  profile: ProfileLike | undefined,
  loadout: RankCardData['loadout'],
): RankCardData {
  const top = profile?.guilds?.[0] ?? null;
  const level = top?.level ?? profile?.global.level ?? 1;
  const totalExp = top?.exp ?? profile?.global.exp ?? 0;
  const rank = top?.rank ?? 1;

  const currentLevelExp = expForLevel(level);
  const nextLevelExp = expForLevel(level + 1);

  return {
    username: profile?.username ?? 'you',
    displayName: profile?.global_name || profile?.username || 'You',
    avatarUrl: profile?.avatar_url ?? '',
    guildName: top?.guild_name ?? 'your servers',
    rank,
    level,
    globalLevel: profile?.global.level ?? 0,
    currentExp: totalExp,
    expProgress: Math.max(0, totalExp - currentLevelExp),
    expNeeded: Math.max(1, nextLevelExp - currentLevelExp),
    loadout,
  };
}
