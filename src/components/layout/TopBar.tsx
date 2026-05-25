import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useGuildStore } from '@/store/guild';
import { useAuthStore } from '@/store/auth';

interface TopBarProps {
  onMenuClick?: () => void;
  menuOpen?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick, menuOpen }) => {
  const navigate = useNavigate();
  const { guildId } = useParams<{ guildId: string }>();
  const { currentGuild, guilds, setSelectedGuildId } = useGuildStore();
  const { user } = useAuthStore();

  const manageableGuilds = guilds.filter(g => g.owner || g.permissions?.includes('administrator'));

  const handleGuildChange = (id: string) => {
    if (!id || id === guildId) return;
    setSelectedGuildId(id);
    navigate(`/server/${id}/overview`);
  };

  const guildIconUrl = currentGuild?.icon
    ? `https://cdn.discordapp.com/icons/${currentGuild.id}/${currentGuild.icon}.png`
    : '/images/acosmibot-logo.png';

  return (
    <div className="dashboard-topbar-wrap">
      <header className="dashboard-topbar">
        <div className="d-flex align-items-center gap-3">
          <button
            className={`mobile-sidebar-toggle${menuOpen ? ' open' : ''}`}
            onClick={onMenuClick}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <span></span><span></span><span></span>
          </button>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img src="/images/acosmibot_website-logo.png" alt="Acosmibot" style={{ height: '32px' }} />
          </Link>
          {currentGuild && (
            <div className="desktop-current-guild">
              <span style={{ color: 'var(--border-light)' }}>|</span>
              <img src={guildIconUrl} alt={currentGuild.name} />
              <h2 className="mb-0 fs-5">{currentGuild.name}</h2>
            </div>
          )}
        </div>

        {user && (
          <button
            className="topbar-user-avatar"
            title="Profile"
            aria-label="Profile"
            onClick={() => { window.location.href = '/profile'; }}
            style={{ backgroundImage: user.avatar ? `url(${user.avatar})` : undefined }}
          >
            {!user.avatar && (user.global_name || user.username).charAt(0).toUpperCase()}
          </button>
        )}
      </header>

      {currentGuild && manageableGuilds.length > 0 && (
        <div className="mobile-guild-bar">
          <div className="mobile-current-guild">
            <img src={guildIconUrl} alt="" />
            <span>{currentGuild.name}</span>
          </div>
          <select
            className="mobile-guild-select"
            aria-label="Switch server"
            value={guildId || currentGuild.id}
            onChange={(event) => handleGuildChange(event.target.value)}
          >
            {manageableGuilds.map(guild => (
              <option key={guild.id} value={guild.id}>{guild.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};
