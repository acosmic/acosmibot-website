import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import '@/styles/docs.css';

// ── Navigation structure (mirrors docs-search.js) ──────────────
const NAV_SECTIONS = [
  {
    category: 'Getting Started',
    items: [
      { slug: 'introduction', label: 'Introduction' },
      { slug: 'quick-start',  label: 'Quick Start' },
    ],
  },
  {
    category: 'Core Systems',
    items: [
      { slug: 'leveling',   label: 'Leveling System' },
      { slug: 'economy',    label: 'Economy & Banking' },
      { slug: 'moderation', label: 'Moderation' },
      { slug: 'ai',         label: 'AI Integration' },
    ],
  },
  {
    category: 'Social Alerts',
    items: [
      { slug: 'twitch',  label: 'Twitch Integration' },
      { slug: 'youtube', label: 'YouTube Integration' },
      { slug: 'kick',    label: 'Kick Integration' },
    ],
  },
  {
    category: 'Games & Gambling',
    items: [
      { slug: 'slots',     label: 'Slots' },
      { slug: 'lottery',   label: 'Lottery' },
      { slug: 'blackjack', label: 'Blackjack' },
      { slug: 'coinflip',  label: 'Coinflip' },
      { slug: 'deathroll', label: 'Deathroll' },
    ],
  },
  {
    category: 'Utilities',
    items: [
      { slug: 'reaction-roles',    label: 'Reaction Roles' },
      { slug: 'custom-commands',   label: 'Custom Commands' },
      { slug: 'embeds',            label: 'Better Embeds' },
      { slug: 'reminders',         label: 'Reminders' },
    ],
  },
  {
    category: 'Chaos',
    items: [
      { slug: 'portals',   label: 'Cross-Server Portals' },
      { slug: 'polymorph', label: 'Polymorph' },
      { slug: 'jail',      label: 'Jail System' },
    ],
  },
  {
    category: 'Reference',
    items: [
      { slug: 'commands', label: 'Command List' },
    ],
  },
];

const ALL_ITEMS = NAV_SECTIONS.flatMap(s => s.items);

export const DocsPage: React.FC = () => {
  const { page = 'introduction' } = useParams<{ page: string }>();
  const navigate = useNavigate();

  const [html, setHtml]           = useState('');
  const [loading, setLoading]     = useState(true);
  const [searchQuery, setSearch]  = useState('');
  const [sidebarOpen, setSidebar] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // ── Patch window.DocsRouter so onclick handlers in view HTML work ──
  useEffect(() => {
    (window as any).DocsRouter = {
      navigate: (slug: string) => {
        navigate(`/docs/${slug}`);
        setSidebar(false);
        window.scrollTo(0, 0);
      },
    };
    return () => { delete (window as any).DocsRouter; };
  }, [navigate]);

  // ── Fetch view HTML whenever page changes ──────────────────────
  useEffect(() => {
    setLoading(true);
    setHtml('');
    fetch(`/docs/views/${page}-view.html`)
      .then(r => {
        if (!r.ok) throw new Error('not found');
        return r.text();
      })
      .then(content => {
        setHtml(content);
        setLoading(false);
        window.scrollTo(0, 0);
      })
      .catch(() => {
        setHtml(`<div class="docs-page-container"><div class="docs-page-header"><h1>Page Not Found</h1></div><div class="docs-section"><p>The documentation page "<strong>${page}</strong>" doesn't exist yet.</p><p><a href="/docs/introduction" onclick="event.preventDefault(); window.DocsRouter.navigate('introduction')">← Back to Introduction</a></p></div></div>`);
        setLoading(false);
      });
  }, [page]);

  // ── Filter nav items by search query ──────────────────────────
  const filteredSections = searchQuery.trim().length < 2
    ? NAV_SECTIONS
    : NAV_SECTIONS.map(s => ({
        ...s,
        items: s.items.filter(i =>
          i.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.slug.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(s => s.items.length > 0);

  const handleNavClick = useCallback((slug: string) => {
    navigate(`/docs/${slug}`);
    setSidebar(false);
    window.scrollTo(0, 0);
  }, [navigate]);

  return (
    <div className="docs-layout">

      {/* ── Top Bar ─────────────────────────────────────────── */}
      <header className="docs-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="docs-mobile-toggle" onClick={() => setSidebar(v => !v)} aria-label="Toggle sidebar">
            <span /><span /><span />
          </button>
          <Link to="/" className="docs-topbar-logo">
            <img src="/images/acosmibot_website-logo.png" alt="Acosmibot" />
          </Link>
        </div>
        <div className="docs-topbar-right">
          <a href="/dashboard" style={{ color: 'var(--primary-color)' }}>Dashboard</a>
        </div>
      </header>

      {/* ── Mobile Backdrop ─────────────────────────────────── */}
      <div
        className={`docs-backdrop${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebar(false)}
      />

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={`docs-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="docs-search">
          <input
            type="text"
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={e => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
        <nav className="docs-nav">
          {filteredSections.map(section => (
            <React.Fragment key={section.category}>
              <div className="docs-nav-category">{section.category}</div>
              {section.items.map(item => (
                <button
                  key={item.slug}
                  className={`docs-nav-item${page === item.slug ? ' active' : ''}`}
                  onClick={() => handleNavClick(item.slug)}
                >
                  {item.label}
                </button>
              ))}
            </React.Fragment>
          ))}
          {filteredSections.length === 0 && (
            <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: 13 }}>No results</div>
          )}
        </nav>
      </aside>

      {/* ── Main Content ─────────────────────────────────────── */}
      <main className="docs-content">
        <div className="docs-content-inner" ref={contentRef}>
          {loading ? (
            <div className="docs-loading">
              <div className="docs-loading-spinner" />
              Loading...
            </div>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </div>
      </main>
    </div>
  );
};
