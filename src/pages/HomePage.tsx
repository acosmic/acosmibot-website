import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/auth';
import '@/styles/home.css';

const DISCORD_INVITE = 'https://discord.com/oauth2/authorize?client_id=1186802023799214223&permissions=8&integration_type=0&scope=bot';
const BTC_ADDRESS = '3GgkQphwJyarorF4tXntXBLYRJNGSkTMfS';

export const HomePage: React.FC = () => {
  const { isAuthenticated, user, token, setToken, setUser, logout } = useAuthStore();

  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [showBitcoinPopup, setShowBitcoinPopup] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: string } | null>(null);

  const userMenuRef = useRef<HTMLButtonElement>(null);

  // ── OAuth redirect: token arrives in URL query param ──────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');

    if (error) {
      showNotif('Login failed. Please try again.', 'error');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    const urlToken = params.get('token');
    if (urlToken) {
      setToken(urlToken);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [setToken]);

  // ── Validate token & load user if needed ─────────────────────
  useEffect(() => {
    if (!token) return;
    if (user) return;

    const apiBase = (window as any).AppConfig?.apiBaseUrl ?? 'https://api.acosmibot.com';
    fetch(`${apiBase}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) throw new Error('unauthorized');
        return r.json();
      })
      .then(data => setUser(data))
      .catch(() => {
        setToken(null);
      });
  }, [token, user, setToken, setUser]);

  // ── Close user menu on outside click ─────────────────────────
  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showUserMenu]);

  // ── Lock body scroll when mobile nav is open ─────────────────
  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileNavOpen]);

  const showNotif = (msg: string, type: string) => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleLogin = () => {
    const apiBase = (window as any).AppConfig?.apiBaseUrl ?? 'https://api.acosmibot.com';
    showNotif('Redirecting to Discord...', 'info');
    window.location.href = `${apiBase}/auth/login`;
  };

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    showNotif('Successfully logged out!', 'info');
  };

  const copyBTC = useCallback(async () => {
    await navigator.clipboard.writeText(BTC_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const DiscordSVG = () => (
    <svg className="discord-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.196.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
      <path d="M8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );

  const svgProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  const Icon = {
    Stream: () => (
      <svg {...svgProps}><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><circle cx="12" cy="20" r="1" /></svg>
    ),
    Tag: () => (
      <svg {...svgProps}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
    ),
    Terminal: () => (
      <svg {...svgProps}><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
    ),
    AI: () => (
      <svg {...svgProps}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6v6H9z" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" /></svg>
    ),
    Coin: () => (
      <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M15 9.5a2.5 2.5 0 0 0-2.5-2.5h-1A2.5 2.5 0 0 0 9 9.5v0A2.5 2.5 0 0 0 11.5 12h1a2.5 2.5 0 0 1 2.5 2.5v0a2.5 2.5 0 0 1-2.5 2.5h-1A2.5 2.5 0 0 1 9 14.5M12 5v2m0 10v2" /></svg>
    ),
    Chart: () => (
      <svg {...svgProps}><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
    ),
    Dice: () => (
      <svg {...svgProps}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" /><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" /><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" /><circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" /></svg>
    ),
    Tools: () => (
      <svg {...svgProps}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
    ),
    Gift: () => (
      <svg {...svgProps}><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z" /></svg>
    ),
    Shield: () => (
      <svg {...svgProps}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
    ),
    Zap: () => (
      <svg {...svgProps}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
    ),
    ArrowRight: () => (
      <svg {...svgProps} width="18" height="18"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
    ),
    Plus: () => (
      <svg {...svgProps} width="18" height="18"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
    ),
    Logout: () => (
      <svg {...svgProps} width="16" height="16"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
    ),
    Copy: () => (
      <svg {...svgProps} width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
    ),
    Check: () => (
      <svg {...svgProps} width="14" height="14"><polyline points="20 6 9 17 4 12" /></svg>
    ),
    Card: () => (
      <svg {...svgProps}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
    ),
    Bitcoin: () => (
      <svg {...svgProps}><circle cx="12" cy="12" r="10" /><path d="M9.5 8h4.25a2 2 0 0 1 0 4H9.5zm0 4h4.75a2 2 0 0 1 0 4H9.5zm0-4v8m2.5-10v2m0 10v2" /></svg>
    ),
    Crown: () => (
      <svg {...svgProps}><path d="M2 7l4 10h12l4-10-6 4-4-7-4 7z" /></svg>
    ),
  };

  return (
    <div className="home-page">

      {/* ── Notification ─────────────────────────────────────── */}
      {notification && (
        <div className={`notification ${notification.type} show`} style={{
          position: 'fixed', top: 80, right: 20, padding: '15px 25px',
          borderRadius: 12, fontWeight: 500, zIndex: 10002, color: 'white',
          background: notification.type === 'error'
            ? 'linear-gradient(135deg,#FF4444,#CC0000)'
            : 'linear-gradient(135deg,#00D9FF,#00A0CC)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        }}>
          {notification.msg}
        </div>
      )}

      {/* ── Mobile Nav Backdrop ─────────────────────────────── */}
      <div
        className={`mobile-nav-backdrop${mobileNavOpen ? ' open' : ''}`}
        onClick={() => setMobileNavOpen(false)}
      />

      {/* ── Mobile Nav Drawer ───────────────────────────────── */}
      <div className={`mobile-nav-drawer${mobileNavOpen ? ' open' : ''}`}>
        <div className="mobile-nav-header">
          <a href="/" className="mobile-nav-logo">
            <img src="/images/acosmibot_website-logo.png" alt="Acosmibot" />
          </a>
          <button className="mobile-nav-close" onClick={() => setMobileNavOpen(false)}>×</button>
        </div>
        <ul className="mobile-nav-links">
          <li><a href="#features" onClick={() => setMobileNavOpen(false)}>Features</a></li>
          <li><button onClick={() => { setMobileNavOpen(false); setShowPremiumModal(true); }}>Premium</button></li>
          <li><a href="/docs/introduction" onClick={() => setMobileNavOpen(false)}>Documentation</a></li>
          {isAuthenticated && (
            <li><a href="/servers" onClick={() => setMobileNavOpen(false)}>Dashboard</a></li>
          )}
          {user?.id === '110637665128325120' && (
            <li><a href="/admin" style={{ color: '#f59e0b' }} onClick={() => setMobileNavOpen(false)}>Admin</a></li>
          )}
        </ul>
        <div className="mobile-nav-divider" />
        <div className="mobile-nav-footer">
          {isAuthenticated && user ? (
            <button
              className="login-btn"
              style={{ width: '100%', justifyContent: 'center', background: 'var(--bg-overlay)', border: '1px solid var(--border-light)', borderRadius: 12, padding: '10px 16px' }}
              onClick={handleLogout}
            >
              <div
                className="user-avatar-nav"
                style={{ backgroundImage: user.avatar ? `url(${user.avatar})` : undefined, width: 32, height: 32 }}
              />
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {user.username}
              </span>
            </button>
          ) : (
            <button className="login-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setMobileNavOpen(false); handleLogin(); }}>
              <DiscordSVG /> Login
            </button>
          )}
        </div>
      </div>

      {/* ── Navigation ──────────────────────────────────────── */}
      <nav>
        <div className="home-container">
          <div className="nav-content">
            <a href="/" className="logo">
              <img src="/images/acosmibot_website-logo.png" alt="Acosmibot" />
            </a>

            <ul className="nav-links">
              <li><a href="#features">Features</a></li>
              <li>
                <a href="#" className="premium-nav-link" onClick={e => { e.preventDefault(); setShowPremiumModal(true); }}>
                  Premium
                </a>
              </li>
              <li><a href="/docs/introduction">Documentation</a></li>
              {isAuthenticated && (
                <li><a href="/servers">Dashboard</a></li>
              )}
              {user?.id === '110637665128325120' && (
                <li><a href="/admin" style={{ color: 'var(--color-warning, #f59e0b)' }}>Admin</a></li>
              )}
            </ul>

            {/* Hamburger */}
            <button
              className={`hamburger-btn${mobileNavOpen ? ' open' : ''}`}
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
            >
              <span /><span /><span />
            </button>

            {/* Login / Avatar */}
            {isAuthenticated && user ? (
              <button
                ref={userMenuRef}
                className="login-btn"
                style={{ padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}
                onClick={() => setShowUserMenu(v => !v)}
              >
                <div
                  className="user-avatar-nav"
                  style={{ backgroundImage: user.avatar ? `url(${user.avatar})` : undefined }}
                />
                {showUserMenu && (
                  <div className="user-menu">
                    <div className="user-info">
                      <div className="user-name">{user.username}</div>
                    </div>
                    <a href="/servers">Dashboard</a>
                    {user.id === '110637665128325120' && (
                      <a href="/admin" style={{ color: '#f59e0b' }}>Admin</a>
                    )}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '5px 0' }} />
                    <button className="logout-btn" onClick={handleLogout}><Icon.Logout /> Logout</button>
                  </div>
                )}
              </button>
            ) : (
              <button className="login-btn" onClick={handleLogin}>
                <DiscordSVG /> Login
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="hero">
        <div className="home-container">
          <div className="hero-content fade-in">
            <h1>Level Up Your Discord Community</h1>
            <p>
              Acosmibot brings engagement, economy, games, and AI-powered interactions to your Discord
              server. Packed with features to keep your community active and entertained.
            </p>
            <div className="hero-buttons">
              <button className="btn btn-primary" onClick={() => window.open(DISCORD_INVITE, '_blank')}>
                Add to Discord <Icon.Plus />
              </button>
              <a href="#features" className="btn btn-secondary">
                Explore Features <Icon.ArrowRight />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section className="features" id="features">
        <div className="home-container">
          <h2 className="section-title fade-in">Powerful Features</h2>
          <p className="section-subtitle fade-in stagger-1">Everything you need to create an engaging Discord community</p>

          <div className="features-grid">
            <div className="feature-card fade-in">
              <div className="feature-icon-wrapper"><Icon.Stream /></div>
              <h3>Streaming Integrations</h3>
              <p>Real-time go-live announcements across the three major streaming platforms, with live viewer counts and automatic VOD links.</p>
              <ul className="feature-list">
                <li>Twitch, YouTube, and Kick support</li>
                <li>Track multiple streamers per server</li>
                <li>Live viewer count updates in-message</li>
                <li>Auto-edits to VOD when stream ends</li>
                <li>Per-streamer mention roles and messages</li>
              </ul>
            </div>

            <div className="feature-card fade-in">
              <div className="feature-icon-wrapper"><Icon.AI /></div>
              <h3>AI Chat & Image Generation</h3>
              <p>OpenAI-powered conversations with persistent memory and a knowledge base unique to each server.</p>
              <ul className="feature-list">
                <li>Mention the bot to start a conversation</li>
                <li>Context-aware threaded memory</li>
                <li>Per-server custom AI personality</li>
                <li>DALL-E image generation on demand</li>
                <li>RAG-powered server knowledge base</li>
              </ul>
            </div>

            <div className="feature-card fade-in">
              <div className="feature-icon-wrapper"><Icon.Chart /></div>
              <h3>Leveling & XP</h3>
              <p>Reward active members with XP, levels, and auto-assigned Discord roles tied to milestones.</p>
              <ul className="feature-list">
                <li>XP from messages, reactions, and commands</li>
                <li>Configurable level-up role rewards</li>
                <li>Per-channel XP multipliers</li>
                <li>Server and global leaderboards</li>
                <li>Per-member stats and rank cards</li>
              </ul>
            </div>

            <div className="feature-card fade-in">
              <div className="feature-icon-wrapper"><Icon.Coin /></div>
              <h3>Economy System</h3>
              <p>A complete in-server currency with daily rewards, banking, member-to-member transfers, and a weekly lottery.</p>
              <ul className="feature-list">
                <li>Daily reward and activity streak bonuses</li>
                <li>Personal balances and server bank</li>
                <li>Member-to-member credit transfers</li>
                <li>Weekly lottery with rolling jackpot</li>
                <li>Economy leaderboards</li>
              </ul>
            </div>

            <div className="feature-card fade-in">
              <div className="feature-icon-wrapper"><Icon.Dice /></div>
              <h3>Games & Gambling</h3>
              <p>A full slate of interactive games and credit-based wagering to keep members engaged.</p>
              <ul className="feature-list">
                <li>Blackjack, Slots, and Coinflip</li>
                <li>Deathroll and Rock Paper Scissors PvP</li>
                <li>Dice rolls and Magic 8-Ball</li>
                <li>Lightweight RPG progression</li>
                <li>Game-specific leaderboards</li>
              </ul>
            </div>

            <div className="feature-card fade-in">
              <div className="feature-icon-wrapper"><Icon.Gift /></div>
              <h3>Giveaways</h3>
              <p>Run timed giveaways with role requirements, multiple winners, and one-click rerolls.</p>
              <ul className="feature-list">
                <li>Configurable duration and winner count</li>
                <li>Required-role entry restrictions</li>
                <li>Live entry tracking</li>
                <li>One-click winner reroll</li>
                <li>Recent giveaways history dashboard</li>
              </ul>
            </div>

            <div className="feature-card fade-in">
              <div className="feature-icon-wrapper"><Icon.Shield /></div>
              <h3>Moderation</h3>
              <p>Tools to keep your community healthy, with full audit logging and a credit-funded jail system.</p>
              <ul className="feature-list">
                <li>Centralized moderation log channel</li>
                <li>Member jail with timed release</li>
                <li>Member-funded bailout mechanic</li>
                <li>Join, leave, and message audit events</li>
                <li>Per-action role and channel controls</li>
              </ul>
            </div>

            <div className="feature-card fade-in">
              <div className="feature-icon-wrapper"><Icon.Tag /></div>
              <h3>Reaction Roles</h3>
              <p>Let members self-assign roles through emoji reactions on a message you control.</p>
              <ul className="feature-list">
                <li>Emoji-to-role mapping per message</li>
                <li>Multiple roles per message</li>
                <li>Add and remove via the same reaction</li>
                <li>Works with custom and Unicode emoji</li>
                <li>Manage from the web dashboard</li>
              </ul>
            </div>

            <div className="feature-card fade-in">
              <div className="feature-icon-wrapper"><Icon.Terminal /></div>
              <h3>Custom Commands</h3>
              <p>Build server-specific slash commands with custom responses, no code required.</p>
              <ul className="feature-list">
                <li>Create commands from the dashboard</li>
                <li>Plain-text or rich embed responses</li>
                <li>Per-server command library</li>
                <li>Edit and disable on the fly</li>
                <li>Usage tracking per command</li>
              </ul>
            </div>

            <div className="feature-card fade-in">
              <div className="feature-icon-wrapper"><Icon.Tools /></div>
              <h3>Utility Tools</h3>
              <p>A grab-bag of everyday helpers — weather, definitions, NASA imagery, GIFs, and personal reminders.</p>
              <ul className="feature-list">
                <li>Weather forecast lookup</li>
                <li>Dictionary definitions</li>
                <li>NASA Astronomy Picture of the Day</li>
                <li>Giphy GIF search</li>
                <li>Personal reminders with delivery</li>
              </ul>
            </div>

            <div className="feature-card fade-in">
              <div className="feature-icon-wrapper"><Icon.Zap /></div>
              <h3>Cross-Server Portals</h3>
              <p>Connect channels across servers, swap nicknames with Polymorph, and discover other communities running the bot.</p>
              <ul className="feature-list">
                <li>Bidirectional message portals</li>
                <li>Portal directory and discovery</li>
                <li>Polymorph nickname swaps</li>
                <li>Credit-gated chaos commands</li>
                <li>Per-channel portal controls</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer>
        <div className="footer-brand">Acosmibot</div>
        <div className="footer-links">
          <a href="/terms-of-service">Terms</a>
          <span className="footer-divider">•</span>
          <a href="/privacy-policy">Privacy</a>
          <span className="footer-divider">•</span>
          <button className="support-link" onClick={() => setShowDonationModal(true)}>
            Support Development
          </button>
        </div>
        <div className="footer-copyright">© 2026 Acosmibot. All rights reserved.</div>
      </footer>

      {/* ── Premium Modal ───────────────────────────────────── */}
      {showPremiumModal && (
        <div className="home-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowPremiumModal(false); }}>
          <div className="premium-modal-content">
            <div className="premium-modal-icon"><Icon.Crown /></div>
            <h2>Premium Coming Soon</h2>
            <p>Premium features are under active development and will be available shortly.</p>
            <p className="p-small">Expect exclusive perks, advanced configuration, and priority support.</p>
            <button className="premium-got-it-btn" onClick={() => setShowPremiumModal(false)}>Got it</button>
          </div>
        </div>
      )}

      {/* ── Donation Modal ──────────────────────────────────── */}
      {showDonationModal && (
        <div className="home-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowDonationModal(false); }}>
          <div className="donation-modal-content">
            <button className="modal-close" onClick={() => setShowDonationModal(false)}>×</button>
            <div className="donation-header">
              <h3>Support Development</h3>
              <p>Help keep Acosmibot growing and improving</p>
            </div>
            <div className="donation-methods">
              <div className="donation-option">
                <div className="method-header">
                  <span className="method-icon"><Icon.Card /></span>
                  <span className="method-name">PayPal</span>
                </div>
                <p className="method-description">Quick and secure donation</p>
                <a href="https://www.paypal.com/ncp/payment/BTN7ZAB3B632G" target="_blank" rel="noreferrer" className="donation-btn paypal-btn">
                  Donate via PayPal
                </a>
              </div>
              <div className="donation-option">
                <div className="method-header">
                  <span className="method-icon"><Icon.Bitcoin /></span>
                  <span className="method-name">Bitcoin</span>
                </div>
                <p className="method-description">Cryptocurrency donation</p>
                <button className="donation-btn crypto-btn" onClick={() => setShowBitcoinPopup(true)}>
                  View Bitcoin Address
                </button>
              </div>
            </div>
            <div className="donation-footer"><p>Thank you for supporting Acosmibot!</p></div>
          </div>
        </div>
      )}

      {/* ── Bitcoin Popup ───────────────────────────────────── */}
      {showBitcoinPopup && (
        <>
          <div className="home-modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowBitcoinPopup(false)} />
          <div className="bitcoin-popup">
            <button className="modal-close" onClick={() => setShowBitcoinPopup(false)}>×</button>
            <h4><span className="bitcoin-popup-icon"><Icon.Bitcoin /></span> Bitcoin Address</h4>
            <p>Send Bitcoin to:</p>
            <div className="crypto-address">
              <input type="text" value={BTC_ADDRESS} readOnly />
              <button className="copy-btn" onClick={copyBTC}>
                {copied ? <><Icon.Check /> Copied</> : <><Icon.Copy /> Copy</>}
              </button>
            </div>
            <p className="popup-note">Thank you for supporting development!</p>
          </div>
        </>
      )}

    </div>
  );
};
