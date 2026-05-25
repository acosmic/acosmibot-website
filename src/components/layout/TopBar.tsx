import React, { useEffect, useRef, useState } from 'react';
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
  const { user, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const activeGuild = currentGuild || guilds.find(guild => guild.id === guildId) || null;
  const manageableGuilds = guilds.filter(g => g.owner || g.permissions?.includes('administrator'));

  const handleGuildChange = (id: string) => {
    if (!id || id === guildId) return;
    setSelectedGuildId(id);
    navigate(`/server/${id}/overview`);
  };

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const guildIconUrl = activeGuild?.icon
    ? `https://cdn.discordapp.com/icons/${activeGuild.id}/${activeGuild.icon}.png`
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
          {activeGuild && (
            <div className="desktop-current-guild">
              <span style={{ color: 'var(--border-light)' }}>|</span>
              <img src={guildIconUrl} alt={activeGuild.name} />
              <h2 className="mb-0 fs-5">{activeGuild.name}</h2>
            </div>
          )}
        </div>

        {user && (
          <div className="topbar-user-menu-wrap" ref={userMenuRef}>
            <button
              className="topbar-user-avatar"
              title="Account menu"
              aria-label="Account menu"
              aria-expanded={showUserMenu}
              onClick={() => setShowUserMenu(open => !open)}
              style={{ backgroundImage: user.avatar ? `url(${user.avatar})` : undefined }}
            >
              {!user.avatar && (user.global_name || user.username).charAt(0).toUpperCase()}
            </button>
            {showUserMenu && (
              <div className="topbar-user-menu">
                <div className="user-info">
                  <div className="user-name">{user.global_name || user.username}</div>
                </div>
                <a href="/servers">Servers</a>
                <a href="/profile">Profile</a>
                {user.id === '110637665128325120' && (
                  <a href="/admin" className="admin-link">Admin</a>
                )}
                <button className="logout-btn" onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        )}
      </header>

      {activeGuild && (
        <div className="mobile-guild-bar">
          <div className="mobile-current-guild">
            <img src={guildIconUrl} alt="" />
            <span>{activeGuild.name}</span>
          </div>
          {manageableGuilds.length > 0 && (
            <select
              className="mobile-guild-select"
              aria-label="Switch server"
              value={guildId || activeGuild.id}
              onChange={(event) => handleGuildChange(event.target.value)}
            >
              {manageableGuilds.map(guild => (
                <option key={guild.id} value={guild.id}>{guild.name}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
};
