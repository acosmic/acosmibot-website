/** Public pages of the stream tools slice (§11.1, §12.8): the channel's quotes. */
import { lazyRoute } from '@/lib/versionSkew';
import type { TwitchPublicPage } from '../types';

export const publicPages: TwitchPublicPage[] = [
  {
    id: 'quotes',
    label: 'Quotes',
    order: 40,
    component: lazyRoute(() => import('./PublicQuotesPage').then((module) => ({ default: module.PublicQuotesPage }))),
    summary: 'Memorable things said on stream, searchable.',
  },
];
