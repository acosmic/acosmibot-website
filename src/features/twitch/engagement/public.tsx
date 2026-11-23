/** Public page of the engagement slice (§11.1, §12.6): the viewer queue. */
import { lazyRoute } from '@/lib/versionSkew';
import type { TwitchPublicPage } from '../types';

export const publicPages: TwitchPublicPage[] = [
  {
    id: 'queue',
    label: 'Viewer queue',
    order: 30,
    component: lazyRoute(() => import('./PublicQueuePage').then((module) => ({ default: module.PublicQueuePage }))),
    summary: 'Who is waiting to play with the streamer.',
  },
];
