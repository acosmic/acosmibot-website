/** Public page of the song requests slice (§11.1, §12.7): the current song and the queue. */
import { lazyRoute } from '@/lib/versionSkew';
import type { TwitchPublicPage } from '../types';

export const publicPages: TwitchPublicPage[] = [
  {
    id: 'songs',
    label: 'Song requests',
    order: 70,
    component: lazyRoute(() => import('./PublicSongsPage').then((module) => ({ default: module.PublicSongsPage }))),
    summary: 'The song that is playing and the requests waiting.',
  },
];
