import React from 'react';
import { ChevronRight, PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useGuildStore } from '@/store/guild';

interface ServerContextBarProps {
  onMenuClick?: () => void;
  menuOpen?: boolean;
}

const SECTION_LABELS: Record<string, string> = {
  overview: 'Overview',
  billing: 'Billing',
  leveling: 'Leveling',
  analytics: 'Analytics',
  music: 'Music',
  embeds: 'Embeds',
  'better-embeds': 'Better Social Embeds',
  'reaction-roles': 'Reaction Roles',
  'activity-monitor': 'Activity Monitor',
  'custom-commands': 'Custom Commands',
  moderation: 'Moderation',
  'banned-users': 'Banned Users',
  ai: 'AI Customization',
  twitch: 'Twitch',
  youtube: 'YouTube',
  kick: 'Kick',
  'x-alerts': 'X Post Alerts',
  polymorph: 'Polymorph',
  portals: 'Portals',
  jail: 'Jail',
  games: 'Games',
  lottery: 'Lottery',
  giveaway: 'Giveaway',
};

const getSectionLabel = (pathname: string, guildId?: string): string => {
  if (!guildId) return 'Overview';

  const route = pathname.split(`/server/${guildId}/`)[1] ?? 'overview';
  const [section, action] = route.split('/');

  if (section === 'embeds' && action === 'new') return 'New Embed';
  if (section === 'embeds' && action === 'edit') return 'Edit Embed';
  if (section === 'reaction-roles' && action === 'new') return 'New Reaction Role';
  if (section === 'reaction-roles' && action === 'edit') return 'Edit Reaction Role';

  return SECTION_LABELS[section] ?? 'Server Settings';
};

export const ServerContextBar: React.FC<ServerContextBarProps> = ({
  onMenuClick,
  menuOpen = false,
}) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { guildId } = useParams<{ guildId: string }>();
  const { currentGuild, guilds, setSelectedGuildId } = useGuildStore();

  const activeGuild = currentGuild || guilds.find((guild) => guild.id === guildId) || null;
  const manageableGuilds = guilds.filter(
    (guild) => guild.owner || guild.permissions?.includes('administrator'),
  );
  const guildIconUrl = activeGuild?.icon
    ? `https://cdn.discordapp.com/icons/${activeGuild.id}/${activeGuild.icon}.png`
    : '/images/acosmibot-logo.png';
  const sectionLabel = getSectionLabel(pathname, guildId);
  const accessLabel = activeGuild?.owner
    ? 'Owner controls'
    : activeGuild?.permissions?.includes('administrator')
      ? 'Administrator controls'
      : 'Member view';

  const handleGuildChange = (id: string) => {
    if (!id || id === guildId) return;
    setSelectedGuildId(id);
    navigate(`/server/${id}/overview`);
  };

  return (
    <header className="server-context-bar">
      <div className="server-context-bar__content">
        <button
          type="button"
          className="server-context-bar__menu"
          onClick={onMenuClick}
          aria-label={menuOpen ? 'Close server navigation' : 'Open server navigation'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </button>

        <nav className="server-breadcrumb" aria-label="Server breadcrumb">
          <span className="server-breadcrumb__eyebrow">Server control</span>
          <Link className="server-breadcrumb__guild" to={`/server/${guildId}/overview`}>
            <img src={guildIconUrl} alt="" />
            <span>{activeGuild?.name ?? 'Server'}</span>
          </Link>
          <ChevronRight className="server-breadcrumb__separator" size={16} aria-hidden="true" />
          <span className="server-breadcrumb__section" aria-current="page">{sectionLabel}</span>
        </nav>

        <span className="server-context-bar__access">
          <ShieldCheck aria-hidden="true" />
          {accessLabel}
        </span>

        {manageableGuilds.length > 1 && (
          <label className="server-context-bar__switcher">
            <span className="visually-hidden">Switch server</span>
            <select
              aria-label="Switch server"
              value={guildId || activeGuild?.id || ''}
              onChange={(event) => handleGuildChange(event.target.value)}
            >
              {manageableGuilds.map((guild) => (
                <option key={guild.id} value={guild.id}>{guild.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>
    </header>
  );
};
