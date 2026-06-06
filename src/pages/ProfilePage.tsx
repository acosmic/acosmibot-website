import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileApi, type PublicProfile, type PrivacySettings } from '@/api/profile';
import { useAuthStore } from '@/store/auth';

const apiBase = (): string =>
  (window as any).AppConfig?.apiBaseUrl ?? 'https://api.acosmibot.com';

const fmt = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : n.toLocaleString();

const ordinal = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : `#${n.toLocaleString()}`;

/** Catches /u/<username>, fetching the public profile (falling back to the
 *  owner view if the visitor is the owner of a hidden profile). */
export const ProfilePage: React.FC = () => {
  const { identifier = '' } = useParams<{ identifier: string }>();
  const authUser = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isAuthed = !!token;
  const queryClient = useQueryClient();

  const { data: profile, isLoading, isError, error } = useQuery<PublicProfile>({
    queryKey: ['profile', identifier],
    queryFn: async () => {
      try {
        return await profileApi.getPublicProfile(identifier);
      } catch (e) {
        // Owners can always view (and un-hide) their own profile.
        const me = useAuthStore.getState().user;
        const isOwner =
          !!me &&
          (me.username?.toLowerCase() === identifier.toLowerCase() || me.id === identifier);
        if (isOwner) {
          return await profileApi.getMyProfile();
        }
        throw e;
      }
    },
    enabled: identifier.length > 0,
  });

  const privacyMutation = useMutation({
    mutationFn: (updates: Partial<PrivacySettings>) => profileApi.updateMyPrivacy(updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', identifier] }),
  });

  const isOwner =
    !!profile && (profile.is_owner || (!!authUser && authUser.id === profile.id));

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ProfileNav authed={!!authUser} authUsername={authUser?.username} />

      <div style={{ flex: 1, padding: '40px 24px', maxWidth: '960px', margin: '0 auto', width: '100%' }}>
        {isLoading && <CenteredMessage emoji="⏳" title="Loading profile…" />}

        {isError && (
          <CenteredMessage
            emoji="🔒"
            title="Profile unavailable"
            subtitle={(error as Error)?.message?.includes('403')
              ? 'This profile is private.'
              : 'We couldn’t find a profile with that name.'}
          />
        )}

        {profile && (
          <>
            <IdentityHeader profile={profile} blurAvatar={!isAuthed} />
            {isAuthed ? (
              <>
                <GlobalStats profile={profile} />
                {profile.guilds && profile.guilds.length > 0 && <GuildStrip guilds={profile.guilds} />}
                {isOwner && (
                  <OwnerPanel
                    privacy={profile.privacy}
                    saving={privacyMutation.isPending}
                    onToggle={(key, value) => privacyMutation.mutate({ [key]: value })}
                  />
                )}
              </>
            ) : (
              <LockedTeaser profile={profile} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

const ProfileNav: React.FC<{ authed: boolean; authUsername?: string }> = ({ authed, authUsername }) => (
  <nav style={{
    height: '56px', background: 'rgba(26,26,26,0.95)', backdropFilter: 'blur(20px)',
    borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 100,
  }}>
    <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
      <img src="/images/acosmibot_website-logo.png" alt="Acosmibot" style={{ height: '32px' }} />
    </a>
    {authed ? (
      <a href={authUsername ? `/u/${authUsername}` : '/servers'} style={{
        color: 'var(--text-secondary)', fontSize: '13px', textDecoration: 'none',
        border: '1px solid var(--border-light)', borderRadius: '8px', padding: '6px 14px',
      }}>
        My Profile
      </a>
    ) : (
      <a href={`${apiBase()}/auth/login`} style={{
        background: 'var(--primary-color)', color: '#000', fontSize: '13px', fontWeight: 700,
        textDecoration: 'none', borderRadius: '8px', padding: '7px 16px',
      }}>
        Log In to Claim Yours
      </a>
    )}
  </nav>
);

const IdentityHeader: React.FC<{ profile: PublicProfile; blurAvatar?: boolean }> = ({ profile, blurAvatar }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap',
    background: 'var(--bg-card)', border: '1px solid var(--border-light)',
    borderRadius: '20px', padding: '28px', marginBottom: '20px',
  }}>
    {/* Ring stays crisp; the image inside is blurred for signed-out visitors so
        we don't expose someone's avatar before they opt in. */}
    <div style={{
      width: '96px', height: '96px', borderRadius: '50%', flexShrink: 0,
      border: '3px solid var(--border-cyan)', overflow: 'hidden',
      backgroundColor: 'var(--bg-tertiary)',
    }}>
      <div style={{
        width: '100%', height: '100%',
        backgroundImage: `url(${profile.avatar_url})`, backgroundSize: 'cover',
        filter: blurAvatar ? 'blur(14px)' : undefined,
        transform: blurAvatar ? 'scale(1.25)' : undefined,
      }} />
    </div>
    <div style={{ flex: 1, minWidth: '200px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
        {profile.global_name || profile.username}
      </h1>
      <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '2px' }}>
        @{profile.username}
      </div>
      {profile.member_since && (
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '10px' }}>
          Member since {profile.member_since}
        </div>
      )}
    </div>
    <div style={{ textAlign: 'center', padding: '0 8px' }}>
      <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--primary-color)' }}>
        {fmt(profile.global.level)}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Global Level
      </div>
    </div>
  </div>
);

const GlobalStats: React.FC<{ profile: PublicProfile }> = ({ profile }) => {
  const g = profile.global;
  const cards: Array<[string, string]> = [
    ['Global Rank', ordinal(g.exp_rank)],
    ['Global XP', fmt(g.exp)],
    ['Messages', fmt(g.total_messages)],
    ['Reactions', fmt(g.total_reactions)],
    ['Commands', fmt(g.total_commands)],
  ];
  if (g.currency !== undefined) {
    cards.push(['Currency', fmt(g.currency)]);
    cards.push(['Currency Rank', ordinal(g.currency_rank)]);
    cards.push(['Bank', fmt(g.bank_balance)]);
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
      gap: '12px', marginBottom: '20px',
    }}>
      {cards.map(([label, value]) => (
        <div key={label} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-light)',
          borderRadius: '14px', padding: '18px',
        }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{label}</div>
        </div>
      ))}
    </div>
  );
};

/** Signed-out view: the identity header stays visible (the share hook), but
 *  the detailed stats are blurred behind a "sign in with Discord" wall to
 *  convert visitors into users. */
const LockedTeaser: React.FC<{ profile: PublicProfile }> = ({ profile }) => {
  const name = profile.global_name || profile.username;
  return (
    <div style={{ position: 'relative' }}>
      <div aria-hidden style={{ filter: 'blur(7px)', pointerEvents: 'none', userSelect: 'none' }}>
        <GlobalStats profile={profile} />
        {profile.guilds && profile.guilds.length > 0 && <GuildStrip guilds={profile.guilds} />}
      </div>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-cyan)',
          borderRadius: '20px', padding: '32px', maxWidth: '420px', textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🔒</div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
            See {name}’s full profile
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 20px' }}>
            Sign in with Discord to unlock full stats, server ranks &amp; streaks — and claim your own profile.
          </p>
          <a href={`${apiBase()}/auth/login`} style={{
            display: 'inline-block', background: 'var(--primary-color)', color: '#000',
            fontWeight: 700, fontSize: '15px', textDecoration: 'none',
            borderRadius: '10px', padding: '12px 28px',
          }}>
            Sign in with Discord
          </a>
        </div>
      </div>
    </div>
  );
};

const GuildStrip: React.FC<{ guilds: PublicProfile['guilds'] }> = ({ guilds }) => (
  <div style={{
    background: 'var(--bg-card)', border: '1px solid var(--border-light)',
    borderRadius: '16px', padding: '20px', marginBottom: '20px',
  }}>
    <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px' }}>
      Server Identity
    </h2>
    <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
      {guilds!.map((gu) => (
        <div key={gu.guild_id} style={{
          flexShrink: 0, minWidth: '160px', background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-light)', borderRadius: '12px', padding: '14px',
        }}>
          <div style={{
            fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {gu.guild_name || 'Unknown Server'}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <Chip>Lvl {fmt(gu.level)}</Chip>
            <Chip highlight>{ordinal(gu.rank)}</Chip>
            {gu.streak > 0 && <Chip>🔥 {fmt(gu.streak)}</Chip>}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const Chip: React.FC<{ children: React.ReactNode; highlight?: boolean }> = ({ children, highlight }) => (
  <span style={{
    fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '10px',
    background: highlight ? 'rgba(0,217,255,0.15)' : 'rgba(255,255,255,0.06)',
    color: highlight ? 'var(--primary-color)' : 'var(--text-secondary)',
    border: `1px solid ${highlight ? 'var(--border-cyan)' : 'var(--border-light)'}`,
  }}>
    {children}
  </span>
);

const OwnerPanel: React.FC<{
  privacy: PrivacySettings;
  saving: boolean;
  onToggle: (key: keyof PrivacySettings, value: boolean) => void;
}> = ({ privacy, saving, onToggle }) => (
  <div style={{
    background: 'var(--bg-card)', border: '1px solid var(--border-cyan)',
    borderRadius: '16px', padding: '20px', marginBottom: '20px',
  }}>
    <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
      This is you ✨
    </h2>
    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
      Your profile is public so others can find you. Control what’s visible below.
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Toggle label="Public profile" hint="Anyone can view this page"
        checked={privacy.profile_public} disabled={saving}
        onChange={(v) => onToggle('profile_public', v)} />
      <Toggle label="Show economy" hint="Currency, bank balance & ranks"
        checked={privacy.show_economy} disabled={saving}
        onChange={(v) => onToggle('show_economy', v)} />
      <Toggle label="Show servers" hint="Your per-server levels & ranks"
        checked={privacy.show_guilds} disabled={saving}
        onChange={(v) => onToggle('show_guilds', v)} />
    </div>
    <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
      🎨 Rank card customization coming soon.
    </div>
  </div>
);

const Toggle: React.FC<{
  label: string; hint: string; checked: boolean; disabled?: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, hint, checked, disabled, onChange }) => (
  <label style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '12px', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
  }}>
    <span>
      <span style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
      <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>{hint}</span>
    </span>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      style={{ width: '18px', height: '18px', accentColor: 'var(--primary-color)', cursor: disabled ? 'default' : 'pointer' }}
    />
  </label>
);

const CenteredMessage: React.FC<{ emoji: string; title: string; subtitle?: string }> = ({ emoji, title, subtitle }) => (
  <div style={{ textAlign: 'center', padding: '80px 20px' }}>
    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>{emoji}</div>
    <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>{title}</h2>
    {subtitle && <p style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
  </div>
);
