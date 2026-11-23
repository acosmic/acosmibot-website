/** Public pages of the commands slice (§11.1, §12.1): the channel's command list. */
import { lazyRoute } from '@/lib/versionSkew';
import type { TwitchPublicPage } from '../types';

export const publicPages: TwitchPublicPage[] = [
  {
    id: 'commands',
    label: 'Commands',
    order: 10,
    component: lazyRoute(() => import('./PublicCommandsPage').then((module) => ({ default: module.PublicCommandsPage }))),
    summary: 'Every chat command you can use in this channel.',
  },
];
