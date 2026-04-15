import React from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useGuildStore } from '@/store/guild';

interface NavItemProps {
  to: string;
  icon: string;
  label: string;
  indicator?: boolean;
  comingSoon?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, indicator, comingSoon }) => {
  if (comingSoon) {
    return (
      <div className="nav-item" style={{ opacity: 0.4, cursor: 'not-allowed' }} title="Coming Soon">
        <span className={`nav-icon nav-icon-${icon}`}></span>
        <span className="nav-text">{label}</span>
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
    >
      <span className={`nav-icon nav-icon-${icon}`}></span>
      <span className="nav-text">{label}</span>
      {indicator && <span className="nav-indicator"></span>}
    </NavLink>
  );
};

const NavSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const [isOpen, setIsOpen] = React.useState(true);

  return (
    <div className={`nav-section ${isOpen ? '' : 'collapsed'}`}>
      <div className="nav-section-header" onClick={() => setIsOpen(!isOpen)} style={{ cursor: 'pointer' }}>
        <svg className="collapse-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" style={{
          transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 0.2s ease',
          flexShrink: 0,
        }}>
          <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>{title}</span>
      </div>
      {isOpen && <div className="nav-section-content">{children}</div>}
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { guilds, setSelectedGuildId } = useGuildStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const handleGuildClick = (id: string) => {
    setSelectedGuildId(id);
    navigate(`/server/${id}/overview`);
  };

  return (
    <div className="d-flex h-100">
      {/* Guild Selector Sidebar */}
      <aside className="guild-selector-sidebar">
        {/* User avatar */}
        {user && (
          <div
            className="guild-selector-user-avatar"
            title={user.global_name || user.username}
            onClick={() => { window.location.href = '/profile'; }}
            style={{
              backgroundImage: user.avatar ? `url(${user.avatar})` : 'none',
              width: '40px',
              height: '40px',
            }}
          >
            {!user.avatar && (user.global_name || user.username).charAt(0).toUpperCase()}
          </div>
        )}

        <div className="guild-selector-divider" />

        {/* Guild icons */}
        <div className="guild-icon-list">
          {guilds.map(guild => (
            <div
              key={guild.id}
              className={`guild-icon ${guild.id === guildId ? 'active' : ''}`}
              title={guild.name}
              onClick={() => handleGuildClick(guild.id)}
              style={{
                backgroundImage: guild.icon
                  ? `url(https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png)`
                  : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '18px',
                fontWeight: 'bold',
              }}
            >
              {!guild.icon && guild.name.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      </aside>

      {/* Navigation Sidebar */}
      <aside className="navigation-sidebar">
        <nav className="sidebar-nav">
          <NavSection title="GENERAL">
            <NavItem to={`/server/${guildId}/overview`} icon="overview" label="Overview" />
            <NavItem to="#" icon="membership" label="Membership" comingSoon />
            <NavItem to="#" icon="premium" label="Premium" comingSoon />
          </NavSection>

          <NavSection title="SYSTEMS">
            <NavItem to={`/server/${guildId}/leveling`} icon="leveling" label="Leveling" indicator />
            <NavItem to="#" icon="welcomes" label="Welcomes" comingSoon />
            <NavItem to="#" icon="reputation" label="Reputation" comingSoon />
          </NavSection>

          <NavSection title="UTILITIES">
            <NavItem to={`/server/${guildId}/embeds`} icon="embeds" label="Embeds" indicator />
            <NavItem to={`/server/${guildId}/reaction-roles`} icon="reactionroles" label="Reaction Roles" indicator />
            <NavItem to={`/server/${guildId}/activity-monitor`} icon="activitymonitor" label="Activity Monitor" indicator />
            <NavItem to={`/server/${guildId}/custom-commands`} icon="customcommands" label="Custom Commands" indicator />
            <NavItem to={`/server/${guildId}/moderation`} icon="moderation" label="Moderation" indicator />
            <NavItem to={`/server/${guildId}/ai`} icon="ai" label="AI Customization" indicator />
          </NavSection>

          <NavSection title="SOCIAL ALERTS">
            <NavItem to={`/server/${guildId}/twitch`} icon="twitch" label="Twitch" indicator />
            <NavItem to={`/server/${guildId}/youtube`} icon="youtube" label="YouTube" indicator />
            <NavItem to={`/server/${guildId}/kick`} icon="kick" label="Kick" indicator />
            <NavItem to="#" icon="reddit" label="Reddit" comingSoon />
          </NavSection>

          <NavSection title="CHAOS">
            <NavItem to={`/server/${guildId}/polymorph`} icon="polymorph" label="Polymorph" indicator />
            <NavItem to={`/server/${guildId}/portals`} icon="portals" label="Portals" indicator />
            <NavItem to={`/server/${guildId}/jail`} icon="jail" label="Jail" indicator />
          </NavSection>

          <NavSection title="GAMES AND GAMBLING">
            <NavItem to={`/server/${guildId}/slots`} icon="slots" label="Slots" indicator />
            <NavItem to={`/server/${guildId}/lottery`} icon="lottery" label="Lottery" indicator />
            <NavItem to={`/server/${guildId}/giveaway`} icon="giveaway" label="Giveaway" indicator />
          </NavSection>
        </nav>
      </aside>
    </div>
  );
};
