/** Public pages of the loyalty slice (§11.1, §12.4): the leaderboard and the store. */
import { lazyRoute } from '@/lib/versionSkew';
import type { TwitchPublicPage } from '../types';

export const publicPages: TwitchPublicPage[] = [
  {
    id: 'leaderboard',
    label: 'Leaderboard',
    order: 20,
    component: lazyRoute(() => import('./PublicLeaderboardPage').then((module) => ({ default: module.PublicLeaderboardPage }))),
    summary: 'Who has the most points and watch time.',
  },
  {
    id: 'store',
    label: 'Store',
    order: 60,
    component: lazyRoute(() => import('./PublicStorePage').then((module) => ({ default: module.PublicStorePage }))),
    summary: 'What viewers can redeem with their points.',
  },
];
