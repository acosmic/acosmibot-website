/**
 * Runtime configuration shared by the browser and the container rehearsal.
 *
 * The production defaults keep Azure Static Web Apps backwards compatible,
 * while a test deployment must provide its own endpoints.  An empty test
 * endpoint is an intentional configuration error; it is never replaced with
 * a production URL.
 */
export type AppEnvironment = 'production' | 'staging' | 'test' | 'development';

export interface RuntimeConfig {
  environment: AppEnvironment;
  siteOrigin?: string;
  apiBaseUrl?: string;
  originBaseUrl?: string;
  inviteUrl?: string | null;
  paymentUrl?: string | null;
  analyticsMeasurementId?: string | null;
  analyticsManualPageViewsReady?: boolean;
  statusUrl?: string;
  renderCardUrl?: string;
  cdnBaseUrl?: string;
}

const PRODUCTION_API = 'https://api.acosmibot.com';
const PRODUCTION_SITE = 'https://acosmibot.com';
const PRODUCTION_INVITE = 'https://discord.com/oauth2/authorize?client_id=1186802023799214223&permissions=8&integration_type=0&scope=bot';
const PRODUCTION_PAYMENT = 'https://donate.stripe.com/bJe3co1sfayvcMD16xgnK00';

const readConfig = (): RuntimeConfig => {
  if (typeof window === 'undefined') {
    return { environment: 'production' };
  }
  return {
    environment: window.AppConfig?.environment ?? 'production',
    ...window.AppConfig,
  };
};

const cleanUrl = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/$/, '') : undefined;
};

export const getRuntimeConfig = (): RuntimeConfig => readConfig();

export const isTestEnvironment = (): boolean => {
  const environment = readConfig().environment;
  return environment === 'test' || environment === 'staging';
};

const configuredEndpoint = (name: keyof RuntimeConfig): string | null => {
  const value = readConfig()[name];
  const endpoint = typeof value === 'string' ? cleanUrl(value) ?? null : null;
  if (!endpoint || !isTestEnvironment()) return endpoint;
  // A test config copied from production must fail closed instead of silently
  // sending browser traffic to a live host.
  if (
    endpoint.startsWith(PRODUCTION_API)
    || endpoint.startsWith(PRODUCTION_SITE)
    || endpoint.startsWith('https://cdn.acosmibot.com')
  ) return null;
  return endpoint;
};

const requiredTestEndpoint = (name: keyof RuntimeConfig): string => {
  const endpoint = configuredEndpoint(name);
  if (!endpoint) {
    throw new Error(`Test environment is missing AppConfig.${String(name)}.`);
  }
  return endpoint;
};

export const siteOrigin = (): string => {
  const configured = configuredEndpoint('siteOrigin');
  if (configured) return configured;
  if (isTestEnvironment()) return window.location.origin;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? window.location.origin
    : PRODUCTION_SITE;
};

export const apiBase = (): string => {
  const configured = configuredEndpoint('apiBaseUrl');
  if (configured) return configured;
  if (isTestEnvironment()) return requiredTestEndpoint('apiBaseUrl');
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : PRODUCTION_API;
};

export const originBase = (): string => {
  const configured = configuredEndpoint('originBaseUrl');
  if (configured) return configured;
  if (isTestEnvironment()) return window.location.origin;
  return siteOrigin();
};

export const inviteUrl = (): string | null => {
  const config = readConfig();
  if (isTestEnvironment()) {
    const value = cleanUrl(config.inviteUrl ?? undefined);
    return value && !value.includes('client_id=1186802023799214223') ? value : null;
  }
  return config.inviteUrl === null ? null : cleanUrl(config.inviteUrl ?? PRODUCTION_INVITE) ?? null;
};

export const paymentUrl = (): string | null => {
  const config = readConfig();
  if (isTestEnvironment()) {
    const value = cleanUrl(config.paymentUrl ?? undefined);
    return value && !value.startsWith('https://donate.stripe.com/') ? value : null;
  }
  return config.paymentUrl === null ? null : cleanUrl(config.paymentUrl ?? PRODUCTION_PAYMENT) ?? null;
};

export const statusUrl = (): string => {
  const configured = configuredEndpoint('statusUrl');
  if (configured) return configured;
  if (isTestEnvironment()) return '/api/status';
  return '/api/status';
};

export const renderCardUrl = (): string => {
  const configured = configuredEndpoint('renderCardUrl');
  if (configured) return configured;
  if (isTestEnvironment()) return '/api/render-card';
  return `${apiBase()}/api/render-card`;
};

export const cdnBaseUrl = (): string => {
  const configured = configuredEndpoint('cdnBaseUrl');
  if (configured) return configured;
  if (isTestEnvironment()) return window.location.origin;
  return 'https://cdn.acosmibot.com';
};
