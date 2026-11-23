/**
 * Registry entry for the Overview section (§11.3). Every slice follows this
 * shape in its own `<slice>/section.tsx`: export metadata only, and import the
 * page lazily so the registry's eager glob loads no page code.
 */
import { LayoutDashboard } from 'lucide-react';
import { lazyRoute } from '@/lib/versionSkew';
import type { TwitchSection } from '../types';

export const sections: TwitchSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    group: 'overview',
    order: 0,
    icon: LayoutDashboard,
    minRole: 'moderator',
    component: lazyRoute(() => import('./OverviewPage').then((module) => ({ default: module.OverviewPage }))),
    summary: 'See whether the channel is live and whether the bot is connected, a moderator and fully permitted.',
  },
];
