/**
 * THESIS: A member profile is a living dossier anchored by the real rank card, not a dashboard of isolated stat tiles.
 * OWN-WORLD: Observatory dossier, card stage, signal ledger, ranked activity traces, and permission-aware reveals.
 * STORY: Recognize the member, read their visible global signals, trace shared communities, and continue into owner tools.
 * FIRST VIEWPORT: The equipped rank card occupies the left stage while identity, membership, and visible stats resolve on the right.
 * FORM: Third-ranked member-dossier structure; established world; seed db474ee8.
 */
import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Flame,
  Hourglass,
  Lock,
  Palette,
  Settings,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { CenteredMessage } from '@/components/ui/CenteredMessage';
import { InlineIcon } from '@/components/ui/InlineIcon';
import { profileApi, type PublicProfile, type TopCommand, type TopReaction } from '@/api/profile';
import { PublicNav } from '@/components/layout/PublicNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { DailyReward } from '@/components/profile/DailyReward';
import { InventorySection } from '@/components/profile/InventorySection';
import { MemberNav } from '@/components/profile/MemberNav';
import { NotificationList } from '@/components/profile/NotificationList';
import { TrophyCase } from '@/components/profile/TrophyCase';
import { ScaledRankCard } from '@/cards/ScaledRankCard';
import { buildGlobalRankCardData, buildRankCardData } from '@/cards/buildRankCardData';
import { startLogin } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';
import '@/styles/member.css';

const DOCS_URL = '/docs/introduction';
const SUPPORT_URL = 'https://discord.gg/hrj7WhCyEv';

const fmt = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : value.toLocaleString();

const ordinal = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : `#${value.toLocaleString()}`;

export const ProfilePage: React.FC = () => {
  const { identifier = '' } = useParams<{ identifier: string }>();
  const authUser = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const viewingOwn =
    !!authUser &&
    (authUser.username?.toLowerCase() === identifier.toLowerCase() || authUser.id === identifier);

  const profileQuery = useQuery<PublicProfile>({
    queryKey: ['profile', identifier, viewingOwn],
    queryFn: () => viewingOwn
      ? profileApi.getMyProfile()
      : profileApi.getPublicProfile(identifier),
    enabled: identifier.length > 0,
  });

  const profile = profileQuery.data;
  const isOwner =
    !!profile && (profile.is_owner || (!!authUser && authUser.id === profile.id));

  return (
    <div className="member-page profile-page">
      <PublicNav variant="observatory" />
      {!!token && <MemberNav />}

      <main className="member-main profile-main">
        {profileQuery.isLoading && (
          <CenteredMessage icon={<Hourglass size={48} />} title="Loading profile…" />
        )}

        {profileQuery.isError && (
          <CenteredMessage
            icon={<Lock size={48} />}
            title="Profile unavailable"
            subtitle={(profileQuery.error as Error)?.message?.includes('403')
              ? 'This profile is private.'
              : 'We couldn’t find a profile with that name.'}
          />
        )}

        {profile && (
          <>
            <section className="profile-dossier">
              <RankCardStage profile={profile} />
              <div className="profile-dossier__signals">
                <div className="profile-identity">
                  <div>
                    <p className="member-kicker">{isOwner ? 'Your member signal' : 'Community member'}</p>
                    <h1>{profile.global_name || profile.username}</h1>
                    <span>@{profile.username}</span>
                  </div>
                  {isOwner && <strong>Owner view</strong>}
                </div>
                <div className="profile-identity__meta">
                  {profile.member_since && <span>Member since {profile.member_since}</span>}
                  {profile.mutual_guild && <span>Connected through {profile.mutual_guild.guild_name}</span>}
                </div>
                <GlobalStats profile={profile} />
              </div>
            </section>

            {isOwner && <NotificationList />}

            {!!token ? (
              <>
                <TopUsage profile={profile} />
                {profile.guilds && profile.guilds.length > 0 && <GuildStrip guilds={profile.guilds} />}
                <TrophyCase achievements={profile.achievements} isOwner={isOwner} />
                {isOwner && <InventorySection />}
                {isOwner && <DailyReward />}
                {isOwner && <OwnerShortcuts />}
              </>
            ) : (
              <LockedTeaser profile={profile} />
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

const RankCardStage: React.FC<{ profile: PublicProfile }> = ({ profile }) => {
  const hasStats = profile.global.exp !== undefined || !!profile.mutual_guild;
  if (!hasStats) {
    return (
      <div className="profile-card-stage is-identity-only">
        <span className="profile-card-stage__avatar">
          <img src={profile.avatar_url} alt="" />
        </span>
        <strong>{profile.global_name || profile.username}</strong>
        <small>Level {profile.global.level}</small>
      </div>
    );
  }

  const data = profile.mutual_guild
    ? buildRankCardData({ ...profile, guilds: [profile.mutual_guild] }, profile.loadout)
    : buildGlobalRankCardData(profile, profile.loadout);

  return (
    <div className="profile-card-stage">
      <div className="profile-card-stage__orbit" aria-hidden="true"><span /><span /><span /></div>
      <ScaledRankCard data={data} />
      <small>Live equipped rank card</small>
    </div>
  );
};

const GlobalStats: React.FC<{ profile: PublicProfile }> = ({ profile }) => {
  const global = profile.global;
  const signals: Array<[string, string]> = [];
  if (global.exp !== undefined) {
    signals.push(['Global rank', ordinal(global.exp_rank)]);
    signals.push(['Global XP', fmt(global.exp)]);
  }
  if (global.total_messages !== undefined) signals.push(['Messages', fmt(global.total_messages)]);
  if (global.total_reactions !== undefined) signals.push(['Reactions', fmt(global.total_reactions)]);
  if (global.total_commands !== undefined) signals.push(['Commands', fmt(global.total_commands)]);
  if (global.currency !== undefined) {
    signals.push(['Net worth', fmt((global.currency ?? 0) + (global.bank_balance ?? 0))]);
    signals.push(['Economy rank', ordinal(global.currency_rank)]);
  }

  if (signals.length === 0) return null;

  return (
    <dl className="profile-signal-ledger">
      {signals.map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  );
};

const Emoji: React.FC<{ reaction: TopReaction }> = ({ reaction }) => {
  if (reaction.emoji_id) {
    const extension = reaction.animated ? 'gif' : 'png';
    return (
      <img
        src={`https://cdn.discordapp.com/emojis/${reaction.emoji_id}.${extension}?size=32`}
        alt={reaction.emoji_display}
        title={`:${reaction.emoji_display}:`}
      />
    );
  }
  return <span>{reaction.emoji_display}</span>;
};

const TopUsage: React.FC<{ profile: PublicProfile }> = ({ profile }) => {
  const commands = profile.global.top_commands ?? [];
  const reactions = profile.global.top_reactions ?? [];
  if (commands.length === 0 && reactions.length === 0) return null;

  return (
    <section className="profile-traces">
      <header>
        <div><p>Activity traces</p><h2>Most-used signals</h2></div>
        <span>Visible by member preference</span>
      </header>
      <div className="profile-traces__grid">
        {commands.length > 0 && (
          <div className="profile-trace">
            <h3>Commands</h3>
            {commands.map((command: TopCommand, index: number) => (
              <div key={command.name}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>/{command.name}</strong>
                <small>{command.count.toLocaleString()}</small>
              </div>
            ))}
          </div>
        )}
        {reactions.length > 0 && (
          <div className="profile-trace">
            <h3>Reactions</h3>
            {reactions.map((reaction: TopReaction, index: number) => (
              <div key={reaction.emoji_key}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong><Emoji reaction={reaction} /></strong>
                <small>{reaction.count.toLocaleString()}</small>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

const LockedTeaser: React.FC<{ profile: PublicProfile }> = ({ profile }) => (
  <section className="profile-gate">
    <div aria-hidden="true"><GlobalStats profile={profile} /></div>
    <div className="profile-gate__prompt">
      <Lock aria-hidden="true" />
      <h2>See {(profile.global_name || profile.username)}’s full profile.</h2>
      <p>Sign in with Discord to reveal permitted stats, shared server ranks, streaks, and your own member profile.</p>
      <button type="button" onClick={startLogin}>Sign in with Discord</button>
    </div>
  </section>
);

const GuildStrip: React.FC<{ guilds: PublicProfile['guilds'] }> = ({ guilds }) => {
  const visibleGuilds = (guilds ?? []).filter((guild) => !guild.hidden);
  if (visibleGuilds.length === 0) return null;

  return (
    <section className="profile-guilds">
      <header><div><p>Community coordinates</p><h2>Server identity</h2></div><span>{visibleGuilds.length} visible</span></header>
      <div className="profile-guilds__track">
        {visibleGuilds.map((guild) => (
          <a key={guild.guild_id} href={`/leaderboard/${guild.guild_id}`}>
            <span className="profile-guilds__node" aria-hidden="true"><i /></span>
            <strong>{guild.guild_name || 'Unknown Server'}</strong>
            <small>Level {fmt(guild.level)}</small>
            <span>{ordinal(guild.rank)} rank</span>
            {guild.streak > 0 && <em><InlineIcon icon={Flame} /> {fmt(guild.streak)} streak</em>}
          </a>
        ))}
      </div>
    </section>
  );
};

const OwnerShortcuts: React.FC = () => {
  const links: Array<{
    label: string;
    icon?: LucideIcon;
    description: string;
    href: string;
    external?: boolean;
    primary?: boolean;
  }> = [
    { label: 'Profile Settings', icon: Settings, description: 'Privacy and visible member signals', href: '/settings', primary: true },
    { label: 'Card Studio', icon: Palette, description: 'Equip rank-card cosmetics', href: '/card-studio', primary: true },
    { label: 'Achievements', icon: Trophy, description: 'Track badges and claimable rewards', href: '/achievements', primary: true },
    { label: 'Manage Servers', description: 'Configure connected communities', href: '/servers' },
    { label: 'Documentation', description: 'Learn every Acosmibot system', href: DOCS_URL },
    { label: 'Support', description: 'Join the Acosmibot Discord', href: SUPPORT_URL, external: true },
  ];

  return (
    <nav className="profile-shortcuts" aria-label="Profile shortcuts">
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          className={link.primary ? 'is-primary' : ''}
          {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          <span>{link.icon && <link.icon aria-hidden="true" />}<strong>{link.label}</strong></span>
          <small>{link.description}</small>
          <ArrowUpRight aria-hidden="true" />
        </a>
      ))}
    </nav>
  );
};

export default ProfilePage;
