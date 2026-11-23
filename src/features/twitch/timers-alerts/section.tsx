/**
 * Registry entries for Timers and Chat alerts (§11.3, §12.2). Metadata only;
 * the pages load lazily.
 */
import { BellRing, Timer } from 'lucide-react';
import { lazyRoute } from '@/lib/versionSkew';
import type { TwitchSection } from '../types';

export const sections: TwitchSection[] = [
  {
    id: 'timers',
    label: 'Timers',
    group: 'chat',
    order: 20,
    icon: Timer,
    minRole: 'moderator',
    component: lazyRoute(() => import('./TimersPage').then((module) => ({ default: module.TimersPage }))),
    summary: 'Send reminders and announcements on a schedule, with chat activity, live or offline and category conditions.',
  },
  {
    id: 'chat-alerts',
    label: 'Chat alerts',
    group: 'chat',
    order: 30,
    icon: BellRing,
    minRole: 'moderator',
    component: lazyRoute(() => import('./ChatAlertsPage').then((module) => ({ default: module.ChatAlertsPage }))),
    summary: 'Thank viewers in chat for follows, subs, gifts, cheers, raids, Hype Trains and channel point redemptions.',
  },
];
