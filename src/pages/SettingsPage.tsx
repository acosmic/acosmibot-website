import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Hourglass, TriangleAlert } from 'lucide-react';
import { CenteredMessage } from '@/components/ui/CenteredMessage';
import { profileApi, type PublicProfile, type PrivacySettings } from '@/api/profile';
import { OwnerSettings } from '@/components/profile/OwnerSettings';
import { ProfileNav } from '@/components/profile/ProfileNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ConnectedAccountsSettings } from '@/components/profile/ConnectedAccountsSettings';
import { useHydrateAuthUser } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';
import { spotifyApi, type SpotifyStatus } from '@/api/spotify';
import { showToast } from '@/utils/toast';

/**
 * Owner-only account settings (`/settings`). Renders the shared `OwnerSettings`
 * panel against the private `/api/profile/me` payload. This is the home that
 * per-user premium / billing / rank-card customization will grow into; the
 * public profile (`/u/<name>`) just links here.
 */
export const SettingsPage: React.FC = () => {
  const authUser = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useHydrateAuthUser();

  // You can only manage your own settings — bounce signed-out visitors home.
  useEffect(() => {
    if (!token) navigate('/', { replace: true });
  }, [token, navigate]);

  const { data: profile, isLoading, isError } = useQuery<PublicProfile>({
    queryKey: ['profile', 'me'],
    queryFn: () => profileApi.getMyProfile(),
    enabled: !!token,
  });

  const { data: spotifyStatus, isLoading: spotifyLoading } = useQuery<SpotifyStatus>({
    queryKey: ['spotify', 'status'],
    queryFn: () => spotifyApi.status(),
    enabled: !!token,
  });

  const privacyMutation = useMutation({
    mutationFn: (updates: Partial<PrivacySettings>) => profileApi.updateMyPrivacy(updates),
    // Prefix match keeps both this page and the /u/<name> profile in sync.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });

  const timezoneMutation = useMutation({
    mutationFn: (timezone: string) => profileApi.updateMyTimezone(timezone),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });

  const spotifyLinkMutation = useMutation({
    mutationFn: () => spotifyApi.linkToken(),
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });

  const spotifyUnlinkMutation = useMutation({
    mutationFn: () => spotifyApi.unlink(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spotify', 'status'] });
      showToast('Spotify unlinked', 'success');
    },
  });

  const spotifyOptOutMutation = useMutation({
    mutationFn: (optedOut: boolean) => spotifyApi.setOptOut(optedOut),
    onSuccess: ({ opted_out }) => {
      queryClient.invalidateQueries({ queryKey: ['spotify', 'status'] });
      showToast(opted_out ? 'Spotify tracking off' : 'Spotify tracking on', 'success');
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spotify = params.get('spotify');
    if (!spotify) return;
    if (spotify === 'linked') {
      showToast('Spotify linked', 'success');
      queryClient.invalidateQueries({ queryKey: ['spotify', 'status'] });
    } else {
      showToast(spotify === 'expired' ? 'Spotify link expired' : 'Spotify link failed', 'error');
    }
    params.delete('spotify');
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState(null, '', next);
  }, [queryClient]);

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ProfileNav user={authUser} />

      <div style={{ flex: 1, padding: '40px 24px', maxWidth: '720px', margin: '0 auto', width: '100%' }}>
        {isLoading && <CenteredMessage icon={<Hourglass size={48} />} title="Loading settings…" />}

        {isError && (
          <CenteredMessage
            icon={<TriangleAlert size={48} />}
            title="Couldn’t load your settings"
            subtitle="Try refreshing, or sign in again."
          />
        )}

        {profile && (
          <>
            <header style={{ marginBottom: '20px' }}>
              <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Profile Settings
              </h1>
              <a href={`/u/${profile.username}`} style={{
                display: 'inline-block', marginTop: '6px', fontSize: '14px',
                color: 'var(--primary-color)', textDecoration: 'none',
              }}>
                View your public profile →
              </a>
            </header>

            <OwnerSettings
              privacy={profile.privacy}
              guilds={profile.guilds}
              timezone={profile.timezone ?? ''}
              saving={privacyMutation.isPending}
              timezoneSaving={timezoneMutation.isPending}
              onToggle={(key, value) =>
                privacyMutation.mutate({ [key]: value } as Partial<PrivacySettings>)}
              onToggleGuild={(guildId, hidden) => {
                const current = profile.privacy.hidden_guilds ?? [];
                const next = hidden
                  ? [...current.filter((g) => g !== guildId), guildId]
                  : current.filter((g) => g !== guildId);
                privacyMutation.mutate({ hidden_guilds: next });
              }}
              onTimezoneChange={(tz) => timezoneMutation.mutate(tz)}
            />
            <ConnectedAccountsSettings
              spotify={spotifyStatus}
              loading={spotifyLoading}
              saving={spotifyLinkMutation.isPending || spotifyUnlinkMutation.isPending}
              optOutSaving={spotifyOptOutMutation.isPending}
              onLink={() => spotifyLinkMutation.mutate()}
              onUnlink={() => spotifyUnlinkMutation.mutate()}
              onToggleOptOut={(optedOut) => spotifyOptOutMutation.mutate(optedOut)}
            />
          </>
        )}
      </div>
      <SiteFooter />
    </div>
  );
};
