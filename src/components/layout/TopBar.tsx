import React from 'react';
import { Link } from 'react-router-dom';
import { useGuildStore } from '@/store/guild';

interface TopBarProps {
  onMenuClick?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  const { currentGuild } = useGuildStore();

  return (
    <header style={{
      height: '56px',
      background: 'rgba(26, 26, 26, 0.95)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-light)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
    }}>
      <div className="d-flex align-items-center gap-3">
        <button
          className="topbar-hamburger"
          onClick={onMenuClick}
          aria-label="Open menu"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: '4px 8px',
            fontSize: '20px',
            lineHeight: 1,
            display: 'none',
          }}
        >
          ☰
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

