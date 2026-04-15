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
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '5px 0' }} />
                    <button className="logout-btn" onClick={handleLogout}>🚪 Logout</button>
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
                Add to Discord <span>🚀</span>
              </button>
              <a href="#features" className="btn btn-secondary">
                Explore Features <span>⭐</span>
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
            <div className="feature-card fade-in stagger-1">
              <span className="feature-icon">📺</span>
              <h3>Twitch Integration</h3>
              <p>Get notified when your favorite streamers go live with automatic announcements to your server.</p>
              <ul className="feature-list">
                <li>Live stream notifications</li>
                <li>Track multiple streamers</li>
                <li>Constantly updates viewer count</li>
                <li>Edits post when stream ends with VOD</li>
                <li>Customizable notification messages</li>
              </ul>
            </div>

            <div className="feature-card fade-in stagger-2">
              <span className="feature-icon">🎭</span>
              <h3>Reaction Roles</h3>
              <p>Let members self-assign roles with emoji reactions, buttons, or dropdown menus.</p>
              <ul className="feature-list">
                <li>Emoji-based role assignment</li>
                <li>Button role menus</li>
                <li>Dropdown role selectors</li>
                <li>Multiple roles per interaction</li>
                <li>Fully customizable messages</li>
              </ul>
            </div>

            <div className="feature-card fade-in stagger-3">
              <span className="feature-icon">🛠️</span>
              <h3>Custom Commands</h3>
              <p>Create server-specific commands with custom responses tailored to your community.</p>
              <ul className="feature-list">
                <li>Create custom bot commands</li>
                <li>Custom responses and actions</li>
                <li>Easy command management</li>
                <li>Server-specific functionality</li>
                <li>Simple command syntax</li>
              </ul>
            </div>

            <div className="feature-card fade-in stagger-1">
              <span className="feature-icon">🤖</span>
              <h3>AI Chat & Image Generation</h3>
              <p>Powered by OpenAI with conversational memory, custom personalities, and DALL-E image generation.</p>
              <ul className="feature-list">
                <li>Chat with AI by mentioning the bot</li>
                <li>Context-aware conversations</li>
                <li>Custom AI personality per server</li>
                <li>DALL-E image generation</li>
                <li>Multiple AI models available</li>
              </ul>
            </div>

            <div className="feature-card fade-in stagger-2">
              <span className="feature-icon">💰</span>
              <h3>Economy System</h3>
              <p>A complete fake currency system with credits, banking, and member-to-member transactions.</p>
              <ul className="feature-list">
                <li>Daily Reward</li>
                <li>Activity Streak counter</li>
                <li>Server bank system</li>
                <li>Lottery System</li>
                <li>Economy leaderboards</li>
              </ul>
            </div>

            <div className="feature-card fade-in stagger-3">
              <span className="feature-icon">📊</span>
              <h3>Leveling & XP System</h3>
              <p>Reward active members with experience points, levels, and automatic role assignments.</p>
              <ul className="feature-list">
                <li>Participation-based leveling</li>
                <li>XP points for chatting & commands</li>
                <li>Auto-applied Discord roles</li>
                <li>Interactive leaderboards</li>
                <li>Member statistics tracking</li>
              </ul>
            </div>

            <div className="feature-card fade-in stagger-1">
              <span className="feature-icon">🎮</span>
              <h3>Games & Gambling</h3>
              <p>Keep your community entertained with interactive games and a complete economy system.</p>
              <ul className="feature-list">
                <li>Coinflip, Deathroll, Rock Paper Scissors</li>
                <li>Magic 8Ball predictions</li>
                <li>Weekly lottery system</li>
                <li>Player vs Player betting games</li>
                <li>Slot machine gambling</li>
              </ul>
            </div>

            <div className="feature-card fade-in stagger-2">
              <span className="feature-icon">🔧</span>
              <h3>Utility Tools</h3>
              <p>Helpful everyday tools including weather forecasts, definitions, NASA imagery, and more.</p>
              <ul className="feature-list">
                <li>Weather information lookup</li>
                <li>Dictionary definitions</li>
                <li>NASA Astronomy Picture of the Day</li>
                <li>GIF search with Giphy</li>
                <li>Personal reminders system</li>
              </ul>
            </div>

            <div className="feature-card fade-in stagger-3">
              <span className="feature-icon">🌀</span>
              <h3>Chaos Features</h3>
              <p>Unleash fun chaos with cross-server portals and the power to transform other members' nicknames.</p>
              <ul className="feature-list">
                <li>Cross-server portals</li>
                <li>Send messages between servers</li>
                <li>Polymorph command (change nicknames)</li>
                <li>Portal search and discovery</li>
                <li>Costs Credits for maximum fun</li>
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
            Support Development ☕
          </button>
        </div>
        <div className="footer-copyright">© 2026 Acosmibot. All rights reserved.</div>
      </footer>

      {/* ── Premium Modal ───────────────────────────────────── */}
      {showPremiumModal && (
        <div className="home-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowPremiumModal(false); }}>
          <div className="premium-modal-content">
            <div style={{ fontSize: 64, marginBottom: 15 }}>✨</div>
            <h2>Premium Coming Soon!</h2>
            <p>Premium features are currently under development and will be available soon.</p>
            <p className="p-small">Stay tuned for exclusive perks, advanced features, and enhanced functionality!</p>
            <button className="premium-got-it-btn" onClick={() => setShowPremiumModal(false)}>Got it!</button>
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
                  <span className="method-icon">💳</span>
                  <span className="method-name">PayPal</span>
                </div>
                <p className="method-description">Quick and secure donation</p>
                <a href="https://www.paypal.com/ncp/payment/BTN7ZAB3B632G" target="_blank" rel="noreferrer" className="donation-btn paypal-btn">
                  Donate via PayPal
                </a>
              </div>
              <div className="donation-option">
                <div className="method-header">
                  <span className="method-icon">₿</span>
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
            <h4>₿ Bitcoin Address</h4>
            <p>Send Bitcoin to:</p>
            <div className="crypto-address">
              <input type="text" value={BTC_ADDRESS} readOnly />
              <button className="copy-btn" onClick={copyBTC}>{copied ? '✓ Copied' : '📋 Copy'}</button>
            </div>
            <p className="popup-note">Thank you for supporting development!</p>
          </div>
        </>
      )}

    </div>
  );
};
