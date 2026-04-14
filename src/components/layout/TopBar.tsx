import React from 'react';
import { useAuthStore } from '@/store/auth';
import { useGuildStore } from '@/store/guild';

export const TopBar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { currentGuild } = useGuildStore();

  return (
    <header className="p-3 d-flex justify-content-between align-items-center" style={{ 
      background: 'rgba(26, 26, 26, 0.95)', 
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-light)',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      <div className="d-flex align-items-center gap-3">
        {currentGuild && (
          <>
            <img 
              src={currentGuild.icon ? `https://cdn.discordapp.com/icons/${currentGuild.id}/${currentGuild.icon}.png` : '/images/acosmibot-logo.png'} 
              alt={currentGuild.name} 
              style={{ height: '32px', borderRadius: '50%' }}
            />
            <h2 className="mb-0 fs-5">{currentGuild.name}</h2>
          </>
        )}
      </div>

      <div className="d-flex align-items-center gap-3">
        {user ? (
          <div className="dropdown">
            <div 
              className="user-avatar-nav" 
              style={{ backgroundImage: `url(https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png)` }}
              title={user.username}
            />
            <div className="user-menu" style={{ display: 'none' }}>
              <div className="user-info">
                <div className="user-name">{user.global_name || user.username}</div>
              </div>
              <a href="#" onClick={logout} className="logout-btn">Logout</a>
            </div>
          </div>
        ) : (
          <button className="login-btn">Login</button>
        )}
      </div>
    </header>
  );
};
