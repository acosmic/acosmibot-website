/**
 * Registry entries for the overlays slice (§11.3, §12.9): Overlays and
 * Activity. Metadata only; the pages load lazily.
 */
import { Activity, MonitorPlay } from 'lucide-react';
import { lazyRoute } from '@/lib/versionSkew';
import type { TwitchSection } from '../types';

export const sections: TwitchSection[] = [
  {
    id: 'overlays',
    label: 'Overlays',
    group: 'stream',
    order: 30,
    icon: MonitorPlay,
    minRole: 'editor',
    component: lazyRoute(() => import('./OverlaysPage').then((module) => ({ default: module.OverlaysPage }))),
    summary: 'Add OBS browser sources for alerts, chat, recent events, goals, labels, the leaderboard, giveaways and the current song.',
  },
  {
    id: 'activity',
    label: 'Activity',
    group: 'stream',
    order: 40,
    icon: Activity,
    minRole: 'moderator',
    component: lazyRoute(() => import('./ActivityPage').then((module) => ({ default: module.ActivityPage }))),
    summary: 'A filterable log of follows, subs, gifts, cheers, raids, redemptions and other channel events, updated live.',
  },
];
