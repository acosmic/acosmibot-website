import React from 'react';
import { useGuildStore } from '@/store/guild';

export const TopBar: React.FC = () => {
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
        {currentGuild ? (
          <>
            <img
              src={currentGuild.icon
                ? `https://cdn.discordapp.com/icons/${currentGuild.id}/${currentGuild.icon}.png`
                : '/images/acosmibot-logo.png'}
              alt={currentGuild.name}
              style={{ height: '32px', borderRadius: '50%' }}
            />
            <h2 className="mb-0 fs-5">{currentGuild.name}</h2>
          </>
        ) : (
          <img src="/images/acosmibot_website-logo.png" alt="Acosmibot" style={{ height: '32px' }} />
        )}
      </div>
    </header>
  );
};
