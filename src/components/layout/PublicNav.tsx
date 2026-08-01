import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  CircleDollarSign,
  CircleUserRound,
  LogOut,
  Menu,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { NotificationBell } from '@/components/profile/NotificationBell';
import { DiscordLogo } from '@/components/ui/DiscordLogo';
import { endSession, startLogin, useHydrateAuthUser } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';
import { showToast } from '@/utils/toast';
import '@/styles/public-nav.css';

interface PublicNavProps {
  onLogin?: () => void;
  onLogout?: () => void;
  variant?: 'default' | 'observatory';
}

export const PublicNav: React.FC<PublicNavProps> = ({
  onLogin = startLogin,
  onLogout,
  variant = 'default',
}) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches,
  );
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountPanelRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

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
        const restoreTarget = mobileNavOpen ? hamburgerRef.current : accountTriggerRef.current;
        setMobileNavOpen(false);
        setAccountMenuOpen(false);
        window.requestAnimationFrame(() => restoreTarget?.focus());
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileNavOpen, accountMenuOpen]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (mobileNavOpen || (accountMenuOpen && isMobileViewport)) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen, accountMenuOpen, isMobileViewport]);

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 768px)');
    const handleViewportChange = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches);
      if (!event.matches) setMobileNavOpen(false);
    };

    mobileQuery.addEventListener('change', handleViewportChange);
    return () => mobileQuery.removeEventListener('change', handleViewportChange);
  }, []);

  useEffect(() => {
    const activeOverlay = mobileNavOpen
      ? drawerRef.current
      : accountMenuOpen && isMobileViewport
        ? accountPanelRef.current
        : null;

    if (!activeOverlay) return;

    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const getFocusable = () => Array.from(
      activeOverlay.querySelectorAll<HTMLElement>(focusableSelector),
    ).filter((element) => element.getAttribute('aria-hidden') !== 'true');

    const focusFrame = window.requestAnimationFrame(() => {
      const initialTarget = mobileNavOpen ? drawerCloseRef.current : getFocusable()[0];
      initialTarget?.focus();
    });

    const containFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (!activeOverlay.contains(activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', containFocus);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', containFocus);
    };
  }, [accountMenuOpen, isMobileViewport, mobileNavOpen]);

  useEffect(() => {
    setMobileNavOpen(false);
    setAccountMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await endSession();
      setMobileNavOpen(false);
      setAccountMenuOpen(false);
      onLogout?.();
      navigate('/');
    } catch {
      showToast('Could not log out. Your session is still active; please try again.', 'error');
    }
  };

  const featuresHref = pathname === '/' ? '#system-map' : '/#system-map';

  return (
    <>
      <div
        className={`public-nav__backdrop${mobileNavOpen ? ' open' : ''}`}
        onClick={() => {
          setMobileNavOpen(false);
          window.requestAnimationFrame(() => hamburgerRef.current?.focus());
        }}
        aria-hidden="true"
      />
      <div
        className={`public-nav__account-backdrop${accountMenuOpen ? ' open' : ''}`}
        onClick={() => {
          setAccountMenuOpen(false);
          window.requestAnimationFrame(() => accountTriggerRef.current?.focus());
        }}
        aria-hidden="true"
      />

      <aside
        id="public-mobile-navigation"
        ref={drawerRef}
        className={`public-nav__drawer public-nav__drawer--observatory${mobileNavOpen ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-mobile-navigation-title"
        aria-hidden={!mobileNavOpen}
      >
        <div className="public-nav__drawer-header">
          <div>
            <span>Site coordinates</span>
            <strong id="public-mobile-navigation-title">Navigate Acosmibot</strong>
          </div>
          <button
            ref={drawerCloseRef}
            type="button"
            className="public-nav__drawer-close"
            onClick={() => {
              setMobileNavOpen(false);
              window.requestAnimationFrame(() => hamburgerRef.current?.focus());
            }}
            aria-label="Close menu"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <nav
          className="public-nav__drawer-body"
          aria-label="Mobile navigation"
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest('a')) {
              setMobileNavOpen(false);
            }
          }}
        >
          <span className="public-nav__drawer-section-label">Explore</span>
          <ul className="public-nav__drawer-links">
            <li>
              <a href={featuresHref} onClick={() => setMobileNavOpen(false)}>
                <Sparkles aria-hidden="true" />
                <span>Features</span>
                <i aria-hidden="true" />
              </a>
            </li>
            <li>
              <NavLink to="/pricing">
                <CircleDollarSign aria-hidden="true" />
                <span>Pricing</span>
                <i aria-hidden="true" />
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/introduction"
                className={pathname.startsWith('/docs/') ? 'active' : undefined}
                aria-current={pathname.startsWith('/docs/') ? 'page' : undefined}
              >
                <BookOpen aria-hidden="true" />
                <span>Documentation</span>
                <i aria-hidden="true" />
              </NavLink>
            </li>
            <li>
              <NavLink to="/leaderboard">
                <BarChart3 aria-hidden="true" />
                <span>Leaderboards</span>
                <i aria-hidden="true" />
              </NavLink>
            </li>
          </ul>

          {isAuthenticated && (
            <>
              <span className="public-nav__drawer-section-label">Your signal</span>
              <ul className="public-nav__drawer-links">
                <li>
                  <NavLink
                    to="/servers"
                    className={
                      pathname === '/servers' || pathname.startsWith('/server/')
                        ? 'active'
                        : undefined
                    }
                    aria-current={
                      pathname === '/servers' || pathname.startsWith('/server/')
                        ? 'page'
                        : undefined
                    }
                  >
                    <Server aria-hidden="true" />
                    <span>Servers</span>
                    <i aria-hidden="true" />
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/me">
                    <CircleUserRound aria-hidden="true" />
                    <span>Profile</span>
                    <i aria-hidden="true" />
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/achievements">
                    <Trophy aria-hidden="true" />
                    <span>Achievements</span>
                    <i aria-hidden="true" />
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/settings">
                    <Settings aria-hidden="true" />
                    <span>Settings</span>
                    <i aria-hidden="true" />
                  </NavLink>
                </li>
                {user?.is_admin && (
                  <li>
                    <NavLink className="public-nav__admin-link" to="/admin">
                      <ShieldCheck aria-hidden="true" />
                      <span>Admin</span>
                      <i aria-hidden="true" />
                    </NavLink>
                  </li>
                )}
              </ul>
            </>
          )}
        </nav>

        <div className="public-nav__drawer-footer">
          {isAuthenticated && user ? (
            <div className="public-nav__drawer-session">
              <Link className="public-nav__drawer-account" to="/me" onClick={() => setMobileNavOpen(false)}>
                <span
                  className="public-nav__drawer-avatar"
                  style={{ backgroundImage: user.avatar ? `url(${user.avatar})` : undefined }}
                  aria-hidden="true"
                >
                  {!user.avatar && user.username.slice(0, 1).toUpperCase()}
                </span>
                <span className="public-nav__drawer-account-copy">
                  <span>{user.global_name || user.username}</span>
                  <small>@{user.username} · connected</small>
                </span>
              </Link>
              <button type="button" className="public-nav__drawer-logout" onClick={handleLogout} aria-label="Log out">
                <LogOut aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              ref={hamburgerRef}
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

      <nav
        className={`public-nav${variant === 'observatory' ? ' public-nav--observatory' : ''}`}
        aria-label="Primary navigation"
      >
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
              onClick={() => {
                setAccountMenuOpen(false);
                setMobileNavOpen((open) => !open);
              }}
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileNavOpen}
              aria-controls="public-mobile-navigation"
            >
              {mobileNavOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
              <span className="public-nav__hamburger-signal" aria-hidden="true" />
            </button>

            {isAuthenticated && user ? (
              <div className="public-nav__account-area">
                <NotificationBell username={user.username} />
                <div className="public-nav__account" ref={accountMenuRef}>
                  <button
                    ref={accountTriggerRef}
                    type="button"
                    className="public-nav__account-trigger"
                    onClick={() => {
                      setMobileNavOpen(false);
                      setAccountMenuOpen((open) => !open);
                    }}
                    aria-label={`${accountMenuOpen ? 'Close' : 'Open'} account menu for ${user.username}`}
                    aria-expanded={accountMenuOpen}
                    aria-controls="public-account-navigation"
                  >
                    <span
                      className="public-nav__avatar"
                      style={{ backgroundImage: user.avatar ? `url(${user.avatar})` : undefined }}
                      aria-hidden="true"
                    >
                      {!user.avatar && user.username.slice(0, 1).toUpperCase()}
                    </span>
                    <ChevronDown className="public-nav__account-chevron" aria-hidden="true" />
                  </button>

                  {accountMenuOpen && (
                    <div
                      id="public-account-navigation"
                      ref={accountPanelRef}
                      className="public-nav__account-menu"
                      role="dialog"
                      aria-modal={isMobileViewport ? 'true' : undefined}
                      aria-label="Account navigation"
                      onClick={(event) => {
                        if (event.target instanceof Element && event.target.closest('a')) {
                          setAccountMenuOpen(false);
                        }
                      }}
                    >
                      <div className="public-nav__account-identity">
                        <span
                          className="public-nav__account-menu-avatar"
                          style={{ backgroundImage: user.avatar ? `url(${user.avatar})` : undefined }}
                          aria-hidden="true"
                        >
                          {!user.avatar && user.username.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="public-nav__account-identity-copy">
                          <strong>{user.global_name || user.username}</strong>
                          <small>@{user.username}</small>
                        </span>
                        <span className="public-nav__account-online" aria-label="Discord connected" />
                      </div>

                      <span className="public-nav__account-group-label">Member signal</span>
                      <Link to="/me"><CircleUserRound aria-hidden="true" /><span>My Profile</span></Link>
                      <Link to="/achievements"><Trophy aria-hidden="true" /><span>Achievements</span></Link>
                      <Link to="/leaderboard"><BarChart3 aria-hidden="true" /><span>Leaderboards</span></Link>

                      <span className="public-nav__account-group-label">Workspace</span>
                      <Link to="/servers"><Server aria-hidden="true" /><span>Servers</span></Link>
                      <Link to="/settings"><Settings aria-hidden="true" /><span>Settings</span></Link>
                      <Link to="/docs/introduction"><BookOpen aria-hidden="true" /><span>Docs</span></Link>
                      {user.is_admin && (
                        <Link className="public-nav__admin-link" to="/admin">
                          <ShieldCheck aria-hidden="true" /><span>Admin</span>
                        </Link>
                      )}

                      <div className="public-nav__account-divider" />
                      <button type="button" className="public-nav__logout" onClick={handleLogout}>
                        <LogOut aria-hidden="true" /><span>Logout</span>
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
