import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { NotificationBell } from '@/components/profile/NotificationBell';
import { DiscordLogo } from '@/components/ui/DiscordLogo';
import { startLogin, useHydrateAuthUser } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';
import '@/styles/public-nav.css';

interface PublicNavProps {
  onLogin?: () => void;
  onLogout?: () => void;
}

export const PublicNav: React.FC<PublicNavProps> = ({
  onLogin = startLogin,
  onLogout,
}) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuthStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useHydrateAuthUser();

  useEffect(() => {
    if (!accountMenuOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!mobileNavOpen && !accountMenuOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileNavOpen(false);
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileNavOpen, accountMenuOpen]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (mobileNavOpen) document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    setMobileNavOpen(false);
    setAccountMenuOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    logout();
    setMobileNavOpen(false);
    setAccountMenuOpen(false);
    onLogout?.();
    navigate('/');
  };

  const featuresHref = pathname === '/' ? '#features' : '/#features';

  return (
    <>
      <div
        className={`public-nav__backdrop${mobileNavOpen ? ' open' : ''}`}
        onClick={() => setMobileNavOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`public-nav__drawer${mobileNavOpen ? ' open' : ''}`}
        aria-hidden={!mobileNavOpen}
      >
        <div className="public-nav__drawer-header">
          <Link to="/" className="public-nav__drawer-logo" onClick={() => setMobileNavOpen(false)}>
            <img src="/images/acosmibot_website-logo.png" alt="Acosmibot" />
          </Link>
          <button
            type="button"
            className="public-nav__drawer-close"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <ul className="public-nav__drawer-links">
          <li><a href={featuresHref} onClick={() => setMobileNavOpen(false)}>Features</a></li>
          <li><Link to="/pricing">Pricing</Link></li>
          <li><Link to="/docs/introduction">Documentation</Link></li>
          <li><Link to="/leaderboard">Leaderboards</Link></li>
          {isAuthenticated && (
            <>
              <li><Link to="/servers">Servers</Link></li>
              <li><Link to="/me">Profile</Link></li>
            </>
          )}
          {user?.is_admin && (
            <li><Link className="public-nav__admin-link" to="/admin">Admin</Link></li>
          )}
        </ul>

        <div className="public-nav__drawer-footer">
          {isAuthenticated && user ? (
            <button type="button" className="public-nav__drawer-account" onClick={handleLogout}>
              <span
                className="public-nav__drawer-avatar"
                style={{ backgroundImage: user.avatar ? `url(${user.avatar})` : undefined }}
                aria-hidden="true"
              >
                {!user.avatar && user.username.slice(0, 1).toUpperCase()}
              </span>
              <span className="public-nav__drawer-account-copy">
                <span>{user.username}</span>
                <small>Log out</small>
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="public-nav__login public-nav__drawer-login"
              onClick={() => {
                setMobileNavOpen(false);
                onLogin();
              }}
            >
              <DiscordLogo className="public-nav__discord-icon" /> Login
            </button>
          )}
        </div>
      </aside>

      <nav className="public-nav" aria-label="Primary navigation">
        <div className="public-nav__container">
          <div className="public-nav__content">
            <Link to="/" className="public-nav__logo">
              <img src="/images/acosmibot_website-logo.png" alt="Acosmibot" />
            </Link>

            <ul className="public-nav__links">
              <li><a href={featuresHref}>Features</a></li>
              <li><Link to="/pricing">Pricing</Link></li>
              <li><Link to="/docs/introduction">Documentation</Link></li>
              <li><Link to="/leaderboard">Leaderboards</Link></li>
              {isAuthenticated && <li><Link to="/servers">Servers</Link></li>}
              {user?.is_admin && (
                <li><Link className="public-nav__admin-link" to="/admin">Admin</Link></li>
              )}
            </ul>

            <button
              type="button"
              className={`public-nav__hamburger${mobileNavOpen ? ' open' : ''}`}
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileNavOpen}
            >
              <span /><span /><span />
            </button>

            {isAuthenticated && user ? (
              <div className="public-nav__account-area">
                <NotificationBell username={user.username} />
                <div className="public-nav__account" ref={accountMenuRef}>
                  <button
                    type="button"
                    className="public-nav__account-trigger"
                    onClick={() => setAccountMenuOpen((open) => !open)}
                    aria-label={`Open account menu for ${user.username}`}
                    aria-expanded={accountMenuOpen}
                  >
                    <span
                      className="public-nav__avatar"
                      style={{ backgroundImage: user.avatar ? `url(${user.avatar})` : undefined }}
                      aria-hidden="true"
                    >
                      {!user.avatar && user.username.slice(0, 1).toUpperCase()}
                    </span>
                  </button>

                  {accountMenuOpen && (
                    <div className="public-nav__account-menu">
                      <div className="public-nav__account-name">{user.username}</div>
                      <Link to="/me">My Profile</Link>
                      <Link to="/achievements">Achievements</Link>
                      <Link to="/leaderboard">Leaderboards</Link>
                      <Link to="/servers">Servers</Link>
                      <Link to="/settings">Settings</Link>
                      <Link to="/docs/introduction">Docs</Link>
                      {user.is_admin && <Link className="public-nav__admin-link" to="/admin">Admin</Link>}
                      <div className="public-nav__account-divider" />
                      <button type="button" className="public-nav__logout" onClick={handleLogout}>
                        <LogoutIcon /> Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button type="button" className="public-nav__login" onClick={onLogin}>
                <DiscordLogo className="public-nav__discord-icon" /> Login
              </button>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};

const LogoutIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
