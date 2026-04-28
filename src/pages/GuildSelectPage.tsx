import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGuildStore } from '@/store/guild';
import { useAuthStore } from '@/store/auth';
import { guildApi } from '@/api/guilds';

const INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1186802023799214223&permissions=8&integration_type=0&scope=bot';

export const GuildSelectPage: React.FC = () => {
  const navigate = useNavigate();
  const { guilds, setGuilds, setSelectedGuildId } = useGuildStore();
  const { isAuthenticated, user, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    guildApi.getGuilds().then(setGuilds).catch(console.error);
  }, [isAuthenticated, navigate, setGuilds]);

  const handleManage = (guildId: string) => {
    setSelectedGuildId(guildId);
    navigate(`/server/${guildId}/overview`);
  };

  const sorted = [...guilds].sort((a, b) => {
    const score = (g: typeof a) =>
      g.owner ? 2 : g.permissions?.includes('administrator') ? 1 : 0;
    return score(b) - score(a);
  });

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Top nav */}
      <nav style={{
        height: '56px',
        background: 'rgba(26,26,26,0.95)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src="/images/acosmibot_website-logo.png" alt="Acosmibot" style={{ height: '32px' }} />
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                backgroundImage: user.avatar ? `url(${user.avatar})` : 'none',
                backgroundSize: 'cover',
                backgroundColor: 'var(--bg-tertiary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', fontWeight: 'bold', color: 'white',
              }}>
                {!user.avatar && (user.global_name || user.username).charAt(0).toUpperCase()}
              </div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                {user.global_name || user.username}
              </span>
            </div>
          )}
          <button
            onClick={logout}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-light)',
              color: 'var(--text-secondary)',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Log Out
          </button>
        </div>
      </nav>

      <div style={{ flex: 1, padding: '48px 24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Your Discord Servers
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
            Choose a server to manage its settings and view stats.
          </p>
        </div>

        {/* Empty state */}
        {sorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🤖</div>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '12px' }}>No servers found</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
              Add Acosmibot to a server you own or manage to get started.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
              {[
                ['1', 'Own or manage a Discord server', 'Create one at discord.com if you don\'t have one.'],
                ['2', 'Add Acosmibot to your server', 'Click the button below to invite the bot.'],
                ['3', 'Come back and configure', 'Refresh this page to see your server.'],
              ].map(([n, title, desc]) => (
                <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', maxWidth: '400px', textAlign: 'left' }}>
                  <span style={{
                    width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary-color)',
                    color: '#000', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0,
                  }}>{n}</span>
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '2px' }}>{title}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => window.open(INVITE_URL, '_blank')}
              style={{
                background: 'var(--primary-color)', color: '#000', border: 'none',
                borderRadius: '10px', padding: '14px 32px', fontSize: '15px',
                fontWeight: 700, cursor: 'pointer',
              }}
            >
              ➕ Add Acosmibot to a Server
            </button>
          </div>
        )}

        {/* Guild grid */}
        {sorted.length > 0 && (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '32px',
            }}>
              {sorted.map(guild => {
                const isOwner = guild.owner;
                const isAdmin = guild.permissions?.includes('administrator');

                return (
                  <div
                    key={guild.id}
                    onClick={() => handleManage(guild.id)}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '16px',
                      padding: '24px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary-color)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-light)')}
                  >
                    {/* Premium badge */}
                    {guild.premium_tier && guild.premium_tier !== 'free' && (
                      <span style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '16px' }}
                        title={guild.premium_tier === 'premium_plus_ai' ? 'Premium + AI' : 'Premium'}>
                        {guild.premium_tier === 'premium_plus_ai' ? '🤖💎' : '💎'}
                      </span>
                    )}

                    {/* Guild icon */}
                    <div style={{
                      width: '72px', height: '72px', borderRadius: '50%',
                      backgroundImage: guild.icon
                        ? `url(https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128)`
                        : 'none',
                      backgroundSize: 'cover',
                      backgroundColor: 'var(--bg-tertiary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '28px', fontWeight: 'bold', color: 'white', flexShrink: 0,
                    }}>
                      {!guild.icon && guild.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Name */}
                    <div style={{
                      fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)',
                      textAlign: 'center', wordBreak: 'break-word', lineHeight: 1.3,
                    }}>
                      {guild.name}
                    </div>

                    {/* Member count */}
                    {guild.member_count !== undefined && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {guild.member_count.toLocaleString()} members
                      </div>
                    )}

                    {/* Role badge */}
                    <span style={{
                      fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '12px',
                      background: isOwner ? 'rgba(0,217,255,0.15)' : 'rgba(255,255,255,0.08)',
                      color: isOwner ? 'var(--primary-color)' : 'var(--text-secondary)',
                      border: `1px solid ${isOwner ? 'var(--border-cyan)' : 'var(--border-light)'}`,
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                    }}>
                      {isOwner ? 'Owner' : isAdmin ? 'Admin' : 'Member'}
                    </span>

                    {/* Action button */}
                    {(isOwner || isAdmin) ? (
                      <button style={{
                        background: 'var(--primary-color)', color: '#000', border: 'none',
                        borderRadius: '8px', padding: '8px 20px', fontSize: '13px',
                        fontWeight: 700, cursor: 'pointer', width: '100%', marginTop: '4px',
                      }}>
                        Manage
                      </button>
                    ) : (
                      <button style={{
                        background: 'transparent', color: 'var(--text-primary)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '8px', padding: '8px 20px', fontSize: '13px',
                        fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: '4px',
                      }}>
                        View Stats
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Add to another server card */}
              <div
                onClick={() => window.open(INVITE_URL, '_blank')}
                style={{
                  background: 'transparent',
                  border: '2px dashed var(--border-light)',
                  borderRadius: '16px',
                  padding: '24px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minHeight: '220px',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary-color)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-light)')}
              >
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: 'var(--bg-overlay)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px',
                }}>
                  ➕
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', fontWeight: 500 }}>
                  Add to another server
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
