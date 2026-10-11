/**
 * Public status relay for Acosmibot.
 *
 * Sentry credentials stay in Azure app settings. This function returns only a
 * small, allowlisted health model: no issue text, event payloads, stack traces,
 * project identifiers, infrastructure details, or user data cross the public
 * boundary. A direct off-host probe keeps the page useful when Sentry is
 * temporarily unavailable, while Sentry supplies confirmed uptime and the bot
 * database heartbeat when configured.
 */
import { PUBLIC_STATUS_INCIDENTS } from '../../src/status/publicIncidents';

type ComponentStatus = 'operational' | 'degraded' | 'outage' | 'unknown';

interface ComponentSignal {
  id: 'website' | 'api' | 'bot-database';
  name: string;
  description: string;
  status: ComponentStatus;
  checkedAt: string;
  latencyMs?: number;
  history?: UptimeHistory;
}

interface UptimeSegment {
  timestamp: string;
  status: ComponentStatus;
  percentage: number | null;
  totalChecks: number;
  failedChecks: number;
  missedChecks: number;
  downtimeMinutes: number | null;
}

interface UptimeHistory {
  periodDays: 30;
  state: 'available' | 'unavailable' | 'not_configured';
  percentage: number | null;
  totalChecks: number;
  segments: UptimeSegment[];
}

interface PublicIncident {
  id: string;
  title: string;
  impact: 'partial' | 'major';
  status: 'investigating' | 'monitoring' | 'resolved';
  startedAt: string;
  resolvedAt?: string;
  duration?: string;
  summary: string;
}

export interface PublicStatusPayload {
  schemaVersion: 1;
  overallStatus: ComponentStatus;
  headline: string;
  checkedAt: string;
  dataState: 'live' | 'partial' | 'delayed';
  source: 'sentry-and-direct' | 'direct' | 'fallback';
  components: ComponentSignal[];
  uptime: {
    periodDays: 30;
    percentage: number | null;
    totalChecks: number;
    monitoringStartedAt?: string;
    segments: UptimeSegment[];
  };
  incidents: PublicIncident[];
}

interface DirectProbe {
  status: ComponentStatus;
  latencyMs?: number;
}

interface SentrySnapshot {
  websiteStatus?: ComponentStatus;
  websiteHistory?: UptimeHistory;
  botHistory?: UptimeHistory;
  apiStatus: ComponentStatus;
  botStatus: ComponentStatus;
  uptimePercentage: number | null;
  totalChecks: number;
  monitoringStartedAt?: string;
  segments: UptimeSegment[];
  apiIncidentStartedAt?: string;
  botIncidentStartedAt?: string;
  available: boolean;
}

const PRODUCTION_API_HEALTH_URL = 'https://api.acosmibot.com/health';
const PRODUCTION_WEBSITE_URL = 'https://acosmibot.com/';
const PRODUCTION_SENTRY_ORIGIN = 'https://sentry.io';
const CACHE_TTL_MS = 30_000;
const MAX_RESPONSE_BYTES = 512 * 1024;

let cached: { expiresAt: number; payload: PublicStatusPayload } | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asFiniteNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asIsoDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
};

export const normalizeHealthStatus = (value: unknown): ComponentStatus => {
  // Sentry's UptimeStatus IntEnum is OK=1, FAILED=2.
  if (value === 1) return 'operational';
  if (value === 2) return 'outage';
  if (typeof value !== 'string') return 'unknown';
  const normalized = value.trim().toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');
  if (['up', 'ok', 'healthy', 'success', 'resolved', 'operational'].includes(normalized)) {
    return 'operational';
  }
  if (['degraded', 'warning', 'missed_window'].includes(normalized)) return 'degraded';
  if (
    ['down', 'failure', 'failed', 'error', 'critical', 'unresolved', 'missed_checkin', 'timeout']
      .includes(normalized)
  ) {
    return 'outage';
  }
  if (normalized === 'in_progress') return 'operational';
  return 'unknown';
};

const fetchJson = async (url: string, token: string, timeoutMs = 5_000): Promise<unknown> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`source returned ${response.status}`);
    const declaredSize = asFiniteNumber(response.headers.get('content-length')) ?? 0;
    if (declaredSize > MAX_RESPONSE_BYTES) throw new Error('source response exceeded limit');
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new Error('source response exceeded limit');
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
};

const isIsolatedEnvironment = (): boolean => (
  ['test', 'staging'].includes(process.env.ACOSMIBOT_ENVIRONMENT?.trim().toLowerCase() || '')
);

const configuredApiHealthUrl = (): string | null => (
  process.env.STATUS_API_HEALTH_URL?.trim() || process.env.API_HEALTH_URL?.trim()
    || (isIsolatedEnvironment() ? null : PRODUCTION_API_HEALTH_URL)
);

const configuredWebsiteUrl = (): string | null => (
  process.env.STATUS_WEBSITE_HEALTH_URL?.trim()
    || (isIsolatedEnvironment() ? null : PRODUCTION_WEBSITE_URL)
);

const configuredSentryOrigin = (): string | null => (
  process.env.SENTRY_STATUS_ORIGIN?.trim().replace(/\/$/, '')
    || (isIsolatedEnvironment() ? null : PRODUCTION_SENTRY_ORIGIN)
);

const configuredSentryEnvironment = (): string => (
  process.env.SENTRY_STATUS_ENVIRONMENT?.trim() || (isIsolatedEnvironment() ? 'test' : 'production')
);

const directProbe = async (url = configuredApiHealthUrl()): Promise<DirectProbe> => {
  if (!url) return { status: 'unknown' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      redirect: 'error',
      signal: controller.signal,
    });
    return {
      status: response.ok ? 'operational' : 'outage',
      latencyMs: Date.now() - startedAt,
    };
  } catch {
    return { status: 'outage' };
  } finally {
    clearTimeout(timer);
  }
};

const getDetectorId = (detectors: unknown, expectedName: string): string | undefined => {
  const rows = Array.isArray(detectors)
    ? detectors
    : isRecord(detectors) && Array.isArray(detectors.data)
      ? detectors.data
      : [];
  const match = rows.find((row) => (
    isRecord(row) && typeof row.name === 'string' && row.name === expectedName
  ));
  const id = isRecord(match) ? match.id : undefined;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : undefined;
};

const count = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return 0;
  return value;
};

// Public history follows confirmed downtime duration. Isolated HTTP probe
// failures and missed monitoring windows remain diagnostic counts only.
export const dailyStatus = (downtimeMinutes: number, observedChecks: number): ComponentStatus => {
  if (observedChecks === 0) return 'unknown';
  if (downtimeMinutes === 0) return 'operational';
  return downtimeMinutes < 60 ? 'degraded' : 'outage';
};

const emptyHistory = (state: UptimeHistory['state'] = 'unavailable'): UptimeHistory => ({
  periodDays: 30, state, percentage: null, totalChecks: 0, segments: [],
});

const buildHistory = (
  rows: Array<{ timestamp: number; successful: number; failed: number; missed: number; confirmedFailed: number; observed: number }>,
  since: number,
  until: number,
  intervalSeconds: number,
): UptimeHistory => {
  if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0 || intervalSeconds > 86_400) return emptyHistory();
  let confirmedFailed = 0;
  let observedChecks = 0;
  let measuredChecks = 0;
  let totalChecks = 0;
  const segments = rows.filter(row => (
    Number.isFinite(row.timestamp) && row.timestamp >= since && row.timestamp <= until
  )).sort((a, b) => a.timestamp - b.timestamp).slice(-30).map(row => {
    const total = row.successful + row.failed + row.missed;
    confirmedFailed += row.confirmedFailed;
    observedChecks += row.observed;
    totalChecks += total;
    // A bucket containing only unknown/missed HTTP probes provides no uptime
    // evidence and must not improve the period percentage.
    if (row.observed > 0) measuredChecks += total;
    const downtimeMinutes = row.confirmedFailed * intervalSeconds / 60;
    return {
      timestamp: new Date(row.timestamp * 1_000).toISOString(),
      status: dailyStatus(downtimeMinutes, row.observed),
      percentage: row.observed > 0 ? Number(((total - row.confirmedFailed) / total * 100).toFixed(3)) : null,
      downtimeMinutes: row.observed > 0 ? downtimeMinutes : null,
      totalChecks: total,
      failedChecks: row.failed,
      missedChecks: row.missed,
    };
  });
  return {
    periodDays: 30,
    state: observedChecks > 0 ? 'available' : 'unavailable',
    percentage: observedChecks > 0 ? Number(((measuredChecks - confirmedFailed) / measuredChecks * 100).toFixed(3)) : null,
    totalChecks,
    segments,
  };
};

export const readUptimeHistory = (
  response: unknown, detectorId: string, since: number, until: number, intervalSeconds: number,
): UptimeHistory => {
  const root = isRecord(response) ? response : {};
  const rows = asArray(root[detectorId]).flatMap(bucket => {
    if (!Array.isArray(bucket) || bucket.length < 2 || !isRecord(bucket[1])) return [];
    const timestamp = asFiniteNumber(bucket[0]);
    if (timestamp == null) return [];
    const counts = bucket[1];
    return [{
      timestamp,
      successful: count(counts.success),
      failed: count(counts.failure) + count(counts.failure_incident),
      missed: count(counts.missed_window),
      confirmedFailed: count(counts.failure_incident),
      observed: count(counts.success) + count(counts.failure) + count(counts.failure_incident),
    }];
  });
  return buildHistory(rows, since, until, intervalSeconds);
};

export const readCronHistory = (
  response: unknown, monitorId: string, since: number, until: number, intervalSeconds: number, environmentName = 'production',
): UptimeHistory => {
  const root = isRecord(response) ? response : {};
  const rows = asArray(root[monitorId]).flatMap(bucket => {
    if (!Array.isArray(bucket) || !isRecord(bucket[1])) return [];
    const timestamp = asFiniteNumber(bucket[0]);
    const counts = bucket[1][environmentName];
    if (timestamp == null || !isRecord(counts)) return [];
    return [{
      timestamp,
      successful: count(counts.ok),
      failed: count(counts.error) + count(counts.timeout),
      missed: count(counts.missed) + count(counts.unknown),
      // Cron missed check-ins are emitted after the configured grace period,
      // unlike an HTTP missed_window, which only means no probe ran.
      confirmedFailed: count(counts.error) + count(counts.timeout) + count(counts.missed),
      observed: count(counts.ok) + count(counts.error) + count(counts.timeout) + count(counts.missed),
    }];
  });
  return buildHistory(rows, since, until, intervalSeconds);
};

const findCronEnvironment = (monitor: unknown): Record<string, unknown> => {
  if (!isRecord(monitor)) return {};
  const environments = asArray(monitor.environments).filter(isRecord);
  return environments.find((environment) => (
    environment.name === configuredSentryEnvironment() || environment.environment === configuredSentryEnvironment()
  )) ?? {};
};

const readCronSignal = (monitor: unknown, checkIns: unknown) => {
  const environment = findCronEnvironment(monitor);
  const lastCheckIn = isRecord(environment.lastCheckIn)
    ? environment.lastCheckIn
    : isRecord(environment.last_check_in)
      ? environment.last_check_in
      : {};
  const checks = Array.isArray(checkIns)
    ? checkIns.filter(isRecord)
    : isRecord(checkIns) && Array.isArray(checkIns.data)
      ? checkIns.data.filter(isRecord)
      : [];
  const latest = checks[0] ?? {};
  const rawStatus = lastCheckIn.status
    ?? latest.status
    ?? environment.status;
  const checkedAt = asIsoDate(
    (typeof environment.lastCheckIn === 'string' ? environment.lastCheckIn : undefined)
      ?? lastCheckIn.dateUpdated
      ?? lastCheckIn.date_updated
      ?? latest.dateUpdated
      ?? latest.date_updated
      ?? latest.dateCreated
      ?? latest.date_created,
  );
  return { status: normalizeHealthStatus(rawStatus), checkedAt };
};

const getSentrySnapshot = async (): Promise<SentrySnapshot> => {
  const token = process.env.SENTRY_STATUS_TOKEN?.trim();
  const sentryOrigin = configuredSentryOrigin();
  const sentryEnvironment = configuredSentryEnvironment();
  if (!token || !sentryOrigin) {
    return {
      apiStatus: 'unknown',
      botStatus: 'unknown',
      uptimePercentage: null,
      totalChecks: 0,
      segments: [],
      available: false,
    };
  }

  const org = encodeURIComponent(process.env.SENTRY_STATUS_ORG?.trim() || 'acosmic');
  const apiProject = encodeURIComponent(
    process.env.SENTRY_STATUS_API_PROJECT?.trim() || 'acosmibot-api',
  );
  const detectorName = process.env.SENTRY_STATUS_UPTIME_NAME?.trim() || 'Acosmibot API uptime';
  const botMonitor = encodeURIComponent(
    process.env.SENTRY_STATUS_BOT_MONITOR?.trim() || 'acosmibot-bot-db',
  );

  const websiteProject = encodeURIComponent(
    process.env.SENTRY_STATUS_WEBSITE_PROJECT?.trim() || 'acosmibot-api',
  );
  const websiteName = process.env.SENTRY_STATUS_WEBSITE_UPTIME_NAME?.trim() || 'Acosmibot website uptime';
  let detectorId = process.env.SENTRY_STATUS_UPTIME_DETECTOR_ID?.trim();
  let websiteDetectorId = process.env.SENTRY_STATUS_WEBSITE_DETECTOR_ID?.trim();
  // Discovery is bounded to the configured project(s); no public query can
  // select a Sentry monitor or URL. Tokens and IDs never leave this relay.
  const discover = async (project: string) => fetchJson(
    `${sentryOrigin}/api/0/organizations/${org}/detectors/?project=${project}`, token,
  );
  const discoveredProjects = new Set<string>();
  try {
    const detectors = await discover(apiProject);
    discoveredProjects.add(apiProject);
    detectorId ??= getDetectorId(detectors, detectorName);
    const websiteDetectors = websiteProject === apiProject ? detectors : await discover(websiteProject);
    discoveredProjects.add(websiteProject);
    websiteDetectorId ??= getDetectorId(websiteDetectors, websiteName);
  } catch {
    // Explicit configured detector IDs can still work during discovery failure.
  }

  // Sentry stats ignores statsPeriod/interval: request 30 UTC calendar days,
  // including today so far, using its since/until/resolution contract.
  const until = Math.floor(Date.now() / 1_000);
  const since = Math.floor(until / 86_400) * 86_400 - 29 * 86_400;
  const readUptime = async (id: string | undefined, project: string) => {
    if (!id) return { detail: {}, history: emptyHistory(discoveredProjects.has(project) ? 'not_configured' : 'unavailable') };
    const query = new URLSearchParams({ uptimeDetectorId: id, since: String(since), until: String(until), resolution: '1d' });
    const [detail, history] = await Promise.allSettled([
      fetchJson(`${sentryOrigin}/api/0/projects/${org}/${project}/uptime/${encodeURIComponent(id)}/`, token),
      fetchJson(`${sentryOrigin}/api/0/organizations/${org}/uptime-stats/?${query}`, token),
    ]);
    const monitor = detail.status === 'fulfilled' && isRecord(detail.value) ? detail.value : {};
    return {
      detail: monitor,
      history: history.status === 'fulfilled' ? readUptimeHistory(history.value, id, since, until, count(monitor.intervalSeconds)) : emptyHistory(),
    };
  };
  const readBot = async () => {
    const monitor = await fetchJson(
      `${sentryOrigin}/api/0/organizations/${org}/monitors/${botMonitor}/?environment=${encodeURIComponent(sentryEnvironment)}`, token,
    );
    const detail = isRecord(monitor) ? monitor : {};
    const monitorId = typeof detail.id === 'string' ? detail.id : '';
    const config = isRecord(detail.config) ? detail.config : {};
    // This code-owned bot heartbeat runs once per minute. Fail closed if the
    // configured cadence changes instead of silently misreporting minutes.
    const cadence = config.schedule_type === 'crontab' && config.schedule === '* * * * *' ? 60 : 0;
    let history = emptyHistory();
    if (monitorId) {
      // The single-monitor /stats endpoint times out on long histories; the
      // optimized aggregate endpoint scopes by monitor and the configured environment.
      const query = new URLSearchParams({ monitor: monitorId, environment: sentryEnvironment, since: String(since), until: String(until), resolution: '1d' });
      try {
        const stats = await fetchJson(`${sentryOrigin}/api/0/organizations/${org}/monitors-stats/?${query}`, token);
        history = readCronHistory(stats, monitorId, since, until, cadence, sentryEnvironment);
      } catch {
        // Keep current heartbeat status available if historical reads fail.
      }
    }
    return { signal: readCronSignal(detail, []), history };
  };
  const [api, website, botResult] = await Promise.all([
    readUptime(detectorId, apiProject),
    readUptime(websiteDetectorId, websiteProject),
    readBot().catch(() => ({ signal: { status: 'unknown' as ComponentStatus, checkedAt: undefined }, history: emptyHistory() })),
  ]);
  const latestGroup = isRecord(api.detail.latestGroup) ? api.detail.latestGroup : {};
  const apiStatus = normalizeHealthStatus(api.detail.uptimeStatus ?? api.detail.uptime_status);
  return {
    apiStatus,
    websiteStatus: normalizeHealthStatus(website.detail.uptimeStatus ?? website.detail.uptime_status),
    websiteHistory: website.history,
    botStatus: botResult.signal.status,
    botHistory: botResult.history,
    uptimePercentage: api.history.percentage,
    totalChecks: api.history.totalChecks,
    monitoringStartedAt: asIsoDate(api.detail.dateCreated ?? api.detail.date_created),
    segments: api.history.segments,
    apiIncidentStartedAt: apiStatus === 'outage' ? asIsoDate(latestGroup.firstSeen ?? latestGroup.first_seen) : undefined,
    botIncidentStartedAt: botResult.signal.status === 'outage' ? botResult.signal.checkedAt : undefined,
    available: apiStatus !== 'unknown' || botResult.signal.status !== 'unknown',
  };
};

const mergeApiStatus = (
  directStatus: ComponentStatus,
  sentryStatus: ComponentStatus,
): ComponentStatus => {
  if (sentryStatus === 'outage') return 'outage';
  if (directStatus === 'outage' && sentryStatus === 'operational') return 'degraded';
  if (directStatus === 'outage') return 'outage';
  if (sentryStatus === 'degraded') return 'degraded';
  return directStatus === 'operational' ? 'operational' : sentryStatus;
};

const overallFrom = (components: ComponentSignal[]): ComponentStatus => {
  const serviceStatuses = components.map(component => component.status);
  if (serviceStatuses.includes('outage')) return 'outage';
  if (serviceStatuses.includes('degraded')) return 'degraded';
  if (serviceStatuses.every((status) => status === 'unknown')) return 'unknown';
  if (serviceStatuses.includes('unknown')) return 'degraded';
  return 'operational';
};

const headlineFor = (status: ComponentStatus) => {
  if (status === 'operational') return 'All systems are operating normally.';
  if (status === 'degraded') return 'Some systems are reporting degraded service.';
  if (status === 'outage') return 'Acosmibot is experiencing a service disruption.';
  return 'Live status data is temporarily delayed.';
};

export const buildStatusPayload = (
  direct: DirectProbe,
  sentry: SentrySnapshot,
  checkedAt = new Date().toISOString(),
  websiteDirect: DirectProbe = { status: 'unknown' },
): PublicStatusPayload => {
  const apiStatus = mergeApiStatus(direct.status, sentry.apiStatus);
  const components: ComponentSignal[] = [
    {
      id: 'website',
      name: 'Website',
      description: 'Public site and status relay',
      status: mergeApiStatus(websiteDirect.status, sentry.websiteStatus ?? 'unknown'),
      checkedAt,
      history: sentry.websiteHistory ?? emptyHistory(),
    },
    {
      id: 'api',
      name: 'API & gateway',
      description: 'Public API, secure tunnel, and application host',
      status: apiStatus,
      checkedAt,
      history: { periodDays: 30, state: sentry.uptimePercentage != null ? 'available' : 'unavailable', percentage: sentry.uptimePercentage, totalChecks: sentry.totalChecks, segments: sentry.segments.slice(-30) },
      ...(direct.latencyMs == null ? {} : { latencyMs: direct.latencyMs }),
    },
    {
      id: 'bot-database',
      name: 'Bot',
      description: 'Discord bot process and database heartbeat',
      status: sentry.botStatus,
      checkedAt,
      history: sentry.botHistory ?? emptyHistory(),
    },
  ];
  const overallStatus = overallFrom(components);
  const activeIncidents: PublicIncident[] = [];
  if (components[0].status === 'outage') {
    activeIncidents.push({
      id: 'active-website-availability',
      title: 'Website connectivity disruption',
      impact: 'partial',
      status: 'investigating',
      startedAt: checkedAt,
      summary: 'The public website is not responding normally. Monitoring is active while service is restored.',
    });
  }
  if (apiStatus === 'outage') {
    activeIncidents.push({
      id: 'active-api-availability',
      title: 'API connectivity disruption',
      impact: 'major',
      status: 'investigating',
      startedAt: sentry.apiIncidentStartedAt ?? checkedAt,
      summary: 'The public API is not responding normally. Monitoring is active while service is restored.',
    });
  }
  if (sentry.botStatus === 'outage') {
    activeIncidents.push({
      id: 'active-bot-database-heartbeat',
      title: 'Bot application heartbeat missed',
      impact: 'partial',
      status: 'investigating',
      startedAt: sentry.botIncidentStartedAt ?? checkedAt,
      summary: 'The bot and database health signal is not reporting normally. Some Discord actions may be unavailable.',
    });
  }

  return {
    schemaVersion: 1,
    overallStatus,
    headline: headlineFor(overallStatus),
    checkedAt,
    dataState: sentry.available ? 'live' : direct.status === 'operational' ? 'partial' : 'delayed',
    source: sentry.available ? 'sentry-and-direct' : direct.status !== 'unknown' ? 'direct' : 'fallback',
    components,
    uptime: {
      periodDays: 30,
      percentage: sentry.uptimePercentage,
      totalChecks: sentry.totalChecks,
      monitoringStartedAt: sentry.monitoringStartedAt,
      segments: sentry.segments.slice(-30),
    },
    incidents: [...activeIncidents, ...PUBLIC_STATUS_INCIDENTS],
  };
};

const buildLivePayload = async (): Promise<PublicStatusPayload> => {
  const [direct, websiteDirect, sentryResult] = await Promise.all([
    directProbe(),
    directProbe(configuredWebsiteUrl()),
    getSentrySnapshot().catch((): SentrySnapshot => ({
      apiStatus: 'unknown',
      botStatus: 'unknown',
      uptimePercentage: null,
      totalChecks: 0,
      segments: [],
      available: false,
    })),
  ]);
  return buildStatusPayload(direct, sentryResult, new Date().toISOString(), websiteDirect);
};

export async function run(context: any): Promise<void> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    context.res = {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=300',
        'X-Content-Type-Options': 'nosniff',
      },
      body: cached.payload,
    };
    return;
  }

  try {
    const payload = await buildLivePayload();
    cached = { expiresAt: now + CACHE_TTL_MS, payload };
    context.res = {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=300',
        'X-Content-Type-Options': 'nosniff',
      },
      body: payload,
    };
  } catch {
    context.log?.warn?.('public status refresh failed');
    if (cached) {
      context.res = {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=15, stale-while-revalidate=300',
          'X-Content-Type-Options': 'nosniff',
        },
        body: { ...cached.payload, dataState: 'delayed' },
      };
      return;
    }
    context.res = {
      status: 503,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
      body: { error: 'Status data is temporarily unavailable.' },
    };
  }
}
