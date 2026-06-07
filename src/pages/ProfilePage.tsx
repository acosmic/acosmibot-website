import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { profileApi, type PublicProfile } from '@/api/profile';
import { ProfileNav } from '@/components/profile/ProfileNav';
import { DailyReward } from '@/components/profile/DailyReward';
import { ScaledRankCard } from '@/cards/ScaledRankCard';
import { buildRankCardData } from '@/cards/buildRankCardData';
import { startLogin, useHydrateAuthUser } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';

const DOCS_URL = '/docs/introduction';
const SUPPORT_URL = 'https://discord.gg/hrj7WhCyEv';

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

  // /u/<name> isn't wrapped in DashboardShell, so hydrate the logged-in user
  // from /auth/me — otherwise we can't tell the owner apart from a visitor.
  useHydrateAuthUser();

  // Is the signed-in user looking at their own profile? (username or id match)
  const viewingOwn =
    !!authUser &&
    (authUser.username?.toLowerCase() === identifier.toLowerCase() ||
      authUser.id === identifier);

  const { data: profile, isLoading, isError, error } = useQuery<PublicProfile>({
    // viewingOwn is part of the key so the query refetches the *private* owner
    // payload (full stats + all servers) once auth hydrates.
    queryKey: ['profile', identifier, viewingOwn],
    queryFn: async () => {
      // Owner view: /api/profile/me returns the un-gated payload (every stat,
      // including servers the owner has hidden from the public).
      if (viewingOwn) {
        return await profileApi.getMyProfile();
      }
      return await profileApi.getPublicProfile(identifier);
    },
    enabled: identifier.length > 0,
  });

  const isOwner =
    !!profile && (profile.is_owner || (!!authUser && authUser.id === profile.id));

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ProfileNav user={authUser} />

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
            <IdentityHeader profile={profile} blurAvatar={profile.avatar_masked ?? !isAuthed} />
            <RankCardShowcase profile={profile} isOwner={isOwner} />
            {isAuthed ? (
              <>
                <GlobalStats profile={profile} />
                {profile.guilds && profile.guilds.length > 0 && <GuildStrip guilds={profile.guilds} />}
                {isOwner && <DailyReward />}
                {isOwner && <OwnerShortcuts />}
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

/** The user's rank card, rendered with their equipped cosmetics. Reuses the
 *  exact <RankCard> the Discord /rank card renders. Owners get a "Customize"
 *  shortcut into the Card Studio. */
const RankCardShowcase: React.FC<{ profile: PublicProfile; isOwner: boolean }> = ({ profile, isOwner }) => {
  // Only render when we have real stats to show — otherwise the card would
  // fall back to placeholder numbers (rank #1, 0 XP). When a viewer has hidden
  // their XP and servers, we respect that by omitting the card entirely.
  const hasStats = (profile.guilds && profile.guilds.length > 0) || profile.global.exp !== undefined;
  if (!hasStats) return null;

  const data = buildRankCardData(profile, profile.loadout);
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-light)',
      borderRadius: '20px', padding: '20px', marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Rank Card
        </span>
        {isOwner && (
          <Link to="/card-studio" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary-color)', textDecoration: 'none' }}>
            🎨 Customize
          </Link>
        )}
      </div>
      <ScaledRankCard data={data} />
    </div>
  );
};

const GlobalStats: React.FC<{ profile: PublicProfile }> = ({ profile }) => {
  const g = profile.global;
  // Each stat is only present when its privacy toggle is on; hidden ones simply
  // don't render. Level lives in the identity header and is always shown.
  const cards: Array<[string, string]> = [];
  if (g.exp !== undefined) {
    cards.push(['Global Rank', ordinal(g.exp_rank)]);
    cards.push(['Global XP', fmt(g.exp)]);
  }
  if (g.total_messages !== undefined) cards.push(['Messages', fmt(g.total_messages)]);
  if (g.total_reactions !== undefined) cards.push(['Reactions', fmt(g.total_reactions)]);
  if (g.total_commands !== undefined) cards.push(['Commands', fmt(g.total_commands)]);
  if (g.currency !== undefined) {
    cards.push(['Currency', fmt(g.currency)]);
    cards.push(['Currency Rank', ordinal(g.currency_rank)]);
    cards.push(['Bank', fmt(g.bank_balance)]);
  }

  if (cards.length === 0) return null;

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
          <button onClick={startLogin} style={{
            background: 'var(--primary-color)', color: '#000', border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: '15px', borderRadius: '10px', padding: '12px 28px',
          }}>
            Sign in with Discord
          </button>
        </div>
      </div>
    </div>
  );
};

const GuildStrip: React.FC<{ guilds: PublicProfile['guilds'] }> = ({ guilds }) => {
  // Owner payloads include hidden servers (for the toggle panel); the public
  // strip should only show the ones that are actually visible.
  const visible = (guilds ?? []).filter((gu) => !gu.hidden);
  if (visible.length === 0) return null;
  return (
  <div style={{
    background: 'var(--bg-card)', border: '1px solid var(--border-light)',
    borderRadius: '16px', padding: '20px', marginBottom: '20px',
  }}>
    <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px' }}>
      Server Identity
    </h2>
    <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
      {visible.map((gu) => (
        <a key={gu.guild_id} href={`/leaderboard/${gu.guild_id}`} title="View this server's leaderboard" style={{
          flexShrink: 0, minWidth: '160px', background: 'var(--bg-tertiary)', textDecoration: 'none',
          border: '1px solid var(--border-light)', borderRadius: '12px', padding: '14px', display: 'block',
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
        </a>
      ))}
    </div>
  </div>
  );
};

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

/** Owner-only navigation shortcuts — carries over the legacy /profile page's
 *  "Quick Links" so the consolidated profile is also the account jumping-off
 *  point. These are navigation (not settings) and stay on the profile. */
const OwnerShortcuts: React.FC = () => {
  const links: Array<{ label: string; desc: string; href: string; external?: boolean; primary?: boolean }> = [
    { label: '⚙ Profile Settings', desc: 'Privacy & what others can see', href: '/settings', primary: true },
    { label: '🎨 Customize your card', desc: 'Shop cosmetics & style your rank card', href: '/card-studio', primary: true },
    { label: 'Manage Servers', desc: 'Configure the bot in your servers', href: '/servers' },
    { label: 'Documentation', desc: 'Learn how to use the bot', href: DOCS_URL },
    { label: 'Support', desc: 'Join our Discord server', href: SUPPORT_URL, external: true },
  ];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '12px', marginBottom: '20px',
    }}>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          style={{
            background: 'var(--bg-card)',
            border: `1px solid ${l.primary ? 'var(--border-cyan)' : 'var(--border-light)'}`,
            borderRadius: '14px', padding: '16px', textDecoration: 'none', display: 'block',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 700, color: l.primary ? 'var(--primary-color)' : 'var(--text-primary)' }}>{l.label}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{l.desc}</div>
        </a>
      ))}
    </div>
  );
};

const CenteredMessage: React.FC<{ emoji: string; title: string; subtitle?: string }> = ({ emoji, title, subtitle }) => (
  <div style={{ textAlign: 'center', padding: '80px 20px' }}>
    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>{emoji}</div>
    <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>{title}</h2>
    {subtitle && <p style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
  </div>
);
