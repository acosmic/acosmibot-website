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
  Pause,
  PieChart,
  Play,
  Plus,
  Radio,
  Shield,
  Sparkles,
  Tags,
  Terminal,
  Wrench,
} from 'lucide-react';
import { DiscordShowcase, ShowcasePreview, showcaseAnchor, showcasePreviewSurface, type ShowcasePreviewId, type ShowcaseRowId } from '@/components/home/DiscordShowcase';
import { revealClass, usePrefersReducedMotion, useReveal, type Reveal } from '@/components/home/useReveal';
import { PublicNav } from '@/components/layout/PublicNav';
import { startLogin } from '@/lib/auth';
import { trackEvent } from '@/lib/analytics';
import { COMPANY_BRAND } from '@/lib/company';
import { HOME_TAGLINE } from '@/seo/publicRoutes';
import '@/styles/home.css';

const DISCORD_INVITE = 'https://api.acosmibot.com/auth/install/website';
const STRIPE_DONATION_URL = 'https://donate.stripe.com/bJe3co1sfayvcMD16xgnK00';
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
    description: 'Real-time go-live announcements across three major streaming platforms, plus focused post alerts from paid X accounts.',
    bullets: ['Twitch, YouTube, Kick, and paid X post alerts', 'Track multiple creators per server', 'Live viewer count updates in-message', 'Auto-edits to VOD when stream ends', 'Flexible destination and role-mention controls'],
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
    bullets: ['Daily reward and activity streak bonuses', 'Personal balances and server bank', 'Member-to-member Acosmicoin transfers', 'Weekly lottery with rolling jackpot', 'Economy leaderboards'],
  },
  {
    id: 'items',
    name: 'Items & Inventory',
    shortName: 'Items',
    family: 'reward',
    Icon: Package,
    x: 88,
    y: 68,
    description: 'An Acosmicoin-funded shop where members buy items, stock an inventory, and activate boosts that stack with the economy and leveling systems.',
    bullets: ['Buy items with Acosmicoins', 'Personal inventory per member', 'Equip items for always-on effects', 'Consumable items with one-time effects', 'Gift and trade items to other members'],
  },
  {
    id: 'games',
    name: 'Games',
    shortName: 'Games',
    family: 'reward',
    Icon: Dices,
    x: 68,
    y: 88,
    description: 'A full slate of interactive games and Acosmicoin wagering to keep members engaged.',
    bullets: ['Blackjack, Slots, Mines, and Coinflip', 'Deathroll and Rock Paper Scissors PvP', 'Magic 8-Ball predictions', 'Acosmicoin wagering on every game', 'Game-specific leaderboards'],
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
    description: 'Build server-specific commands with your own prefix and custom responses, no code required.',
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
    name: 'Custom Embeds',
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
    bullets: ['Most-used and undiscovered commands', 'Top reactions and channel activity', 'AI activity by feature and member', 'Member joins, departures, and net growth', 'Configurable weekly server recaps'],
  },
  {
    id: 'chaos',
    name: 'Chaos',
    shortName: 'Chaos',
    family: 'chaos',
    Icon: Sparkles,
    x: 46,
    y: 92,
    description: 'Turn controlled community chaos into a system with cross-server portals, Polymorph nickname swaps, and reaction-ballot confinement.',
    bullets: ['Cross-server portals and community discovery', 'Bidirectional portal messages', 'Temporary Polymorph nickname swaps', 'Reaction ballots with one edited tracker', 'Automatic release with member-specific restoration'],
  },
];

interface FeatureRelation {
  from: string;
  to: string;
  /** What moves across the link, phrased so it reads the same from either end. */
  label: string;
  /**
   * Pins the label at this fraction of the way from `from` to `to`, for links
   * whose default spot would cover a node or the core.
   */
  labelAt?: number;
}

// Only relationships the product really has; a feature with none keeps just
// its link to the core.
const FEATURE_RELATIONS: FeatureRelation[] = [
  { from: 'leveling', to: 'economy', label: 'Daily chat rewards' },
  { from: 'leveling', to: 'items', label: 'XP boosts' },
  { from: 'leveling', to: 'reaction-roles', label: 'Level-up roles' },
  { from: 'economy', to: 'items', label: 'Shop purchases' },
  { from: 'economy', to: 'games', label: 'Wagers and payouts' },
  { from: 'ai', to: 'economy', label: 'Balance lookups' },
  { from: 'ai', to: 'utilities', label: 'Weather and reminders' },
  { from: 'ai', to: 'analytics', label: 'AI usage reports' },
  { from: 'analytics', to: 'commands', label: 'Command usage', labelAt: 0.35 },
  { from: 'commands', to: 'embeds', label: 'Embed replies', labelAt: 0.66 },
  { from: 'reaction-roles', to: 'embeds', label: 'Embed messages', labelAt: 0.5 },
  { from: 'moderation', to: 'reaction-roles', label: 'Role change logs', labelAt: 0.12 },
  { from: 'moderation', to: 'activity-monitoring', label: 'Log exclusions', labelAt: 0.42 },
];

// The idle tour walks neighbors where it can, so each step keeps a lit link.
const FEATURE_TOUR = [
  'ai',
  'utilities',
  'economy',
  'games',
  'items',
  'leveling',
  'analytics',
  'commands',
  'embeds',
  'reaction-roles',
  'moderation',
  'activity-monitoring',
  'streaming',
  'giveaways',
  'chaos',
];
const TOUR_INTERVAL_MS = 5000;
// How far along a lit link its label sits, measured from the selected feature.
// Past the midpoint, so labels on links that leave one node together fan apart.
const RELATION_LABEL_POSITION = 0.66;

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

// The compact live example each feature shows in the inspector. A feature
// without one falls back to its capability checklist.
const FEATURE_PREVIEWS: Partial<Record<string, ShowcasePreviewId>> = {
  streaming: 'stream-live',
  ai: 'ai-weather',
  leveling: 'rank-card',
  economy: 'ai-stats',
  items: 'item-shop',
  games: 'slots',
  giveaways: 'giveaway',
  moderation: 'mod-log',
  'reaction-roles': 'reaction-roles',
  commands: 'custom-command',
  utilities: 'ai-reminder',
  embeds: 'custom-embed',
  'activity-monitoring': 'activity-roles',
  analytics: 'analytics',
  chaos: 'chaos',
};

// Features that have a live example row in the "In your server" showcase.
const FEATURE_SHOWCASE_ROWS: Partial<Record<string, ShowcaseRowId>> = {
  ai: 'ai',
  leveling: 'rank',
  economy: 'games',
  games: 'games',
  utilities: 'ai',
  embeds: 'custom-embeds',
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
        <img
          className="hero-constellation__mascot"
          src="/images/mascot/acosmibot-mascot-320.webp"
          srcSet="/images/mascot/acosmibot-mascot-320.webp 320w, /images/mascot/acosmibot-mascot-640.webp 640w"
          sizes="(max-width: 640px) 150px, 236px"
          width={320}
          height={343}
          alt=""
          // React 18 only recognizes the lowercase attribute name.
          {...{ fetchpriority: 'high' }}
        />
        <div className="hero-constellation__plate">
          <strong translate="no">Acosmibot</strong>
          <small>community core</small>
        </div>
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

interface FeatureTour {
  /** False for reduced-motion visitors, who never get an automatic tour. */
  available: boolean;
  paused: boolean;
  running: boolean;
  onToggle: () => void;
  /** Holds the tour while the visitor is reading the inspector. */
  onHold: (held: boolean) => void;
}

interface FeatureMapProps {
  selectedId: string;
  onSelect: (id: string) => void;
  onShowRow: (id: ShowcaseRowId) => void;
  tour: FeatureTour;
  reveal: Reveal;
  explorerRef: React.RefObject<HTMLDivElement>;
}

const featureById = (id: string): Feature | undefined => FEATURES.find(feature => feature.id === id);

const FeatureMap: React.FC<FeatureMapProps> = ({ selectedId, onSelect, onShowRow, tour, reveal, explorerRef }) => {
  const plotRef = useRef<HTMLDivElement>(null);
  const selected = featureById(selectedId) ?? FEATURES[1];
  const SelectedIcon = selected.Icon;
  const landingPath = FEATURE_LANDING_PATHS[selected.id];
  const docsPath = FEATURE_DOC_PATHS[selected.id] ?? '/docs/introduction';
  const showcaseRow = FEATURE_SHOWCASE_ROWS[selected.id];
  const previewId = FEATURE_PREVIEWS[selected.id];

  // The selected feature's relationships, each paired with the feature at the other end.
  const connections = FEATURE_RELATIONS.flatMap(relation => {
    if (relation.from !== selected.id && relation.to !== selected.id) return [];
    const partner = featureById(relation.from === selected.id ? relation.to : relation.from);
    return partner ? [{ relation, partner }] : [];
  });
  const partnerIds = new Set(connections.map(connection => connection.partner.id));

  // On small screens the nodes are a horizontal strip; keep the selected one in
  // view as the tour moves, without scrolling the page itself.
  useEffect(() => {
    const plot = plotRef.current;
    if (!plot || plot.scrollWidth <= plot.clientWidth) return;
    const node = plot.querySelector<HTMLElement>('.feature-node.is-selected');
    if (!node) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    plot.scrollTo({
      left: node.offsetLeft - (plot.clientWidth - node.offsetWidth) / 2,
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }, [selectedId]);

  return (
    <div ref={explorerRef} className={`feature-explorer${revealClass(reveal)}`}>
      <div className="feature-map" aria-label="Explore Acosmibot features">
        <div className="feature-map__header">
          <span><Network aria-hidden="true" /> System topology</span>
          <div className="feature-map__tools">
            <span className="feature-map__count">{FEATURES.length} nodes · {FEATURES.length + FEATURE_RELATIONS.length} links</span>
            {tour.available && (
              <button type="button" className="feature-map__tour" onClick={tour.onToggle}>
                {tour.paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                {tour.paused ? 'Resume tour' : 'Pause tour'}
              </button>
            )}
          </div>
          {tour.running && (
            <i key={selected.id} className="feature-map__tour-progress" aria-hidden="true" style={{ animationDuration: `${TOUR_INTERVAL_MS}ms` }} />
          )}
        </div>
        <div ref={plotRef} className="feature-map__plot">
          <svg className="feature-map__links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {FEATURES.map(feature => (
              <line
                key={`hub-${feature.id}`}
                className={selected.id === feature.id ? 'is-active' : ''}
                x1="50"
                y1="50"
                x2={feature.x}
                y2={feature.y}
              />
            ))}
            {FEATURE_RELATIONS.map(relation => {
              const from = featureById(relation.from);
              const to = featureById(relation.to);
              if (!from || !to) return null;
              const active = selected.id === relation.from || selected.id === relation.to;
              return (
                <line
                  key={`${relation.from}-${relation.to}`}
                  className={`feature-map__relation${active ? ' is-active' : ''}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                />
              );
            })}
          </svg>
          {/* Signals: two pulses from the core to the selected feature, then one
              along each of its relationships. */}
          <div className="feature-map__signals" key={selected.id} aria-hidden="true">
            {[0, 1].map(step => (
              <span
                key={step}
                className="feature-map__signal"
                style={{ '--from-x': '50%', '--from-y': '50%', '--to-x': `${selected.x}%`, '--to-y': `${selected.y}%`, '--delay': `${step * 1.1}s` } as React.CSSProperties}
              >
                <i />
              </span>
            ))}
            {connections.map(({ partner }, index) => (
              <span
                key={partner.id}
                className="feature-map__signal feature-map__signal--relation"
                style={{ '--from-x': `${selected.x}%`, '--from-y': `${selected.y}%`, '--to-x': `${partner.x}%`, '--to-y': `${partner.y}%`, '--delay': `${0.5 + index * 0.35}s` } as React.CSSProperties}
              >
                <i />
              </span>
            ))}
          </div>
          <div className="feature-map__hub" aria-hidden="true">
            <img src="/images/mascot/acosmibot-mascot-320.webp" width={320} height={343} alt="" loading="lazy" />
          </div>
          {connections.map(({ relation, partner }) => {
            // Measured from the selected feature, whichever end of the link it is.
            const pinned = relation.from === selected.id ? relation.labelAt : relation.labelAt !== undefined ? 1 - relation.labelAt : undefined;
            const along = pinned ?? RELATION_LABEL_POSITION;
            return (
              <span
                key={`${selected.id}-${partner.id}`}
                className="feature-map__relation-label"
                aria-hidden="true"
                style={{
                  '--label-x': `${selected.x + (partner.x - selected.x) * along}%`,
                  '--label-y': `${selected.y + (partner.y - selected.y) * along}%`,
                } as React.CSSProperties}
              >
                {relation.label}
              </span>
            );
          })}
          {FEATURES.map((feature, index) => {
            const FeatureIcon = feature.Icon;
            const isSelected = feature.id === selected.id;
            return (
              <button
                key={feature.id}
                type="button"
                className={`feature-node feature-node--${feature.family}${isSelected ? ' is-selected' : ''}${partnerIds.has(feature.id) ? ' is-related' : ''}`}
                style={{ '--node-x': `${feature.x}%`, '--node-y': `${feature.y}%`, '--order': index } as React.CSSProperties}
                onClick={() => onSelect(feature.id)}
                aria-pressed={isSelected}
              >
                <span className="feature-node__mark"><FeatureIcon aria-hidden="true" /></span>
                <span className="feature-node__label">{feature.shortName}</span>
              </button>
            );
          })}
        </div>
        <div className="feature-map__hint">
          <MousePointer2 aria-hidden="true" />
          {tour.running ? 'Touring · select a node to take over' : 'Select a node to inspect'}
        </div>
      </div>

      <aside
        className={`feature-inspector feature-inspector--${selected.family}`}
        // Announcing every automatic step would talk over the visitor.
        aria-live={tour.paused || !tour.available ? 'polite' : 'off'}
        onPointerEnter={() => tour.onHold(true)}
        onPointerLeave={() => tour.onHold(false)}
      >
        <div className="feature-inspector__body" key={selected.id}>
          <div className="feature-inspector__head">
            <div className="feature-inspector__icon"><SelectedIcon aria-hidden="true" /></div>
            <div>
              <span>{FAMILY_LABELS[selected.family]} system</span>
              <h3>{selected.name}</h3>
            </div>
          </div>
          <p>{selected.description}</p>
          {connections.length > 0 && (
            <div className="feature-inspector__partners">
              <span>Works with</span>
              {connections.map(({ relation, partner }) => {
                const PartnerIcon = partner.Icon;
                return (
                  <button
                    key={partner.id}
                    type="button"
                    className={`feature-inspector__partner feature-node--${partner.family}`}
                    onClick={() => onSelect(partner.id)}
                    aria-label={`${partner.name}: ${relation.label}`}
                  >
                    <PartnerIcon aria-hidden="true" /> {partner.shortName}
                  </button>
                );
              })}
            </div>
          )}
          {previewId ? (
            <>
              <div className="feature-inspector__divider">
                <span>{showcasePreviewSurface(previewId) === 'dashboard' ? 'In the dashboard' : 'In Discord'}</span>
                <span>Sample data</span>
              </div>
              <ShowcasePreview id={previewId} />
            </>
          ) : (
            <>
              <div className="feature-inspector__divider">
                <span>Connected capabilities</span>
                <span>{selected.bullets.length.toString().padStart(2, '0')}</span>
              </div>
              <ul>
                {selected.bullets.map(item => <li key={item}><Check aria-hidden="true" /> {item}</li>)}
              </ul>
            </>
          )}
          <div className="feature-inspector__links">
            {showcaseRow && (
              <button
                type="button"
                className="feature-inspector__link feature-inspector__link--primary"
                onClick={() => onShowRow(showcaseRow)}
              >
                See it in Discord <ArrowRight aria-hidden="true" />
              </button>
            )}
            {landingPath && (
              <Link to={landingPath} className="feature-inspector__link">
                Explore {selected.shortName} <ArrowRight aria-hidden="true" />
              </Link>
            )}
            <Link to={docsPath} className="feature-inspector__link">
              Read the docs <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
};

export const HomePage: React.FC = () => {
  const donationDialogRef = useRef<HTMLDivElement>(null);
  const bitcoinDialogRef = useRef<HTMLDivElement>(null);
  const modalRestoreRef = useRef<HTMLElement | null>(null);
  const [selectedFeature, setSelectedFeature] = useState(FEATURE_TOUR[0]);
  // The map tours itself while it is on screen, until the visitor picks a node
  // or pauses it. It also holds while they hover the inspector to read.
  const reducedMotion = usePrefersReducedMotion();
  const mapReveal = useReveal<HTMLDivElement>(0.3);
  const [tourPaused, setTourPaused] = useState(false);
  const [tourHeld, setTourHeld] = useState(false);
  const tourRunning = mapReveal.inView && !tourPaused && !tourHeld && !reducedMotion;
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

  useEffect(() => {
    if (!tourRunning) return;
    const timer = window.setTimeout(() => {
      setSelectedFeature(current => FEATURE_TOUR[(FEATURE_TOUR.indexOf(current) + 1) % FEATURE_TOUR.length]);
    }, TOUR_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [tourRunning, selectedFeature]);

  // A selection made by the visitor ends the tour; they can resume it from the map.
  const selectFeature = useCallback((id: string) => {
    setSelectedFeature(id);
    setTourPaused(true);
  }, []);
  const toggleTour = useCallback(() => setTourPaused(current => !current), []);

  const showRowInDiscord = useCallback((id: ShowcaseRowId) => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(showcaseAnchor(id))?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
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
            <MiniConstellation onSelect={selectFeature} />
          </div>
          <a className="home-hero__scroll" href="#in-discord">
            <span>See it in action</span>
            <i />
          </a>
        </section>

        <section className="showcase-section" id="in-discord" aria-labelledby="showcase-title">
          <div className="home-shell">
            <DiscordShowcase />
          </div>
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
            <FeatureMap
              selectedId={selectedFeature}
              onSelect={selectFeature}
              onShowRow={showRowInDiscord}
              tour={{ available: !reducedMotion, paused: tourPaused, running: tourRunning, onToggle: toggleTour, onHold: setTourHeld }}
              reveal={mapReveal.reveal}
              explorerRef={mapReveal.ref}
            />
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
            <Link to="/status">Status</Link>
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
                  <span className="method-name">Stripe</span>
                  <p className="method-description">Choose a one-time amount; no public attribution</p>
                </div>
                <a href={STRIPE_DONATION_URL} target="_blank" rel="noopener noreferrer" className="donation-btn">
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
