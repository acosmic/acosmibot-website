/*
THESIS: Acosmibot is a connected community system, not a shelf of unrelated bot commands.
OWN-WORLD: A near-black observatory, fine topology lines, shaped feature nodes, cool-white type,
signal-cyan selection, quiet violet depth, and floating graphite instruments.
STORY: Visitors see the whole system, understand the promise, explore each connected capability,
and add Acosmibot to Discord.
FIRST VIEWPORT: Product copy and the primary action occupy the left half while a living Acosmibot
constellation fills the right; a slim topology readout anchors the bottom edge.
FORM: Persuade-mode spatial observatory, adapted directly from the knowledge constellation.
The graph is the product demonstration, while conventional navigation and actions remain obvious.
*/
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bitcoin,
  Bot,
  Check,
  Coins,
  Copy,
  CreditCard,
  Dices,
  FileText,
  Gift,
  LucideIcon,
  MousePointer2,
  Network,
  Orbit,
  Package,
  PieChart,
  Plus,
  Radio,
  Shield,
  Sparkles,
  Tags,
  Terminal,
  Wrench,
} from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { startLogin } from '@/lib/auth';
import { trackEvent } from '@/lib/analytics';
import { COMPANY_BRAND } from '@/lib/company';
import { HOME_TAGLINE } from '@/seo/publicRoutes';
import '@/styles/home.css';

const DISCORD_INVITE = 'https://discord.com/oauth2/authorize?client_id=1186802023799214223&permissions=8&integration_type=0&scope=bot';
const BTC_ADDRESS = '3GgkQphwJyarorF4tXntXBLYRJNGSkTMfS';

type FeatureFamily = 'connect' | 'intelligence' | 'reward' | 'operate' | 'chaos';

interface Feature {
  id: string;
  name: string;
  shortName: string;
  family: FeatureFamily;
  description: string;
  bullets: string[];
  Icon: LucideIcon;
  x: number;
  y: number;
}

const FEATURES: Feature[] = [
  {
    id: 'streaming',
    name: 'Streaming Integrations',
    shortName: 'Streaming',
    family: 'connect',
    Icon: Radio,
    x: 12,
    y: 12,
    description: 'Real-time go-live announcements across the three major streaming platforms, with live viewer counts and automatic VOD links.',
    bullets: ['Twitch, YouTube, and Kick support', 'Track multiple streamers per server', 'Live viewer count updates in-message', 'Auto-edits to VOD when stream ends', 'Per-streamer mention roles and messages'],
  },
  {
    id: 'ai',
    name: 'AI Chat & Image Generation',
    shortName: 'AI',
    family: 'intelligence',
    Icon: Bot,
    x: 42,
    y: 13,
    description: 'OpenAI-powered conversations with persistent memory and a knowledge base unique to each server.',
    bullets: ['Mention the bot to start a conversation', 'Context-aware threaded memory', 'Per-server custom AI personality', 'On-demand AI image generation', 'RAG-powered server knowledge base'],
  },
  {
    id: 'leveling',
    name: 'Leveling & XP',
    shortName: 'Leveling',
    family: 'reward',
    Icon: BarChart3,
    x: 88,
    y: 18,
    description: 'Reward active members with XP, levels, and auto-assigned Discord roles tied to milestones.',
    bullets: ['XP from messages, reactions, and commands', 'Configurable level-up role rewards', 'Per-channel XP multipliers', 'Server and global leaderboards', 'Per-member stats and rank cards'],
  },
  {
    id: 'economy',
    name: 'Economy System',
    shortName: 'Economy',
    family: 'reward',
    Icon: Coins,
    x: 93,
    y: 42,
    description: 'A complete in-server currency with daily rewards, banking, member-to-member transfers, and a weekly lottery.',
    bullets: ['Daily reward and activity streak bonuses', 'Personal balances and server bank', 'Member-to-member credit transfers', 'Weekly lottery with rolling jackpot', 'Economy leaderboards'],
  },
  {
    id: 'items',
    name: 'Items & Inventory',
    shortName: 'Items',
    family: 'reward',
    Icon: Package,
    x: 88,
    y: 68,
    description: 'A credit-funded shop where members buy items, stock an inventory, and activate boosts that stack with the economy and leveling systems.',
    bullets: ['Buy items from the credits shop', 'Personal inventory per member', 'Equip items for always-on effects', 'Consumable items with one-time effects', 'Gift and trade items to other members'],
  },
  {
    id: 'games',
    name: 'Games',
    shortName: 'Games',
    family: 'reward',
    Icon: Dices,
    x: 68,
    y: 88,
    description: 'A full slate of interactive games and credit-based wagering to keep members engaged.',
    bullets: ['Blackjack, Slots, Mines, and Coinflip', 'Deathroll and Rock Paper Scissors PvP', 'Magic 8-Ball predictions', 'Credit-based wagering on every game', 'Game-specific leaderboards'],
  },
  {
    id: 'giveaways',
    name: 'Giveaways',
    shortName: 'Giveaways',
    family: 'connect',
    Icon: Gift,
    x: 22,
    y: 87,
    description: 'Run timed giveaways with role requirements, multiple winners, and one-click rerolls.',
    bullets: ['Configurable duration and winner count', 'Required-role entry restrictions', 'Live entry tracking', 'One-click winner reroll', 'Recent giveaways history dashboard'],
  },
  {
    id: 'moderation',
    name: 'Moderation',
    shortName: 'Moderation',
    family: 'operate',
    Icon: Shield,
    x: 7,
    y: 70,
    description: 'Keep your community healthy with configurable event logging and clear controls for how server activity is recorded.',
    bullets: ['Centralized moderation log channel', 'Join, leave, and message audit events', 'Role-change audit logging', 'Per-action role and channel controls', 'Configurable activity-monitor exclusions'],
  },
  {
    id: 'reaction-roles',
    name: 'Reaction Roles',
    shortName: 'Roles',
    family: 'operate',
    Icon: Tags,
    x: 11,
    y: 25,
    description: 'Let members self-assign roles through emoji reactions on a message you control.',
    bullets: ['Emoji-to-role mapping per message', 'Multiple roles per message', 'Add and remove via the same reaction', 'Works with custom and Unicode emoji', 'Manage from the web dashboard'],
  },
  {
    id: 'commands',
    name: 'Custom Commands',
    shortName: 'Commands',
    family: 'intelligence',
    Icon: Terminal,
    x: 49,
    y: 65,
    description: 'Build server-specific slash commands with custom responses, no code required.',
    bullets: ['Create commands from the dashboard', 'Plain-text or rich embed responses', 'Per-server command library', 'Edit and disable on the fly', 'Usage tracking per command'],
  },
  {
    id: 'utilities',
    name: 'Utility Tools',
    shortName: 'Utilities',
    family: 'intelligence',
    Icon: Wrench,
    x: 69,
    y: 38,
    description: 'A grab-bag of everyday helpers — weather, definitions, NASA imagery, GIFs, and personal reminders.',
    bullets: ['Weather forecast lookup', 'Dictionary definitions', 'NASA Astronomy Picture of the Day', 'Giphy GIF search', 'Personal reminders with delivery'],
  },
  {
    id: 'embeds',
    name: 'Better Embeds',
    shortName: 'Embeds',
    family: 'operate',
    Icon: FileText,
    x: 28,
    y: 32,
    description: 'Build rich Discord messages in the dashboard, preview them as members will see them, and send them directly to a channel.',
    bullets: ['Rich message and embed builder', 'Live Discord-style previews', 'Image uploads and interactive buttons', 'Reusable drafts with duplicate and edit tools', 'Direct channel sending from the dashboard'],
  },
  {
    id: 'activity-monitoring',
    name: 'Activity Monitoring',
    shortName: 'Activity',
    family: 'operate',
    Icon: Activity,
    x: 13,
    y: 48,
    description: 'Automatically assign roles when members play, stream, listen, watch, compete, or set a custom status.',
    bullets: ['Rule-based automatic role assignment', 'Playing, streaming, listening, and watching states', 'Competing and custom-status support', 'Separate trigger and assigned roles', 'Optional moderation-log exclusions'],
  },
  {
    id: 'analytics',
    name: 'Server Analytics',
    shortName: 'Analytics',
    family: 'intelligence',
    Icon: PieChart,
    x: 67,
    y: 10,
    description: 'See what members actually use across commands, reactions, AI, channels, and community growth.',
    bullets: ['Most-used and undiscovered commands', 'Top reactions and channel activity', 'AI usage, tokens, and cost visibility', 'Member joins, departures, and net growth', 'Configurable weekly server recaps'],
  },
  {
    id: 'chaos',
    name: 'Chaos',
    shortName: 'Chaos',
    family: 'chaos',
    Icon: Sparkles,
    x: 46,
    y: 92,
    description: 'Turn controlled community chaos into a system with cross-server portals, Polymorph nickname swaps, and the server jail.',
    bullets: ['Cross-server portals and community discovery', 'Bidirectional portal messages', 'Temporary Polymorph nickname swaps', 'Credit-gated jail and bailout mechanics', 'Jailmail messages to and from the jail'],
  },
];

const FEATURE_EDGES: Array<[string, string]> = [
  ['leveling', 'economy'],
  ['leveling', 'items'],
  ['economy', 'items'],
  ['economy', 'games'],
  ['moderation', 'reaction-roles'],
  ['moderation', 'activity-monitoring'],
  ['reaction-roles', 'embeds'],
  ['analytics', 'ai'],
  ['analytics', 'commands'],
  ['chaos', 'moderation'],
];

const FAMILY_LABELS: Record<FeatureFamily, string> = {
  connect: 'Community',
  intelligence: 'Intelligence',
  reward: 'Progression',
  operate: 'Operations',
  chaos: 'Chaos',
};

const FEATURE_LANDING_PATHS: Partial<Record<string, string>> = {
  ai: '/features/ai-discord-bot',
  leveling: '/features/discord-leveling-bot',
  economy: '/features/discord-economy-bot',
  games: '/features/discord-games-bot',
};

const FEATURE_DOC_PATHS: Partial<Record<string, string>> = {
  ai: '/docs/ai',
  leveling: '/docs/leveling',
  economy: '/docs/economy',
  games: '/docs/commands',
  streaming: '/docs/twitch',
  moderation: '/docs/moderation',
  'reaction-roles': '/docs/reaction-roles',
  commands: '/docs/custom-commands',
  embeds: '/docs/embeds',
  utilities: '/docs/reminders',
  chaos: '/docs/portals',
};

const HomeCosmos: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;
    let frameId = 0;
    let pointerX = 0;
    let pointerY = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let seed = 1847;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const stars = Array.from({ length: 105 }, () => ({
      x: random(),
      y: random(),
      size: 0.45 + random() * 1.15,
      alpha: 0.18 + random() * 0.5,
      phase: random() * Math.PI * 2,
    }));

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const onPointerMove = (event: PointerEvent) => {
      pointerX = (event.clientX / Math.max(width, 1) - 0.5) * 9;
      pointerY = (event.clientY / Math.max(height, 1) - 0.5) * 9;
    };
    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      for (const star of stars) {
        const drift = reducedMotion ? 0 : time * 0.000002 * (star.size + 0.4);
        const x = ((star.x + drift) % 1) * width + pointerX * star.size;
        const y = star.y * height + pointerY * star.size;
        const twinkle = reducedMotion ? 1 : 0.72 + Math.sin(time * 0.001 + star.phase) * 0.28;
        context.globalAlpha = star.alpha * twinkle;
        context.fillStyle = star.size > 1.25 ? '#67ecff' : '#dcecf4';
        context.beginPath();
        context.arc(x, y, star.size, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      if (!reducedMotion) frameId = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    draw(0);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="home-cosmos" aria-hidden="true" />;
};

interface MiniConstellationProps {
  onSelect: (id: string) => void;
}

const MiniConstellation: React.FC<MiniConstellationProps> = ({ onSelect }) => {
  const visibleNodes = FEATURES.filter(feature => [
    'ai',
    'analytics',
    'leveling',
    'economy',
    'games',
    'chaos',
    'activity-monitoring',
    'moderation',
    'reaction-roles',
    'embeds',
    'utilities',
    'streaming',
  ].includes(feature.id));
  const positions: Record<string, { x: number; y: number }> = {
    ai: { x: 50, y: 5 },
    analytics: { x: 70, y: 9 },
    leveling: { x: 87, y: 22 },
    economy: { x: 94, y: 45 },
    games: { x: 88, y: 70 },
    chaos: { x: 70, y: 88 },
    'activity-monitoring': { x: 48, y: 94 },
    moderation: { x: 25, y: 87 },
    'reaction-roles': { x: 8, y: 68 },
    embeds: { x: 5, y: 42 },
    utilities: { x: 14, y: 18 },
    streaming: { x: 32, y: 7 },
  };

  const selectNode = (id: string) => {
    onSelect(id);
    document.querySelector('#system-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="hero-constellation" aria-label="Acosmibot feature constellation">
      <div className="hero-constellation__orbit hero-constellation__orbit--one" />
      <div className="hero-constellation__orbit hero-constellation__orbit--two" />
      <svg className="hero-constellation__links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {visibleNodes.map(feature => {
          const point = positions[feature.id];
          return <line key={feature.id} x1="50" y1="49" x2={point.x} y2={point.y} />;
        })}
      </svg>
      <div className="hero-constellation__hub">
        <span className="hero-constellation__hub-pulse" />
        <img src="/images/acosmibot-logo.png" alt="" />
        <strong>Acosmibot</strong>
        <small>community core</small>
      </div>
      {visibleNodes.map((feature, index) => {
        const point = positions[feature.id];
        const FeatureIcon = feature.Icon;
        return (
          <button
            key={feature.id}
            type="button"
            className={`hero-node hero-node--${feature.family}`}
            style={{ '--node-x': `${point.x}%`, '--node-y': `${point.y}%`, '--delay': `${index * -0.7}s` } as React.CSSProperties}
            onClick={() => selectNode(feature.id)}
            aria-label={`Explore ${feature.name}`}
          >
            <span><FeatureIcon aria-hidden="true" /></span>
            <small>{feature.shortName}</small>
          </button>
        );
      })}
      <div className="hero-constellation__readout">
        <Network aria-hidden="true" />
        <span>{FEATURES.length} systems</span>
        <i />
        <span>1 community</span>
      </div>
    </div>
  );
};

interface FeatureMapProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

const FeatureMap: React.FC<FeatureMapProps> = ({ selectedId, onSelect }) => {
  const selected = FEATURES.find(feature => feature.id === selectedId) ?? FEATURES[1];
  const SelectedIcon = selected.Icon;
  const landingPath = FEATURE_LANDING_PATHS[selected.id];
  const docsPath = FEATURE_DOC_PATHS[selected.id] ?? '/docs/introduction';

  return (
    <div className="feature-explorer">
      <div className="feature-map" aria-label="Explore Acosmibot features">
        <div className="feature-map__header">
          <span><Network aria-hidden="true" /> System topology</span>
          <span>{FEATURES.length} nodes · {FEATURES.length + FEATURE_EDGES.length} links</span>
        </div>
        <svg className="feature-map__links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {FEATURES.map(feature => (
            <line
              key={`hub-${feature.id}`}
              className={selectedId === feature.id ? 'is-active' : ''}
              x1="50"
              y1="50"
              x2={feature.x}
              y2={feature.y}
            />
          ))}
          {FEATURE_EDGES.map(([fromId, toId]) => {
            const from = FEATURES.find(feature => feature.id === fromId);
            const to = FEATURES.find(feature => feature.id === toId);
            if (!from || !to) return null;
            const active = selectedId === fromId || selectedId === toId;
            return (
              <line
                key={`${fromId}-${toId}`}
                className={`feature-map__relation${active ? ' is-active' : ''}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
              />
            );
          })}
        </svg>
        <div className="feature-map__hub" aria-hidden="true">
          <img src="/images/acosmibot-logo.png" alt="" />
          <span>Acosmibot</span>
        </div>
        {FEATURES.map((feature, index) => {
          const FeatureIcon = feature.Icon;
          const isSelected = feature.id === selectedId;
          return (
            <button
              key={feature.id}
              type="button"
              className={`feature-node feature-node--${feature.family}${isSelected ? ' is-selected' : ''}`}
              style={{ '--node-x': `${feature.x}%`, '--node-y': `${feature.y}%`, '--delay': `${index * -0.45}s` } as React.CSSProperties}
              onClick={() => onSelect(feature.id)}
              aria-pressed={isSelected}
            >
              <span className="feature-node__mark"><FeatureIcon aria-hidden="true" /></span>
              <span className="feature-node__label">{feature.shortName}</span>
            </button>
          );
        })}
        <div className="feature-map__hint">
          <MousePointer2 aria-hidden="true" />
          Select a node to inspect
        </div>
      </div>

      <aside className={`feature-inspector feature-inspector--${selected.family}`} aria-live="polite">
        <div className="feature-inspector__head">
          <div className="feature-inspector__icon"><SelectedIcon aria-hidden="true" /></div>
          <div>
            <span>{FAMILY_LABELS[selected.family]} system</span>
            <h3>{selected.name}</h3>
          </div>
        </div>
        <p>{selected.description}</p>
        <div className="feature-inspector__divider">
          <span>Connected capabilities</span>
          <span>{selected.bullets.length.toString().padStart(2, '0')}</span>
        </div>
        <ul>
          {selected.bullets.map(item => <li key={item}><Check aria-hidden="true" /> {item}</li>)}
        </ul>
        <div className="feature-inspector__links">
          {landingPath && (
            <Link to={landingPath} className="feature-inspector__link feature-inspector__link--primary">
              Explore {selected.shortName} <ArrowRight aria-hidden="true" />
            </Link>
          )}
          <Link to={docsPath} className="feature-inspector__link">
            Read the docs <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </aside>
    </div>
  );
};

export const HomePage: React.FC = () => {
  const donationDialogRef = useRef<HTMLDivElement>(null);
  const bitcoinDialogRef = useRef<HTMLDivElement>(null);
  const modalRestoreRef = useRef<HTMLElement | null>(null);
  const [selectedFeature, setSelectedFeature] = useState('ai');
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [showBitcoinPopup, setShowBitcoinPopup] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: string } | null>(null);

  const showNotif = useCallback((msg: string, type: string) => {
    setNotification({ msg, type });
    window.setTimeout(() => setNotification(null), 3000);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error) {
      showNotif('Login failed. Please try again.', 'error');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
  }, [showNotif]);

  useEffect(() => {
    if (!showDonationModal && !showBitcoinPopup) return;
    const dialog = showBitcoinPopup ? bitcoinDialogRef.current : donationDialogRef.current;
    if (!dialog) return;
    const background = Array.from(document.querySelectorAll<HTMLElement>(
      '.home-page > main, .home-page > footer, .home-page > nav, .home-page > aside, .home-page > .public-nav__backdrop',
    ));
    background.forEach(element => element.setAttribute('inert', ''));
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    focusable[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowBitcoinPopup(false);
        setShowDonationModal(false);
        return;
      }
      if (event.key !== 'Tab' || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      background.forEach(element => element.removeAttribute('inert'));
    };
  }, [showDonationModal, showBitcoinPopup]);

  useEffect(() => {
    if (showDonationModal || showBitcoinPopup) return;
    modalRestoreRef.current?.focus();
    modalRestoreRef.current = null;
  }, [showDonationModal, showBitcoinPopup]);

  useEffect(() => {
    if (window.location.hash !== '#system-map') return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector('#system-map')?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const handleLogin = () => {
    showNotif('Redirecting to Discord...', 'info');
    startLogin();
  };

  const inviteBot = (source: 'hero' | 'navigation') => {
    trackEvent('bot_invite_start', { source });
    window.open(DISCORD_INVITE, '_blank', 'noopener,noreferrer');
  };

  const copyBTC = useCallback(async () => {
    await navigator.clipboard.writeText(BTC_ADDRESS);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <div className="home-page">
      <HomeCosmos />
      <div className="home-nebula" aria-hidden="true" />

      {notification && (
        <div className={`home-notification home-notification--${notification.type}`} role="status">
          <span />
          {notification.msg}
        </div>
      )}

      <PublicNav
        variant="observatory"
        onLogin={handleLogin}
        onLogout={() => showNotif('Successfully logged out!', 'info')}
      />

      <main>
        <section className="home-hero">
          <div className="home-shell home-hero__layout">
            <div className="home-hero__copy">
              <div className="home-kicker">
                <span className="home-kicker__signal" />
                Community operating system
              </div>
              <h1 aria-label={HOME_TAGLINE}>
                <span className="home-hero__primary">A cosmic intelligence</span>
                <span>at your server’s command.</span>
              </h1>
              <p>
                Acosmibot connects engagement, economy, games, and agentic AI-powered interactions in one
                living system—built to keep your server active and entertained.
              </p>
              <div className="home-hero__actions">
                <button className="home-button home-button--primary" onClick={() => inviteBot('hero')}>
                  Add to Discord <Plus aria-hidden="true" />
                </button>
                <a href="#system-map" className="home-button home-button--quiet">
                  Explore the system <ArrowRight aria-hidden="true" />
                </a>
              </div>
              <div className="home-hero__meta" aria-label="Acosmibot product summary">
                <span><Network aria-hidden="true" /> {FEATURES.length} connected systems</span>
                <i />
                <span>One dashboard</span>
              </div>
            </div>
            <MiniConstellation onSelect={setSelectedFeature} />
          </div>
          <a className="home-hero__scroll" href="#system-map">
            <span>Explore topology</span>
            <i />
          </a>
        </section>

        <section className="system-section" id="system-map">
          <div className="home-shell">
            <div className="system-section__intro">
              <div>
                <span className="system-section__label">Connected by design</span>
                <h2>One bot. A whole community in motion.</h2>
              </div>
              <p>
                Explore Acosmibot the way its features actually work: as a connected system.
                Select any node to see what it brings to your server.
              </p>
            </div>
            <FeatureMap selectedId={selectedFeature} onSelect={setSelectedFeature} />
            <nav className="home-feature-routes" aria-label="Explore core Acosmibot features">
              <span>Core feature guides</span>
              <Link to="/features/ai-discord-bot">Agentic AI Discord bot <ArrowRight aria-hidden="true" /></Link>
              <Link to="/features/discord-leveling-bot">Discord leveling bot <ArrowRight aria-hidden="true" /></Link>
              <Link to="/features/discord-economy-bot">Discord economy bot <ArrowRight aria-hidden="true" /></Link>
              <Link to="/features/discord-games-bot">Discord games bot <ArrowRight aria-hidden="true" /></Link>
            </nav>
          </div>
        </section>

        <section className="home-closing">
          <div className="home-shell home-closing__inner">
            <div className="home-closing__signal" aria-hidden="true">
              <span /><span /><span />
              <img src="/images/acosmibot-logo.png" alt="" />
            </div>
            <div className="home-closing__copy">
              <span>Ready when your community is</span>
              <h2>Put every system in orbit.</h2>
              <p>Add Acosmibot to Discord, then shape the experience from one connected dashboard.</p>
            </div>
            <button className="home-button home-button--primary" onClick={() => inviteBot('navigation')}>
              Add to Discord <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-shell home-footer__inner">
          <div className="home-footer__brand">
            <img src="/images/acosmibot_website-logo.png" alt="Acosmibot" />
            <span>Community systems, connected.</span>
          </div>
          <div className="home-footer__links">
            <Link to="/terms-of-service">Terms</Link>
            <Link to="/privacy-policy">Privacy</Link>
            <button type="button" onClick={event => {
              modalRestoreRef.current = event.currentTarget;
              setShowDonationModal(true);
            }}>Support development</button>
          </div>
          <div className="home-footer__copyright">© {new Date().getFullYear()} {COMPANY_BRAND}</div>
        </div>
      </footer>

      {showDonationModal && (
        <div className="home-modal-overlay" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) setShowDonationModal(false);
        }}>
          <div ref={donationDialogRef} className="donation-modal-content" role="dialog" aria-modal="true" aria-labelledby="support-title">
            <button className="modal-close" onClick={() => setShowDonationModal(false)} aria-label="Close support dialog">×</button>
            <div className="donation-header">
              <span className="donation-header__signal"><Orbit aria-hidden="true" /></span>
              <h3 id="support-title">Support Development</h3>
              <p>Help keep Acosmibot growing and improving.</p>
            </div>
            <div className="donation-methods">
              <div className="donation-option">
                <span className="method-icon"><CreditCard aria-hidden="true" /></span>
                <div>
                  <span className="method-name">PayPal</span>
                  <p className="method-description">Quick and secure donation</p>
                </div>
                <a href="https://www.paypal.com/ncp/payment/BTN7ZAB3B632G" target="_blank" rel="noreferrer" className="donation-btn">
                  Donate <ArrowRight aria-hidden="true" />
                </a>
              </div>
              <div className="donation-option">
                <span className="method-icon method-icon--bitcoin"><Bitcoin aria-hidden="true" /></span>
                <div>
                  <span className="method-name">Bitcoin</span>
                  <p className="method-description">Cryptocurrency donation</p>
                </div>
                <button className="donation-btn" onClick={() => {
                  setShowDonationModal(false);
                  setShowBitcoinPopup(true);
                }}>
                  View address <ArrowRight aria-hidden="true" />
                </button>
              </div>
            </div>
            <p className="donation-footer">Thank you for supporting Acosmibot.</p>
          </div>
        </div>
      )}

      {showBitcoinPopup && (
        <>
          <div className="home-modal-overlay home-modal-overlay--bitcoin" onClick={() => setShowBitcoinPopup(false)} />
          <div ref={bitcoinDialogRef} className="bitcoin-popup" role="dialog" aria-modal="true" aria-labelledby="bitcoin-title">
            <button className="modal-close" onClick={() => setShowBitcoinPopup(false)} aria-label="Close Bitcoin address dialog">×</button>
            <span className="bitcoin-popup__icon"><Bitcoin aria-hidden="true" /></span>
            <h4 id="bitcoin-title">Bitcoin Address</h4>
            <p>Send Bitcoin to:</p>
            <div className="crypto-address">
              <input type="text" value={BTC_ADDRESS} readOnly aria-label="Bitcoin address" />
              <button className="copy-btn" onClick={copyBTC}>
                {copied ? <><Check aria-hidden="true" /> Copied</> : <><Copy aria-hidden="true" /> Copy</>}
              </button>
            </div>
            <p className="popup-note">Thank you for supporting development.</p>
          </div>
        </>
      )}
    </div>
  );
};
