import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { NotificationBell } from '@/components/profile/NotificationBell';
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
              <DiscordLogo /> Login
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
                <DiscordLogo /> Login
              </button>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};

const DiscordLogo: React.FC = () => (
  <svg className="public-nav__discord-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.196.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const LogoutIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
