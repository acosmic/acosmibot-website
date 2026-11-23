/**
 * Registry entries for Filters, Moderation log and Chat log (§11.3, §12.3).
 * Metadata only; the pages load lazily.
 */
import { MessagesSquare, ScrollText, ShieldCheck } from 'lucide-react';
import { lazyRoute } from '@/lib/versionSkew';
import type { TwitchSection } from '../types';

export const sections: TwitchSection[] = [
  {
    id: 'moderation',
    label: 'Filters',
    group: 'moderation',
    order: 10,
    icon: ShieldCheck,
    minRole: 'moderator',
    component: lazyRoute(() => import('./FiltersPage').then((module) => ({ default: module.FiltersPage }))),
    summary: 'Filter links, caps, symbols, emotes, repetition, zalgo, mass mentions and blocked terms, with a strike ladder and raid protection.',
  },
  {
    id: 'mod-log',
    label: 'Moderation log',
    group: 'moderation',
    order: 20,
    icon: ScrollText,
    minRole: 'moderator',
    component: lazyRoute(() => import('./ModLogPage').then((module) => ({ default: module.ModLogPage }))),
  },
  {
    id: 'chat-log',
    label: 'Chat log',
    group: 'moderation',
    order: 30,
    icon: MessagesSquare,
    minRole: 'moderator',
    component: lazyRoute(() => import('./ChatLogPage').then((module) => ({ default: module.ChatLogPage }))),
  },
];
