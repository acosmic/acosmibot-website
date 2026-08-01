/*
 * Direction contract
 * Physical scene: a community owner reads a field manual inside the same dim observatory as the public site.
 * Composition: a compact constellation index, one illuminated reading stage, and a live section-signal rail.
 * Scale and rhythm: dense 11–14px wayfinding surrounds a relaxed 17px reading column with generous section gaps.
 * Color and material: Observatory Void, opaque blue-black panels, quiet cyan selection, and warm status accents.
 * Differentiation and response: article headings become navigable signals; wide screens gain a third rail while mobile keeps one clear reading column and a contents drawer.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlarmClock, Bomb, BookOpen, Bot, Cherry, ClipboardList, Coins, Dices, Grid3x3,
  FileText, Gem, Landmark, Lock, Music, Orbit, Package, Rocket, Settings, Shield, Spade,
  Sparkles, Ticket, TrendingUp, TvMinimalPlay, Vault, VenetianMask, PanelLeftClose, PanelLeftOpen,
  Search, X, ArrowUpRight, HandHeart,
  type LucideIcon,
} from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import '@/styles/docs.css';

// ── Navigation structure (mirrors docs-search.js) ──────────────
interface NavItemDef {
  slug: string;
  label: string;
  icon: LucideIcon;
  iconColor?: string;
  assetIcon?: 'twitch' | 'youtube' | 'kick';
}

const NAV_SECTIONS: Array<{ category: string; items: NavItemDef[] }> = [
  {
    category: 'Getting Started',
    items: [
      { slug: 'introduction', label: 'Introduction', icon: BookOpen },
      { slug: 'quick-start',  label: 'Quick Start', icon: Rocket },
      { slug: 'subscription-plans', label: 'Plans & Pricing', icon: Gem },
    ],
  },
  {
    category: 'Core Systems',
    items: [
      { slug: 'leveling',   label: 'Leveling System', icon: TrendingUp },
      { slug: 'economy',    label: 'Economy & Banking', icon: Landmark },
      { slug: 'items',      label: 'Items & Inventory', icon: Package },
      { slug: 'moderation', label: 'Moderation', icon: Shield },
      { slug: 'ai',         label: 'AI Integration', icon: Bot },
      { slug: 'music',      label: 'Music', icon: Music },
    ],
  },
  {
    category: 'Social Alerts',
    items: [
      { slug: 'twitch',  label: 'Twitch Integration', icon: TvMinimalPlay, assetIcon: 'twitch' },
      { slug: 'youtube', label: 'YouTube Integration', icon: TvMinimalPlay, assetIcon: 'youtube' },
      { slug: 'kick',    label: 'Kick Integration', icon: TvMinimalPlay, assetIcon: 'kick' },
    ],
  },
  {
    category: 'Games & Gambling',
    items: [
      { slug: 'slots',     label: 'Slots', icon: Cherry },
      { slug: 'mines',     label: 'Mines', icon: Bomb },
      { slug: 'keno',      label: 'Keno', icon: Grid3x3 },
      { slug: 'lottery',   label: 'Lottery', icon: Ticket },
      { slug: 'blackjack', label: 'Blackjack', icon: Spade },
      { slug: 'coinflip',  label: 'Coinflip', icon: Coins },
      { slug: 'deathroll', label: 'Deathroll', icon: Dices },
      { slug: 'heist',     label: 'Heist', icon: Vault },
      { slug: 'good-deeds', label: 'Good Deeds', icon: HandHeart },
    ],
  },
  {
    category: 'Utilities',
    items: [
      { slug: 'reaction-roles',    label: 'Reaction Roles', icon: Sparkles },
      { slug: 'custom-commands',   label: 'Custom Commands', icon: Settings },
      { slug: 'embeds',            label: 'Better Embeds', icon: FileText },
      { slug: 'reminders',         label: 'Reminders', icon: AlarmClock },
    ],
  },
  {
    category: 'Chaos',
    items: [
      { slug: 'portals',   label: 'Cross-Server Portals', icon: Orbit },
      { slug: 'polymorph', label: 'Polymorph', icon: VenetianMask },
      { slug: 'jail',      label: 'Jail System', icon: Lock },
    ],
  },
  {
    category: 'Reference',
    items: [
      { slug: 'commands', label: 'Command List', icon: ClipboardList },
    ],
  },
];

const ALL_ITEMS = NAV_SECTIONS.flatMap(s => s.items);

interface TocItem {
  id: string;
  label: string;
}

const makeSectionId = (label: string, index: number) => {
  const slug = label
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return `section-${slug || index + 1}`;
};

export const DocsPage: React.FC = () => {
  const { page = 'introduction' } = useParams<{ page: string }>();
  const navigate = useNavigate();

  const [html, setHtml]           = useState('');
  const [loading, setLoading]     = useState(true);
  const [searchQuery, setSearch]  = useState('');
  const [sidebarOpen, setSidebar] = useState(false);
  const [tocItems, setTocItems]   = useState<TocItem[]>([]);
  const [activeSection, setActiveSection] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const contentScrollerRef = useRef<HTMLElement>(null);
  const activeItem = ALL_ITEMS.find((item) => item.slug === page);
  const activePageLabel = activeItem?.label ?? 'Documentation';
  const activeCategory = NAV_SECTIONS.find((section) =>
    section.items.some((item) => item.slug === page)
  )?.category ?? 'Field Manual';

  // ── Patch window.DocsRouter so onclick handlers in view HTML work ──
  useEffect(() => {
    (window as any).DocsRouter = {
      navigate: (slug: string) => {
        navigate(`/docs/${slug}`);
        setSidebar(false);
        contentScrollerRef.current?.scrollTo({ top: 0 });
      },
    };
    return () => { delete (window as any).DocsRouter; };
  }, [navigate]);

  // ── Fetch view HTML whenever page changes ──────────────────────
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setHtml('');
    setTocItems([]);
    setActiveSection('');
    contentScrollerRef.current?.scrollTo({ top: 0 });

    fetch(`/docs/views/${page}-view.html`, { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error('not found');
        return r.text();
      })
      .then(content => {
        setHtml(content);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setHtml(`<div class="docs-page-container"><div class="docs-page-header"><h1>Page Not Found</h1></div><div class="docs-section"><p>The documentation page "<strong>${page}</strong>" doesn't exist yet.</p><p><a href="/docs/introduction" onclick="event.preventDefault(); window.DocsRouter.navigate('introduction')">← Back to Introduction</a></p></div></div>`);
        setLoading(false);
      });

    return () => controller.abort();
  }, [page]);

  // ── Turn static article headings into live section signals ────
  useEffect(() => {
    if (loading || !html) return;

    const article = contentRef.current?.querySelector<HTMLElement>('.docs-page-container');
    const scroller = contentScrollerRef.current;
    if (!article || !scroller) return;

    article.querySelectorAll<HTMLTableElement>('table.docs-table').forEach((table) => {
      if (table.parentElement?.classList.contains('docs-table-wrap')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'docs-table-wrap';
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });

    const headings = Array.from(article.querySelectorAll<HTMLHeadingElement>('.docs-section > h2'));
    const usedIds = new Set<string>();
    const nextToc = headings.map((heading, index) => {
      const baseId = makeSectionId(heading.textContent?.trim() ?? '', index);
      let id = baseId;
      let suffix = 2;
      while (usedIds.has(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }
      usedIds.add(id);
      heading.id = id;
      return { id, label: heading.textContent?.trim() || `Section ${index + 1}` };
    });

    setTocItems(nextToc);
    setActiveSection(nextToc[0]?.id ?? '');

    const syncActiveSection = () => {
      const readingLine = scroller.getBoundingClientRect().top + 132;
      let current = headings[0]?.id ?? '';

      headings.forEach((heading) => {
        if (heading.getBoundingClientRect().top <= readingLine) {
          current = heading.id;
        }
      });

      setActiveSection(current);
    };

    let scrollFrame: number | null = null;
    const scheduleActiveSectionSync = () => {
      if (scrollFrame !== null) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = null;
        syncActiveSection();
      });
    };

    const initialFrame = window.requestAnimationFrame(() => {
      const hashId = window.location.hash.slice(1);
      const hashTarget = hashId ? document.getElementById(hashId) : null;
      if (hashTarget && article.contains(hashTarget)) {
        const offset = hashTarget.getBoundingClientRect().top
          - scroller.getBoundingClientRect().top
          + scroller.scrollTop
          - 40;
        scroller.scrollTo({ top: offset });
      }
      syncActiveSection();
    });

    scroller.addEventListener('scroll', scheduleActiveSectionSync, { passive: true });
    return () => {
      window.cancelAnimationFrame(initialFrame);
      if (scrollFrame !== null) window.cancelAnimationFrame(scrollFrame);
      scroller.removeEventListener('scroll', scheduleActiveSectionSync);
    };
  }, [html, loading]);

  useEffect(() => {
    if (!sidebarOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebar(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [sidebarOpen]);

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
    contentScrollerRef.current?.scrollTo({ top: 0 });
  }, [navigate]);

  const handleSectionClick = useCallback((id: string) => {
    const scroller = contentScrollerRef.current;
    const target = contentRef.current?.querySelector<HTMLElement>(`#${id}`);
    if (!scroller || !target) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const top = target.getBoundingClientRect().top
      - scroller.getBoundingClientRect().top
      + scroller.scrollTop
      - 40;

    scroller.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    window.history.replaceState(null, '', `${window.location.pathname}#${id}`);
    setActiveSection(id);
  }, []);

  return (
    <div className="docs-layout">

      <PublicNav variant="observatory" />

      <div className="docs-context-bar">
        <button
          type="button"
          className="docs-context-bar__toggle"
          onClick={() => setSidebar((open) => !open)}
          aria-label={sidebarOpen ? 'Close documentation contents' : 'Open documentation contents'}
          aria-expanded={sidebarOpen}
          aria-controls="docs-sidebar"
        >
          {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          <span>Contents</span>
        </button>
        <span className="docs-context-bar__page">{activePageLabel}</span>
      </div>

      {/* ── Mobile Backdrop ─────────────────────────────────── */}
      <button
        type="button"
        aria-label="Close documentation contents"
        className={`docs-backdrop${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebar(false)}
      />

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        id="docs-sidebar"
        className={`docs-sidebar${sidebarOpen ? ' open' : ''}`}
        aria-label="Documentation contents"
      >
        <div className="docs-sidebar__header">
          <span className="docs-sidebar__signal" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <div>
            <span className="docs-sidebar__eyebrow">Field manual</span>
            <strong>Acosmibot systems</strong>
          </div>
        </div>
        <div className="docs-search">
          <Search size={16} aria-hidden="true" />
          <label className="visually-hidden" htmlFor="docs-search-input">Search documentation topics</label>
          <input
            id="docs-search-input"
            type="text"
            placeholder="Find a topic..."
            value={searchQuery}
            onChange={e => setSearch(e.target.value)}
            autoComplete="off"
          />
          {searchQuery && (
            <button
              type="button"
              className="docs-search__clear"
              onClick={() => setSearch('')}
              aria-label="Clear documentation search"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <nav className="docs-nav" aria-label="Documentation topics">
          {filteredSections.map(section => (
            <section className="docs-nav-group" key={section.category}>
              <h2 className="docs-nav-category">{section.category}</h2>
              {section.items.map(item => (
                <button
                  type="button"
                  key={item.slug}
                  className={`docs-nav-item${page === item.slug ? ' active' : ''}`}
                  onClick={() => handleNavClick(item.slug)}
                  aria-current={page === item.slug ? 'page' : undefined}
                >
                  {item.assetIcon ? (
                    <span
                      className="docs-nav-asset-icon"
                      style={{
                        backgroundImage: `url('/images/acosmibot_${item.assetIcon}-${page === item.slug ? 'active' : 'inactive'}.svg')`,
                      }}
                      aria-hidden
                    />
                  ) : (
                    <item.icon size={16} color={item.iconColor} aria-hidden />
                  )}
                  <span>{item.label}</span>
                </button>
              ))}
            </section>
          ))}
          {filteredSections.length === 0 && (
            <div className="docs-nav-empty">
              <span>No matching signals</span>
              <button type="button" onClick={() => setSearch('')}>Clear search</button>
            </div>
          )}
        </nav>
        <div className="docs-sidebar__footer">
          <span>{ALL_ITEMS.length} guides online</span>
          <i aria-hidden="true" />
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────── */}
      <main className="docs-content" ref={contentScrollerRef}>
        <div className="docs-stage">
          <article className="docs-content-inner" ref={contentRef}>
            <div className="docs-reading-meta" aria-label="Current documentation location">
              <span>Documentation</span>
              <i aria-hidden="true" />
              <span>{activeCategory}</span>
            </div>
            {loading ? (
              <div className="docs-loading" role="status">
                <div className="docs-loading-spinner" aria-hidden="true" />
                Aligning field notes...
              </div>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: html }} />
            )}
          </article>

          {tocItems.length > 0 && (
            <aside className="docs-toc" aria-label="On this page">
              <div className="docs-toc__heading">
                <span>On this page</span>
                <i aria-hidden="true" />
              </div>
              <nav>
                {tocItems.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={activeSection === item.id ? 'active' : ''}
                    onClick={() => handleSectionClick(item.id)}
                    aria-current={activeSection === item.id ? 'location' : undefined}
                  >
                    <span aria-hidden="true" />
                    {item.label}
                  </button>
                ))}
              </nav>
              <button
                type="button"
                className="docs-toc__top"
                onClick={() => {
                  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                  contentScrollerRef.current?.scrollTo({
                    top: 0,
                    behavior: reduceMotion ? 'auto' : 'smooth',
                  });
                }}
              >
                Back to top
                <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
};
