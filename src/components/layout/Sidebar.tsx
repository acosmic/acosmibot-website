import React from 'react';
import {
  ArrowLeft,
  BarChart3,
  Bot,
  ChevronDown,
  CircleDollarSign,
  Command,
  CreditCard,
  Eye,
  Gamepad2,
  Gift,
  LayoutDashboard,
  LockKeyhole,
  MessageSquareHeart,
  Music2,
  Orbit,
  PanelTop,
  RadioTower,
  Radar,
  Shield,
  Shuffle,
  Sparkles,
  Ticket,
  Trophy,
  Tv,
  UserRoundX,
  UsersRound,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useGuildStore } from '@/store/guild';
import { useGuildPermissions } from '@/hooks/useGuildPermissions';

interface NavItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  status?: 'soon';
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon: Icon, label, end, status, onClick }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}${status ? ` is-${status}` : ''}`}
    onClick={onClick}
    aria-label={status === 'soon' ? `${label}, coming soon` : undefined}
  >
    <span className="nav-icon"><Icon aria-hidden="true" /></span>
    <span className="nav-text">{label}</span>
    {status === 'soon'
      ? <span className="nav-status" aria-hidden="true">Soon</span>
      : <span className="nav-signal" aria-hidden="true" />}
  </NavLink>
);

const NavSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const [isOpen, setIsOpen] = React.useState(true);

  return (
    <section className={`nav-section${isOpen ? '' : ' collapsed'}`}>
      <button
        type="button"
        className="nav-section-header"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
      >
        <span>{title}</span>
        <ChevronDown className="collapse-arrow" aria-hidden="true" />
      </button>
      {isOpen && <div className="nav-section-content">{children}</div>}
    </section>
  );
};

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { guildId } = useParams<{ guildId: string }>();
  const { guilds, currentGuild, setSelectedGuildId } = useGuildStore();
  const navigate = useNavigate();
  const { canManage } = useGuildPermissions(guildId);
  const manageableGuilds = guilds.filter(
    (guild) => guild.owner || guild.permissions?.includes('administrator'),
  );
  const memberGuilds = guilds.filter(
    (guild) => !guild.owner && !guild.permissions?.includes('administrator'),
  );

  const handleAdminGuildClick = (id: string) => {
    setSelectedGuildId(id);
    navigate(`/server/${id}/overview`);
    onClose?.();
  };

  const handleMemberGuildClick = (id: string) => {
    navigate(`/server/${id}`);
    onClose?.();
  };

  return (
    <div className="server-navigation">
      <aside className="guild-selector-sidebar" aria-label="Server shortcuts">
        <section className="guild-rail__section" aria-labelledby="admin-servers-label">
          <div className="guild-rail__label" id="admin-servers-label">Admin servers</div>
          <div className="guild-icon-list">
            {manageableGuilds.map((guild) => (
              <button
                type="button"
                key={guild.id}
                className={`guild-icon${guild.id === guildId ? ' active' : ''}`}
                title={`${guild.name} · Admin`}
                aria-label={`Manage ${guild.name}`}
                aria-current={guild.id === guildId ? 'page' : undefined}
                onClick={() => handleAdminGuildClick(guild.id)}
                style={{
                  backgroundImage: guild.icon
                    ? `url(https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png)`
                    : 'none',
                }}
              >
                {!guild.icon && guild.name.charAt(0).toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        <section className="guild-rail__section guild-rail__section--members" aria-labelledby="member-servers-label">
          <div className="guild-rail__label" id="member-servers-label">Member servers</div>
          {memberGuilds.length > 0 ? (
            <div className="guild-icon-list">
              {memberGuilds.map((guild) => (
                <button
                  type="button"
                  key={guild.id}
                  className="guild-icon guild-icon--member"
                  title={`${guild.name} · Member`}
                  aria-label={`View ${guild.name} member page`}
                  onClick={() => handleMemberGuildClick(guild.id)}
                  style={{
                    backgroundImage: guild.icon
                      ? `url(https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png)`
                      : 'none',
                  }}
                >
                  {!guild.icon && guild.name.charAt(0).toUpperCase()}
                </button>
              ))}
            </div>
          ) : (
            <span className="guild-rail__empty">None</span>
          )}
        </section>
      </aside>

      <aside className={`navigation-sidebar${isOpen ? ' open' : ''}`}>
        <div className="sidebar-nav__identity">
          <span>Server control matrix</span>
          <strong>{currentGuild?.name ?? 'Selected server'}</strong>
          <small>{canManage ? 'Administrator workspace' : 'Member overview'}</small>
        </div>

        <nav className="sidebar-nav" aria-label="Server systems">
          <NavSection title="General">
            <NavItem to={`/server/${guildId}/overview`} icon={LayoutDashboard} label="Overview" onClick={onClose} />
            {canManage && <NavItem to={`/server/${guildId}`} icon={Eye} label="Member page" end onClick={onClose} />}
            {canManage && <NavItem to={`/server/${guildId}/billing`} icon={CreditCard} label="Billing" onClick={onClose} />}
          </NavSection>

          {canManage && (
            <>
              <NavSection title="Systems">
                <NavItem to={`/server/${guildId}/leveling`} icon={Trophy} label="Leveling" onClick={onClose} />
                <NavItem to={`/server/${guildId}/analytics`} icon={BarChart3} label="Analytics" onClick={onClose} />
                <NavItem to={`/server/${guildId}/music`} icon={Music2} label="Music" onClick={onClose} />
              </NavSection>

              <NavSection title="Utilities">
                <NavItem to={`/server/${guildId}/embeds`} icon={PanelTop} label="Embeds" onClick={onClose} />
                <NavItem to={`/server/${guildId}/better-embeds`} icon={MessageSquareHeart} label="Better Social Embeds" onClick={onClose} />
                <NavItem to={`/server/${guildId}/reaction-roles`} icon={UsersRound} label="Reaction Roles" onClick={onClose} />
                <NavItem to={`/server/${guildId}/activity-monitor`} icon={Radar} label="Activity Monitor" onClick={onClose} />
                <NavItem to={`/server/${guildId}/custom-commands`} icon={Command} label="Custom Commands" onClick={onClose} />
                <NavItem to={`/server/${guildId}/moderation`} icon={Shield} label="Moderation" onClick={onClose} />
                <NavItem to={`/server/${guildId}/banned-users`} icon={UserRoundX} label="Banned Users" onClick={onClose} />
                <NavItem to={`/server/${guildId}/ai`} icon={Bot} label="AI Customization" onClick={onClose} />
              </NavSection>

              <NavSection title="Social alerts">
                <NavItem to={`/server/${guildId}/twitch`} icon={Tv} label="Twitch" onClick={onClose} />
                <NavItem to={`/server/${guildId}/youtube`} icon={Video} label="YouTube" onClick={onClose} />
                <NavItem to={`/server/${guildId}/kick`} icon={RadioTower} label="Kick" onClick={onClose} />
              </NavSection>

              <NavSection title="Chaos">
                <NavItem to={`/server/${guildId}/polymorph`} icon={Shuffle} label="Polymorph" onClick={onClose} />
                <NavItem to={`/server/${guildId}/portals`} icon={Orbit} label="Portals" status="soon" onClick={onClose} />
                <NavItem to={`/server/${guildId}/jail`} icon={LockKeyhole} label="Jail" status="soon" onClick={onClose} />
              </NavSection>

              <NavSection title="Games">
                <NavItem to={`/server/${guildId}/games`} icon={Gamepad2} label="Games" onClick={onClose} />
                <NavItem to={`/server/${guildId}/lottery`} icon={Ticket} label="Lottery" status="soon" onClick={onClose} />
                <NavItem to={`/server/${guildId}/giveaway`} icon={Gift} label="Giveaway" onClick={onClose} />
              </NavSection>
            </>
          )}
        </nav>

        <footer className="sidebar-nav__footer">
          <Link to="/servers" onClick={onClose}>
            <ArrowLeft aria-hidden="true" />
            <span>All servers</span>
          </Link>
          <span><CircleDollarSign aria-hidden="true" /> Live configuration</span>
          <span><Sparkles aria-hidden="true" /> Changes apply to Discord</span>
        </footer>
      </aside>
    </div>
  );
};
