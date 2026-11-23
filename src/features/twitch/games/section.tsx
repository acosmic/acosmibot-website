/**
 * Registry entry for the Games slice (§11.3, §12.5): settings, trivia questions, live controls
 * and recent rounds on one page. Metadata only; the page loads lazily.
 */
import { Gamepad2 } from 'lucide-react';
import { lazyRoute } from '@/lib/versionSkew';
import type { TwitchSection } from '../types';

export const sections: TwitchSection[] = [
  {
    id: 'games',
    label: 'Games',
    group: 'community',
    order: 30,
    icon: Gamepad2,
    minRole: 'moderator',
    component: lazyRoute(() => import('./GamesPage').then((module) => ({ default: module.GamesPage }))),
    summary: 'Let viewers play with their points: gamble, roulette, slots, duels, heists, raffles, trivia, bingo and betting contests.',
  },
];
