import React from 'react';
import { Link } from 'react-router-dom';
import { useGuildStore } from '@/store/guild';

interface TopBarProps {
  onMenuClick?: () => void;
  menuOpen?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick, menuOpen }) => {
  const { currentGuild } = useGuildStore();

  return (
    <header style={{
      height: '56px',
      background: 'rgba(26, 26, 26, 0.95)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-light)',
      position: 'sticky',
      top: 0,
      zIndex: 1002,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
    }}>
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
          <>
            <span style={{ color: 'var(--border-light)' }}>|</span>
            <img
              src={currentGuild.icon
                ? `https://cdn.discordapp.com/icons/${currentGuild.id}/${currentGuild.icon}.png`
                : '/images/acosmibot-logo.png'}
              alt={currentGuild.name}
              style={{ height: '32px', borderRadius: '50%' }}
            />
            <h2 className="mb-0 fs-5" style={{ color: 'var(--text-primary)' }}>{currentGuild.name}</h2>
          </>
        )}
      </div>
    </header>
  );
};
