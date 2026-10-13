/**
 * Homepage "In your server" showcase.
 *
 * Six feature rows alternate sides down the page. Each row pairs a short
 * explanation with a Discord channel panel that tilts toward the page center;
 * the last one shows the Event Horizon Activity instead of a channel.
 * Every panel is live DOM rather than a screenshot: the rank and weather cards
 * are the same components the render-card function rasterizes for Discord, the
 * announcement uses the dashboard's own embed preview, and the game results
 * and AI replies mirror the embeds and messages the bot builds in its Cogs and
 * Views. Because nothing is a baked image, the stage can tilt, lift, and light
 * each piece without a background box. All members, servers, and values are
 * sample data.
 *
 * The same scenes, plus one compact example for every other feature, also feed
 * the feature map's inspector through `ShowcasePreview`.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, BellOff, Bot, Check, ChevronDown, Dices, ExternalLink, Eye, Hash, Image as ImageIcon, LayoutDashboard, Link2, LucideIcon, PanelTop, Pause, Play, Rocket, Users } from 'lucide-react';
import { RankCard, CARD_HEIGHT as RANK_HEIGHT, CARD_WIDTH as RANK_WIDTH } from '@/cards/RankCard';
import { WeatherCard, CARD_HEIGHT as WEATHER_HEIGHT, CARD_WIDTH as WEATHER_WIDTH } from '@/cards/WeatherCard';
import type { RankCardData, WeatherCardData } from '@/cards/types';
import { DiscordEmbedPreview, type EmbedButton, type EmbedConfig } from '@/components/ui/DiscordEmbedPreview';
import { MemberFlowChart, type MemberFlowDay } from '@/features/analytics/charts';
import { revealClass, usePrefersReducedMotion, useReveal, type Reveal } from './useReveal';
import '@/styles/home-showcase.css';

export type ShowcaseRowId = 'rank' | 'ai' | 'games' | 'custom-embeds' | 'social-embeds' | 'event-horizon';

/** Element id of a showcase row, shared with the feature map's jump links. */
export const showcaseAnchor = (id: ShowcaseRowId): string => `showcase-${id}`;

const BOT_AVATAR = '/images/showcase/acosmibot-avatar.webp';
const emote = (name: string) => `/images/emotes/aco/${name}.png`;
const slotArt = (name: string) => `/images/slots/acosmibot/${name}.png`;
const rankArt = (name: string) => `/images/showcase/rank-cards/${name}.webp`;
const cardArt = (name: string) => `/images/showcase/games/card-${name}.webp`;
const aiArt = (name: string) => `/images/showcase/ai/${name}.webp`;

const RANK_INTERVAL_MS = 3400;
const AI_INTERVAL_MS = 6500;
const GAME_INTERVAL_MS = 6000;

// Discord's preset embed colors, as discord.py names them.
const EMBED_GREEN = '#2ecc71';
const EMBED_ORANGE = '#e67e22';
const EMBED_BLURPLE = '#5865f2';
const EMBED_UNSET = '#1e1f22';
// AI plan embeds only disclose a cost line; this is the bot's zero-cost wording.
const INCLUDED_CREDIT_COST = '0 AI Credits — covered by this server’s included monthly allowance.';

// Sample members reused across every row.
const NOVA = { name: 'Nova', username: 'nova', avatar: emote('acocozy') };
const ORION = { name: 'Orion', avatar: emote('acohmm') };
const VEGA = { name: 'Vega', avatar: emote('acoflex') };
const LYRA = { name: 'Lyra', avatar: emote('acosalute') };
const ACOSMICOIN = '/images/emotes/acosmicoin.png';

// Level 34 spans 115,600–122,500 XP on the bot's level² × 100 curve.
const RANK_SAMPLE: RankCardData = {
  username: NOVA.username,
  displayName: NOVA.name,
  avatarUrl: NOVA.avatar,
  guildName: 'Starlight Lounge',
  rank: 3,
  level: 34,
  globalLevel: 41,
  currentExp: 118240,
  expProgress: 2640,
  expNeeded: 6900,
};

interface RankVariant {
  id: string;
  label: string;
  detail: string;
  loadout?: RankCardData['loadout'];
}

const ARTWORK_FALLBACK = '#18191c';

// Real Card Studio cosmetics. Gradients, ring colors, and accent colors are the
// catalog values seeded in add_cosmetics_system.sql; the artwork files are
// copies of the uploaded 800×250 backgrounds served from the production CDN.
const RANK_VARIANTS: RankVariant[] = [
  { id: 'midnight', label: 'Midnight', detail: 'The default background with the cyan accent.' },
  {
    id: 'nebula',
    label: 'Nebula',
    detail: 'Gradient background with a gold ring and amber accent.',
    loadout: { background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)', ringColor: '#ffd700', accentColor: '#ffb300' },
  },
  {
    id: 'flat-earth',
    label: 'Flat Earth',
    detail: 'Artwork background with a gold ring.',
    loadout: { background: ARTWORK_FALLBACK, backgroundImageUrl: rankArt('flat-earth'), layoutPreset: 'artwork', ringColor: '#ffd700' },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    detail: 'Gradient background with a white ring and hot pink accent.',
    loadout: { background: 'linear-gradient(135deg, #2b1331, #5b1e44, #8a2846)', ringColor: '#ffffff', accentColor: '#ff5277' },
  },
  {
    id: 'goth',
    label: 'Goth',
    detail: 'Artwork background with a white ring and violet accent.',
    loadout: { background: ARTWORK_FALLBACK, backgroundImageUrl: rankArt('goth'), layoutPreset: 'artwork', ringColor: '#ffffff', accentColor: '#a855f7' },
  },
  {
    id: 'exile',
    label: 'Exile',
    detail: 'Artwork background with the default ring and accent.',
    loadout: { background: ARTWORK_FALLBACK, backgroundImageUrl: rankArt('exile'), layoutPreset: 'artwork' },
  },
  {
    id: 'og',
    label: 'OG Card',
    detail: 'An achievement reward with a gold filigree frame.',
    loadout: { background: 'linear-gradient(135deg, #3a2f0b, #7a5c12, #c9a227, #7a5c12, #3a2f0b)', backgroundKey: 'og_member' },
  },
  {
    id: 'aurora',
    label: 'Aurora',
    detail: 'Gradient background with a cyan ring and lime accent.',
    loadout: { background: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)', ringColor: '#00ffff', accentColor: '#a3ff3c' },
  },
];

const rankData = (index: number): RankCardData => ({ ...RANK_SAMPLE, loadout: RANK_VARIANTS[index].loadout });

const WEATHER_SAMPLE: WeatherCardData = {
  card: 'weather',
  location: 'Chicago, IL, US',
  temperature: '61°F',
  condition: 'Few clouds',
  detail: 'H:64°F  L:48°F · Feels 59°F',
  iconCode: '02d',
  days: [
    { label: 'TODAY', iconCode: '02d', high: '64°F', low: '48°F' },
    { label: 'Tue', iconCode: '01d', high: '68°F', low: '51°F' },
    { label: 'Wed', iconCode: '03d', high: '66°F', low: '52°F' },
    { label: 'Thu', iconCode: '10d', high: '59°F', low: '49°F' },
    { label: 'Fri', iconCode: '04d', high: '57°F', low: '46°F' },
  ],
};

const ANNOUNCEMENT_EMBED: EmbedConfig = {
  author: { name: 'Starlight Lounge', icon_url: emote('acosalute') },
  title: 'Event Horizon high-score night',
  description: 'Friday at 8 PM ET. Launch the Activity from any voice channel and post your best flight. Top three pilots split the prize pool.',
  color: 0x00d9ff,
  fields: [
    { name: 'Prize pool', value: '50,000 Acosmicoins', inline: true },
    { name: 'Entry', value: 'Free', inline: true },
    { name: 'Where', value: '#game-night', inline: true },
  ],
  image: { url: '/images/showcase/event-horizon-key-art.webp' },
  footer: { text: 'Sent from the Acosmibot dashboard' },
};

const ANNOUNCEMENT_BUTTONS: EmbedButton[] = [
  { label: 'How to play', url: '/docs/event-horizon' },
  { label: 'Leaderboard', url: '/leaderboard' },
];

// Keno: five picks against the ten numbers drawn. Three hits on five spots pays
// 4x on the bot's paytable (utils/keno.py).
const KENO_PICKS = new Set([4, 13, 22, 27, 36]);
const KENO_DRAWN = new Set([4, 9, 13, 18, 22, 25, 31, 34, 38, 40]);
const KENO_ROWS = [0, 1, 2, 3, 4].map(row => Array.from({ length: 8 }, (_, column) => row * 8 + column + 1));
// Sprite order: tiles 1–40, then the hit, miss, and drawn markers.
const KENO_HIT = 40;
const KENO_MISS = 41;
const KENO_DRAWN_MARK = 42;
const kenoTile = (value: number): number => {
  if (KENO_PICKS.has(value) && KENO_DRAWN.has(value)) return KENO_HIT;
  if (KENO_DRAWN.has(value)) return KENO_DRAWN_MARK;
  if (KENO_PICKS.has(value)) return KENO_MISS;
  return value - 1;
};

interface ShowcaseRowState {
  copyRef: React.RefObject<HTMLDivElement>;
  copyReveal: Reveal;
  stageRef: React.RefObject<HTMLDivElement>;
  stageReveal: Reveal;
  /** True while enough of the stage is on screen for its carousel to run. */
  inView: boolean;
}

/**
 * Per-row behavior: the explanation and the stage each enter as they scroll
 * in (they stack on small screens, so they are observed separately), and the
 * stage leans a few degrees toward the cursor.
 */
function useShowcaseRow(): ShowcaseRowState {
  const copy = useReveal<HTMLDivElement>(0, '0px 0px -10% 0px');
  const stageReveal = useReveal<HTMLDivElement>(0.3);
  const stageRef = stageReveal.ref;

  // Pointer parallax. Skipped for touch and reduced-motion visitors, who keep
  // the resting tilt.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    const apply = (x: number, y: number) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        stage.style.setProperty('--lean-x', x.toFixed(3));
        stage.style.setProperty('--lean-y', y.toFixed(3));
      });
    };
    const onMove = (event: PointerEvent) => {
      const bounds = stage.getBoundingClientRect();
      apply(
        ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
        ((event.clientY - bounds.top) / bounds.height - 0.5) * 2,
      );
    };
    const onLeave = () => apply(0, 0);

    stage.addEventListener('pointermove', onMove, { passive: true });
    stage.addEventListener('pointerleave', onLeave);
    return () => {
      window.cancelAnimationFrame(frame);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return { copyRef: copy.ref, copyReveal: copy.reveal, stageRef, stageReveal: stageReveal.reveal, inView: stageReveal.inView };
}

/**
 * Steps through `count` slides while `enabled`. Choosing a slide by hand pauses
 * the rotation, so the visitor keeps what they picked until they resume it.
 */
function useRotation(count: number, intervalMs: number, enabled: boolean) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const running = enabled && !paused;

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setIndex(current => (current + 1) % count), intervalMs);
    return () => window.clearTimeout(timer);
  }, [running, index, count, intervalMs]);

  const select = useCallback((next: number) => {
    setIndex(next);
    setPaused(true);
  }, []);
  const toggle = useCallback(() => setPaused(current => !current), []);

  return { index, paused, running, select, toggle };
}

type Rotation = ReturnType<typeof useRotation>;

/** Plays a muted looping clip only while `playing`; otherwise it rests on its poster or last frame. */
function useLoopingClip(playing: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      // Autoplay can be refused (data saver, low power); the poster stays up.
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [playing]);

  return videoRef;
}

/** Scales a fixed-size card to the width of its column without reflowing it. */
const FitCard: React.FC<{ width: number; height: number; label: string; children: React.ReactNode }> = ({
  width,
  height,
  label,
  children,
}) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => { if (frame.clientWidth) setScale(frame.clientWidth / width); };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={frameRef} className="dc-attachment dc-lift" role="img" aria-label={label} style={{ aspectRatio: `${width} / ${height}` }}>
      <div
        className="dc-attachment__canvas"
        aria-hidden="true"
        // Unset once measured so the canvas still inherits `hidden` from an inactive slide.
        style={{ width, height, transform: `scale(${scale})`, visibility: scale ? undefined : 'hidden' }}
      >
        {children}
      </div>
    </div>
  );
};

/**
 * Crossfades between rank-card loadouts. The outgoing card stays underneath
 * until the incoming one has faded in, so the art never drops to an empty frame.
 */
const RankCardStack: React.FC<{ index: number }> = ({ index }) => {
  const [layers, setLayers] = useState<{ current: number; previous: number | null }>({ current: index, previous: null });
  if (layers.current !== index) setLayers({ current: index, previous: layers.current });

  const visible = layers.previous === null ? [layers.current] : [layers.previous, layers.current];
  return (
    <FitCard
      width={RANK_WIDTH}
      height={RANK_HEIGHT}
      label={`Rank card for Nova: rank 3, level 34 in Starlight Lounge, with the ${RANK_VARIANTS[layers.current].label} background`}
    >
      {visible.map(layer => (
        <div key={layer} className={`dc-card-layer${layer === layers.current ? ' is-current' : ''}`}>
          <RankCard data={rankData(layer)} />
        </div>
      ))}
    </FitCard>
  );
};

const Invocation: React.FC<{ avatar: string; user: string; command: string }> = ({ avatar, user, command }) => (
  <p className="dc-message__context">
    <img src={avatar} width={16} height={16} alt="" loading="lazy" />
    <strong>{user}</strong> used <span className="dc-chip">/{command}</span>
  </p>
);

/** Acosmibot is a verified app, so Discord draws a check inside its tag. */
const AppTag: React.FC = () => (
  <span className="dc-app-tag"><Check aria-hidden="true" />APP</span>
);

/** The quoted line Discord shows above a message that replies to another. */
const Reply: React.FC<{ member: { name: string; avatar: string }; app?: boolean; children: React.ReactNode }> = ({ member, app, children }) => (
  <p className="dc-message__context">
    <img src={member.avatar} width={16} height={16} alt="" loading="lazy" />
    {app && <AppTag />}
    <strong>{app ? `@${member.name}` : member.name}</strong>
    <span className="dc-message__quote">{children}</span>
  </p>
);

const DiscordMessage: React.FC<{
  author: string;
  avatar: string;
  time: string;
  app?: boolean;
  silent?: boolean;
  context?: React.ReactNode;
  children: React.ReactNode;
}> = ({ author, avatar, time, app, silent, context, children }) => (
  <article className={`dc-message${context ? ' has-context' : ''}`}>
    {context}
    <img className="dc-message__avatar" src={avatar} width={40} height={40} alt="" loading="lazy" />
    <div className="dc-message__body">
      <header>
        <strong className={app ? 'is-app' : undefined} translate="no">{author}</strong>
        {app && <AppTag />}
        <span className="dc-message__time">{time}</span>
        {silent && <BellOff className="dc-message__silent" role="img" aria-label="Sent silently" />}
      </header>
      {children}
    </div>
  </article>
);

/** Inline custom emoji, sized like Discord renders them inside embed text. */
const Emoji: React.FC<{ src: string; name: string; jumbo?: boolean }> = ({ src, name, jumbo }) => (
  <img className={`dc-emoji${jumbo ? ' dc-emoji--jumbo' : ''}`} src={src} width={jumbo ? 34 : 22} height={jumbo ? 34 : 22} alt={`:${name}:`} loading="lazy" />
);

const Mention: React.FC<{ children: React.ReactNode }> = ({ children }) => <span className="dc-chip">@{children}</span>;

const Embed: React.FC<{
  color: string;
  author?: { name: string; icon: string };
  title?: React.ReactNode;
  footer?: React.ReactNode;
  footerIcon?: string;
  thumbnail?: string;
  children: React.ReactNode;
}> = ({ color, author, title, footer, footerIcon, thumbnail, children }) => (
  <div className="discord-embed dc-lift">
    <div className="discord-embed-color-bar" style={{ backgroundColor: color }} />
    <div className={`discord-embed-content${thumbnail ? ' has-thumbnail' : ''}`}>
      {thumbnail && (
        <div className="discord-embed-thumbnail"><img src={thumbnail} width={80} height={80} alt="" loading="lazy" /></div>
      )}
      {author && (
        <div className="discord-embed-author">
          <img className="discord-embed-author-icon" src={author.icon} width={24} height={24} alt="" loading="lazy" />
          <span className="discord-embed-author-name">{author.name}</span>
        </div>
      )}
      {title && <div className="discord-embed-title">{title}</div>}
      {children}
      {footer && (
        <div className="discord-embed-footer">
          {footerIcon && <img className="discord-embed-footer-icon" src={footerIcon} width={20} height={20} alt="" loading="lazy" />}
          <span className="discord-embed-footer-text">{footer}</span>
        </div>
      )}
    </div>
  </div>
);

const EmbedField: React.FC<{ name: React.ReactNode; inline?: boolean; children: React.ReactNode }> = ({ name, inline, children }) => (
  <div className={`discord-embed-field${inline ? ' discord-embed-field-inline' : ''}`}>
    <div className="discord-embed-field-name">{name}</div>
    <div className="discord-embed-field-value dc-embed-lines">{children}</div>
  </div>
);

const RankScene: React.FC<{ index: number }> = ({ index }) => (
  <DiscordMessage
    author="Acosmibot"
    avatar={BOT_AVATAR}
    time="Today at 4:12 PM"
    app
    context={<Invocation avatar={NOVA.avatar} user={NOVA.name} command="rank" />}
  >
    <RankCardStack index={index} />
    <div className="dc-actions">
      <span className="dc-button dc-button--link">🌐 Customize your profile <ExternalLink aria-hidden="true" /></span>
    </div>
  </DiscordMessage>
);

const BOT_MEMBER = { name: 'Acosmibot', avatar: BOT_AVATAR };

/** A member mentions Acosmibot with a question and the bot replies to it. */
const AiExchange: React.FC<{
  asker: { name: string; avatar: string };
  time: string;
  question: string;
  children: React.ReactNode;
}> = ({ asker, time, question, children }) => (
  <>
    <DiscordMessage author={asker.name} avatar={asker.avatar} time={time}>
      <p className="dc-text"><Mention>Acosmibot</Mention> {question}</p>
    </DiscordMessage>
    <DiscordMessage
      author="Acosmibot"
      avatar={BOT_AVATAR}
      time={time}
      app
      context={<Reply member={asker}><Mention>Acosmibot</Mention> {question}</Reply>}
    >
      {children}
    </DiscordMessage>
  </>
);

// The AI weather path sends the /weather card plus its unit toggle
// (AIControls._ai_weather_presentation).
const AiWeatherScene: React.FC = () => (
  <AiExchange asker={ORION} time="Today at 9:41 AM" question="do I need a jacket in Chicago this week?">
    <p className="dc-text">Tonight, yes: it drops to 48°F. The rest of the week stays mild until rain moves in on Thursday.</p>
    <FitCard width={WEATHER_WIDTH} height={WEATHER_HEIGHT} label="Weather card for Chicago: 61°F, few clouds, with a five-day forecast">
      <WeatherCard data={WEATHER_SAMPLE} />
    </FitCard>
    <div className="dc-actions">
      <span className="dc-button dc-button--secondary">🌡️ Switch to °C</span>
    </div>
  </AiExchange>
);

// Answers come from the server_stats tool. The second reply matches the rank
// card sample: rank 3, level 34, 4,260 XP short of level 35.
const AiStatsScene: React.FC = () => (
  <>
    <AiExchange asker={NOVA} time="Today at 4:36 PM" question="who has the most Acosmicoins in this server?">
      <p className="dc-text">Vega has the most, with <strong>2,486,310 Acosmicoins</strong>. A truly central-bank-sized pile.</p>
    </AiExchange>
    <AiExchange asker={NOVA} time="Today at 4:37 PM" question="and where do I rank by level?">
      <p className="dc-text">You’re <strong>#3</strong> in Starlight Lounge at level <strong>34</strong>, with 4,260 XP to go until level 35.</p>
    </AiExchange>
  </>
);

// Web answers are plain text; the bot only adds a URL when the member asks for one.
const AiSearchScene: React.FC = () => (
  <AiExchange asker={VEGA} time="Today at 7:02 PM" question="look up the tallest volcano in the solar system">
    <p className="dc-text">
      That’s Olympus Mons on Mars. It stands roughly 22 km high, about two and a half times the height of Mount Everest.
    </p>
  </AiExchange>
);

// AI reminders reuse the /reminder confirmation embed
// (ReminderCommand.build_reminder_set_embed). The bar is the member's role color.
const AiReminderScene: React.FC = () => (
  <AiExchange asker={NOVA} time="Today at 4:35 PM" question="remind me to claim my daily tomorrow at 9am">
    <p className="dc-text">Done. I’ll DM you tomorrow at 9 AM so the streak survives.</p>
    <Embed
      color="#3498db"
      author={{ name: NOVA.username, icon: NOVA.avatar }}
      title="⏰ Reminder Set!"
      footer="Timezone: America/Chicago • You’ll receive a DM when it’s time!"
    >
      <div className="discord-embed-description">I’ll remind you in <strong>16 hours, 25 minutes</strong></div>
      <div className="discord-embed-fields">
        <EmbedField name="Reminder">claim my daily</EmbedField>
        <EmbedField name="When"><span className="dc-timestamp">Tuesday, October 13, 2026 9:00 AM</span></EmbedField>
      </div>
    </Embed>
  </AiExchange>
);

/** The approved state of the image/emote plan (Views/AIGenerationConfirmView.py). */
const PlanEmbed: React.FC<{ prompt: string; request: string; editLabel: string; children: React.ReactNode }> = ({ prompt, request, editLabel, children }) => (
  <>
    <Embed color={EMBED_GREEN} title="Making it now…">
      <blockquote className="discord-embed-description dc-quote">{prompt}</blockquote>
      <div className="discord-embed-fields">
        <EmbedField name="Original request">{request}</EmbedField>
        {children}
        <EmbedField name="AI Credit cost">{INCLUDED_CREDIT_COST}</EmbedField>
      </div>
    </Embed>
    <div className="dc-actions">
      <span className="dc-button dc-button--success is-disabled">Generate</span>
      <span className="dc-button dc-button--secondary is-disabled">{editLabel}</span>
      <span className="dc-button dc-button--danger is-disabled">Cancel</span>
    </div>
  </>
);

const IMAGE_REQUEST = 'make an image of you holding a giant snowflake';
const EMOTE_REQUEST = 'Make this into an emote please';

// The requester approves the plan, then the image arrives as its own reply.
// Both bot messages quote the request, so the member's own message is omitted.
// The picture is Acosmibot brand art standing in for a generated result.
const AiImageScene: React.FC = () => (
  <>
    <DiscordMessage
      author="Acosmibot"
      avatar={BOT_AVATAR}
      time="Today at 5:53 PM"
      app
      context={<Reply member={NOVA}><Mention>Acosmibot</Mention> {IMAGE_REQUEST}</Reply>}
    >
      <PlanEmbed prompt="Acosmibot, a hooded robot mascot, holding a giant glowing snowflake" request={IMAGE_REQUEST} editLabel="Edit prompt">
        <EmbedField name="Reference pictures">None — this will be drawn from the prompt alone.</EmbedField>
      </PlanEmbed>
    </DiscordMessage>
    <DiscordMessage
      author="Acosmibot"
      avatar={BOT_AVATAR}
      time="Today at 5:53 PM"
      app
      context={<Reply member={NOVA}><Mention>Acosmibot</Mention> {IMAGE_REQUEST}</Reply>}
    >
      <p className="dc-text">Here’s your generated image.</p>
      <img className="dc-image dc-lift" src={aiArt('generated-snowflake')} width={640} height={640} alt="Acosmibot holding a giant glowing snowflake" loading="lazy" />
    </DiscordMessage>
  </>
);

// A reply to the generated image turns it into a server emote (AI/emote_create.py).
const AiEmoteScene: React.FC = () => (
  <>
    <DiscordMessage
      author={NOVA.name}
      avatar={NOVA.avatar}
      time="Today at 5:54 PM"
      context={<Reply member={BOT_MEMBER} app>Here’s your generated image. <ImageIcon className="dc-context-icon" aria-hidden="true" /></Reply>}
    >
      <p className="dc-text">{EMOTE_REQUEST}</p>
    </DiscordMessage>
    <DiscordMessage
      author="Acosmibot"
      avatar={BOT_AVATAR}
      time="Today at 5:54 PM"
      app
      context={<Reply member={NOVA}>{EMOTE_REQUEST}</Reply>}
    >
      <PlanEmbed prompt="A small, expressive emote based on the image in the replied-to message" request={EMOTE_REQUEST} editLabel="Edit emote">
        <EmbedField name="Emote name">:acoSNOWFLAKE:</EmbedField>
        <EmbedField name="Base image">1 image from this message or its reply chain.</EmbedField>
      </PlanEmbed>
      <div className="dc-select">the attached or replied-to image <ChevronDown aria-hidden="true" /></div>
    </DiscordMessage>
    <DiscordMessage
      author="Acosmibot"
      avatar={BOT_AVATAR}
      time="Today at 5:55 PM"
      app
      context={<Reply member={NOVA}>{EMOTE_REQUEST}</Reply>}
    >
      <p className="dc-text">Created <Emoji src={aiArt('emote-snowflake')} name="acoSNOWFLAKE" />.</p>
    </DiscordMessage>
  </>
);

interface AiSlide {
  id: string;
  label: string;
  detail: string;
  View: React.FC;
}

const AI_SLIDES: AiSlide[] = [
  { id: 'weather', label: 'Weather', detail: 'Forecasts arrive with the same card /weather sends.', View: AiWeatherScene },
  { id: 'stats', label: 'Server stats', detail: 'Levels, ranks, balances, and leaderboards, read from your server’s own data.', View: AiStatsScene },
  { id: 'search', label: 'Web search', detail: 'Looks things up on the live web when a question needs current facts.', View: AiSearchScene },
  { id: 'reminders', label: 'Reminders', detail: 'Saves a reminder from plain language and DMs the member when it is due.', View: AiReminderScene },
  { id: 'images', label: 'Images', detail: 'Generates an image once the requester approves the prompt and the cost.', View: AiImageScene },
  { id: 'emotes', label: 'Emotes', detail: 'Turns an image into a custom emote and adds it to your server.', View: AiEmoteScene },
];

// Mirrors the result embed built in Cogs/Slots.py. Four gems pay 15 × the rare
// tier's 3, so a 100 bet returns 4,500.
const SlotsScene: React.FC = () => (
  <DiscordMessage
    author="Acosmibot"
    avatar={BOT_AVATAR}
    time="Today at 10:27 PM"
    app
    context={<Invocation avatar={NOVA.avatar} user={NOVA.name} command="games slots" />}
  >
    <Embed
      color={EMBED_GREEN}
      author={{ name: NOVA.username, icon: NOVA.avatar }}
      title={<><Emoji src={slotArt('sl_coin')} name="sl_coin" /> Slots</>}
      footer="Balance: 16,950"
    >
      <div className="dc-slots-reels" role="img" aria-label="Reels: gem, gem, gem, gem, bolt">
        {['sl_gem', 'sl_gem', 'sl_gem', 'sl_gem', 'sl_bolt'].map((symbol, index) => (
          <React.Fragment key={index}>
            <span aria-hidden="true">|</span>
            <Emoji src={slotArt(symbol)} name={symbol} jumbo />
          </React.Fragment>
        ))}
        <span aria-hidden="true">|</span>
      </div>
      <div className="discord-embed-description dc-embed-lines">
        <p><strong>FOUR IN A ROW!</strong> <Emoji src={slotArt('sl_gem')} name="sl_gem" /> ×45 <Emoji src={emote('acoflex')} name="acoflex" /></p>
        <p className="dc-embed-gap">Bet: <strong>100</strong> Acosmicoins → Won <strong>4,500</strong> Acosmicoins (+4,400)</p>
        <p><Emoji src={slotArt('sl_gem')} name="sl_gem" /> = Rare tier</p>
      </div>
    </Embed>
    <div className="dc-actions">
      <span className="dc-button dc-button--primary">
        <Emoji src={slotArt('sl_coin')} name="sl_coin" /> Spin Again (100 Acosmicoins)
      </span>
    </div>
  </DiscordMessage>
);

const KenoTile: React.FC<{ tile: number; inline?: boolean }> = ({ tile, inline }) => (
  <span
    className={`dc-keno__tile${inline ? ' dc-keno__tile--inline' : ''}`}
    aria-hidden="true"
    style={{ backgroundPosition: `${((tile % 8) / 7) * 100}% ${(Math.floor(tile / 8) / 5) * 100}%` }}
  />
);

// Mirrors Views/Keno_View.py: every board cell is a custom emoji tile.
const KenoScene: React.FC = () => (
  <DiscordMessage
    author="Acosmibot"
    avatar={BOT_AVATAR}
    time="Today at 10:31 PM"
    app
    context={<Invocation avatar={NOVA.avatar} user={NOVA.name} command="games keno" />}
  >
    <Embed
      color={EMBED_GREEN}
      author={{ name: NOVA.username, icon: NOVA.avatar }}
      title={<><KenoTile tile={KENO_DRAWN_MARK} inline /> Keno</>}
      footer="Balance: 17,250"
    >
      <div className="dc-keno" role="img" aria-label="Keno board of 40 numbers. Picks 4, 13, and 22 were drawn; picks 27 and 36 were not.">
        {KENO_ROWS.map(row => (
          <div className="dc-keno__row" key={row[0]}>
            {row.map(value => <KenoTile key={value} tile={kenoTile(value)} />)}
          </div>
        ))}
      </div>
      <div className="discord-embed-description dc-embed-lines">
        <p><KenoTile tile={KENO_HIT} inline /> hit | <KenoTile tile={KENO_MISS} inline /> miss | <KenoTile tile={KENO_DRAWN_MARK} inline /> drawn</p>
        <p className="dc-embed-gap">Bet: <strong>100</strong> Acosmicoins | Spots: <strong>5</strong></p>
        <p className="dc-embed-gap">
          <Emoji src={emote('acocelebrate')} name="acocelebrate" /> <strong>3/5 matched!</strong> Multiplier <strong>4x</strong> — paid <strong>400</strong> Acosmicoins (<strong>+300</strong>).
        </p>
      </div>
      <div className="discord-embed-fields">
        <EmbedField name="Paytable (5 spots)">
          <p>3 matches → <strong>4x</strong></p>
          <p>4 matches → <strong>40x</strong></p>
          <p>5 matches → <strong>650x</strong></p>
        </EmbedField>
      </div>
    </Embed>
    <div className="dc-actions">
      <span className="dc-button dc-button--primary">🔄 Bet Again (100 Acosmicoins)</span>
    </div>
  </DiscordMessage>
);

const Hand: React.FC<{ label: string; cards: string[] }> = ({ label, cards }) => (
  <div className="dc-hand" role="img" aria-label={label}>
    {cards.map(card => <img key={card} src={cardArt(card)} width={30} height={30} alt="" loading="lazy" />)}
  </div>
);

// Mirrors the finished-game embed in Views/Blackjack_View.py, drawn with the
// Classic card set's emoji.
const BlackjackScene: React.FC = () => (
  <DiscordMessage
    author="Acosmibot"
    avatar={BOT_AVATAR}
    time="Today at 10:36 PM"
    app
    context={<Invocation avatar={NOVA.avatar} user={NOVA.name} command="games blackjack" />}
  >
    <Embed
      color={EMBED_GREEN}
      author={{ name: NOVA.username, icon: NOVA.avatar }}
      title="♠️ Blackjack - You win! ♥️"
      footer="Balance: 17,350"
    >
      <div className="discord-embed-description dc-embed-lines">
        <p><strong>Dealer’s Hand (18):</strong></p>
        <Hand label="King of hearts and eight of spades" cards={['kh', '8s']} />
        <p className="dc-embed-gap"><strong>Your Hand (20):</strong></p>
        <Hand label="Ace of spades and nine of clubs" cards={['as', '9c']} />
        <p className="dc-embed-gap"><Emoji src={emote('acoez')} name="acoez" /> <strong>You win!</strong></p>
      </div>
      <div className="discord-embed-fields">
        <EmbedField name="Results">
          <p><strong>Hand 1:</strong> Win! +100</p>
          <p className="dc-embed-gap"><strong>Net Profit:</strong> +100 Acosmicoins 💰</p>
        </EmbedField>
      </div>
    </Embed>
    <div className="dc-actions">
      <span className="dc-button dc-button--primary">🔄 Bet Again (100 Acosmicoins)</span>
    </div>
  </DiscordMessage>
);

const RPS_ROUNDS: Array<[string, string, string]> = [
  ['🪨', '✂️', NOVA.name],
  ['📄', '✂️', ORION.name],
  ['✂️', '📄', NOVA.name],
  ['🪨', '✂️', NOVA.name],
];

// Mirrors the finished match in Views/View_Rock_Paper_Scissors.py: one row of
// three inline fields per round, then the final standings.
const RpsScene: React.FC = () => (
  <>
    <DiscordMessage
      author="Acosmibot"
      avatar={BOT_AVATAR}
      time="Today at 10:42 PM"
      app
      context={<Invocation avatar={NOVA.avatar} user={NOVA.name} command="games rockpaperscissors" />}
    >
      <Embed color={EMBED_UNSET} title="Nova won in 4 rounds!">
        <div className="discord-embed-description">Nova vs. Orion</div>
        <div className="discord-embed-fields">
          {RPS_ROUNDS.map(([first, second, winner], round) => (
            <React.Fragment key={round}>
              <EmbedField name={NOVA.name} inline>{first}</EmbedField>
              <EmbedField name={ORION.name} inline>{second}</EmbedField>
              <EmbedField name="Winner" inline>{winner}</EmbedField>
            </React.Fragment>
          ))}
          <div className="discord-embed-field dc-embed-spacer" aria-hidden="true" />
          <EmbedField name={NOVA.name} inline>🏆 WINNER! 🏆</EmbedField>
          <EmbedField name={ORION.name} inline><Emoji src={emote('acomad')} name="acomad" /></EmbedField>
        </div>
      </Embed>
    </DiscordMessage>
    <DiscordMessage author="Acosmibot" avatar={BOT_AVATAR} time="Today at 10:42 PM" app>
      <p className="dc-text">
        <Mention>{NOVA.name}</Mention> has defeated <Mention>{ORION.name}</Mention> in a match of 🪨📄✂️ and won 250 Acosmicoins! <Emoji src={emote('acocelebrate')} name="acocelebrate" />
      </p>
    </DiscordMessage>
  </>
);

// Mirrors the end-of-game embed in Views/Deathroll_View.py. The bot colors the
// bar with the loser's role color, so the value here is a sample role color.
const DeathrollScene: React.FC = () => (
  <>
    <DiscordMessage
      author="Acosmibot"
      avatar={BOT_AVATAR}
      time="Today at 10:48 PM"
      app
      context={<Invocation avatar={NOVA.avatar} user={NOVA.name} command="games deathroll" />}
    >
      <Embed color="#9b59b6" title={<span>💀 Deathroll - 500 Acosmicoins 💀<br />Nova vs Orion</span>}>
        <div className="discord-embed-description">
          <p className="dc-embed-h1">Game Over!</p>
          <p className="dc-embed-h1">Orion rolled a 1 and lost 500 Acosmicoins!</p>
        </div>
        <div className="discord-embed-fields">
          <EmbedField name="Nova:" inline>🏆 WINNER 🏆</EmbedField>
          <EmbedField name="Orion:" inline>💀 BROKIE 💀</EmbedField>
        </div>
      </Embed>
    </DiscordMessage>
    <DiscordMessage author="Acosmibot" avatar={BOT_AVATAR} time="Today at 10:48 PM" app>
      <p className="dc-text">
        <Mention>{ORION.name}</Mention> rolled a 1 and lost 500 Acosmicoins to <Mention>{NOVA.name}</Mention>! 💀
      </p>
    </DiscordMessage>
  </>
);

// Mirrors the success embed in Views/Heist_View.py. An even split of 12,600
// leaves no remainder for the ringleader.
const HeistScene: React.FC = () => (
  <DiscordMessage author="Acosmibot" avatar={BOT_AVATAR} time="Today at 11:04 PM" app>
    <Embed color={EMBED_GREEN} title="✅ Clean Getaway" footer="Lay low for a while before the next job.">
      <div className="discord-embed-description dc-embed-lines">
        <p>Smooth as silk. The crew’s out the back door before anyone blinks.</p>
        <p className="dc-embed-gap"><strong>Total loot:</strong> 12,600 Acosmicoins 🦝</p>
      </div>
      <div className="discord-embed-fields">
        <EmbedField name="🎯 Task Outcomes">
          <p><strong>Nova</strong> — 🔓 Lockpick · ✅ passed in <strong>6.2s</strong></p>
          <p><strong>Orion</strong> — 💻 Hack the Mainframe · ✅ passed in <strong>9.8s</strong></p>
          <p><strong>Vega</strong> — ✂️ Cut the Wire · ❌ failed in <strong>4.1s</strong></p>
        </EmbedField>
        <EmbedField name="🎯 Crew Performance">
          <p>2 job(s) nailed · 1 botched</p>
          <p>Final odds: <strong>62%</strong></p>
        </EmbedField>
        <EmbedField name="The Split (3 crew)">
          {[NOVA, ORION, VEGA].map(member => (
            <p key={member.name}><Mention>{member.name}</Mention> — <strong>4,200</strong> Acosmicoins</p>
          ))}
        </EmbedField>
        <EmbedField name="🔥 Heat">
          <p>Each member picks up <strong>+15 Heat</strong> 🔥 — cool off with <code>/donate</code>.</p>
        </EmbedField>
      </div>
    </Embed>
  </DiscordMessage>
);

const CustomEmbedScene: React.FC = () => (
  <DiscordMessage author="Acosmibot" avatar={BOT_AVATAR} time="Today at 2:05 PM" app>
    <p className="dc-text"><Mention>Game Night</Mention> this Friday. Bring your best run.</p>
    <div className="dc-lift dc-embed-host">
      <DiscordEmbedPreview config={ANNOUNCEMENT_EMBED} buttons={ANNOUNCEMENT_BUTTONS} showCharCount={false} />
    </div>
  </DiscordMessage>
);

// The link row follows format_rewritten_social_link in the bot. The preview
// under it is unfurled by Discord from FixupX; its color, author, text, and
// footer are that provider's real metadata for this post. The clip is the
// Event Horizon loop, played without sound while the row is on screen.
const SocialEmbedScene: React.FC<{ playing: boolean }> = ({ playing }) => {
  const videoRef = useLoopingClip(playing);

  return (
    <>
      <DiscordMessage author={VEGA.name} avatar={VEGA.avatar} time="Today at 6:18 PM">
        <p className="dc-text"><span className="dc-link">https://x.com/AcosmicDev/status/2101886021457563769</span></p>
      </DiscordMessage>
      <DiscordMessage author="Acosmibot" avatar={BOT_AVATAR} time="Today at 6:18 PM" app silent>
        <p className="dc-text">
          <span className="dc-link">Tweet</span> • <span className="dc-link">@AcosmicDev</span> • <span className="dc-link">FxTwitter</span>
        </p>
        <Embed
          color="#6363ff"
          author={{ name: 'Acosmic (@AcosmicDev)', icon: BOT_AVATAR }}
          footer="FixupX • 9/20/26, 11:07 PM"
          footerIcon="/images/showcase/fixupx.png"
        >
          <div className="discord-embed-description dc-embed-lines">
            <p>
              Meet Event Horizon. Acosmibot’s arcade survival game, playable right inside Discord. Skim the black hole
              for bigger scores, dodge debris, grab gems, and Phase Shift out of trouble. Watch friends fly and compete
              for the server’s top spot! /event-horizon to play!
            </p>
            <p className="dc-embed-gap">👁️ 53</p>
          </div>
          <div className="discord-embed-image">
            <video
              ref={videoRef}
              className="dc-embed-video"
              src="/images/showcase/event-horizon-loop.mp4"
              poster="/images/showcase/event-horizon-loop-poster.webp"
              width={480}
              height={270}
              loop
              muted
              playsInline
              preload="none"
              aria-label="Looping clip: Acosmibot rides a rocket past a black hole, captioned Hop on Event Horizon"
            />
          </div>
        </Embed>
      </DiscordMessage>
    </>
  );
};

/** Reaction pills under a message; `mine` marks one the viewer has pressed. */
const Reactions: React.FC<{ items: Array<{ emoji: string; count: number; mine?: boolean }> }> = ({ items }) => (
  <div className="dc-reactions">
    {items.map(item => (
      <span key={item.emoji} className={`dc-reaction${item.mine ? ' is-mine' : ''}`}>{item.emoji}<b>{item.count}</b></span>
    ))}
  </div>
);

/** The note Discord adds under a reply only the command's user can see. */
const Ephemeral: React.FC = () => (
  <p className="dc-ephemeral"><Eye aria-hidden="true" /> Only you can see this • <span className="dc-link">Dismiss message</span></p>
);

const Channel: React.FC<{ children: React.ReactNode }> = ({ children }) => <span className="dc-chip">#{children}</span>;

// Mirrors the go-live embed the API posts from its Twitch webhook: Twitch
// purple, the stream title as a heading link, the channel avatar as the
// thumbnail, and the stream preview as the image. The line above the embed is
// the server's role mention plus its custom message.
const StreamLiveScene: React.FC = () => (
  <DiscordMessage author="Acosmibot" avatar={BOT_AVATAR} time="Today at 7:30 PM" app>
    <p className="dc-text"><Mention>Stream Alerts</Mention> Vega is live. Come hang out!</p>
    <Embed color="#6441a4" title="🔴 Vega is live on Twitch!" thumbnail={VEGA.avatar}>
      <div className="discord-embed-description">
        <p className="dc-embed-h3"><span className="dc-link">Event Horizon high-score runs</span></p>
      </div>
      <div className="discord-embed-fields">
        <EmbedField name="Category">Games + Demos</EmbedField>
        <EmbedField name="Viewers">128</EmbedField>
        <EmbedField name="Started"><span className="dc-timestamp">2 minutes ago</span></EmbedField>
      </div>
      <div className="discord-embed-image">
        <img src="/images/showcase/event-horizon-key-art.webp" width={960} height={540} alt="" loading="lazy" />
      </div>
    </Embed>
  </DiscordMessage>
);

// Mirrors the /shop embed in Cogs/Shop.py, which only the member who ran it
// sees. Names, prices, and descriptions are the seeded catalog values.
const ItemShopScene: React.FC = () => (
  <DiscordMessage
    author="Acosmibot"
    avatar={BOT_AVATAR}
    time="Today at 5:02 PM"
    app
    context={<Invocation avatar={NOVA.avatar} user={NOVA.name} command="shop" />}
  >
    <Embed color={EMBED_BLURPLE} title="🛒 Item Shop">
      <div className="discord-embed-description">
        Buy with <code>/buy item quantity</code>. Manage items from <code>/inventory</code>; automatic items trigger on their own.
      </div>
      <div className="discord-embed-fields">
        <EmbedField name={<>⚡ XP Boost (24h) — 5,000 <Emoji src={ACOSMICOIN} name="acosmicoin_heads" /></>}>
          <p>+50% XP gained in every server for 24 hours.</p>
          <p><em>uncommon · 24h · every server</em></p>
        </EmbedField>
        <EmbedField name={<><Emoji src={emote('acofreeze')} name="acofreeze" /> Streak Freeze — 10,000 <Emoji src={ACOSMICOIN} name="acosmicoin_heads" /></>}>
          <p>Automatically protects one missed daily-message streak day in one server. Multiple are consumed for longer gaps.</p>
          <p><em>rare · automatic · one server</em></p>
        </EmbedField>
      </div>
    </Embed>
    <Ephemeral />
  </DiscordMessage>
);

// Mirrors build_giveaway_embed in Cogs/Admin_Giveaway.py for a giveaway whose
// entry emoji was set to 🎁. The bot adds the first reaction itself, so the
// pill reads one higher than the entry count.
const GiveawayScene: React.FC = () => (
  <DiscordMessage author="Acosmibot" avatar={BOT_AVATAR} time="Today at 12:00 PM" app>
    <Embed
      color={EMBED_BLURPLE}
      title={<><Emoji src={emote('acocelebrate')} name="acocelebrate" /> GIVEAWAY</>}
      footer="React with 🎁 to enter! | #128"
    >
      <div className="discord-embed-description dc-embed-lines">
        <p><em>Thanks for 1,000 members!</em></p>
        <p className="dc-embed-gap">React with <strong>🎁</strong> to enter!</p>
      </div>
      <div className="discord-embed-fields">
        <EmbedField name="Prize"><p><strong>$25 gift card</strong></p></EmbedField>
        <EmbedField name="Ends" inline>
          <p><span className="dc-timestamp">Friday, October 16, 2026 8:00 PM</span> (<span className="dc-timestamp">in 4 days</span>)</p>
        </EmbedField>
        <EmbedField name="Hosted by" inline><p><Mention>{VEGA.name}</Mention></p></EmbedField>
        <EmbedField name="Entries" inline>42</EmbedField>
        <EmbedField name="Requirements">
          <p>Required roles: <Mention>Member</Mention></p>
          <p>Account age: 30+ days</p>
        </EmbedField>
      </div>
    </Embed>
    <Reactions items={[{ emoji: '🎁', count: 43 }]} />
  </DiscordMessage>
);

const LogTime: React.FC<{ at: string; ago: string }> = ({ at, ago }) => (
  <EmbedField name="Time">
    <p><span className="dc-timestamp">{at}</span> (<span className="dc-timestamp">{ago}</span>)</p>
  </EmbedField>
);

// Mirrors two entries from Cogs/ModerationLog.py. Discord groups consecutive
// messages from one author, so both embeds sit under a single header.
const ModLogScene: React.FC = () => (
  <DiscordMessage author="Acosmibot" avatar={BOT_AVATAR} time="Today at 9:14 PM" app>
    <Embed
      color={EMBED_ORANGE}
      author={{ name: ORION.name, icon: ORION.avatar }}
      title="Member Muted (Timeout)"
      footer="Target ID: 284650193847562240"
    >
      <div className="discord-embed-description dc-embed-lines">
        <p><strong>Target:</strong> <Mention>{ORION.name}</Mention></p>
        <p><strong>Moderator:</strong> <Mention>{VEGA.name}</Mention></p>
        <p><strong>Reason:</strong> Spamming invite links</p>
        <p><strong>Until:</strong> <span className="dc-timestamp">in 10 minutes</span></p>
      </div>
      <div className="discord-embed-fields">
        <LogTime at="Monday, October 12, 2026 9:14 PM" ago="now" />
      </div>
    </Embed>
    <Embed
      color={EMBED_ORANGE}
      author={{ name: ORION.name, icon: ORION.avatar }}
      title="Message Deleted"
      footer="Author ID: 284650193847562240 | Message ID: 1427801135069724702"
    >
      <div className="discord-embed-description dc-embed-lines">
        <p><strong>Author:</strong> <Mention>{ORION.name}</Mention></p>
        <p><strong>Channel:</strong> <Channel>general</Channel></p>
      </div>
      <div className="discord-embed-fields">
        <EmbedField name="Content">join my server for free coins!!</EmbedField>
        <LogTime at="Monday, October 12, 2026 9:14 PM" ago="now" />
      </div>
    </Embed>
  </DiscordMessage>
);

// A reaction-role message as the dashboard sends it: the embed, then one
// reaction per mapped role, which the bot adds for members to press.
const ReactionRolesScene: React.FC = () => (
  <DiscordMessage author="Acosmibot" avatar={BOT_AVATAR} time="09/02/2026" app>
    <Embed color="#00d9ff" title="Pick your roles">
      <div className="discord-embed-description dc-embed-lines">
        <p>React below to add a role. Remove your reaction to drop it.</p>
        <p className="dc-embed-gap">🎮 <Mention>Game Night</Mention> for game session pings</p>
        <p>🎬 <Mention>Movie Club</Mention> for watch party pings</p>
        <p>🔔 <Mention>Stream Alerts</Mention> for go-live pings</p>
      </div>
    </Embed>
    <Reactions items={[{ emoji: '🎮', count: 18, mine: true }, { emoji: '🎬', count: 9 }, { emoji: '🔔', count: 31 }]} />
  </DiscordMessage>
);

// A prefix-triggered custom command with an embed response (Cogs/CustomCommands.py).
// The title and footer use the {server} and {uses} placeholders.
const CustomCommandScene: React.FC = () => (
  <>
    <DiscordMessage author={NOVA.name} avatar={NOVA.avatar} time="Today at 3:20 PM">
      <p className="dc-text">!schedule</p>
    </DiscordMessage>
    <DiscordMessage author="Acosmibot" avatar={BOT_AVATAR} time="Today at 3:20 PM" app>
      <Embed color="#00d9ff" title="This week in Starlight Lounge" footer="!schedule has been used 128 times">
        <div className="discord-embed-fields">
          <EmbedField name="Tuesday · 8 PM ET">Movie Club watch party</EmbedField>
          <EmbedField name="Friday · 8 PM ET">Event Horizon high-score night</EmbedField>
          <EmbedField name="Sunday · 3 PM ET">Community game day</EmbedField>
        </div>
      </Embed>
    </DiscordMessage>
  </>
);

interface ActivityGroup {
  role: string;
  color: string;
  members: Array<{ name: string; avatar: string; verb: string; activity: string; streaming?: boolean }>;
}

// Activity Monitoring posts nothing; its result is the role. With the assigned
// roles set to display separately, Discord's member list groups members by them.
const ACTIVITY_GROUPS: ActivityGroup[] = [
  { role: 'Live Now', color: '#a970ff', members: [{ ...VEGA, verb: 'Streaming', activity: 'Event Horizon', streaming: true }] },
  {
    role: 'In Game',
    color: '#57f287',
    members: [
      { ...NOVA, verb: 'Playing', activity: 'Event Horizon' },
      { ...ORION, verb: 'Playing', activity: 'Event Horizon' },
    ],
  },
  { role: 'Tuned In', color: '#00d9ff', members: [{ ...LYRA, verb: 'Listening to', activity: 'Spotify' }] },
];

const ActivityRolesScene: React.FC = () => (
  <div className="dc-members">
    {ACTIVITY_GROUPS.map(group => (
      <section key={group.role}>
        <h4>{group.role} — {group.members.length}</h4>
        {group.members.map(member => (
          <div className="dc-member" key={member.name}>
            <span className={`dc-member__avatar${member.streaming ? ' is-streaming' : ''}`}>
              <img src={member.avatar} width={32} height={32} alt="" loading="lazy" />
            </span>
            <span className="dc-member__name" style={{ color: group.color }}>{member.name}</span>
            <span className="dc-member__activity">{member.verb} <strong>{member.activity}</strong></span>
          </div>
        ))}
      </section>
    ))}
  </div>
);

const flowDay = (date: string, joins: number, leaves = 0, kicks = 0, bans = 0): MemberFlowDay => {
  const departures = leaves + kicks + bans;
  return { date, joins, leaves, kicks, bans, departures, net: joins - departures };
};

// Like the live endpoint, only days with member movement are listed.
const MEMBER_FLOW: MemberFlowDay[] = [
  flowDay('2026-09-14', 6, 1),
  flowDay('2026-09-16', 9),
  flowDay('2026-09-18', 14, 2),
  flowDay('2026-09-19', 11, 1, 1),
  flowDay('2026-09-21', 7),
  flowDay('2026-09-23', 12, 3),
  flowDay('2026-09-25', 18, 2),
  flowDay('2026-09-27', 9, 4, 0, 1),
  flowDay('2026-09-29', 6, 1),
  flowDay('2026-10-02', 15, 2),
  flowDay('2026-10-04', 21, 3),
  flowDay('2026-10-06', 8, 6, 1),
  flowDay('2026-10-09', 13, 1),
  flowDay('2026-10-11', 17, 2),
];
const FLOW_JOINS = MEMBER_FLOW.reduce((total, day) => total + day.joins, 0);
const FLOW_DEPARTURES = MEMBER_FLOW.reduce((total, day) => total + day.departures, 0);

const SERVER_TOTALS: Array<{ label: string; value: string; accent?: boolean }> = [
  { label: 'Total members', value: '1,284' },
  { label: 'Active members', value: '1,036', accent: true },
  { label: 'Total messages', value: '412,906' },
  { label: 'Total reactions', value: '58,317' },
];

// The dashboard overview's "Server activity" panel: the same four totals and
// the same member-growth chart component the dashboard renders.
const AnalyticsScene: React.FC = () => (
  <div className="dash-activity">
    <dl className="dash-activity__metrics">
      {SERVER_TOTALS.map(total => (
        <div key={total.label}>
          <dt>{total.label}</dt>
          <dd className={total.accent ? 'is-positive' : undefined}>{total.value}</dd>
        </div>
      ))}
    </dl>
    <div className="dash-activity__growth">
      <div className="dash-activity__header">
        <h4>Member growth</h4>
        <p>
          Last 30 days: <span className="is-positive">+{FLOW_JOINS}</span> / <span className="is-negative">−{FLOW_DEPARTURES}</span>{' '}
          (net +{FLOW_JOINS - FLOW_DEPARTURES})
        </p>
      </div>
      <MemberFlowChart data={MEMBER_FLOW} />
    </div>
  </div>
);

// Mirrors the Polymorph embed (Cogs/Polymorph.py) and an open Jail ballot
// (JailService.build_ballot_embed). The mention already shows the new nickname,
// as it does in Discord once the rename lands. Both bars use sample role colors.
const ChaosScene: React.FC = () => (
  <>
    <DiscordMessage
      author="Acosmibot"
      avatar={BOT_AVATAR}
      time="Today at 11:21 PM"
      app
      context={<Invocation avatar={NOVA.avatar} user={NOVA.name} command="polymorph" />}
    >
      <Embed
        color="#e91e63"
        author={{ name: 'Sir Honks-a-Lot', icon: ORION.avatar }}
        title="Polymorph 🐑"
        footer="/polymorph [@target] - costs 10,000 Acosmicoins"
      >
        <div className="discord-embed-description">
          <p className="dc-embed-h3"><Mention>Sir Honks-a-Lot</Mention> is now <strong>Sir Honks-a-Lot</strong>.</p>
          <p className="dc-embed-subtext">Polymorphed by nova for 60 minutes</p>
        </div>
      </Embed>
    </DiscordMessage>
    <DiscordMessage author="Acosmibot" avatar={BOT_AVATAR} time="Today at 11:24 PM" app>
      <Embed
        color={EMBED_ORANGE}
        author={{ name: VEGA.name, icon: VEGA.avatar }}
        title="Jail vote for Vega"
        footer="Remove the configured reaction to withdraw your vote while this ballot is active."
      >
        <div className="discord-embed-description dc-embed-lines">
          <p>3 / 5 votes</p>
          <p>2 vote(s) remaining</p>
        </div>
        <div className="discord-embed-fields">
          <EmbedField name="Ballot closes" inline><span className="dc-timestamp">in 12 minutes</span></EmbedField>
          <EmbedField name="Original message"><span className="dc-link">Jump to message</span></EmbedField>
        </div>
      </Embed>
    </DiscordMessage>
  </>
);

// Sample standings. Nova's row is the pilot's own, and matches where the
// looping flight is heading (about 128,000 at 3:23).
const EH_STANDINGS: Array<{ name: string; avatar: string; score: string; survived: string; you?: boolean }> = [
  { ...VEGA, score: '152,380', survived: '3:48' },
  { ...NOVA, score: '131,480', survived: '3:28', you: true },
  { ...ORION, score: '118,442', survived: '3:12' },
  { ...LYRA, score: '96,730', survived: '2:46' },
  { name: 'Atlas', avatar: emote('acoez'), score: '84,155', survived: '2:31' },
];

// The Activity itself rather than a channel: a clip of a real ranked flight
// loops beside the lobby's leaderboard card. The card's wording, tabs, and row
// layout follow activities/event-horizon/index.html and leaderboard.mjs.
const EventHorizonScene: React.FC<{ playing: boolean }> = ({ playing }) => {
  const videoRef = useLoopingClip(playing);

  return (
    <div className="eh">
      <div className="eh__screen dc-lift">
        <video
          ref={videoRef}
          src="/images/showcase/event-horizon-flight.mp4"
          poster="/images/showcase/event-horizon-flight-poster.webp"
          width={480}
          height={600}
          loop
          muted
          playsInline
          preload="none"
          aria-label="Looping gameplay clip: a rocket skims the black hole as a Pulsar Sweep ring expands and the score climbs past 125,000"
        />
      </div>
      <div className="eh__board" role="img" aria-label="Event Horizon top scores for Starlight Lounge: Vega 152,380, Nova 131,480, Orion 118,442, Lyra 96,730, Atlas 84,155">
        <p className="eh__scope" aria-hidden="true">Starlight Lounge</p>
        <h4 aria-hidden="true">The edge belongs<br />to the bold.</h4>
        <div className="eh__tabs" aria-hidden="true">
          <span className="is-active">Top scores</span>
          <span>Most Deaths</span>
          <span>Highest Average Score</span>
        </div>
        <p className="eh__status" aria-hidden="true">Server-verified flight</p>
        <ol className="eh__standings" aria-hidden="true">
          {EH_STANDINGS.map((pilot, index) => (
            <li key={pilot.name} className={pilot.you ? 'is-you' : undefined}>
              <span className="eh__place">{index + 1}</span>
              <img src={pilot.avatar} width={24} height={24} alt="" loading="lazy" />
              <span className="eh__name">{pilot.name}</span>
              <span className="eh__result"><strong>{pilot.score}</strong><small>{pilot.survived} survived</small></span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

interface GameMeta {
  id: string;
  label: string;
  command: string;
  detail: string;
  docsPath: string;
  docsLabel: string;
  View: React.FC;
}

const GAMES: GameMeta[] = [
  { id: 'slots', label: 'Slots', command: '/games slots', detail: 'Five reels of Acosmibot art, tiered payouts, and a one-click respin.', docsPath: '/docs/slots', docsLabel: 'Slots', View: SlotsScene },
  { id: 'keno', label: 'Keno', command: '/games keno', detail: 'Pick up to ten numbers on a 40-tile board, then ten are drawn.', docsPath: '/docs/keno', docsLabel: 'Keno', View: KenoScene },
  { id: 'blackjack', label: 'Blackjack', command: '/games blackjack', detail: 'A dealer game with hit, stand, double down, split, and surrender.', docsPath: '/docs/blackjack', docsLabel: 'Blackjack', View: BlackjackScene },
  { id: 'rps', label: 'Rock Paper Scissors', command: '/games rockpaperscissors', detail: 'A first-to-three match against another member, with or without a bet.', docsPath: '/docs/commands', docsLabel: 'Commands', View: RpsScene },
  { id: 'deathroll', label: 'Deathroll', command: '/games deathroll', detail: 'Two members roll down from the wager. Whoever rolls a 1 pays up.', docsPath: '/docs/deathroll', docsLabel: 'Deathroll', View: DeathrollScene },
  { id: 'heist', label: 'Heist', command: '/heist start', detail: 'A crew runs timed jobs to crack the server vault and split the take.', docsPath: '/docs/heist', docsLabel: 'Heist', View: HeistScene },
];

const Panel: React.FC<{ channel: string; Icon?: LucideIcon; active?: boolean; children: React.ReactNode }> = ({
  channel,
  Icon = Hash,
  active = true,
  children,
}) => (
  <div
    className={`showcase__panel${active ? ' is-active' : ''}`}
    aria-hidden={active ? undefined : true}
    // React 18 only passes the lowercase attribute through as a string.
    {...(active ? {} : { inert: '' })}
  >
    <div className="showcase__channel">
      <Icon aria-hidden="true" />
      <span translate="no">{channel}</span>
    </div>
    <div className="showcase__feed">{children}</div>
  </div>
);

const RowFrame: React.FC<{
  row: ShowcaseRowState;
  id: ShowcaseRowId;
  side: 'left' | 'right';
  Icon: LucideIcon;
  trigger: string;
  title: string;
  copy: React.ReactNode;
  children: React.ReactNode;
}> = ({ row, id, side, Icon, trigger, title, copy, children }) => {
  const anchor = showcaseAnchor(id);
  return (
    <article id={anchor} className={`showcase-row showcase-row--${side}`} aria-labelledby={`${anchor}-title`}>
      <div ref={row.copyRef} className={`showcase-row__copy${revealClass(row.copyReveal)}`}>
        <p className="showcase-row__trigger">
          <span><Icon aria-hidden="true" /></span>
          <code translate="no">{trigger}</code>
        </p>
        <h3 id={`${anchor}-title`}>{title}</h3>
        {copy}
      </div>
      <div ref={row.stageRef} className={`showcase__stage${revealClass(row.stageReveal)}`}>
        <div className="showcase__glow" aria-hidden="true" />
        <div className="showcase__tilt">{children}</div>
      </div>
    </article>
  );
};

const Points: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="showcase-row__points">
    {items.map(item => <li key={item}>{item}</li>)}
  </ul>
);

const GuideLink: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <Link className="showcase-row__link" to={to}>{children} <ArrowRight aria-hidden="true" /></Link>
);

const Picker: React.FC<{
  label: string;
  noun: string;
  options: Array<{ id: string; label: string }>;
  rotation: Rotation;
  intervalMs: number;
  showToggle: boolean;
}> = ({ label, noun, options, rotation, intervalMs, showToggle }) => (
  <div className="showcase-picker" role="group" aria-label={label}>
    {showToggle && (
      <button
        type="button"
        className="showcase-picker__toggle"
        onClick={rotation.toggle}
        aria-label={rotation.paused ? `Resume cycling ${noun}` : `Pause cycling ${noun}`}
      >
        {rotation.paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
      </button>
    )}
    {options.map((option, index) => {
      const isActive = index === rotation.index;
      return (
        <button
          key={option.id}
          type="button"
          className={`showcase-pick${isActive ? ' is-active' : ''}`}
          aria-pressed={isActive}
          onClick={() => rotation.select(index)}
        >
          {option.label}
          {isActive && rotation.running && (
            <span className="showcase-pick__progress" aria-hidden="true" style={{ animationDuration: `${intervalMs}ms` }} />
          )}
        </button>
      );
    })}
  </div>
);

const RankRow: React.FC = () => {
  const row = useShowcaseRow();
  const reducedMotion = usePrefersReducedMotion();
  const rotation = useRotation(RANK_VARIANTS.length, RANK_INTERVAL_MS, row.inView && !reducedMotion);
  const variant = RANK_VARIANTS[rotation.index];

  // Warm the next artwork so the crossfade never reveals a half-loaded image.
  useEffect(() => {
    if (!row.inView) return;
    const next = RANK_VARIANTS[(rotation.index + 1) % RANK_VARIANTS.length].loadout?.backgroundImageUrl;
    if (next) new Image().src = next;
  }, [rotation.index, row.inView]);

  return (
    <RowFrame
      row={row}
      id="rank"
      side="right"
      Icon={BarChart3}
      trigger="/rank"
      title="Rank Cards"
      copy={(
        <>
          <p className="showcase-row__lede">
            A member runs /rank and gets a card like this one. The backgrounds cycling here are real options from Card Studio.
          </p>
          <Points
            items={[
              'Backgrounds, avatar rings, and accent colors',
              'Bought with banked Acosmicoins or earned from achievements',
              'One renderer draws the Discord card and the site preview',
            ]}
          />
          <Picker label="Card backgrounds" noun="backgrounds" options={RANK_VARIANTS} rotation={rotation} intervalMs={RANK_INTERVAL_MS} showToggle={!reducedMotion} />
          <p className="showcase-row__caption" aria-live={rotation.paused ? 'polite' : 'off'}>
            <strong>{variant.label}</strong> {variant.detail}
          </p>
          <GuideLink to="/docs/leveling">Read the Leveling guide</GuideLink>
        </>
      )}
    >
      <Panel channel="general"><RankScene index={rotation.index} /></Panel>
    </RowFrame>
  );
};

const AiRow: React.FC = () => {
  const row = useShowcaseRow();
  const reducedMotion = usePrefersReducedMotion();
  const rotation = useRotation(AI_SLIDES.length, AI_INTERVAL_MS, row.inView && !reducedMotion);
  const slide = AI_SLIDES[rotation.index];

  return (
    <RowFrame
      row={row}
      id="ai"
      side="left"
      Icon={Bot}
      trigger="@Acosmibot"
      title="AI Chat"
      copy={(
        <>
          <p className="showcase-row__lede">
            Members mention Acosmibot and ask in plain language. It answers in the channel and reaches for the same tools the slash commands use.
          </p>
          <Points
            items={[
              'Remembers the thread it is replying in',
              'A personality you set for your server',
              'Asks the requester before it generates an image or emote',
            ]}
          />
          <Picker label="AI Chat examples" noun="examples" options={AI_SLIDES} rotation={rotation} intervalMs={AI_INTERVAL_MS} showToggle={!reducedMotion} />
          <p className="showcase-row__caption" aria-live={rotation.paused ? 'polite' : 'off'}>
            <strong>{slide.label}</strong> {slide.detail}
          </p>
          <GuideLink to="/docs/ai">Read the AI Chat guide</GuideLink>
        </>
      )}
    >
      {AI_SLIDES.map((candidate, index) => (
        <Panel key={candidate.id} channel="general" active={index === rotation.index}>
          <candidate.View />
        </Panel>
      ))}
    </RowFrame>
  );
};

const GamesRow: React.FC = () => {
  const row = useShowcaseRow();
  const reducedMotion = usePrefersReducedMotion();
  const rotation = useRotation(GAMES.length, GAME_INTERVAL_MS, row.inView && !reducedMotion);
  const game = GAMES[rotation.index];

  return (
    <RowFrame
      row={row}
      id="games"
      side="right"
      Icon={Dices}
      trigger="/games"
      title="Games"
      copy={(
        <>
          <p className="showcase-row__lede">
            Members wager the Acosmicoins they earn in your server. Each result posts as an embed like these, drawn with Acosmibot’s own reel, tile, and card art.
          </p>
          <Points
            items={[
              'Solo games, member duels, and crew heists',
              'One-click replays on Slots, Keno, and Blackjack',
              'Every wager and payout is in Acosmicoins',
            ]}
          />
          <Picker label="Games" noun="games" options={GAMES} rotation={rotation} intervalMs={GAME_INTERVAL_MS} showToggle={!reducedMotion} />
          <p className="showcase-row__caption" aria-live={rotation.paused ? 'polite' : 'off'}>
            <code translate="no">{game.command}</code> {game.detail}
          </p>
          <GuideLink to={game.docsPath}>Read the {game.docsLabel} guide</GuideLink>
        </>
      )}
    >
      {GAMES.map((candidate, index) => (
        <Panel key={candidate.id} channel="games" active={index === rotation.index}>
          <candidate.View />
        </Panel>
      ))}
    </RowFrame>
  );
};

const CustomEmbedsRow: React.FC = () => {
  const row = useShowcaseRow();
  return (
    <RowFrame
      row={row}
      id="custom-embeds"
      side="left"
      Icon={PanelTop}
      trigger="Dashboard"
      title="Custom Embeds"
      copy={(
        <>
          <p className="showcase-row__lede">
            Write an announcement in the dashboard, add an image and link buttons, check the live preview, then send it to any channel.
          </p>
          <Points
            items={[
              'A live Discord preview while you build',
              'Image uploads and link buttons',
              'Drafts you can duplicate and reuse',
            ]}
          />
          <GuideLink to="/docs/embeds">Read the Embeds guide</GuideLink>
        </>
      )}
    >
      <Panel channel="announcements"><CustomEmbedScene /></Panel>
    </RowFrame>
  );
};

const SocialEmbedsRow: React.FC = () => {
  const row = useShowcaseRow();
  const reducedMotion = usePrefersReducedMotion();
  return (
    <RowFrame
      row={row}
      id="social-embeds"
      side="right"
      Icon={Link2}
      trigger="Automatic"
      title="Better Social Embeds"
      copy={(
        <>
          <p className="showcase-row__lede">
            A member pastes a social link that Discord previews badly or not at all. Acosmibot posts a working preview underneath and leaves their message alone.
          </p>
          <Points
            items={[
              'Instagram, X, Bluesky, TikTok, and Reddit',
              'Sent silently, so it never pings the channel',
              'Free on every plan',
            ]}
          />
          <GuideLink to="/docs/embeds">Read the Better Social Embeds guide</GuideLink>
        </>
      )}
    >
      <Panel channel="general"><SocialEmbedScene playing={row.inView && !reducedMotion} /></Panel>
    </RowFrame>
  );
};

const EventHorizonRow: React.FC = () => {
  const row = useShowcaseRow();
  const reducedMotion = usePrefersReducedMotion();
  return (
    <RowFrame
      row={row}
      id="event-horizon"
      side="left"
      Icon={Rocket}
      trigger="/event-horizon"
      title="Event Horizon"
      copy={(
        <>
          <p className="showcase-row__lede">
            An arcade survival game that runs inside Discord. Hold to climb, release to dive, and skim the black hole for a bigger score before the heat ends your flight.
          </p>
          <Points
            items={[
              'Fly closer to the black hole for up to 5× points',
              'New hazards the longer you last: asteroids, Gravity Tide, Pulsar Sweep',
              'Server leaderboards, live spectating, and a post when the record falls',
              'Free on every plan, with nothing wagered',
            ]}
          />
          <GuideLink to="/docs/event-horizon">Read the Event Horizon guide</GuideLink>
        </>
      )}
    >
      <Panel channel="Event Horizon" Icon={Rocket}><EventHorizonScene playing={row.inView && !reducedMotion} /></Panel>
    </RowFrame>
  );
};

export type ShowcasePreviewId =
  | 'rank-card'
  | 'ai-weather'
  | 'ai-stats'
  | 'ai-reminder'
  | 'slots'
  | 'custom-embed'
  | 'stream-live'
  | 'item-shop'
  | 'giveaway'
  | 'mod-log'
  | 'reaction-roles'
  | 'custom-command'
  | 'activity-roles'
  | 'analytics'
  | 'chaos';

/** Where a preview's example comes from: a Discord channel or the web dashboard. */
export type ShowcaseSurface = 'discord' | 'dashboard';

interface PreviewMeta {
  /** Header text: a channel name unless `Icon` says otherwise. */
  channel: string;
  Icon?: LucideIcon;
  surface?: ShowcaseSurface;
  label: string;
  View: React.FC;
}

// The inspector shows one fixed loadout; looked up by id so reordering the
// carousel cannot change it.
const RANK_PREVIEW_INDEX = Math.max(0, RANK_VARIANTS.findIndex(variant => variant.id === 'goth'));
const RankPreviewScene: React.FC = () => <RankScene index={RANK_PREVIEW_INDEX} />;

const PREVIEWS: Record<ShowcasePreviewId, PreviewMeta> = {
  'rank-card': { channel: 'general', label: 'Example: the rank card Acosmibot posts for /rank', View: RankPreviewScene },
  'ai-weather': { channel: 'general', label: 'Example: Acosmibot answering a weather question with a forecast card', View: AiWeatherScene },
  'ai-stats': { channel: 'general', label: 'Example: Acosmibot answering who holds the most Acosmicoins', View: AiStatsScene },
  'ai-reminder': { channel: 'general', label: 'Example: Acosmibot confirming a reminder', View: AiReminderScene },
  slots: { channel: 'games', label: 'Example: a winning /games slots result', View: SlotsScene },
  'custom-embed': { channel: 'announcements', label: 'Example: an announcement built with Custom Embeds', View: CustomEmbedScene },
  'stream-live': { channel: 'live-now', label: 'Example: a go-live alert for a Twitch stream, with its category, viewer count, and preview', View: StreamLiveScene },
  'item-shop': { channel: 'general', label: 'Example: the /shop list with an XP boost and a Streak Freeze priced in Acosmicoins', View: ItemShopScene },
  giveaway: { channel: 'giveaways', label: 'Example: a running giveaway with its prize, end time, host, entry count, and requirements', View: GiveawayScene },
  'mod-log': { channel: 'mod-log', label: 'Example: moderation log entries for a timeout and a deleted message', View: ModLogScene },
  'reaction-roles': { channel: 'roles', label: 'Example: a role menu where each reaction adds a role', View: ReactionRolesScene },
  'custom-command': { channel: 'general', label: 'Example: a member runs the custom command !schedule and Acosmibot replies with the week’s events', View: CustomCommandScene },
  'activity-roles': {
    channel: 'Members',
    Icon: Users,
    label: 'Example: the member list grouped by roles assigned from what each member is streaming, playing, or listening to',
    View: ActivityRolesScene,
  },
  analytics: {
    channel: 'Server activity',
    Icon: LayoutDashboard,
    surface: 'dashboard',
    label: 'Example: the dashboard’s server activity panel with member totals and a 30-day member growth chart',
    View: AnalyticsScene,
  },
  chaos: { channel: 'general', label: 'Example: a Polymorph nickname swap and an open Jail vote', View: ChaosScene },
};

export const showcasePreviewSurface = (id: ShowcasePreviewId): ShowcaseSurface => PREVIEWS[id].surface ?? 'discord';

const PREVIEW_WIDTH = 460;
const PREVIEW_FADE = 64;

/**
 * A flat, scaled-down showcase panel for tight spaces such as the feature
 * map's inspector. It lays the panel out at a fixed width and scales it to the
 * frame. In a flex column the frame takes whatever height is left, up to the
 * example's own height; anything past the frame fades out.
 */
export const ShowcasePreview: React.FC<{ id: ShowcasePreviewId }> = ({ id }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 0, height: 0, fade: 0 });

  useEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;
    const update = () => {
      if (!frame.clientWidth) return;
      const scale = Math.min(1, frame.clientWidth / PREVIEW_WIDTH);
      const height = Math.round(canvas.offsetHeight * scale);
      // The fade grows with what is cut off, so losing a few pixels only softens the edge.
      const hidden = height - frame.clientHeight;
      const fade = hidden > 1 ? Math.min(PREVIEW_FADE, hidden * 3) : 0;
      setBox(current => (
        current.scale === scale && current.height === height && current.fade === fade ? current : { scale, height, fade }
      ));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [id]);

  const preview = PREVIEWS[id];
  return (
    <div
      ref={frameRef}
      className={`showcase showcase--preview${box.fade ? ' is-clipped' : ''}`}
      role="img"
      aria-label={preview.label}
      style={box.scale ? { '--preview-height': `${box.height}px`, '--preview-fade': `${box.fade}px` } as React.CSSProperties : undefined}
    >
      <div
        ref={canvasRef}
        className="showcase-preview__canvas"
        aria-hidden="true"
        style={{ width: PREVIEW_WIDTH, transform: `scale(${box.scale})`, visibility: box.scale ? undefined : 'hidden' }}
      >
        <Panel channel={preview.channel} Icon={preview.Icon}><preview.View /></Panel>
      </div>
    </div>
  );
};

export const DiscordShowcase: React.FC = () => (
  <div className="showcase">
    <div className="showcase__intro">
      <span className="system-section__label">In your server</span>
      <h2 id="showcase-title">Acosmibot in action.</h2>
    </div>

    <RankRow />
    <AiRow />
    <GamesRow />
    <CustomEmbedsRow />
    <SocialEmbedsRow />
    <EventHorizonRow />
  </div>
);

export default DiscordShowcase;
