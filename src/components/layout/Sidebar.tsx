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
      <div className="nav-item opacity-50" style={{ cursor: 'not-allowed' }} title="Coming Soon">
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
        <svg className="collapse-arrow" width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ 
          transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 0.2s ease'
        }}>
          <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
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
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleGuildClick = (id: string) => {
    setSelectedGuildId(id);
    navigate(`/server/${id}/overview`);
  };

  return (
    <div className="d-flex h-100">
      {/* Guild Selector */}
      <aside className="guild-selector-sidebar" style={{
        width: '72px',
        background: '#151515',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0',
        gap: '8px',
        borderRight: '1px solid var(--border-light)'
      }}>
        {/* User avatar at top */}
        {user && (
          <div
            title={user.global_name || user.username}
            onClick={() => { window.location.href = '/profile'; }}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundImage: user.avatar ? `url(${user.avatar})` : 'none',
              backgroundSize: 'cover',
              backgroundColor: '#2b2d31',
              cursor: 'pointer',
              flexShrink: 0,
              marginBottom: '4px',
            }}
          />
        )}

        {/* Divider */}
        <div style={{ width: '32px', height: '2px', background: 'var(--border-light)', flexShrink: 0 }} />

        {/* Guild icons */}
        {guilds.map(guild => (
          <div
            key={guild.id}
            className={`guild-icon ${guild.id === guildId ? 'active' : ''}`}
            title={guild.name}
            onClick={() => handleGuildClick(guild.id)}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: guild.id === guildId ? '16px' : '50%',
              backgroundImage: guild.icon ? `url(https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png)` : 'none',
              backgroundSize: 'cover',
              backgroundColor: '#2b2d31',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '18px',
              fontWeight: 'bold',
              flexShrink: 0,
            }}
          >
            {!guild.icon && guild.name.charAt(0).toUpperCase()}
          </div>
        ))}
      </aside>

      {/* Navigation Sidebar */}
      <aside className="navigation-sidebar" style={{
        width: '280px',
        background: '#2b2d31',
        overflowY: 'auto',
        padding: '16px 0'
      }}>
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
      </aside>
    </div>
  );
};
