import type { PublicIncidentRecord } from '@/status/publicIncidents';

export type ServiceHealth = 'operational' | 'degraded' | 'outage' | 'unknown';

export interface PublicStatusComponent {
  id: 'website' | 'api' | 'bot-database';
  name: string;
  description: string;
  status: ServiceHealth;
  checkedAt: string;
  latencyMs?: number;
}

export type PublicStatusIncident = PublicIncidentRecord;

export interface PublicStatusResponse {
  schemaVersion: 1;
  overallStatus: ServiceHealth;
  headline: string;
  checkedAt: string;
  dataState: 'live' | 'partial' | 'delayed';
  source: 'sentry-and-direct' | 'direct' | 'fallback';
  components: PublicStatusComponent[];
  uptime: {
    periodDays: 30;
    percentage: number | null;
    totalChecks: number;
    monitoringStartedAt?: string;
    segments: Array<{ timestamp: string; status: ServiceHealth }>;
  };
  incidents: PublicStatusIncident[];
}

const VALID_HEALTH = new Set<ServiceHealth>(['operational', 'degraded', 'outage', 'unknown']);

const isPublicStatusResponse = (value: unknown): value is PublicStatusResponse => {
  if (!value || typeof value !== 'object') return false;
  const status = value as Partial<PublicStatusResponse>;
  return (
    status.schemaVersion === 1
    && typeof status.headline === 'string'
    && typeof status.checkedAt === 'string'
    && typeof status.overallStatus === 'string'
    && VALID_HEALTH.has(status.overallStatus as ServiceHealth)
    && Array.isArray(status.components)
    && Array.isArray(status.incidents)
    && !!status.uptime
    && Array.isArray(status.uptime.segments)
  );
};

export const fetchPublicStatus = async (): Promise<PublicStatusResponse> => {
  const response = await fetch('/api/status', {
    headers: { Accept: 'application/json' },
    credentials: 'omit',
  });
  if (!response.ok) throw new Error('Status telemetry is unavailable');
  const payload: unknown = await response.json();
  if (!isPublicStatusResponse(payload)) throw new Error('Status telemetry returned an invalid response');
  return payload;
};
