/**
 * Registry entries for the engagement slice (§11.3, §12.6): Giveaways, Polls & predictions and
 * the Viewer queue. Metadata only; the pages load lazily.
 */
import { Gift, ListOrdered, Vote } from 'lucide-react';
import { lazyRoute } from '@/lib/versionSkew';
import type { TwitchSection } from '../types';

export const sections: TwitchSection[] = [
  {
    id: 'giveaways',
    label: 'Giveaways',
    group: 'community',
    order: 40,
    icon: Gift,
    minRole: 'moderator',
    component: lazyRoute(() => import('./GiveawaysPage').then((module) => ({ default: module.GiveawaysPage }))),
    summary: 'Run giveaways by keyword, active chat or point tickets, with eligibility rules, a claim timer and rerolls.',
  },
  {
    id: 'polls',
    label: 'Polls & predictions',
    group: 'community',
    order: 50,
    icon: Vote,
    minRole: 'moderator',
    component: lazyRoute(() => import('./PollsPage').then((module) => ({ default: module.PollsPage }))),
    summary: 'Start Twitch polls and predictions from the dashboard or chat and follow the live results.',
  },
  {
    id: 'queue',
    label: 'Viewer queue',
    group: 'community',
    order: 60,
    icon: ListOrdered,
    minRole: 'moderator',
    component: lazyRoute(() => import('./QueuePage').then((module) => ({ default: module.QueuePage }))),
    summary: 'Let viewers line up to play with you, open and close the line, and pick who is next.',
  },
];
