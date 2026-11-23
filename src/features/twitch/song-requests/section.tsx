/** Registry entry for the song requests slice (§11.3, §12.7). Metadata only; the page loads lazily. */
import { Music } from 'lucide-react';
import { lazyRoute } from '@/lib/versionSkew';
import type { TwitchSection } from '../types';

export const sections: TwitchSection[] = [
  {
    id: 'song-requests',
    label: 'Song requests',
    group: 'community',
    order: 70,
    icon: Music,
    minRole: 'moderator',
    component: lazyRoute(() => import('./SongRequestsPage').then((module) => ({ default: module.SongRequestsPage }))),
    summary: 'Let viewers request YouTube songs, play the queue from the dashboard, and keep a fallback playlist.',
  },
];
