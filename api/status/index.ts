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
}

interface UptimeSegment {
  timestamp: string;
  status: ComponentStatus;
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

const API_HEALTH_URL = 'https://api.acosmibot.com/health';
const SENTRY_ORIGIN = 'https://sentry.io';
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

const directProbe = async (): Promise<DirectProbe> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  const startedAt = Date.now();
  try {
    const response = await fetch(API_HEALTH_URL, {
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

const readUptimeSummary = (response: unknown, detectorId: string) => {
  const root = isRecord(response) ? response : {};
  const summary = isRecord(root[detectorId]) ? root[detectorId] as Record<string, unknown> : {};
  const totalChecks = Math.max(0, Math.round(asFiniteNumber(
    summary.totalChecks ?? summary.total_checks,
  ) ?? 0));
  const downtimeChecks = Math.max(0, Math.round(asFiniteNumber(
    summary.downtimeChecks ?? summary.downtime_checks,
  ) ?? 0));
  const percentage = totalChecks > 0
    ? Math.max(0, Math.min(100, ((totalChecks - downtimeChecks) / totalChecks) * 100))
    : null;
  return {
    totalChecks,
    percentage: percentage == null ? null : Number(percentage.toFixed(3)),
  };
};

const readUptimeSegments = (response: unknown, detectorId: string): UptimeSegment[] => {
  const root = isRecord(response) ? response : {};
  return asArray(root[detectorId]).flatMap((bucket): UptimeSegment[] => {
    if (!Array.isArray(bucket) || bucket.length < 2 || !isRecord(bucket[1])) return [];
    const epoch = asFiniteNumber(bucket[0]);
    if (epoch == null) return [];
    const counts = bucket[1];
    const incidentFailures = asFiniteNumber(counts.failure_incident) ?? 0;
    const failures = asFiniteNumber(counts.failure) ?? 0;
    const missed = asFiniteNumber(counts.missed_window) ?? 0;
    const successes = asFiniteNumber(counts.success) ?? 0;
    const status: ComponentStatus = incidentFailures > 0
      ? 'outage'
      : failures > 0 || missed > 0
        ? 'degraded'
        : successes > 0
          ? 'operational'
          : 'unknown';
    return [{ timestamp: new Date(epoch * 1_000).toISOString(), status }];
  });
};

const findCronEnvironment = (monitor: unknown): Record<string, unknown> => {
  if (!isRecord(monitor)) return {};
  const environments = asArray(monitor.environments).filter(isRecord);
  return environments.find((environment) => (
    environment.name === 'production' || environment.environment === 'production'
  )) ?? environments[0] ?? {};
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
    lastCheckIn.dateUpdated
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
  if (!token) {
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

  let detectorId = process.env.SENTRY_STATUS_UPTIME_DETECTOR_ID?.trim();
  if (!detectorId) {
    try {
      const detectors = await fetchJson(
        `${SENTRY_ORIGIN}/api/0/organizations/${org}/detectors/?project=${apiProject}`,
        token,
      );
      detectorId = getDetectorId(detectors, detectorName);
    } catch {
      detectorId = undefined;
    }
  }

  const uptimeDetailUrl = detectorId
    ? `${SENTRY_ORIGIN}/api/0/projects/${org}/${apiProject}/uptime/${encodeURIComponent(detectorId)}/`
    : null;
  const summaryUrl = detectorId
    ? `${SENTRY_ORIGIN}/api/0/organizations/${org}/uptime-summary/?uptimeDetectorId=${encodeURIComponent(detectorId)}&statsPeriod=30d`
    : null;
  const statsUrl = detectorId
    ? `${SENTRY_ORIGIN}/api/0/organizations/${org}/uptime-stats/?uptimeDetectorId=${encodeURIComponent(detectorId)}&statsPeriod=30d&interval=1d`
    : null;
  const cronUrl = `${SENTRY_ORIGIN}/api/0/organizations/${org}/monitors/${botMonitor}/?environment=production`;
  const checkInsUrl = `${SENTRY_ORIGIN}/api/0/organizations/${org}/monitors/${botMonitor}/checkins/`;

  const settled = await Promise.allSettled([
    uptimeDetailUrl ? fetchJson(uptimeDetailUrl, token) : Promise.resolve(null),
    summaryUrl ? fetchJson(summaryUrl, token) : Promise.resolve(null),
    statsUrl ? fetchJson(statsUrl, token) : Promise.resolve(null),
    fetchJson(cronUrl, token),
    fetchJson(checkInsUrl, token),
  ]);
  const valueAt = (index: number): unknown => (
    settled[index]?.status === 'fulfilled' ? settled[index].value : null
  );
  const detail = isRecord(valueAt(0)) ? valueAt(0) as Record<string, unknown> : {};
  const latestGroup = isRecord(detail.latestGroup) ? detail.latestGroup : {};
  const cronSignal = readCronSignal(valueAt(3), valueAt(4));
  const summary = detectorId
    ? readUptimeSummary(valueAt(1), detectorId)
    : { totalChecks: 0, percentage: null };

  return {
    apiStatus: normalizeHealthStatus(detail.uptimeStatus ?? detail.uptime_status),
    botStatus: cronSignal.status,
    uptimePercentage: summary.percentage,
    totalChecks: summary.totalChecks,
    monitoringStartedAt: asIsoDate(detail.dateCreated ?? detail.date_created),
    segments: detectorId ? readUptimeSegments(valueAt(2), detectorId) : [],
    apiIncidentStartedAt: normalizeHealthStatus(detail.uptimeStatus ?? detail.uptime_status) === 'outage'
      ? asIsoDate(latestGroup.firstSeen ?? latestGroup.first_seen)
      : undefined,
    botIncidentStartedAt: cronSignal.status === 'outage' ? cronSignal.checkedAt : undefined,
    available: settled.some((result) => result.status === 'fulfilled' && result.value != null),
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
  const serviceStatuses = components.filter((component) => component.id !== 'website').map(
    (component) => component.status,
  );
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
): PublicStatusPayload => {
  const apiStatus = mergeApiStatus(direct.status, sentry.apiStatus);
  const components: ComponentSignal[] = [
    {
      id: 'website',
      name: 'Website',
      description: 'Public site and status relay',
      status: 'operational',
      checkedAt,
    },
    {
      id: 'api',
      name: 'API & gateway',
      description: 'Public API, secure tunnel, and application host',
      status: apiStatus,
      checkedAt,
      ...(direct.latencyMs == null ? {} : { latencyMs: direct.latencyMs }),
    },
    {
      id: 'bot-database',
      name: 'Bot & database',
      description: 'Discord bot process and database heartbeat',
      status: sentry.botStatus,
      checkedAt,
    },
  ];
  const overallStatus = overallFrom(components);
  const activeIncidents: PublicIncident[] = [];
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
  const [direct, sentryResult] = await Promise.all([
    directProbe(),
    getSentrySnapshot().catch((): SentrySnapshot => ({
      apiStatus: 'unknown',
      botStatus: 'unknown',
      uptimePercentage: null,
      totalChecks: 0,
      segments: [],
      available: false,
    })),
  ]);
  return buildStatusPayload(direct, sentryResult);
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
