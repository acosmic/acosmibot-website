import { useQuery } from '@tanstack/react-query';
import type { MetaLevel, MetaResponse, Role } from '../types';
import { twitchApi, twitchRetry } from './api';
import { TWITCH_META_KEY } from './queryKeys';
import { fallbackSectionWriteRole } from './roles';

/** §3.3 level values, used until `GET /meta` answers (or if it fails). */
export const FALLBACK_LEVELS: MetaLevel[] = [
  { value: 0, name: 'everyone' },
  { value: 100, name: 'follower' },
  { value: 200, name: 'regular' },
  { value: 300, name: 'subscriber' },
  { value: 400, name: 'vip' },
  { value: 500, name: 'moderator' },
  { value: 1000, name: 'broadcaster' },
];

const LEVEL_LABELS: Record<string, string> = {
  everyone: 'Everyone',
  follower: 'Followers',
  regular: 'Regulars',
  subscriber: 'Subscribers',
  vip: 'VIPs',
  moderator: 'Moderators',
  broadcaster: 'Broadcaster only',
};

/** Human label for a level name from `meta.levels` ("vip" → "VIPs"). */
export const levelLabel = (name: string): string =>
  LEVEL_LABELS[name] ?? (name ? name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ') : 'Unknown');

/** `GET /api/twitch-bot/meta` (public, cached for 10 minutes). */
export function useMeta() {
  return useQuery({
    queryKey: TWITCH_META_KEY,
    queryFn: () => twitchApi.get<MetaResponse>('/api/twitch-bot/meta'),
    staleTime: 10 * 60 * 1000,
    retry: twitchRetry,
  });
}

/** Levels from meta, or the §3.3 fallback while meta is loading or unavailable. */
export function useLevels(): MetaLevel[] {
  const { data } = useMeta();
  return data?.levels?.length ? data.levels : FALLBACK_LEVELS;
}

/** Human label for a level value, e.g. `500` → "Moderators". */
export function useLevelLabel(): (value: number) => string {
  const levels = useLevels();
  return (value: number) => {
    const match = levels.find((level) => level.value === value);
    return match ? levelLabel(match.name) : `Level ${value}`;
  };
}

/** Minimum role that may save a settings section (meta first, §10.3 fallback). */
export function useSectionWriteRole(section: string): Role {
  const { data } = useMeta();
  return data?.sections?.find((entry) => entry.name === section)?.write_role ?? fallbackSectionWriteRole(section);
}
