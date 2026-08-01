export type AnalyticsConsent = 'granted' | 'denied' | null;

interface ConsentPreferences {
  version: number;
  analytics: boolean;
}

export const ANALYTICS_CONSENT_KEY = 'acosmibot_analytics_consent';
export const ANALYTICS_PREFERENCES_EVENT = 'acosmibot:analytics-preferences';
export const CONSENT_SCHEMA_VERSION = 1;

type EventName =
  | 'begin_checkout'
  | 'bot_invite_start'
  | 'config_save'
  | 'login'
  | 'login_start'
  | 'purchase'
  | 'server_open'
  | 'subscription_change';

type EventParameters = Record<string, string | number | boolean | undefined>;

const EVENT_PARAMETERS: Record<EventName, readonly string[]> = {
  begin_checkout: ['plan', 'interval', 'currency', 'value'],
  bot_invite_start: ['source'],
  config_save: ['feature', 'outcome'],
  login: ['method'],
  login_start: ['method'],
  purchase: ['plan', 'interval', 'currency', 'value'],
  server_open: ['access'],
  subscription_change: ['from_plan', 'to_plan', 'outcome'],
};

const SAFE_STRING = /^[a-z0-9][a-z0-9_-]{0,63}$/;
let initialized = false;
let consent: AnalyticsConsent = null;
let lastTrackedPath: string | null = null;

export interface AnalyticsPage {
  path: string;
  title: string;
  track: boolean;
}

const EXACT_PAGES: Record<string, string> = {
  '/': 'Acosmibot | The Discord Community System',
  '/servers': 'Your Servers | Acosmibot',
  '/settings': 'Member Settings | Acosmibot',
  '/card-studio': 'Card Studio | Acosmibot',
  '/leaderboard': 'Global Leaderboard | Acosmibot',
  '/achievements': 'Achievements | Acosmibot',
  '/docs': 'Documentation | Acosmibot',
  '/terms-of-service': 'Terms of Service | Acosmibot',
  '/privacy-policy': 'Privacy Policy | Acosmibot',
  '/pricing': 'Pricing | Acosmibot',
};

const FEATURE_TITLES: Record<string, string> = {
  overview: 'Server Overview',
  billing: 'Server Billing',
  giveaway: 'Giveaways',
  leveling: 'Leveling',
  twitch: 'Twitch Alerts',
  youtube: 'YouTube Alerts',
  kick: 'Kick Alerts',
  'custom-commands': 'Custom Commands',
  moderation: 'Moderation',
  'banned-users': 'Banned Users',
  ai: 'AI Settings',
  games: 'Games',
  polymorph: 'Polymorph',
  analytics: 'Server Analytics',
  music: 'Music',
  'activity-monitor': 'Activity Monitor',
  'better-embeds': 'Better Embeds',
  embeds: 'Embeds',
  'reaction-roles': 'Reaction Roles',
};

const DOC_PAGES = new Set([
  'ai', 'blackjack', 'coinflip', 'commands', 'custom-commands', 'deathroll',
  'economy', 'embeds', 'good-deeds', 'heist', 'introduction', 'items', 'jail',
  'keno', 'kick', 'leveling', 'lottery', 'mines', 'moderation', 'music',
  'polymorph', 'portals', 'quick-start', 'reaction-roles', 'reminders', 'slots',
  'subscription-plans', 'twitch', 'youtube',
]);

export function resolveAnalyticsPage(pathname: string): AnalyticsPage {
  if (pathname === '/dashboard') {
    return { path: '/dashboard', title: 'Completing Sign In | Acosmibot', track: false };
  }
  if (pathname === '/me' || pathname === '/profile' || pathname === '/premium' || /^\/server\/[^/]+\/?$/.test(pathname)) {
    return { path: '/redirect', title: 'Acosmibot', track: false };
  }
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return { path: '/admin', title: 'Owner Administration | Acosmibot', track: false };
  }
  if (EXACT_PAGES[pathname]) {
    return { path: pathname, title: EXACT_PAGES[pathname], track: true };
  }
  if (/^\/u\/[^/]+$/.test(pathname)) {
    return { path: '/u/:profile', title: 'Member Profile | Acosmibot', track: true };
  }
  if (/^\/leaderboard\/[^/]+$/.test(pathname)) {
    return { path: '/leaderboard/:guild', title: 'Server Leaderboard | Acosmibot', track: true };
  }
  if (/^\/docs\/[^/]+$/.test(pathname)) {
    const slug = pathname.split('/')[2].replace(/[^a-z0-9-]/gi, '').slice(0, 48);
    const safeSlug = DOC_PAGES.has(slug) ? slug : ':page';
    return { path: `/docs/${safeSlug}`, title: 'Documentation | Acosmibot', track: true };
  }

  const serverMatch = pathname.match(/^\/server\/[^/]+\/([^/]+)(?:\/([^/]+))?(?:\/[^/]+)?$/);
  if (serverMatch) {
    const feature = FEATURE_TITLES[serverMatch[1]] ? serverMatch[1] : 'feature';
    let suffix = '';
    if (serverMatch[2] === 'new') suffix = '/new';
    if (serverMatch[2] === 'edit') suffix = '/edit/:item';
    return {
      path: `/server/:guild/${feature}${suffix}`,
      title: `${FEATURE_TITLES[feature] ?? 'Server Feature'} | Acosmibot`,
      track: true,
    };
  }

  return { path: '/404', title: 'Page Not Found | Acosmibot', track: true };
}

export function readAnalyticsConsent(): AnalyticsConsent {
  try {
    const value = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (!value) return null;

    // Migrate choices made by the first analytics-only banner. This branch is
    // deliberately valid only for schema v1; a future category/version must
    // prompt again instead of inheriting a broader, undisclosed purpose.
    if (CONSENT_SCHEMA_VERSION === 1 && (value === 'granted' || value === 'denied')) {
      const preferences: ConsentPreferences = {
        version: CONSENT_SCHEMA_VERSION,
        analytics: value === 'granted',
      };
      localStorage.setItem(ANALYTICS_CONSENT_KEY, JSON.stringify(preferences));
      return value;
    }

    const preferences = JSON.parse(value) as Partial<ConsentPreferences>;
    if (
      preferences.version !== CONSENT_SCHEMA_VERSION
      || typeof preferences.analytics !== 'boolean'
    ) return null;
    return preferences.analytics ? 'granted' : 'denied';
  } catch {
    return null;
  }
}

export function writeAnalyticsConsent(value: Exclude<AnalyticsConsent, null>): void {
  consent = value;
  try {
    const preferences: ConsentPreferences = {
      version: CONSENT_SCHEMA_VERSION,
      analytics: value === 'granted',
    };
    localStorage.setItem(ANALYTICS_CONSENT_KEY, JSON.stringify(preferences));
  } catch { /* analytics stays fail-closed when storage is unavailable */ }

  if (window.gtag) {
    window.gtag('consent', 'update', {
      analytics_storage: value,
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  }
  if (value === 'denied') clearAnalyticsCookies();
}

export function openAnalyticsPreferences(): void {
  window.dispatchEvent(new CustomEvent(ANALYTICS_PREFERENCES_EVENT));
}

export function initializeAnalytics(): boolean {
  consent = readAnalyticsConsent();
  const measurementId = window.AppConfig?.analyticsMeasurementId;
  if (
    consent !== 'granted'
    || !measurementId
    || window.AppConfig?.analyticsManualPageViewsReady !== true
  ) return false;
  if (initialized) return true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.gtag('consent', 'update', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  const currentPage = resolveAnalyticsPage(window.location.pathname || '/');
  window.gtag('set', {
    page_title: currentPage.title,
    page_location: `${window.location.origin}${currentPage.path}`,
    page_referrer: sanitizedExternalReferrer(),
  });
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  if (!document.querySelector(`script[data-acosmibot-analytics="${measurementId}"]`)) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.dataset.acosmibotAnalytics = measurementId;
    document.head.appendChild(script);
  }
  initialized = true;
  return true;
}

export function trackPageView(page: AnalyticsPage): void {
  if (!page.track || !initializeAnalytics() || lastTrackedPath === page.path) return;
  const previousPath = lastTrackedPath;
  lastTrackedPath = page.path;
  window.gtag?.('set', {
    page_title: page.title,
    page_location: `${window.location.origin}${page.path}`,
    page_referrer: previousPath
      ? `${window.location.origin}${previousPath}`
      : sanitizedExternalReferrer(),
  });
  window.gtag?.('event', 'page_view', {
    page_title: page.title,
    page_location: `${window.location.origin}${page.path}`,
    page_referrer: previousPath
      ? `${window.location.origin}${previousPath}`
      : sanitizedExternalReferrer(),
  });
}

function sanitizedExternalReferrer(): string {
  if (!document.referrer) return '';
  try {
    const referrer = new URL(document.referrer);
    return referrer.origin === window.location.origin ? window.location.origin : referrer.origin;
  } catch {
    return '';
  }
}

export function trackEvent(name: EventName, parameters: EventParameters = {}): void {
  if (!initializeAnalytics()) return;
  const allowed = new Set(EVENT_PARAMETERS[name]);
  const safeParameters: EventParameters = {};
  for (const [key, value] of Object.entries(parameters)) {
    if (!allowed.has(key) || value === undefined) continue;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (SAFE_STRING.test(normalized)) safeParameters[key] = normalized;
    } else if (typeof value === 'boolean') {
      safeParameters[key] = value;
    } else if (Number.isFinite(value)) {
      safeParameters[key] = value;
    }
  }
  window.gtag?.('event', name, safeParameters);
}

function clearAnalyticsCookies(): void {
  const cookieNames = document.cookie
    .split(';')
    .map((value) => value.split('=')[0].trim())
    .filter((name) => name.startsWith('_ga'));
  for (const name of cookieNames) {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.acosmibot.com; SameSite=Lax`;
  }
}
