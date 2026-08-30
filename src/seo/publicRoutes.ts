import { SUPPORT_DISCORD_URL, SUPPORT_EMAIL } from '../lib/company.ts';

export const SITE_ORIGIN = 'https://acosmibot.com';
export const DISCORD_INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1186802023799214223&permissions=8&integration_type=0&scope=bot';
export const HOME_TAGLINE = 'A cosmic intelligence at your server’s command.';

export type FeatureLandingTheme = 'intelligence' | 'leveling' | 'economy' | 'games';

export interface FeatureCapability {
  title: string;
  description: string;
}

export interface FeatureStep {
  title: string;
  description: string;
}

export interface FeatureRelatedLink {
  label: string;
  path: string;
  description: string;
}

export interface FeatureLandingDefinition {
  slug: string;
  theme: FeatureLandingTheme;
  kicker: string;
  title: string;
  description: string;
  shortDescription: string;
  promise: string;
  availability: string;
  documentationPath: string;
  highlights: string[];
  capabilities: FeatureCapability[];
  steps: FeatureStep[];
  demonstration: {
    prompt: string;
    route: string;
    result: string;
    note: string;
  };
  related: FeatureRelatedLink[];
}

export const FEATURE_LANDINGS: Record<string, FeatureLandingDefinition> = {
  'ai-discord-bot': {
    slug: 'ai-discord-bot',
    theme: 'intelligence',
    kicker: 'Intelligence system',
    title: 'An agentic AI Discord bot that understands your server.',
    description: 'Acosmibot combines natural Discord conversations with native tool use, live server context, member memory, web and documentation search, reminders, image understanding, and creative actions.',
    shortDescription: 'Agentic AI for Discord with live server context, native tools, member memory, reminders, search, and image capabilities.',
    promise: 'More than a chat wrapper: Acosmibot can select trusted tools, retrieve current community data, complete authorized actions, and screen every model-authored response before it reaches Discord.',
    availability: 'Basic AI chat is available on every plan. AI tools, member memory, saved personalities, and ambient replies are available on Pro and Max.',
    documentationPath: '/docs/ai',
    highlights: ['Native function calling', 'Live Discord context', 'Screened output', 'Server-controlled access'],
    capabilities: [
      { title: 'Knows what is happening now', description: 'Retrieve current Discord channels, roles, events, server details, and permission-safe member information instead of guessing from stale context.' },
      { title: 'Answers from community data', description: 'Explore member progression, economy standing, game records, leaderboards, achievements, and server activity through live statistics tools.' },
      { title: 'Searches with provenance', description: 'Search Acosmibot documentation or the live web while keeping the exact source URLs attached to the current tool result.' },
      { title: 'Acts on clear requests', description: 'Create and cancel reminders, generate or analyze images, and create server emotes when the user and server permissions authorize the action.' },
      { title: 'Remembers with member control', description: 'Use server-scoped memories extracted from conversation, while giving each member a direct way to review or clear what was retained.' },
      { title: 'Stops at a safety boundary', description: 'Moderation, URL provenance, deterministic policy checks, and final output screening run before generated text is delivered.' },
    ],
    steps: [
      { title: 'A member asks naturally', description: 'Mention Acosmibot in an ordinary Discord message. No command syntax is required for conversation.' },
      { title: 'The model selects a tool', description: 'A bounded native tool loop chooses from only the capabilities allowed for that server, plan, channel, and request.' },
      { title: 'Acosmibot retrieves or acts', description: 'The selected tool returns live, structured information or completes a narrowly authorized action.' },
      { title: 'The answer is screened', description: 'The bot validates the final response, including any URLs, immediately before sending it to Discord.' },
    ],
    demonstration: {
      prompt: 'Who is the best blackjack player in this server?',
      route: 'Acosmibot selects server_stats and requests the server blackjack leaderboard.',
      result: 'The answer is grounded in the server’s recorded game totals, including current batched activity, rather than an invented ranking.',
      note: 'Illustrative request flow using implemented Acosmibot tools; names and results come from the live server at request time.',
    },
    related: [
      { label: 'Discord leveling bot', path: '/features/discord-leveling-bot', description: 'Turn member activity into XP, levels, roles, rank cards, and leaderboards.' },
      { label: 'Discord economy bot', path: '/features/discord-economy-bot', description: 'Connect Acosmicoins, banking, items, daily rewards, transfers, and community progression.' },
      { label: 'Discord games bot', path: '/features/discord-games-bot', description: 'Give the AI live context about blackjack, slots, mines, heists, and other game records.' },
    ],
  },
  'discord-leveling-bot': {
    slug: 'discord-leveling-bot',
    theme: 'leveling',
    kicker: 'Progression system',
    title: 'A Discord leveling bot built around real community activity.',
    description: 'Reward messages, reactions, and slash-command participation with configurable XP, level announcements, role milestones, rank cards, member statistics, and server or global leaderboards.',
    shortDescription: 'Discord leveling with configurable XP, automatic role rewards, rank cards, activity stats, and server and global leaderboards.',
    promise: 'Acosmibot makes progression visible without flattening every community into the same XP curve. Server owners control local rates and rewards while global XP stays fair across servers.',
    availability: 'The core leveling and XP system is included on the Free plan.',
    documentationPath: '/docs/leveling',
    highlights: ['Message XP', 'Reaction and command XP', 'Role milestones', 'Custom rank cards'],
    capabilities: [
      { title: 'Reward the activity you value', description: 'Configure separate guild XP rates for messages, reactions, and slash commands, with anti-spam protection on message activity.' },
      { title: 'Automate role milestones', description: 'Assign Discord roles at chosen levels and decide whether members keep earlier rewards or move cleanly to their highest milestone role.' },
      { title: 'Make progress tangible', description: 'Members can open polished rank cards with their level, XP progress, leaderboard position, and equipped cosmetic treatment.' },
      { title: 'Celebrate without noise', description: 'Choose where level-up announcements appear and customize messages with member, level, XP, streak, and earned-role placeholders.' },
      { title: 'Compare locally or globally', description: 'Run server-specific rankings while a separate flat-rate global XP track follows members across every Acosmibot community.' },
      { title: 'Connect progression to the rest', description: 'Leveling works alongside achievements, activity statistics, items, XP boosts, public profiles, and the broader Acosmibot economy.' },
    ],
    steps: [
      { title: 'Choose XP sources', description: 'Turn message, reaction, and command XP on or off and set rates that fit the pace of your server.' },
      { title: 'Define milestones', description: 'Map meaningful levels to role rewards and choose the announcement channel and copy.' },
      { title: 'Members participate', description: 'Acosmibot batches activity safely and applies the configured server progression rules.' },
      { title: 'Progress becomes visible', description: 'Members use rank cards, profiles, statistics, achievements, and leaderboards to see where they stand.' },
    ],
    demonstration: {
      prompt: '/rank @member',
      route: 'Acosmibot resolves the member’s current server progression and rank-card configuration.',
      result: 'Discord receives a visual card with the member’s level, XP progress, and current server standing.',
      note: 'Voice-time XP is not currently part of Acosmibot leveling; the implemented system covers messages, reactions, and commands.',
    },
    related: [
      { label: 'Discord economy bot', path: '/features/discord-economy-bot', description: 'Let activity, Acosmicoins, items, boosts, and rewards reinforce one another.' },
      { label: 'Discord games bot', path: '/features/discord-games-bot', description: 'Add competitive game statistics and Acosmicoin play to community progression.' },
      { label: 'Agentic AI Discord bot', path: '/features/ai-discord-bot', description: 'Let members ask conversational questions about levels, stats, activity, and standings.' },
    ],
  },
  'discord-economy-bot': {
    slug: 'discord-economy-bot',
    theme: 'economy',
    kicker: 'Economy system',
    title: 'A Discord economy bot where Acosmicoins connect the whole community.',
    description: 'Give members a server wallet, global bank, daily rewards, transfers, items, inventory effects, leaderboards, a guild vault, lottery events, and games that share one consistent currency system.',
    shortDescription: 'A connected Discord economy with Acosmicoins, banking, daily rewards, transfers, items, inventory, leaderboards, lottery, and games.',
    promise: 'The economy is not an isolated balance command. Acosmicoins move through rewards, banking, items, games, good deeds, donations, heists, and public progression while Acosmibot keeps global and server balances consistent.',
    availability: 'Core economy, banking, items, and games are included on the Free plan.',
    documentationPath: '/docs/economy',
    highlights: ['Server wallet', 'Global bank', 'Items and effects', 'Connected games'],
    capabilities: [
      { title: 'Earn and move Acosmicoins', description: 'Members can receive daily rewards, win games, collect mystery Good Deeds, transfer Acosmicoins, and donate to the server guild vault.' },
      { title: 'Bank across communities', description: 'Move Acosmicoins between a server wallet and a separate global bank with deposit and withdrawal history.' },
      { title: 'Build a useful item loop', description: 'Spend Acosmicoins in the shop, hold a personal inventory, equip persistent effects, activate consumables, and gift or trade items.' },
      { title: 'Create community stakes', description: 'Run a rolling lottery, fund the guild bank, reduce heist Heat through donations, and let crews attempt interactive bank heists.' },
      { title: 'Keep standings visible', description: 'Members can compare currency and net-worth standings through leaderboards, profiles, and conversational AI server statistics.' },
      { title: 'Preserve accounting integrity', description: 'Every guild-currency change applies the same delta to the member’s global total instead of overwriting whole balance rows.' },
    ],
    steps: [
      { title: 'Members earn Acosmicoins', description: 'Daily rewards, games, transfers, events, and Good Deeds create understandable sources of currency.' },
      { title: 'Acosmicoins move through the system', description: 'Members bank, give, donate, buy items, enter lotteries, or place game wagers.' },
      { title: 'Items change progression', description: 'Equipped and consumable effects can connect the shop back to leveling and other member systems.' },
      { title: 'The community builds history', description: 'Balances, transactions, game records, leaderboards, and guild-vault activity remain visible over time.' },
    ],
    demonstration: {
      prompt: '/bank deposit amount:2500',
      route: 'Acosmibot validates the member’s wallet, applies the transfer, and records the bank transaction.',
      result: 'The server wallet decreases by the same amount the global bank increases, preserving a clear and auditable transfer.',
      note: 'Acosmicoins are virtual community currency with no real-world monetary value.',
    },
    related: [
      { label: 'Discord games bot', path: '/features/discord-games-bot', description: 'Use one currency across blackjack, slots, mines, coinflip, heists, and more.' },
      { label: 'Discord leveling bot', path: '/features/discord-leveling-bot', description: 'Connect activity rewards, XP boosts, item effects, profiles, and community status.' },
      { label: 'Agentic AI Discord bot', path: '/features/ai-discord-bot', description: 'Answer live questions about net worth, standings, game records, and server activity.' },
    ],
  },
  'discord-games-bot': {
    slug: 'discord-games-bot',
    theme: 'games',
    kicker: 'Games system',
    title: 'A Discord games bot with stakes, statistics, and shared moments.',
    description: 'Play blackjack, slots, mines, keno, coinflip, deathroll, rock paper scissors, lottery events, interactive bank heists, and commandless Good Deeds inside the same connected economy.',
    shortDescription: 'Discord games including blackjack, slots, mines, keno, coinflip, deathroll, rock paper scissors, lottery, heists, and Good Deeds.',
    promise: 'Acosmibot games are built for the channel, not pasted beside it. Shared messages, buttons, turn-based minigames, wagers, live records, and community leaderboards make play visible to everyone.',
    availability: 'The core games and economy systems are included on the Free plan. Server owners can enable games individually.',
    documentationPath: '/docs/commands',
    highlights: ['Interactive Discord UI', 'Acosmicoin play', 'Live game records', 'Per-game controls'],
    capabilities: [
      { title: 'Play familiar casino games', description: 'Blackjack, slots, mines, keno, and coinflip combine quick Discord interaction with the shared Acosmicoin economy.' },
      { title: 'Challenge other members', description: 'Deathroll and best-of-three rock paper scissors create direct member-versus-member moments with clear public results.' },
      { title: 'Run a crew heist', description: 'Members form a crew, ready up, and take turns on random lockpick, hacking, lookout, wire, loot, and thermal-drill minigames.' },
      { title: 'Drop commandless Good Deeds', description: 'Admins can schedule public mystery challenges that reward the first member who claims and completes them.' },
      { title: 'Track every game honestly', description: 'Member and server game totals merge recent batched activity before cards, leaderboards, and AI answers are rendered.' },
      { title: 'Configure the game floor', description: 'A master switch and game-specific controls let each server choose which experiences and custom slot symbols fit its community.' },
    ],
    steps: [
      { title: 'Enable the right games', description: 'Server owners choose the experiences they want and keep individual games disabled where they do not fit.' },
      { title: 'Members play in Discord', description: 'Slash commands open public, interactive messages with buttons, choices, wagers, and clear turn ownership.' },
      { title: 'Acosmicoins settle consistently', description: 'Wins and losses use the same synchronized economy path as transfers, banking, items, and leaderboards.' },
      { title: 'Records stay useful', description: 'Members can view game cards and ask AI questions about totals, streaks, opponents, biggest wins, and standings.' },
    ],
    demonstration: {
      prompt: '/heist start',
      route: 'A crew joins the lobby, sees its assignments, and completes shared timed minigames one member at a time.',
      result: 'Each job changes the crew’s final success chance; one pass never guarantees the heist and one failure does not end it immediately.',
      note: 'Game records include live pending sessions when Acosmibot renders statistics, so recent play is not silently omitted.',
    },
    related: [
      { label: 'Discord economy bot', path: '/features/discord-economy-bot', description: 'Connect every wager, prize, item, bank transfer, and leaderboard to one currency model.' },
      { label: 'Discord leveling bot', path: '/features/discord-leveling-bot', description: 'Give active members another visible progression path through ranks and achievements.' },
      { label: 'Agentic AI Discord bot', path: '/features/ai-discord-bot', description: 'Ask natural questions about game totals, streaks, opponents, records, and rankings.' },
    ],
  },
};

export const DOC_ROUTES = [
  ['introduction', 'Acosmibot Introduction'],
  ['quick-start', 'Acosmibot Quick Start'],
  ['subscription-plans', 'Plans and Pricing'],
  ['leveling', 'Discord Leveling System'],
  ['economy', 'Discord Economy and Banking'],
  ['items', 'Items and Inventory'],
  ['moderation', 'Discord Moderation'],
  ['ai', 'AI Discord Bot'],
  ['ai-credits', 'AI Credits and Fuel Cells'],
  ['stats', 'Discord Statistics and Member Hub'],
  ['music', 'Discord Music Statistics'],
  ['twitch', 'Twitch Stream Alerts'],
  ['youtube', 'YouTube Alerts'],
  ['kick', 'Kick Stream Alerts'],
  ['x-alerts', 'X Post Alerts for Discord'],
  ['slots', 'Discord Slots'],
  ['mines', 'Discord Mines'],
  ['keno', 'Discord Keno'],
  ['lottery', 'Discord Lottery'],
  ['blackjack', 'Discord Blackjack'],
  ['coinflip', 'Discord Coinflip'],
  ['deathroll', 'Discord Deathroll'],
  ['heist', 'Discord Bank Heist'],
  ['good-deeds', 'Discord Good Deeds'],
  ['reaction-roles', 'Discord Reaction Roles'],
  ['custom-commands', 'Discord Custom Commands'],
  ['embeds', 'Discord Embed Builder'],
  ['reminders', 'Discord Reminders'],
  ['wow', 'World of Warcraft Character Lookups'],
  ['portals', 'Cross-Server Portals'],
  ['polymorph', 'Discord Polymorph'],
  ['jail', 'Discord Jail System'],
  ['commands', 'Acosmibot Command List'],
] as const;

export interface SeoMeta {
  title: string;
  description: string;
  socialTitle?: string;
  canonicalPath: string;
  indexable: boolean;
  kind: 'home' | 'feature' | 'docs' | 'pricing' | 'legal' | 'status' | 'app';
}

const EXACT_PUBLIC_META: Record<string, Omit<SeoMeta, 'canonicalPath'>> = {
  '/': {
    title: 'Acosmibot | AI, Leveling, Economy & Games for Discord',
    description: 'Add one Discord bot for agentic AI, leveling, economy, games, rank cards, stream alerts, moderation, reaction roles, giveaways, and more.',
    socialTitle: HOME_TAGLINE,
    indexable: true,
    kind: 'home',
  },
  '/pricing': {
    title: 'Acosmibot Pricing | Free, Plus, Pro & Max Discord Plans',
    description: 'Compare Acosmibot Free, Plus, Pro, and Max plans for Discord leveling, economy, games, streaming alerts, AI tools, memory, and server automation.',
    indexable: true,
    kind: 'pricing',
  },
  '/terms-of-service': {
    title: 'Terms of Service | Acosmibot',
    description: 'Read the terms that govern Acosmibot, its Discord bot features, website, virtual currency, and optional paid subscriptions.',
    indexable: true,
    kind: 'legal',
  },
  '/privacy-policy': {
    title: 'Privacy Policy | Acosmibot',
    description: 'Learn what Acosmibot stores, why Discord community data is processed, how website analytics consent works, and what controls users have.',
    indexable: true,
    kind: 'legal',
  },
  '/status': {
    title: 'Acosmibot Status | Live Bot, API & Database Health',
    description: 'Check current Acosmibot website, API, Discord bot, and database health, review independent uptime monitoring, and read recent incident history.',
    indexable: true,
    kind: 'status',
  },
};

const SPECIAL_DOC_META: Partial<Record<(typeof DOC_ROUTES)[number][0], Pick<SeoMeta, 'title' | 'description'>>> = {
  ai: {
    title: 'AI Discord Bot Setup, Tools & Commands | Acosmibot Docs',
    description: 'Configure Acosmibot AI chat, native tools, server personalities, member memory, ambient replies, image generation, and channel controls for Discord.',
  },
  'ai-credits': {
    title: 'AI Credits, Fuel Cells & Paid Overage | Acosmibot Docs',
    description: 'Learn Acosmibot Fuel Cell prices, provider-neutral AI Credit rates, wallet funding order, image confirmation, member contributions, and privacy controls.',
  },
  stats: {
    title: 'Discord Member Statistics & Server Hub | Acosmibot Docs',
    description: 'Understand Acosmibot member statistics, reactions given and received, most-loved rankings, leaderboards, and the authenticated server member hub.',
  },
  leveling: {
    title: 'Discord Leveling Bot Setup & Commands | Acosmibot Docs',
    description: 'Configure Discord XP rates, level announcements, role rewards, rank cards, server leaderboards, and global progression with Acosmibot.',
  },
  economy: {
    title: 'Discord Economy Bot Setup & Commands | Acosmibot Docs',
    description: 'Learn about Acosmicoins, banking, transfers, guild vaults, items, games, Good Deeds, Heat, heists, and economy leaderboards.',
  },
  wow: {
    title: 'WoW Character Lookup Bot for Discord | Acosmibot Docs',
    description: 'Look up Retail and Classic World of Warcraft characters in Discord with full-body profile cards, combat stats, gear, talents, PvP, raids, and Retail Mythic+ data.',
  },
  commands: {
    title: 'Acosmibot Discord Commands | Complete Command List',
    description: 'Browse Acosmibot commands for AI, leveling, economy, games, moderation, streaming, utilities, reaction roles, embeds, and community tools.',
  },
};

const normalizePath = (pathname: string) => {
  const clean = pathname.split(/[?#]/, 1)[0] || '/';
  return clean !== '/' ? clean.replace(/\/+$/, '') : '/';
};

export function getSeoMeta(pathname: string): SeoMeta {
  const path = normalizePath(pathname);
  const exact = EXACT_PUBLIC_META[path];
  if (exact) return { ...exact, canonicalPath: path };

  const featureSlug = path.match(/^\/features\/([^/]+)$/)?.[1];
  if (featureSlug && FEATURE_LANDINGS[featureSlug]) {
    const feature = FEATURE_LANDINGS[featureSlug];
    return {
      title: featureSlug === 'ai-discord-bot'
        ? 'Agentic AI Discord Bot with Tools & Memory | Acosmibot'
        : featureSlug === 'discord-leveling-bot'
          ? 'Discord Leveling Bot with XP, Roles & Rank Cards | Acosmibot'
          : featureSlug === 'discord-economy-bot'
            ? 'Discord Economy Bot with Banking, Items & Games | Acosmibot'
            : 'Discord Games Bot: Blackjack, Slots, Mines & Heists | Acosmibot',
      description: feature.shortDescription,
      canonicalPath: path,
      indexable: true,
      kind: 'feature',
    };
  }

  const docsSlug = path.match(/^\/docs\/([^/]+)$/)?.[1];
  const doc = docsSlug && DOC_ROUTES.find(([slug]) => slug === docsSlug);
  if (docsSlug && doc) {
    const special = SPECIAL_DOC_META[docsSlug as keyof typeof SPECIAL_DOC_META];
    const label = doc[1];
    return {
      title: special?.title ?? `${label} Guide | Acosmibot Docs`,
      description: special?.description ?? `Learn how to set up and use ${label} with Acosmibot, including Discord commands, configuration options, examples, and practical guidance.`,
      canonicalPath: path,
      indexable: true,
      kind: 'docs',
    };
  }

  return {
    title: 'Acosmibot Dashboard',
    description: 'Secure Acosmibot account and Discord server configuration.',
    canonicalPath: path,
    indexable: false,
    kind: 'app',
  };
}

export const INDEXABLE_PUBLIC_PATHS = [
  '/',
  ...Object.keys(FEATURE_LANDINGS).map(slug => `/features/${slug}`),
  ...DOC_ROUTES.map(([slug]) => `/docs/${slug}`),
  '/pricing',
  '/terms-of-service',
  '/privacy-policy',
  '/status',
];

export function buildStructuredData(meta: SeoMeta) {
  const canonical = `${SITE_ORIGIN}${meta.canonicalPath}`;
  const organization = {
    '@type': 'Organization',
    '@id': `${SITE_ORIGIN}/#organization`,
    name: 'Acosmibot',
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/images/acosmibot-logo.png`,
    email: SUPPORT_EMAIL,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: SUPPORT_EMAIL,
      url: SUPPORT_DISCORD_URL,
      availableLanguage: 'English',
    },
  };
  const website = {
    '@type': 'WebSite',
    '@id': `${SITE_ORIGIN}/#website`,
    name: 'Acosmibot',
    url: SITE_ORIGIN,
    publisher: { '@id': `${SITE_ORIGIN}/#organization` },
  };
  const application = {
    '@type': 'SoftwareApplication',
    '@id': `${SITE_ORIGIN}/#discord-app`,
    name: 'Acosmibot',
    url: SITE_ORIGIN,
    operatingSystem: 'Discord',
    applicationCategory: 'CommunicationApplication',
    description: EXACT_PUBLIC_META['/'].description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free plan available; optional paid plans add capacity and AI tools.',
    },
    publisher: { '@id': `${SITE_ORIGIN}/#organization` },
  };

  const graph: Record<string, unknown>[] = [organization, website, application];
  if (meta.canonicalPath !== '/') {
    graph.push({
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: meta.title,
      description: meta.description,
      isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
      about: { '@id': `${SITE_ORIGIN}/#discord-app` },
    });
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Acosmibot', item: SITE_ORIGIN },
        { '@type': 'ListItem', position: 2, name: meta.kind === 'docs' ? 'Documentation' : meta.kind === 'feature' ? 'Features' : meta.title, item: canonical },
      ],
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
