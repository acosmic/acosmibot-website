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
  // SPOTIFY OAUTH DEFERRED — account linking (link-token/unlink) needs Spotify
  // Extended Quota Mode. See SPOTIFY_OAUTH_DEFERRED.md. Presence scrobbling +
  // the privacy opt-out below don't need it.
  setOptOut: (optedOut: boolean) =>
    api.fetch<{ opted_out: boolean }>('/api/spotify/opt-out', {
      method: 'POST',
      body: JSON.stringify({ opted_out: optedOut }),
    }),
};
