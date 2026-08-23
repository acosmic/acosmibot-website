/*
THESIS: Service health reads like a flight recorder, not a wall of generic metric cards.
OWN-WORLD: A deep-space field, one literal status beacon, thin signal rails, opaque graphite
instruments, and restrained cyan, green, amber, or coral states.
STORY: Visitors understand the current condition first, trace each service boundary second,
inspect availability evidence, then read active and resolved incidents.
FIRST VIEWPORT: A large live-state declaration anchors the left while a 30-day recorder and
freshness controls sit right; the connected service relay crosses directly beneath them.
FORM: Read-mode flight recorder, fifth grounded structure, staged as a vertical signal path;
concept seed 2110590f. State and recovery outrank ornament at every breakpoint.
*/
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Bot,
  Check,
  CircleAlert,
  Cloud,
  Database,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import {
  fetchPublicStatus,
  PublicStatusComponent,
  PublicStatusIncident,
  ServiceHealth,
} from '@/api/status';
import { PUBLIC_STATUS_INCIDENTS } from '@/status/publicIncidents';
import '@/styles/status.css';

const HEALTH_LABELS: Record<ServiceHealth, string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  outage: 'Service disruption',
  unknown: 'Awaiting signal',
};

const HEALTH_SUMMARIES: Record<ServiceHealth, string> = {
  operational: 'All systems are operating normally.',
  degraded: 'Some systems are reporting degraded service.',
  outage: 'Acosmibot is experiencing a service disruption.',
  unknown: 'Live status data is temporarily delayed.',
};

const STATUS_ICON = {
  website: Cloud,
  api: Activity,
  'bot-database': Bot,
} as const;

const FALLBACK_COMPONENTS: PublicStatusComponent[] = [
  {
    id: 'website',
    name: 'Website',
    description: 'Public site and status relay',
    status: 'operational',
    checkedAt: new Date(0).toISOString(),
  },
  {
    id: 'api',
    name: 'API & gateway',
    description: 'Public API, secure gateway, and application host',
    status: 'unknown',
    checkedAt: new Date(0).toISOString(),
  },
  {
    id: 'bot-database',
    name: 'Bot & database',
    description: 'Discord bot process and database heartbeat',
    status: 'unknown',
    checkedAt: new Date(0).toISOString(),
  },
];

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const formatTimestamp = (value?: string) => {
  if (!value) return 'Not available';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? dateFormatter.format(parsed) : 'Not available';
};

const formatRelativeTime = (value: string | undefined, now: number) => {
  if (!value) return 'awaiting first report';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'time unavailable';
  const seconds = Math.max(0, Math.round((now - timestamp) / 1_000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
};

const worstStatus = (left: ServiceHealth, right: ServiceHealth): ServiceHealth => {
  const rank: Record<ServiceHealth, number> = { unknown: 0, operational: 1, degraded: 2, outage: 3 };
  return rank[right] > rank[left] ? right : left;
};

const buildThirtyDayRecorder = (
  segments: Array<{ timestamp: string; status: ServiceHealth }>,
  now: number,
) => {
  const daily = new Map<string, ServiceHealth>();
  for (const segment of segments) {
    const timestamp = Date.parse(segment.timestamp);
    if (!Number.isFinite(timestamp)) continue;
    const key = new Date(timestamp).toISOString().slice(0, 10);
    daily.set(key, worstStatus(daily.get(key) ?? 'unknown', segment.status));
  }

  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(now);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - (29 - index));
    const key = date.toISOString().slice(0, 10);
    return { key, date: date.toISOString(), status: daily.get(key) ?? 'unknown' };
  });
};

const StatusMark: React.FC<{ status: ServiceHealth }> = ({ status }) => (
  <span className={`status-mark status-mark--${status}`} aria-hidden="true">
    <span />
  </span>
);

const ServiceRelay: React.FC<{ components: PublicStatusComponent[] }> = ({ components }) => (
  <section className="status-relay" aria-labelledby="service-relay-title">
    <div className="status-section-heading">
      <div>
        <p>Live service path</p>
        <h2 id="service-relay-title">Signal relay</h2>
      </div>
      <span>Independent checks · 60 second cadence</span>
    </div>
    <ol className="status-relay__path">
      {components.map((component, index) => {
        const Icon = STATUS_ICON[component.id];
        return (
          <li key={component.id} className={`status-relay__node status-relay__node--${component.status}`}>
            <div className="status-relay__ordinal" aria-hidden="true">0{index + 1}</div>
            <div className="status-relay__icon"><Icon aria-hidden="true" /></div>
            <div className="status-relay__copy">
              <div>
                <h3>{component.name}</h3>
                <span className={`status-chip status-chip--${component.status}`}>
                  <StatusMark status={component.status} />
                  {HEALTH_LABELS[component.status]}
                </span>
              </div>
              <p>{component.description}</p>
              {component.latencyMs != null && (
                <small>{Math.round(component.latencyMs)} ms live response</small>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  </section>
);

const IncidentRow: React.FC<{ incident: PublicStatusIncident }> = ({ incident }) => (
  <article className={`status-incident status-incident--${incident.status}`}>
    <div className="status-incident__signal" aria-hidden="true">
      {incident.status === 'resolved' ? <Check /> : <CircleAlert />}
    </div>
    <div className="status-incident__body">
      <div className="status-incident__heading">
        <h3>{incident.title}</h3>
        <span>{incident.status === 'resolved' ? 'Resolved' : 'Investigating'}</span>
      </div>
      <p>{incident.summary}</p>
      <dl>
        <div>
          <dt>Impact</dt>
          <dd>{incident.impact === 'major' ? 'Major disruption' : 'Partial disruption'}</dd>
        </div>
        <div>
          <dt>Started</dt>
          <dd><time dateTime={incident.startedAt}>{formatTimestamp(incident.startedAt)}</time></dd>
        </div>
        {incident.resolvedAt && (
          <div>
            <dt>Resolved</dt>
            <dd><time dateTime={incident.resolvedAt}>{formatTimestamp(incident.resolvedAt)}</time></dd>
          </div>
        )}
        {incident.duration && (
          <div>
            <dt>Duration</dt>
            <dd>{incident.duration}</dd>
          </div>
        )}
      </dl>
    </div>
  </article>
);

export const StatusPage: React.FC = () => {
  const [now, setNow] = useState(() => Date.now());
  const query = useQuery({
    queryKey: ['public-service-status'],
    queryFn: fetchPublicStatus,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const response = query.data;
  const overallStatus = response?.overallStatus ?? 'unknown';
  const checkedAt = response?.checkedAt;
  const components = response?.components ?? FALLBACK_COMPONENTS;
  const recorder = useMemo(
    () => buildThirtyDayRecorder(response?.uptime.segments ?? [], now),
    [response?.uptime.segments, now],
  );
  const monitoredDays = recorder.filter((segment) => segment.status !== 'unknown').length;
  const incidents = response?.incidents ?? PUBLIC_STATUS_INCIDENTS;
  const activeIncidents = incidents.filter((incident) => incident.status !== 'resolved');
  const resolvedIncidents = incidents.filter((incident) => incident.status === 'resolved');
  const incidentDataUnavailable = !response && query.isError;
  const uptimePercentage = response?.uptime.percentage;
  const headline = response?.headline ?? HEALTH_SUMMARIES[overallStatus];

  return (
    <div className={`status-page status-page--${overallStatus}`}>
      <PublicNav variant="observatory" />
      <main className="status-main">
        <section className="status-hero" aria-labelledby="status-title">
          <div className="status-hero__state" aria-live="polite">
            <div className={`status-beacon status-beacon--${overallStatus}`} aria-hidden="true">
              <div className="status-beacon__orbit" />
              <div className="status-beacon__core"><ShieldCheck /></div>
            </div>
            <div className="status-hero__copy">
              <p className="status-kicker">Acosmibot service health</p>
              <h1 id="status-title">{headline}</h1>
              <div className={`status-hero__label status-hero__label--${overallStatus}`}>
                <StatusMark status={overallStatus} />
                {HEALTH_LABELS[overallStatus]}
              </div>
            </div>
          </div>

          <aside className="status-recorder" aria-label="Thirty day API availability">
            <div className="status-recorder__header">
              <div>
                <span>30-day API availability</span>
                <strong>
                  {uptimePercentage == null ? 'Collecting history' : `${uptimePercentage.toFixed(3)}%`}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => void query.refetch()}
                disabled={query.isFetching}
              >
                <RefreshCw aria-hidden="true" className={query.isFetching ? 'is-spinning' : undefined} />
                <span>{query.isFetching ? 'Checking' : 'Refresh'}</span>
              </button>
            </div>
            <div
              className="status-recorder__track"
              role="img"
              aria-label={`${monitoredDays} days of availability history currently available`}
            >
              {recorder.map((segment) => (
                <span
                  key={segment.key}
                  className={`status-recorder__segment status-recorder__segment--${segment.status}`}
                  title={`${shortDateFormatter.format(Date.parse(segment.date))}: ${HEALTH_LABELS[segment.status]}`}
                />
              ))}
            </div>
            <div className="status-recorder__footer">
              <span>30 days ago</span>
              <span>{monitoredDays > 0 ? `${monitoredDays} days recorded` : 'History begins after Sentry is connected'}</span>
              <span>Today</span>
            </div>
            <div className="status-recorder__freshness">
              <span className={`status-mark status-mark--${query.isError ? 'unknown' : overallStatus}`} aria-hidden="true"><span /></span>
              <div>
                <strong>{query.isError ? 'Status relay unavailable' : `Updated ${formatRelativeTime(checkedAt, now)}`}</strong>
                <small>
                  {response?.dataState === 'live'
                    ? 'Sentry confirmation and an independent live probe'
                    : response?.dataState === 'partial'
                      ? 'Live probe active; Sentry history is not connected yet'
                      : 'This page is online, but monitoring data is delayed'}
                </small>
              </div>
            </div>
          </aside>
        </section>

        <ServiceRelay components={components} />

        <section className="status-incidents" aria-labelledby="active-incidents-title">
          <div className="status-section-heading">
            <div>
              <p>Operational record</p>
              <h2 id="active-incidents-title">Current incidents</h2>
            </div>
            <span>
              {incidentDataUnavailable
                ? 'Status data delayed'
                : activeIncidents.length === 0
                  ? 'No active incidents'
                  : `${activeIncidents.length} active`}
            </span>
          </div>

          {incidentDataUnavailable ? (
            <div className="status-clear status-clear--unknown">
              <div><CircleAlert aria-hidden="true" /></div>
              <div>
                <h3>Incident data unavailable</h3>
                <p>The status relay could not load. This page is still online; refresh to try the independent checks again.</p>
              </div>
            </div>
          ) : activeIncidents.length === 0 ? (
            <div className="status-clear">
              <div><Check aria-hidden="true" /></div>
              <div>
                <h3>No active incidents</h3>
                <p>Independent monitors are not reporting an active service disruption.</p>
              </div>
            </div>
          ) : (
            <div className="status-incident-list">
              {activeIncidents.map((incident) => <IncidentRow key={incident.id} incident={incident} />)}
            </div>
          )}
        </section>

        <section className="status-history" aria-labelledby="incident-history-title">
          <div className="status-section-heading">
            <div>
              <p>Flight recorder</p>
              <h2 id="incident-history-title">Incident history</h2>
            </div>
            <span>Times shown in your local timezone</span>
          </div>
          <div className="status-incident-list">
            {resolvedIncidents.length > 0 ? (
              resolvedIncidents.map((incident) => <IncidentRow key={incident.id} incident={incident} />)
            ) : (
              <div className="status-history__empty">
                <Database aria-hidden="true" />
                <p>No resolved incidents have been published yet.</p>
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
};

export default StatusPage;
