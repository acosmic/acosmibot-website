import { api } from '@/api/client';

export interface SpotifyStatus {
  linked: boolean;
  spotify_user_id?: string;
  display_name?: string;
  product?: string | null;
  last_synced_at?: string | null;
  // Privacy: when true, the user's Spotify listening is not tracked or shared.
  opted_out?: boolean;
}

export const spotifyApi = {
  status: () => api.fetch<SpotifyStatus>('/api/spotify/status'),
  linkToken: () => api.fetch<{ url: string }>('/api/spotify/link-token', { method: 'POST' }),
  unlink: () => api.fetch<{ success: boolean; was_linked?: boolean }>('/api/spotify/unlink', { method: 'POST' }),
  setOptOut: (optedOut: boolean) =>
    api.fetch<{ opted_out: boolean }>('/api/spotify/opt-out', {
      method: 'POST',
      body: JSON.stringify({ opted_out: optedOut }),
    }),
};
