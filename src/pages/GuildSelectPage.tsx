import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGuildStore } from '@/store/guild';

export const GuildSelectPage: React.FC = () => {
  const navigate = useNavigate();
  const { guilds } = useGuildStore();

  const handleSelect = (guildId: string) => {
    navigate(`/server/${guildId}/overview`);
  };

  return (
    <div className="guild-select-page min-vh-100 d-flex flex-column" style={{ background: 'var(--bg-primary)' }}>
      <nav className="p-3 border-bottom border-light">
        <div className="container d-flex justify-content-between align-items-center">
          <a href="/" className="logo"><img src="/images/acosmibot_website-logo.png" alt="Acosmibot" style={{ height: '32px' }} /></a>
          <h2 className="mb-0 fs-5">Select a Server</h2>
          <div style={{ width: '40px' }}></div>
        </div>
      </nav>

      <div className="container py-5">
        <div className="text-center mb-5">
          <h1 className="fw-bold fs-2 mb-2">Your Discord Servers</h1>
          <p className="text-muted">Choose a server to manage its settings and view stats.</p>
        </div>

        <div className="row g-4 justify-content-center">
          {guilds.map((guild) => (
            <div key={guild.id} className="col-md-4 col-lg-3">
              <div 
                className="card h-100 p-4 text-center d-flex flex-column align-items-center justify-content-center"
                style={{ cursor: 'pointer', transition: 'all 0.2s ease', background: 'var(--bg-secondary)' }}
                onClick={() => handleSelect(guild.id)}
              >
                <div 
                  className="guild-avatar mb-3" 
                  style={{ 
                    width: '80px', 
                    height: '80px', 
                    borderRadius: '50%', 
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: 'var(--bg-tertiary)',
                    backgroundImage: guild.icon ? `url(https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png)` : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                    fontWeight: 'bold'
                  }}
                >
                  {!guild.icon && guild.name.charAt(0).toUpperCase()}
                </div>
                <h3 className="fs-5 fw-bold mb-2 text-truncate w-100">{guild.name}</h3>
                <div className="badge bg-primary px-3 py-2 rounded-pill small">Manage</div>
              </div>
            </div>
          ))}
          {guilds.length === 0 && (
            <div className="text-center p-5">
              <p className="text-muted mb-4">No servers found where you have permissions.</p>
              <button 
                className="btn primary py-3 px-5" 
                onClick={() => window.open('https://discord.com/oauth2/authorize?client_id=1186802023799214223&permissions=8&integration_type=0&scope=bot', '_blank')}
              >
                Invite Acosmibot to a Server
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
