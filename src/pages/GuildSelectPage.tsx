/**
 * THESIS: Server selection is a permission-aware constellation catalog, not a generic card grid.
 * OWN-WORLD: Observatory void, restrained cyan signals, server identity nodes, and compact telemetry.
 * STORY: Find a community, understand your access, then manage it or open its member station.
 * FIRST VIEWPORT: Real access counts orbit the Acosmibot core beside the server search and roster.
 * FORM: Sixth-ranked constellation catalog structure; established world; seed 244f3f11.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Bot, Crown, Gem, Plus, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';
import { useGuildStore } from '@/store/guild';
import { guildApi } from '@/api/guilds';
import { PublicNav } from '@/components/layout/PublicNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import type { Guild } from '@/types/guild';
import '@/styles/servers.css';
import { trackEvent } from '@/lib/analytics';

const INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1186802023799214223&permissions=8&integration_type=0&scope=bot';

type LoadState = 'loading' | 'ready' | 'error';

const canManageGuild = (guild: Guild) =>
  guild.owner || guild.permissions?.includes('administrator');

const accessLabel = (guild: Guild) =>
  guild.owner ? 'Owner' : guild.permissions?.includes('administrator') ? 'Admin' : 'Member';

const planLabel = (tier?: string) => {
  if (!tier || tier === 'free') return null;
  if (tier === 'premium_plus_ai') return 'Pro';
  return tier.charAt(0).toUpperCase() + tier.slice(1);
};

export const GuildSelectPage: React.FC = () => {
  const navigate = useNavigate();
  const { guilds, setGuilds, setSelectedGuildId } = useGuildStore();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [query, setQuery] = useState('');

  const loadGuilds = useCallback(async () => {
    setLoadState('loading');
    try {
      const nextGuilds = await guildApi.getGuilds();
      setGuilds(nextGuilds);
      setLoadState('ready');
    } catch (error) {
      console.error(error);
      setLoadState('error');
    }
  }, [setGuilds]);

  useEffect(() => {
    void loadGuilds();
  }, [loadGuilds]);

  const sorted = useMemo(() => [...guilds].sort((a, b) => {
    const score = (guild: Guild) =>
      guild.owner ? 2 : guild.permissions?.includes('administrator') ? 1 : 0;
    return score(b) - score(a) || a.name.localeCompare(b.name);
  }), [guilds]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return normalizedQuery
      ? sorted.filter((guild) => guild.name.toLowerCase().includes(normalizedQuery))
      : sorted;
  }, [query, sorted]);

  const manageable = filtered.filter(canManageGuild);
  const memberGuilds = filtered.filter((guild) => !canManageGuild(guild));
  const totalManageable = sorted.filter(canManageGuild).length;
  const totalMember = sorted.length - totalManageable;

  const openGuild = (guild: Guild) => {
    trackEvent('server_open', {
      access: guild.owner ? 'owner' : guild.permissions?.includes('administrator') ? 'admin' : 'member',
    });
    if (canManageGuild(guild)) {
      setSelectedGuildId(guild.id);
      navigate(`/server/${guild.id}/overview`);
      return;
    }
    navigate(`/server/${guild.id}`);
  };

  const inviteBot = () => {
    trackEvent('bot_invite_start', { source: 'server_catalog' });
    window.open(INVITE_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="servers-page">
      <PublicNav variant="observatory" />

      <main className="servers-main">
        <section className="servers-hero">
          <div className="servers-hero__copy">
            <p className="servers-kicker">Community constellation</p>
            <h1>Your servers, aligned by access.</h1>
            <p>
              Open configuration where you manage the community, or visit its
              member station to follow activity, standings, and shared AI fuel.
            </p>
          </div>

          <div className="servers-orbit" aria-label={`${sorted.length} connected servers`}>
            <span className="servers-orbit__ring servers-orbit__ring--outer" aria-hidden="true" />
            <span className="servers-orbit__ring servers-orbit__ring--inner" aria-hidden="true" />
            <div className="servers-orbit__core">
              <img src="/images/acosmibot-logo.png" alt="" />
              <span>Connected</span>
            </div>
            <div className="servers-orbit__node servers-orbit__node--manage">
              <ShieldCheck aria-hidden="true" />
              <strong>{totalManageable}</strong>
              <span>Manage</span>
            </div>
            <div className="servers-orbit__node servers-orbit__node--member">
              <Users aria-hidden="true" />
              <strong>{totalMember}</strong>
              <span>Member</span>
            </div>
            <div className="servers-orbit__readout">
              <span>{sorted.length} signals</span><i /><span>1 account</span>
            </div>
          </div>
        </section>

        {loadState === 'loading' && <ServerSkeletons />}

        {loadState === 'error' && (
          <section className="servers-state" aria-live="polite">
            <span className="servers-state__signal"><RefreshCw aria-hidden="true" /></span>
            <div>
              <h2>Server signals could not be loaded.</h2>
              <p>Check your connection and try the Discord server scan again.</p>
            </div>
            <button type="button" onClick={() => void loadGuilds()}>
              Retry scan <RefreshCw aria-hidden="true" />
            </button>
          </section>
        )}

        {loadState === 'ready' && sorted.length === 0 && (
          <section className="servers-empty">
            <div className="servers-empty__map" aria-hidden="true">
              <span /><span /><span />
              <img src="/images/acosmibot-logo.png" alt="" />
            </div>
            <div className="servers-empty__copy">
              <p className="servers-kicker">No connected communities</p>
              <h2>Bring your first server into orbit.</h2>
              <p>Add Acosmibot to a Discord server you own or manage, then return here to configure it.</p>
              <ol>
                <li><span>1</span><div><strong>Choose a server</strong><small>You need ownership or administrator permission.</small></div></li>
                <li><span>2</span><div><strong>Authorize Acosmibot</strong><small>Discord will show the requested bot permissions.</small></div></li>
                <li><span>3</span><div><strong>Configure the community</strong><small>Your new server appears here after the bot joins.</small></div></li>
              </ol>
              <button type="button" onClick={inviteBot}>
                <Plus aria-hidden="true" /> Add Acosmibot to a server
              </button>
            </div>
          </section>
        )}

        {loadState === 'ready' && sorted.length > 0 && (
          <section className="servers-catalog" aria-labelledby="servers-catalog-title">
            <div className="servers-toolbar">
              <div>
                <p className="servers-kicker">Server signals</p>
                <h2 id="servers-catalog-title">Choose your destination.</h2>
              </div>
              <label className="servers-search">
                <Search aria-hidden="true" />
                <span className="visually-hidden">Search servers</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search your servers"
                />
              </label>
              <button type="button" className="servers-add-button" onClick={inviteBot}>
                <Plus aria-hidden="true" /> Add server
              </button>
            </div>

            {manageable.length > 0 && (
              <ServerBand
                title="Configuration access"
                description="Servers where you are the owner or an administrator."
                guilds={manageable}
                onOpen={openGuild}
              />
            )}

            {memberGuilds.length > 0 && (
              <ServerBand
                title="Member access"
                description="Communities you can explore through their member station."
                guilds={memberGuilds}
                onOpen={openGuild}
              />
            )}

            {filtered.length === 0 && (
              <div className="servers-no-results">
                <Search aria-hidden="true" />
                <strong>No server matches “{query}”.</strong>
                <button type="button" onClick={() => setQuery('')}>Clear search</button>
              </div>
            )}
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

const ServerBand: React.FC<{
  title: string;
  description: string;
  guilds: Guild[];
  onOpen: (guild: Guild) => void;
}> = ({ title, description, guilds, onOpen }) => (
  <section className="servers-band">
    <header className="servers-band__header">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <span>{guilds.length} {guilds.length === 1 ? 'server' : 'servers'}</span>
    </header>
    <div className="servers-grid">
      {guilds.map((guild) => (
        <ServerCard key={guild.id} guild={guild} onOpen={() => onOpen(guild)} />
      ))}
    </div>
  </section>
);

const ServerCard: React.FC<{ guild: Guild; onOpen: () => void }> = ({ guild, onOpen }) => {
  const manageable = canManageGuild(guild);
  const tier = planLabel(guild.premium_tier);
  const TierIcon = tier === 'Pro' || tier === 'Max' ? Bot : Gem;

  return (
    <button type="button" className={`server-node${manageable ? ' can-manage' : ''}`} onClick={onOpen}>
      <span className="server-node__line" aria-hidden="true" />
      <span
        className="server-node__avatar"
        style={{
          backgroundImage: guild.icon
            ? `url(https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128)`
            : 'none',
        }}
        aria-hidden="true"
      >
        {!guild.icon && guild.name.charAt(0).toUpperCase()}
      </span>
      <span className="server-node__identity">
        <strong>{guild.name}</strong>
        <small>{guild.member_count?.toLocaleString() ?? '—'} members</small>
      </span>
      <span className={`server-node__access server-node__access--${accessLabel(guild).toLowerCase()}`}>
        {guild.owner && <Crown aria-hidden="true" />}
        {accessLabel(guild)}
      </span>
      {tier && (
        <span className={`server-node__tier server-node__tier--${tier.toLowerCase()}`} title={`${tier} plan`}>
          <TierIcon aria-hidden="true" /> {tier}
        </span>
      )}
      <span className="server-node__action">
        {manageable ? 'Manage server' : 'Open server'} <ArrowRight aria-hidden="true" />
      </span>
    </button>
  );
};

const ServerSkeletons: React.FC = () => (
  <section className="servers-loading" aria-label="Loading servers" aria-busy="true">
    <div className="servers-loading__header"><span /><span /></div>
    <div className="servers-loading__grid">
      {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
    </div>
  </section>
);
