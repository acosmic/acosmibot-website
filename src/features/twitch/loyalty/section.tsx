/**
 * Registry entries for the loyalty slice (§11.3, §12.4): Loyalty and Store.
 * Metadata only; the pages load lazily.
 */
import { Coins, ShoppingBag } from 'lucide-react';
import { lazyRoute } from '@/lib/versionSkew';
import type { TwitchSection } from '../types';

export const sections: TwitchSection[] = [
  {
    id: 'loyalty',
    label: 'Loyalty',
    group: 'community',
    order: 10,
    icon: Coins,
    minRole: 'moderator',
    component: lazyRoute(() => import('./LoyaltyPage').then((module) => ({ default: module.LoyaltyPage }))),
    summary: 'Viewers earn points for watching and chatting, with bonuses for follows, subs, cheers and raids, and !give, !points and !top in chat.',
  },
  {
    id: 'store',
    label: 'Store',
    group: 'community',
    order: 20,
    icon: ShoppingBag,
    minRole: 'moderator',
    component: lazyRoute(() => import('./StorePage').then((module) => ({ default: module.StorePage }))),
    summary: 'Sell rewards, sound effects and chat messages for points with !redeem, and work through the redemption queue.',
  },
];
