import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileApi, type PublicProfile, type PrivacySettings } from '@/api/profile';
import { OwnerSettings } from '@/components/profile/OwnerSettings';
import { ProfileNav } from '@/components/profile/ProfileNav';
import { useHydrateAuthUser } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';

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

  const privacyMutation = useMutation({
    mutationFn: (updates: Partial<PrivacySettings>) => profileApi.updateMyPrivacy(updates),
    // Prefix match keeps both this page and the /u/<name> profile in sync.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ProfileNav user={authUser} />

      <div style={{ flex: 1, padding: '40px 24px', maxWidth: '720px', margin: '0 auto', width: '100%' }}>
        {isLoading && <Centered emoji="⏳" title="Loading settings…" />}

        {isError && (
          <Centered
            emoji="⚠️"
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
              saving={privacyMutation.isPending}
              onToggle={(key, value) =>
                privacyMutation.mutate({ [key]: value } as Partial<PrivacySettings>)}
              onToggleGuild={(guildId, hidden) => {
                const current = profile.privacy.hidden_guilds ?? [];
                const next = hidden
                  ? [...current.filter((g) => g !== guildId), guildId]
                  : current.filter((g) => g !== guildId);
                privacyMutation.mutate({ hidden_guilds: next });
              }}
            />
          </>
        )}
      </div>
    </div>
  );
};

const Centered: React.FC<{ emoji: string; title: string; subtitle?: string }> = ({ emoji, title, subtitle }) => (
  <div style={{ textAlign: 'center', padding: '80px 20px' }}>
    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>{emoji}</div>
    <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>{title}</h2>
    {subtitle && <p style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
  </div>
);
