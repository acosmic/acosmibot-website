/**
 * Registry entries for the stream tools slice (§11.3, §12.8): Quotes, Counters,
 * Stream tools and Channel points. Metadata only; the pages load lazily.
 */
import { Coins, Hash, Quote, Radio } from 'lucide-react';
import { lazyRoute } from '@/lib/versionSkew';
import type { TwitchSection } from '../types';

export const sections: TwitchSection[] = [
  {
    id: 'quotes',
    label: 'Quotes',
    group: 'chat',
    order: 40,
    icon: Quote,
    minRole: 'moderator',
    component: lazyRoute(() => import('./QuotesPage').then((module) => ({ default: module.QuotesPage }))),
    summary: 'Keep numbered quotes that chat can recall with !quote, with a searchable public page.',
  },
  {
    id: 'counters',
    label: 'Counters',
    group: 'chat',
    order: 50,
    icon: Hash,
    minRole: 'moderator',
    component: lazyRoute(() => import('./CountersPage').then((module) => ({ default: module.CountersPage }))),
    summary: 'Count things like deaths with !counter and use the number in command responses.',
  },
  {
    id: 'stream-tools',
    label: 'Stream tools',
    group: 'stream',
    order: 10,
    icon: Radio,
    minRole: 'moderator',
    component: lazyRoute(() => import('./StreamToolsPage').then((module) => ({ default: module.StreamToolsPage }))),
    summary: 'Change the title and category, give shoutouts, and control the clip, marker and commercial commands.',
  },
  {
    id: 'channel-points',
    label: 'Channel points',
    group: 'stream',
    order: 20,
    icon: Coins,
    minRole: 'editor',
    component: lazyRoute(() => import('./ChannelPointsPage').then((module) => ({ default: module.ChannelPointsPage }))),
    summary: 'Create channel point rewards and run an action in chat when viewers redeem them.',
  },
];
