export interface PublicIncidentRecord {
  id: string;
  title: string;
  impact: 'partial' | 'major';
  status: 'investigating' | 'monitoring' | 'resolved';
  startedAt: string;
  resolvedAt?: string;
  duration?: string;
  summary: string;
}

/** Curated public incident history. Never include private diagnostics here. */
export const PUBLIC_STATUS_INCIDENTS: PublicIncidentRecord[] = [
  {
    id: '2026-08-22-database-pool',
    title: 'Database connection pool exhaustion',
    impact: 'partial',
    status: 'resolved',
    startedAt: '2026-08-22T07:19:00Z',
    resolvedAt: '2026-08-22T11:38:51Z',
    duration: '4h 19m',
    summary: 'Database-backed bot actions were impaired. Service recovered, and independent application-health monitoring was added afterward.',
  },
];
