/**
 * THESIS: Member settings are a signal-routing board, not a long undifferentiated form.
 * OWN-WORLD: Restrained observatory console, sticky scope index, grouped control ledgers, and literal save state.
 * STORY: Confirm identity, understand what is public, then route profile, server, AI-clock, and listening signals.
 * FIRST VIEWPORT: A compact owner header leads into a left scope rail and a focused privacy workspace.
 * FORM: Third-ranked signal-routing-board structure; established world; seed 44f65275.
 */
import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, Eye, Link2, LockKeyhole, Settings2, TriangleAlert } from 'lucide-react';
import { profileApi, type PrivacySettings, type PublicProfile } from '@/api/profile';
import { spotifyApi, type SpotifyStatus } from '@/api/spotify';
import { ConnectedAccountsSettings } from '@/components/profile/ConnectedAccountsSettings';
import { MemberNav } from '@/components/profile/MemberNav';
import { OwnerSettings } from '@/components/profile/OwnerSettings';
import { PublicNav } from '@/components/layout/PublicNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { useAuthStore } from '@/store/auth';
import { showToast } from '@/utils/toast';
import '@/styles/member.css';

export const SettingsPage: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const queryClient = useQueryClient();

  const profileQuery = useQuery<PublicProfile>({
    queryKey: ['profile', 'me'],
    queryFn: () => profileApi.getMyProfile(),
    enabled: isAuthenticated,
  });

  const spotifyQuery = useQuery<SpotifyStatus>({
    queryKey: ['spotify', 'status'],
    queryFn: () => spotifyApi.status(),
    enabled: isAuthenticated,
  });

  const privacyMutation = useMutation({
    mutationFn: (updates: Partial<PrivacySettings>) => profileApi.updateMyPrivacy(updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });

  const timezoneMutation = useMutation({
    mutationFn: (timezone: string) => profileApi.updateMyTimezone(timezone),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });

  const spotifyOptOutMutation = useMutation({
    mutationFn: (optedOut: boolean) => spotifyApi.setOptOut(optedOut),
    onSuccess: ({ opted_out }) => {
      queryClient.invalidateQueries({ queryKey: ['spotify', 'status'] });
      showToast(opted_out ? 'Spotify tracking off' : 'Spotify tracking on', 'success');
    },
  });

  const profile = profileQuery.data;
  const privacy = profile?.privacy;
  const visibleSignals = privacy
    ? [
        privacy.profile_public,
        privacy.show_avatar,
        privacy.show_xp,
        privacy.show_messages,
        privacy.show_reactions,
        privacy.show_commands,
        privacy.show_economy,
        privacy.show_guilds,
        privacy.show_achievements,
        privacy.public_identity,
      ].filter(Boolean).length
    : 0;
  const saveError = privacyMutation.error || timezoneMutation.error || spotifyOptOutMutation.error;

  return (
    <div className="member-page settings-page">
      <PublicNav variant="observatory" />
      <MemberNav />

      <main className="member-main settings-main">
        <header className="member-header">
          <div>
            <p className="member-kicker">Personal control plane</p>
            <h1>Route your member signals.</h1>
            <p>Control what your profile reveals, how servers appear, and which personal context Acosmibot can use.</p>
          </div>
          {profile && (
            <a className="member-header__action" href={`/u/${profile.username}`}>
              <Eye aria-hidden="true" /> View public profile
            </a>
          )}
        </header>

        {profileQuery.isLoading ? (
          <SettingsSkeleton />
        ) : profileQuery.isError ? (
          <section className="member-error">
            <TriangleAlert aria-hidden="true" />
            <h2>Couldn’t load your settings.</h2>
            <p>Refresh your member data or sign in again.</p>
            <button type="button" onClick={() => profileQuery.refetch()}>Retry settings</button>
          </section>
        ) : profile ? (
          <div className="settings-console">
            <aside className="settings-scope" aria-label="Settings overview">
              <div className="settings-scope__identity">
                <span><LockKeyhole aria-hidden="true" /></span>
                <div><strong>@{profile.username}</strong><small>Authenticated owner</small></div>
              </div>
              <div className="settings-scope__signals">
                <div><Eye aria-hidden="true" /><span><strong>{visibleSignals}/10</strong> public signals</span></div>
                <div><Clock3 aria-hidden="true" /><span><strong>{profile.timezone || 'Server default'}</strong> AI clock</span></div>
                <div><Link2 aria-hidden="true" /><span><strong>Discord presence</strong> connected source</span></div>
              </div>
              <p>Changes save immediately. Visibility rules are enforced by the profile API, not only by this page.</p>
            </aside>

            <section className="settings-workspace" aria-labelledby="settings-workspace-title">
              <header>
                <span><Settings2 aria-hidden="true" /></span>
                <div>
                  <p>Member preferences</p>
                  <h2 id="settings-workspace-title">Visibility & context</h2>
                </div>
                <small aria-live="polite">
                  {privacyMutation.isPending || timezoneMutation.isPending || spotifyOptOutMutation.isPending
                    ? 'Saving changes…'
                    : 'Changes save automatically'}
                </small>
              </header>

              {saveError && (
                <p className="settings-save-error" role="alert">
                  A change could not be saved. Your previous setting is still active.
                </p>
              )}

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
                    ? [...current.filter((id) => id !== guildId), guildId]
                    : current.filter((id) => id !== guildId);
                  privacyMutation.mutate({ hidden_guilds: next });
                }}
                onTimezoneChange={(timezone) => timezoneMutation.mutate(timezone)}
              />
              <ConnectedAccountsSettings
                spotify={spotifyQuery.data}
                loading={spotifyQuery.isLoading}
                optOutSaving={spotifyOptOutMutation.isPending}
                onToggleOptOut={(optedOut) => spotifyOptOutMutation.mutate(optedOut)}
              />
            </section>
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
};

const SettingsSkeleton: React.FC = () => (
  <div className="settings-skeleton" aria-label="Loading settings">
    <span />
    <div>{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div>
  </div>
);
