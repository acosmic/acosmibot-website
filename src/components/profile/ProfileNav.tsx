import React, { useEffect, useRef, useState } from 'react';
import { startLogin } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';

export type NavUser = { id: string; username: string; avatar: string | null; global_name: string | null };

/**
 * Shared top nav for the profile + settings routes (which aren't inside the
 * dashboard chrome). Shows an avatar dropdown (My Profile / Settings / Servers /
 * Logout) when signed in, or a "Log In to Claim Yours" button otherwise.
 */
export const ProfileNav: React.FC<{ user: NavUser | null }> = ({ user }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const logout = useAuthStore((s) => s.logout);

  // Close the dropdown on any outside click (matches the home-screen menu).
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <nav style={{
      height: '56px', background: 'rgba(26,26,26,0.95)', backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 100,
    }}>
      <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
        <img src="/images/acosmibot_website-logo.png" alt="Acosmibot" style={{ height: '32px' }} />
      </a>

      {user ? (
        <div ref={ref} style={{ position: 'relative' }}>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Account menu"
            style={{
              width: '34px', height: '34px', borderRadius: '50%', padding: 0, cursor: 'pointer',
              border: '2px solid var(--border-cyan)', overflow: 'hidden',
              background: user.avatar ? `url(${user.avatar}) center/cover` : 'var(--bg-tertiary)',
            }}
          />
          {open && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: '180px',
              background: 'var(--bg-card)', border: '1px solid var(--border-light)',
              borderRadius: '12px', padding: '8px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
              display: 'flex', flexDirection: 'column', gap: '2px', zIndex: 200,
            }}>
              <div style={{
                padding: '6px 10px 8px', fontSize: '13px', fontWeight: 700,
                color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)',
                marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {user.global_name || user.username}
              </div>
              <NavMenuLink href={`/u/${user.username}`}>My Profile</NavMenuLink>
              <NavMenuLink href="/leaderboard">Leaderboards</NavMenuLink>
              <NavMenuLink href="/settings">Settings</NavMenuLink>
              <NavMenuLink href="/servers">Servers</NavMenuLink>
              <button
                onClick={() => { logout(); window.location.href = '/'; }}
                style={{
                  textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#ff6b6b', fontSize: '13px', padding: '8px 10px', borderRadius: '8px',
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      ) : (
        <button onClick={startLogin} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--primary-color)', color: '#000', fontSize: '13px', fontWeight: 700,
          border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '7px 16px',
        }}>
          <DiscordLogo /> Login
        </button>
      )}
    </nav>
  );
};

/** Discord wordmark glyph, sized for inline use in buttons. */
export const DiscordLogo: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.196.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const NavMenuLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a href={href} style={{
    color: 'var(--text-secondary)', fontSize: '13px', textDecoration: 'none',
    padding: '8px 10px', borderRadius: '8px',
  }}>
    {children}
  </a>
);
