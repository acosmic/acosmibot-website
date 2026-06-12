import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Ban, Hourglass, Lock, TriangleAlert, Trophy } from 'lucide-react';
import { CenteredMessage } from '@/components/ui/CenteredMessage';
import {
  leaderboardApi,
  type GlobalMetric,
  type GlobalEntry,
  type GuildEntry,
} from '@/api/leaderboard';
import { profileApi } from '@/api/profile';
import { ProfileNav, DiscordLogo } from '@/components/profile/ProfileNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { startLogin, useHydrateAuthUser } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';

const PAGE = 50;
const fmt = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : n.toLocaleString();

// Masking: reveal the first 2 chars of the display name, hide the rest with
// bullets; fully mask the @account name. Bullet counts are fixed so we don't
// leak the real length.
const maskName = (s: string): string => (s.length <= 2 ? s : `${s.slice(0, 2)}•••••`);
const MASKED_HANDLE = '•••••';

export const LeaderboardPage: React.FC = () => {
  const { guildId } = useParams<{ guildId?: string }>();
  const authUser = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isAuthed = !!token;
  useHydrateAuthUser();

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ProfileNav user={authUser} />
      <div style={{ flex: 1, padding: '40px 24px', maxWidth: '760px', margin: '0 auto', width: '100%' }}>
        {guildId ? (
          <GuildBoard guildId={guildId} isAuthed={isAuthed} meId={authUser?.id} />
        ) : (
          <GlobalBoard isAuthed={isAuthed} meId={authUser?.id} />
        )}
      </div>
      <SiteFooter />
    </div>
  );
};

// ── Global (public, tabbed) ──────────────────────────────────────────────
const GlobalBoard: React.FC<{ isAuthed: boolean; meId?: string }> = ({ isAuthed, meId }) => {
  const [metric, setMetric] = useState<GlobalMetric>('xp');
  const [limit, setLimit] = useState(PAGE);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['leaderboard', 'global', metric, limit],
    queryFn: () => leaderboardApi.getGlobal(metric, 0, limit),
    placeholderData: keepPreviousData,
  });

  const entries = data?.entries ?? [];
  const economyValue = (entry: GlobalEntry): number | null | undefined =>
    entry.economy_total ?? (
      entry.total_currency === undefined && entry.bank_balance === undefined
        ? undefined
        : (entry.total_currency ?? 0) + (entry.bank_balance ?? 0)
    );

  return (
    <>
      <Header title="Leaderboards" subtitle="Where you stand across every server." />

      {!isAuthed && <SignInBanner />}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <Tab active={metric === 'xp'} onClick={() => { setMetric('xp'); setLimit(PAGE); }}>Global XP</Tab>
        <Tab active={metric === 'economy'} onClick={() => { setMetric('economy'); setLimit(PAGE); }}>Economy</Tab>
        {isAuthed && <ServerSelector />}
      </div>

      {isLoading && <CenteredMessage icon={<Hourglass size={40} />} title="Loading…" />}
      {isError && <CenteredMessage icon={<TriangleAlert size={40} />} title="Couldn’t load the leaderboard" />}

      {!isLoading && !isError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {entries.map((e) => (
            <Row
              key={e.user_id}
              rank={e.rank}
              avatarUrl={e.avatar_url}
              name={e.global_name || e.discord_username || `User ${e.user_id}`}
              username={e.discord_username}
              userId={e.user_id}
              value={metric === 'economy' ? `${fmt(economyValue(e))} credits` : `${fmt((e as GlobalEntry).global_exp)} XP`}
              sub={`Lvl ${fmt(e.global_level)}`}
              isMe={!!meId && meId === e.user_id}
              masked={e.masked ?? !isAuthed}
            />
          ))}
          {entries.length === 0 && <CenteredMessage icon={<Trophy size={40} />} title="No entries yet" />}
        </div>
      )}

      {entries.length >= limit && (
        <LoadMore onClick={() => setLimit((l) => l + PAGE)} />
      )}
    </>
  );
};

// ── Per-server (members only) ────────────────────────────────────────────
const GuildBoard: React.FC<{ guildId: string; isAuthed: boolean; meId?: string }> = ({ guildId, isAuthed, meId }) => {
  const [limit, setLimit] = useState(PAGE);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['leaderboard', 'guild', guildId, limit],
    queryFn: () => leaderboardApi.getGuild(guildId, 0, limit),
    enabled: isAuthed,
    placeholderData: keepPreviousData,
  });

  if (!isAuthed) {
    return (
      <>
        <BackLink />
        <CenteredMessage icon={<Lock size={40} />} title="Sign in to view this server’s leaderboard" />
        <div style={{ textAlign: 'center' }}>
          <PrimaryButton onClick={startLogin}>Sign in with Discord</PrimaryButton>
        </div>
      </>
    );
  }

  const is403 = (error as Error)?.message?.includes('403') || (error as Error)?.message?.toLowerCase().includes('member');
  const entries = data?.entries ?? [];

  return (
    <>
      <BackLink />
      <Header
        title={data?.guild.name ? `${data.guild.name}` : 'Server Leaderboard'}
        subtitle="Top members by level in this server."
      />

      {isLoading && <CenteredMessage icon={<Hourglass size={40} />} title="Loading…" />}
      {isError && (
        <CenteredMessage
          icon={is403 ? <Ban size={40} /> : <TriangleAlert size={40} />}
          title={is403 ? 'You’re not a member of this server' : 'Couldn’t load this leaderboard'}
        />
      )}

      {!isLoading && !isError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {entries.map((e) => (
            <Row
              key={e.user_id}
              rank={e.rank}
              avatarUrl={e.avatar_url}
              name={e.display_name || e.discord_username || `User ${e.user_id}`}
              username={e.discord_username}
              userId={e.user_id}
              value={`Lvl ${fmt((e as GuildEntry).level)}`}
              sub={`${fmt((e as GuildEntry).exp)} XP`}
              isMe={!!meId && meId === e.user_id}
              masked={false}
            />
          ))}
          {entries.length === 0 && <CenteredMessage icon={<Trophy size={40} />} title="No entries yet" />}
        </div>
      )}

      {!isError && entries.length >= limit && <LoadMore onClick={() => setLimit((l) => l + PAGE)} />}
    </>
  );
};

// ── Signed-in server picker (jumps to /leaderboard/<guildId>) ─────────────
const ServerSelector: React.FC = () => {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => profileApi.getMyProfile(),
  });
  const guilds = data?.guilds ?? [];
  if (guilds.length === 0) return null;
  return (
    <select
      defaultValue=""
      onChange={(ev) => { if (ev.target.value) navigate(`/leaderboard/${ev.target.value}`); }}
      style={{
        marginLeft: 'auto', background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
        border: '1px solid var(--border-light)', borderRadius: '10px', padding: '8px 12px',
        fontSize: '13px', cursor: 'pointer',
      }}
    >
      <option value="">View a server…</option>
      {guilds.map((g) => (
        <option key={g.guild_id} value={g.guild_id}>{g.guild_name || 'Unknown Server'}</option>
      ))}
    </select>
  );
};

// ── Shared bits ───────────────────────────────────────────────────────────
const Row: React.FC<{
  rank: number; avatarUrl: string | null; name: string; username: string | null;
  userId: string; value: string; sub: string; isMe?: boolean; masked?: boolean;
}> = ({ rank, avatarUrl, name, username, userId, value, sub, isMe, masked }) => {
  const medal = rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : 'var(--text-muted)';
  const shownName = masked ? maskName(name) : name;
  // Masked people can't be viewed, so their row doesn't link anywhere (and the
  // API doesn't even send their handle).
  const wrapperStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '14px', textDecoration: 'none',
    background: isMe ? 'rgba(0,217,255,0.08)' : 'var(--bg-card)',
    border: `1px solid ${isMe ? 'var(--border-cyan)' : 'var(--border-light)'}`,
    borderRadius: '14px', padding: '12px 16px',
    cursor: masked ? 'default' : 'pointer',
  };
  const inner = (
    <>
      <div style={{ width: '32px', textAlign: 'center', fontWeight: 800, fontSize: '15px', color: medal, flexShrink: 0 }}>
        {rank}
      </div>
      {/* Ring stays crisp; the avatar inside is blurred for signed-out visitors. */}
      <div style={{
        width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
        border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-tertiary)',
      }}>
        {avatarUrl && (
          <div style={{
            width: '100%', height: '100%',
            backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center',
            filter: masked ? 'blur(8px)' : undefined,
            transform: masked ? 'scale(1.3)' : undefined,
          }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {shownName}{isMe && <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}> · you</span>}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          @{masked ? MASKED_HANDLE : (username || userId)}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</div>
      </div>
    </>
  );

  if (masked) {
    return <div style={wrapperStyle}>{inner}</div>;
  }
  return (
    <Link to={`/u/${encodeURIComponent(username || userId)}`} style={wrapperStyle}>
      {inner}
    </Link>
  );
};

const Tab: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button onClick={onClick} style={{
    background: active ? 'var(--primary-color)' : 'var(--bg-card)',
    color: active ? '#000' : 'var(--text-secondary)', fontWeight: 700, fontSize: '13px',
    border: `1px solid ${active ? 'var(--primary-color)' : 'var(--border-light)'}`,
    borderRadius: '10px', padding: '8px 16px', cursor: 'pointer',
  }}>
    {children}
  </button>
);

const Header: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <header style={{ marginBottom: '16px' }}>
    <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{title}</h1>
    {subtitle && <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '6px 0 0' }}>{subtitle}</p>}
  </header>
);

const BackLink: React.FC = () => (
  <Link to="/leaderboard" style={{ fontSize: '13px', color: 'var(--primary-color)', textDecoration: 'none', display: 'inline-block', marginBottom: '12px' }}>
    ← All leaderboards
  </Link>
);

const LoadMore: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <div style={{ textAlign: 'center', marginTop: '16px' }}>
    <button onClick={onClick} style={{
      background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600,
      border: '1px solid var(--border-light)', borderRadius: '10px', padding: '10px 24px', cursor: 'pointer',
    }}>
      Load more
    </button>
  </div>
);

const SignInBanner: React.FC = () => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
    background: 'var(--bg-card)', border: '1px solid var(--border-cyan)',
    borderRadius: '14px', padding: '14px 16px', marginBottom: '16px',
  }}>
    <button onClick={startLogin} style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      background: 'var(--primary-color)', color: '#000', border: 'none', cursor: 'pointer',
      fontWeight: 700, fontSize: '14px', borderRadius: '10px', padding: '10px 20px', flexShrink: 0,
    }}>
      <DiscordLogo /> Login
    </button>
    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
      to reveal the leaderboard and claim your own profile.
    </span>
  </div>
);

const PrimaryButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button onClick={onClick} style={{
    background: 'var(--primary-color)', color: '#000', border: 'none', cursor: 'pointer',
    fontWeight: 700, fontSize: '15px', borderRadius: '10px', padding: '12px 28px', marginTop: '12px',
  }}>
    {children}
  </button>
);

