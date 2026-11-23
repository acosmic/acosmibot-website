/**
 * Registry entries for the admin slice (§11.3, §12.10): Managers, Import & export,
 * Analytics and Channel settings. Metadata only; the pages load lazily.
 */
import { ArrowDownUp, ChartColumn, Settings, Users } from 'lucide-react';
import { lazyRoute } from '@/lib/versionSkew';
import type { TwitchSection } from '../types';

export const sections: TwitchSection[] = [
  {
    id: 'managers',
    label: 'Managers',
    group: 'channel',
    order: 10,
    icon: Users,
    minRole: 'broadcaster',
    component: lazyRoute(() => import('./ManagersPage').then((module) => ({ default: module.ManagersPage }))),
    summary: 'Give people editor or moderator access to your dashboard, alongside the editors and moderators synced from Twitch.',
  },
  {
    id: 'import',
    label: 'Import & export',
    group: 'channel',
    order: 20,
    icon: ArrowDownUp,
    minRole: 'editor',
    component: lazyRoute(() => import('./ImportExportPage').then((module) => ({ default: module.ImportExportPage }))),
    summary: 'Bring commands and timers over from Nightbot or StreamElements with a preview first, and download your configuration.',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    group: 'channel',
    order: 30,
    icon: ChartColumn,
    minRole: 'editor',
    component: lazyRoute(() => import('./AnalyticsPage').then((module) => ({ default: module.AnalyticsPage }))),
    summary: 'Daily chat messages, chatters, followers, subs, bits and points, plus your recent streams.',
  },
  {
    id: 'settings',
    label: 'Channel settings',
    group: 'channel',
    order: 40,
    icon: Settings,
    minRole: 'editor',
    component: lazyRoute(() => import('./ChannelSettingsPage').then((module) => ({ default: module.ChannelSettingsPage }))),
  },
];
