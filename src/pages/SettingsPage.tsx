/**
 * THESIS: Member settings answer three plain questions: who can see me, what do they see, and how does Acosmibot reach me.
 * OWN-WORLD: Restrained observatory console, sticky summary with a jump index, grouped control ledgers, and literal save state.
 * STORY: Read the current state at a glance, jump to a group, flip a switch, and see it saved.
 * FIRST VIEWPORT: A plain Settings header leads into a left summary and index beside the visibility controls.
 * FORM: Utility surface on the established world; seed 44f65275. Copy is literal: no metaphor in headings, labels, or hints.
 */
import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock3, Eye, EyeOff, Settings2, TriangleAlert, UserRound } from 'lucide-react';
import { profileApi, type PrivacySettings, type PublicProfile } from '@/api/profile';
import { spotifyApi, type SpotifyStatus } from '@/api/spotify';
import { ConnectedAccountsSettings } from '@/components/profile/ConnectedAccountsSettings';
import { MemberNav } from '@/components/profile/MemberNav';
import { OwnerSettings, SETTINGS_SECTIONS } from '@/components/profile/OwnerSettings';
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
  // The optional sections of the profile page, as listed under "What your
  // profile shows" and "Servers on your profile".
  const profileDetails = privacy
    ? [
        privacy.show_xp,
        privacy.show_messages,
        privacy.show_reactions,
        privacy.show_commands,
        privacy.show_economy,
        privacy.show_achievements,
        privacy.show_guilds,
      ]
    : [];
  const shownDetails = profileDetails.filter(Boolean).length;
  const isSaving = privacyMutation.isPending || timezoneMutation.isPending || spotifyOptOutMutation.isPending;
  const hasSaved = privacyMutation.isSuccess || timezoneMutation.isSuccess || spotifyOptOutMutation.isSuccess;
  const saveError = privacyMutation.error || timezoneMutation.error || spotifyOptOutMutation.error;

  return (
    <div className="member-page settings-page">
      <PublicNav variant="observatory" />
      <MemberNav />

      <main className="member-main settings-main">
        <header className="member-header">
          <div>
            <p className="member-kicker">Your account</p>
            <h1>Settings</h1>
            <p>Choose what other people can see on your profile, when Acosmibot messages you, and which timezone it uses for you.</p>
          </div>
          {profile && (
            <Link className="member-header__action" to={`/u/${profile.username}`}>
              <Eye aria-hidden="true" /> View my profile
            </Link>
          )}
        </header>

        {profileQuery.isLoading ? (
          <SettingsSkeleton />
        ) : profileQuery.isError ? (
          <section className="member-error">
            <TriangleAlert aria-hidden="true" />
            <h2>Couldn’t load your settings.</h2>
            <p>Try again. If it keeps failing, sign out and back in.</p>
            <button type="button" onClick={() => profileQuery.refetch()}>Try again</button>
          </section>
        ) : profile ? (
          <div className="settings-console">
            <aside className="settings-scope" aria-label="Settings summary">
              <div className="settings-scope__identity">
                <span><UserRound aria-hidden="true" /></span>
                <div><strong translate="no">@{profile.username}</strong><small>Signed in with Discord</small></div>
              </div>
              <div className="settings-scope__signals">
                <div className={privacy?.profile_public ? 'is-on' : undefined}>
                  {privacy?.profile_public ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                  <span><strong>{privacy?.profile_public ? 'Public' : 'Private'}</strong> Profile page</span>
                </div>
                <div>
                  <Settings2 aria-hidden="true" />
                  <span>
                    <strong>{privacy?.profile_public ? `${shownDetails} of ${profileDetails.length} sections` : 'Hidden while private'}</strong>
                    {' '}Shown on your profile
                  </span>
                </div>
                <div>
                  <Clock3 aria-hidden="true" />
                  <span><strong>{profile.timezone ? profile.timezone.replace(/_/g, ' ') : 'Server default'}</strong> Timezone</span>
                </div>
              </div>
              <nav className="settings-scope__index" aria-label="Settings sections">
                <p>Jump to</p>
                {SETTINGS_SECTIONS.map((section) => (
                  <a key={section.id} href={`#${section.id}`}>{section.label}</a>
                ))}
              </nav>
            </aside>

            <section className="settings-workspace" aria-labelledby="settings-workspace-title">
              <header>
                <span><Settings2 aria-hidden="true" /></span>
                <div>
                  <h2 id="settings-workspace-title">Privacy & preferences</h2>
                  <p>Each switch saves as soon as you change it.</p>
                </div>
                <small className={isSaving ? 'is-saving' : saveError ? 'is-error' : undefined} aria-live="polite">
                  {isSaving ? 'Saving…' : saveError ? 'Not saved' : hasSaved ? 'Saved' : 'Saves automatically'}
                </small>
              </header>

              {saveError && (
                <p className="settings-save-error" role="alert">
                  That change didn’t save, so your previous setting is still in place. Try it again in a moment.
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
  <div className="settings-skeleton" role="status" aria-label="Loading settings…">
    <span />
    <div>{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div>
  </div>
);
