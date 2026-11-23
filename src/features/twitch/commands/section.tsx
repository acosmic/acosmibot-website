/** Registry entry for the Commands section (§11.3, §12.1). Metadata only; the page loads lazily. */
import { SquareTerminal } from 'lucide-react';
import { lazyRoute } from '@/lib/versionSkew';
import type { TwitchSection } from '../types';

export const sections: TwitchSection[] = [
  {
    id: 'commands',
    label: 'Commands',
    group: 'chat',
    order: 10,
    icon: SquareTerminal,
    minRole: 'moderator',
    component: lazyRoute(() => import('./CommandsPage').then((module) => ({ default: module.CommandsPage }))),
    summary: 'Custom commands with aliases, cooldowns, user levels, point costs and keyword triggers, plus the built-in commands and regulars.',
  },
];
