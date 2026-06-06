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
          background: 'var(--primary-color)', color: '#000', fontSize: '13px', fontWeight: 700,
          border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '7px 16px',
        }}>
          Log In to Claim Yours
        </button>
      )}
    </nav>
  );
};

const NavMenuLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a href={href} style={{
    color: 'var(--text-secondary)', fontSize: '13px', textDecoration: 'none',
    padding: '8px 10px', borderRadius: '8px',
  }}>
    {children}
  </a>
);
