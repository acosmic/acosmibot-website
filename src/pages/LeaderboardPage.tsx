/*
 * THESIS: Leaderboards are a community signal array, not a generic sports table or a dashboard of vanity metrics.
 * OWN-WORLD: Observatory Void, opaque blue-black instruments, cyan selection, and distinct gold/silver/copper rank signals.
 * STORY: See the leaders, choose XP or net worth, scan the field, then open an eligible member profile or server board.
 * FIRST VIEWPORT: A compact title and controls resolve immediately into three live rank beacons on a connected ascent path.
 * FORM: Candidate seven, Signal Array; an asymmetric top-three path above a dense field ledger. Seed dc2b1151, degraded offline.
 */
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowUpRight,
  Ban,
  ChevronDown,
  Hourglass,
  Lock,
  Radio,
  ShieldQuestion,
  TriangleAlert,
  Trophy,
} from 'lucide-react';
import {
  leaderboardApi,
  type GlobalMetric,
  type GlobalEntry,
  type GuildEntry,
} from '@/api/leaderboard';
import { profileApi } from '@/api/profile';
import { PublicNav } from '@/components/layout/PublicNav';
import { DiscordLogo } from '@/components/ui/DiscordLogo';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { startLogin, useHydrateAuthUser } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';
import '@/styles/leaderboard.css';

const PAGE = 50;
const fmt = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : n.toLocaleString();

// Masking: reveal the first 2 chars of the display name, hide the rest with
// bullets; fully mask the @account name. Bullet counts are fixed so we don't
// leak the real length.
const maskName = (s: string): string => (s.length <= 2 ? s : `${s.slice(0, 2)}•••••`);
const MASKED_HANDLE = '•••••';

interface RankEntryView {
  rank: number;
  avatarUrl: string | null;
  name: string;
  username: string | null;
  userId: string;
  value: string;
  sub: string;
  isMe: boolean;
  masked: boolean;
}

export const LeaderboardPage: React.FC = () => {
  const { guildId } = useParams<{ guildId?: string }>();
  const authUser = useAuthStore((state) => state.user);
  const isAuthed = useAuthStore((state) => state.isAuthenticated);
  useHydrateAuthUser();

  return (
    <div className="leaderboard-page">
      <PublicNav variant="observatory" />
      <main className="leaderboard-main">
        {guildId ? (
          <GuildBoard guildId={guildId} isAuthed={isAuthed} meId={authUser?.id} />
        ) : (
          <GlobalBoard isAuthed={isAuthed} meId={authUser?.id} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

// ── Global (public, tabbed) ──────────────────────────────────────────────
const GlobalBoard: React.FC<{ isAuthed: boolean; meId?: string }> = ({ isAuthed, meId }) => {
  const [metric, setMetric] = useState<GlobalMetric>('xp');
  const [limit, setLimit] = useState(PAGE);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['leaderboard', 'global', metric, limit],
    queryFn: () => leaderboardApi.getGlobal(metric, 0, limit),
    placeholderData: keepPreviousData,
  });

  const economyValue = (entry: GlobalEntry): number | null | undefined =>
    entry.economy_total ?? (
      entry.total_currency === undefined && entry.bank_balance === undefined
        ? undefined
        : (entry.total_currency ?? 0) + (entry.bank_balance ?? 0)
    );

  const entries: RankEntryView[] = (data?.entries ?? []).map((entry) => ({
    rank: entry.rank,
    avatarUrl: entry.avatar_url,
    name: entry.global_name || entry.discord_username || `User ${entry.user_id}`,
    username: entry.discord_username,
    userId: entry.user_id,
    value: metric === 'economy'
      ? `${fmt(economyValue(entry))} credits`
      : `${fmt(entry.global_exp)} XP`,
    sub: `Lvl ${fmt(entry.global_level)}`,
    isMe: !!meId && meId === entry.user_id,
    masked: entry.masked ?? !isAuthed,
  }));

  return (
    <>
      <LeaderboardHeader
        scope="Across every server"
        title="Leaderboards"
        subtitle="Where you stand across every server."
      />

      {!isAuthed && <SignInBanner />}

      <BoardControls
        metric={metric}
        isAuthed={isAuthed}
        onMetricChange={(nextMetric) => {
          setMetric(nextMetric);
          setLimit(PAGE);
        }}
      />

      <RankBoard
        entries={entries}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        emptyTitle="No entries yet"
        errorTitle="Couldn’t load the leaderboard"
        fieldLabel={metric === 'economy' ? 'Net worth field' : 'Global XP field'}
      />

      {entries.length >= limit && (
        <LoadMore onClick={() => setLimit((currentLimit) => currentLimit + PAGE)} />
      )}
    </>
  );
};

// ── Per-server (members only) ────────────────────────────────────────────
const GuildBoard: React.FC<{ guildId: string; isAuthed: boolean; meId?: string }> = ({
  guildId,
  isAuthed,
  meId,
}) => {
  const [limit, setLimit] = useState(PAGE);
  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['leaderboard', 'guild', guildId, limit],
    queryFn: () => leaderboardApi.getGuild(guildId, 0, limit),
    enabled: isAuthed,
    placeholderData: keepPreviousData,
  });

  if (!isAuthed) {
    return (
      <section className="leaderboard-gate">
        <BackLink />
        <div className="leaderboard-gate__signal" aria-hidden="true">
          <Lock size={30} />
          <span />
          <span />
        </div>
        <p className="leaderboard-kicker">Private server signal</p>
        <h1>Sign in to view this server’s leaderboard</h1>
        <p>Server rankings are available to members after Discord verifies your shared server.</p>
        <PrimaryButton onClick={startLogin}>
          <DiscordLogo />
          Sign in with Discord
        </PrimaryButton>
      </section>
    );
  }

  const is403 = (error as Error)?.message?.includes('403')
    || (error as Error)?.message?.toLowerCase().includes('member');

  const entries: RankEntryView[] = (data?.entries ?? []).map((entry) => ({
    rank: entry.rank,
    avatarUrl: entry.avatar_url,
    name: entry.display_name || entry.discord_username || `User ${entry.user_id}`,
    username: entry.discord_username,
    userId: entry.user_id,
    value: `Lvl ${fmt((entry as GuildEntry).level)}`,
    sub: `${fmt((entry as GuildEntry).exp)} XP`,
    isMe: !!meId && meId === entry.user_id,
    masked: false,
  }));

  return (
    <>
      <BackLink />
      <LeaderboardHeader
        scope="Server standings"
        title={data?.guild.name || 'Server Leaderboard'}
        subtitle="Top members by level in this server."
      />

      <RankBoard
        entries={entries}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        emptyTitle="No entries yet"
        errorTitle={is403 ? 'You’re not a member of this server' : 'Couldn’t load this leaderboard'}
        errorIcon={is403 ? <Ban size={34} /> : undefined}
        fieldLabel="Server level field"
      />

      {!isError && entries.length >= limit && (
        <LoadMore onClick={() => setLimit((currentLimit) => currentLimit + PAGE)} />
      )}
    </>
  );
};

const BoardControls: React.FC<{
  metric: GlobalMetric;
  isAuthed: boolean;
  onMetricChange: (metric: GlobalMetric) => void;
}> = ({ metric, isAuthed, onMetricChange }) => (
  <div className="leaderboard-controls">
    <div className="leaderboard-tabs" role="group" aria-label="Global ranking metric">
      <Tab active={metric === 'xp'} onClick={() => onMetricChange('xp')}>
        Global XP
      </Tab>
      <Tab active={metric === 'economy'} onClick={() => onMetricChange('economy')}>
        Net Worth
      </Tab>
    </div>
    {isAuthed && <ServerSelector />}
  </div>
);

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
    <label className="leaderboard-server-picker">
      <span>Server board</span>
      <span className="leaderboard-server-picker__control">
        <select
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) navigate(`/leaderboard/${event.target.value}`);
          }}
        >
          <option value="">Choose a server…</option>
          {guilds.map((guild) => (
            <option key={guild.guild_id} value={guild.guild_id}>
              {guild.guild_name || 'Unknown Server'}
            </option>
          ))}
        </select>
        <ChevronDown size={15} aria-hidden="true" />
      </span>
    </label>
  );
};

const RankBoard: React.FC<{
  entries: RankEntryView[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  emptyTitle: string;
  errorTitle: string;
  errorIcon?: React.ReactNode;
  fieldLabel: string;
}> = ({
  entries,
  isLoading,
  isFetching,
  isError,
  emptyTitle,
  errorTitle,
  errorIcon,
  fieldLabel,
}) => {
  if (isLoading) {
    return (
      <BoardState
        icon={<Hourglass size={34} />}
        title="Aligning ranking signals…"
        tone="loading"
      />
    );
  }

  if (isError) {
    return (
      <BoardState
        icon={errorIcon ?? <TriangleAlert size={34} />}
        title={errorTitle}
        subtitle="Please try again in a moment."
        tone="error"
      />
    );
  }

  if (entries.length === 0) {
    return (
      <BoardState
        icon={<Trophy size={34} />}
        title={emptyTitle}
        subtitle="Rankings will appear after members begin earning progress."
        tone="empty"
      />
    );
  }

  const leaders = entries.slice(0, 3);
  const field = entries.slice(3);
  const fieldEnd = field.at(-1)?.rank;

  return (
    <section
      className={`leaderboard-board${isFetching ? ' is-updating' : ''}`}
      aria-busy={isFetching}
    >
      <div className="leaderboard-board__status" aria-live="polite">
        <Radio size={13} aria-hidden="true" />
        {isFetching ? 'Refreshing standings' : 'Ranking signal acquired'}
      </div>

      <div className="leaderboard-signal-array" role="list" aria-label="Top three ranked members">
        <span className="leaderboard-signal-array__orbit" aria-hidden="true" />
        {leaders.map((entry) => (
          <RankBeacon key={entry.userId} entry={entry} />
        ))}
      </div>

      {field.length > 0 && (
        <section className="leaderboard-field" aria-label={fieldLabel}>
          <header className="leaderboard-field__header">
            <div>
              <p>The field</p>
              <h2>{fieldLabel}</h2>
            </div>
            <span>Ranks {field[0].rank}–{fieldEnd}</span>
          </header>
          <div className="leaderboard-field__rows" role="list">
            {field.map((entry) => (
              <RankRow key={entry.userId} entry={entry} />
            ))}
          </div>
        </section>
      )}
    </section>
  );
};

const RankBeacon: React.FC<{ entry: RankEntryView }> = ({ entry }) => {
  const inner = (
    <>
      <span className="rank-beacon__rank">#{entry.rank}</span>
      <Avatar entry={entry} size="large" />
      <div className="rank-beacon__identity">
        <strong>{entry.masked ? maskName(entry.name) : entry.name}</strong>
        <span>@{entry.masked ? MASKED_HANDLE : (entry.username || entry.userId)}</span>
      </div>
      <div className="rank-beacon__value">
        <strong>{entry.value}</strong>
        <span>{entry.sub}</span>
      </div>
      {entry.isMe && <span className="rank-beacon__you">Your signal</span>}
    </>
  );

  const className = [
    'rank-beacon',
    `rank-beacon--${entry.rank}`,
    entry.isMe ? 'is-me' : '',
    entry.masked ? 'is-masked' : '',
  ].filter(Boolean).join(' ');

  if (entry.masked) {
    return <div className={className} role="listitem">{inner}</div>;
  }

  return (
    <Link
      to={`/u/${encodeURIComponent(entry.username || entry.userId)}`}
      className={className}
      role="listitem"
      aria-label={`View ${entry.name}'s profile, rank ${entry.rank}`}
    >
      {inner}
      <ArrowUpRight className="rank-beacon__open" size={16} aria-hidden="true" />
    </Link>
  );
};

const RankRow: React.FC<{ entry: RankEntryView }> = ({ entry }) => {
  const inner = (
    <>
      <span className="rank-row__rank">{entry.rank}</span>
      <Avatar entry={entry} size="small" />
      <span className="rank-row__identity">
        <strong>
          {entry.masked ? maskName(entry.name) : entry.name}
          {entry.isMe && <em> · you</em>}
        </strong>
        <small>@{entry.masked ? MASKED_HANDLE : (entry.username || entry.userId)}</small>
      </span>
      <span className="rank-row__value">
        <strong>{entry.value}</strong>
        <small>{entry.sub}</small>
      </span>
      <span className="rank-row__action" aria-hidden="true">
        {entry.masked ? <ShieldQuestion size={15} /> : <ArrowUpRight size={15} />}
      </span>
    </>
  );

  const className = [
    'rank-row',
    entry.isMe ? 'is-me' : '',
    entry.masked ? 'is-masked' : '',
  ].filter(Boolean).join(' ');

  if (entry.masked) {
    return <div className={className} role="listitem">{inner}</div>;
  }

  return (
    <Link
      to={`/u/${encodeURIComponent(entry.username || entry.userId)}`}
      className={className}
      role="listitem"
      aria-label={`View ${entry.name}'s profile, rank ${entry.rank}`}
    >
      {inner}
    </Link>
  );
};

const Avatar: React.FC<{ entry: RankEntryView; size: 'large' | 'small' }> = ({ entry, size }) => (
  <span
    className={`leaderboard-avatar leaderboard-avatar--${size}${entry.masked ? ' is-masked' : ''}`}
    aria-hidden="true"
  >
    {entry.avatarUrl ? (
      <span style={{ backgroundImage: `url(${entry.avatarUrl})` }} />
    ) : (
      <span className="leaderboard-avatar__fallback">
        {(entry.masked ? '?' : entry.name.slice(0, 1)).toUpperCase()}
      </span>
    )}
  </span>
);

const LeaderboardHeader: React.FC<{
  scope: string;
  title: string;
  subtitle: string;
}> = ({ scope, title, subtitle }) => (
  <header className="leaderboard-hero">
    <div className="leaderboard-hero__copy">
      <p className="leaderboard-kicker">{scope}</p>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
    <div className="leaderboard-hero__instrument" aria-hidden="true">
      <span className="leaderboard-hero__arc" />
      <span className="leaderboard-hero__node leaderboard-hero__node--one">1</span>
      <span className="leaderboard-hero__node leaderboard-hero__node--two">2</span>
      <span className="leaderboard-hero__node leaderboard-hero__node--three">3</span>
      <small>Community rank signal</small>
    </div>
  </header>
);

const BoardState: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  tone: 'loading' | 'error' | 'empty';
}> = ({ icon, title, subtitle, tone }) => (
  <section className={`leaderboard-state leaderboard-state--${tone}`} role="status">
    <span className="leaderboard-state__icon">{icon}</span>
    <h2>{title}</h2>
    {subtitle && <p>{subtitle}</p>}
  </section>
);

const Tab: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    className={`leaderboard-tab${active ? ' active' : ''}`}
    onClick={onClick}
    aria-pressed={active}
  >
    {children}
  </button>
);

const BackLink: React.FC = () => (
  <Link to="/leaderboard" className="leaderboard-back">
    <ArrowLeft size={15} aria-hidden="true" />
    All leaderboards
  </Link>
);

const LoadMore: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <div className="leaderboard-load-more">
    <button type="button" onClick={onClick}>
      Load 50 more
      <ChevronDown size={16} aria-hidden="true" />
    </button>
  </div>
);

const SignInBanner: React.FC = () => (
  <aside className="leaderboard-signin">
    <span className="leaderboard-signin__signal" aria-hidden="true">
      <Lock size={16} />
    </span>
    <p>
      <strong>Identity signals are protected.</strong>
      Sign in to reveal members you share a server with and find your own rank.
    </p>
    <button type="button" onClick={startLogin}>
      <DiscordLogo />
      Login
    </button>
  </aside>
);

const PrimaryButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
}> = ({ onClick, children }) => (
  <button type="button" className="leaderboard-primary-button" onClick={onClick}>
    {children}
  </button>
);
