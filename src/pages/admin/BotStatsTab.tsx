import React, { useCallback, useEffect, useRef, useState } from 'react';

interface PerformanceWindow {
  messages_processed: number;
  xp_grants: number;
  level_ups: number;
  cache_hits: number;
  cache_misses: number;
  cache_hit_rate_pct: number;
  daily_rewards: number;
  daily_checks_performed: number;
  daily_checks_skipped: number;
}

interface PerformanceTotals {
  messages_processed: number;
  xp_grants: number;
  level_ups: number;
  cache_hits: number;
  cache_misses: number;
  cache_hit_rate_pct: number;
  daily_rewards: number;
}

interface BotReport {
  generated_at: string;
  uptime_seconds: number;
  guild_count: number;
  latency_ms: number | null;
  window_minutes: number;
  window: PerformanceWindow;
  totals: PerformanceTotals;
}

interface LogEntry {
  timestamp: string;
  level: 'ERROR' | 'WARNING' | 'CRITICAL' | 'INFO' | 'DEBUG';
  logger: string;
  message: string;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

function relativeTime(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const LEVEL_BADGE: Record<string, { bg: string; color: string }> = {
  CRITICAL: { bg: '#7f1d1d', color: '#fca5a5' },
  ERROR:    { bg: '#450a0a', color: '#f87171' },
  WARNING:  { bg: '#451a03', color: '#fbbf24' },
  INFO:     { bg: '#1e3a5f', color: '#93c5fd' },
  DEBUG:    { bg: 'var(--bg-secondary)', color: 'var(--text-muted)' },
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-light)',
      borderRadius: 8,
      padding: '16px 20px',
      flex: '1 1 160px',
      minWidth: 140,
    }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Badge({ children, color = '#4ade80', bg = 'rgba(74,222,128,0.12)' }: { children: React.ReactNode; color?: string; bg?: string }) {
  return (
    <span style={{
      background: bg,
      color,
      border: `1px solid ${color}40`,
      borderRadius: 6,
      padding: '3px 10px',
      fontSize: '0.8rem',
      fontWeight: 600,
    }}>
      {children}
    </span>
  );
}

export const BotStatsTab: React.FC<{ token: string | null }> = ({ token }) => {
  const [report, setReport] = useState<BotReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [logLimit, setLogLimit] = useState(50);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const apiBase = (window as any).AppConfig?.apiBaseUrl ?? 'https://api.acosmibot.com';
  const headers = { Authorization: `Bearer ${token}` };

  const fetchAll = useCallback(async () => {
    if (!token) return;
    try {
      const [statsRes, logsRes] = await Promise.all([
        fetch(`${apiBase}/api/admin/bot/stats`, { headers }),
        fetch(`${apiBase}/api/admin/bot/logs?limit=${logLimit}&level=WARNING`, { headers }),
      ]);
      const statsData = await statsRes.json();
      const logsData = await logsRes.json();

      if (statsData.success) setReport(statsData.report);
      else setReportError(statsData.error ?? 'Unknown error');

      if (logsData.success) setLogs(logsData.entries ?? []);
      else setLogsError(logsData.error ?? 'Unknown error');

      setLastFetch(new Date());
    } catch (e) {
      setReportError(String(e));
    } finally {
      setLoading(false);
    }
  }, [token, logLimit, apiBase]);

  useEffect(() => {
    setLoading(true);
    fetchAll();
    intervalRef.current = setInterval(fetchAll, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll]);

  const toggleRow = (i: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  if (loading) return <div className="text-muted p-4">Loading bot stats...</div>;

  return (
    <div>
      {/* ── Header bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {report ? (
          <>
            <Badge color="#4ade80">
              {formatUptime(report.uptime_seconds)} uptime
            </Badge>
            <Badge color="#93c5fd" bg="rgba(147,197,253,0.12)">
              {report.guild_count} guilds
            </Badge>
            {report.latency_ms !== null && (
              <Badge
                color={report.latency_ms < 100 ? '#4ade80' : report.latency_ms < 250 ? '#fbbf24' : '#f87171'}
                bg="rgba(0,0,0,0.15)"
              >
                {report.latency_ms} ms latency
              </Badge>
            )}
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Last report: {relativeTime(report.generated_at)}
            </span>
          </>
        ) : (
          reportError && <span style={{ color: '#f87171', fontSize: '0.85rem' }}>{reportError}</span>
        )}
        <button
          onClick={() => { setLoading(true); fetchAll(); }}
          style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--border-light)', borderRadius: 6, padding: '4px 14px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
        >
          Refresh
        </button>
        {lastFetch && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            fetched {relativeTime(lastFetch.toISOString())}
          </span>
        )}
      </div>

      {report && (
        <>
          {/* ── 5-min window ── */}
          <h5 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Last 5 minutes
          </h5>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
            <StatCard label="Messages" value={report.window.messages_processed} />
            <StatCard label="XP Grants" value={report.window.xp_grants} />
            <StatCard label="Level-ups" value={report.window.level_ups} />
            <StatCard label="Cache Hit Rate" value={`${report.window.cache_hit_rate_pct}%`} sub={`${report.window.cache_hits} hits / ${report.window.cache_misses} misses`} />
            <StatCard label="Daily Rewards" value={report.window.daily_rewards} />
            <StatCard label="Daily Checks" value={report.window.daily_checks_performed} sub={`${report.window.daily_checks_skipped} skipped`} />
          </div>

          {/* ── All-time totals ── */}
          <h5 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Since last restart
          </h5>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 36 }}>
            <StatCard label="Messages" value={report.totals.messages_processed.toLocaleString()} />
            <StatCard label="XP Grants" value={report.totals.xp_grants.toLocaleString()} />
            <StatCard label="Level-ups" value={report.totals.level_ups.toLocaleString()} />
            <StatCard label="Cache Hit Rate" value={`${report.totals.cache_hit_rate_pct}%`} sub={`${report.totals.cache_hits.toLocaleString()} hits`} />
            <StatCard label="Daily Rewards" value={report.totals.daily_rewards.toLocaleString()} />
          </div>
        </>
      )}

      {/* ── Logs ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h5 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
          Error / Warning Log
        </h5>
        <select
          value={logLimit}
          onChange={e => setLogLimit(Number(e.target.value))}
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', borderRadius: 4, padding: '2px 6px', fontSize: '0.78rem' }}
        >
          {[50, 100, 200, 500].map(n => <option key={n} value={n}>Last {n}</option>)}
        </select>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{logs.length} entries</span>
      </div>

      {logsError ? (
        <p style={{ color: '#f87171', fontSize: '0.85rem' }}>{logsError}</p>
      ) : logs.length === 0 ? (
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>No warnings or errors found.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-dark table-hover" style={{ fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th style={{ borderColor: 'var(--border-light)', whiteSpace: 'nowrap' }}>Timestamp</th>
                <th style={{ borderColor: 'var(--border-light)', width: 90 }}>Level</th>
                <th style={{ borderColor: 'var(--border-light)' }}>Logger</th>
                <th style={{ borderColor: 'var(--border-light)' }}>Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((entry, i) => {
                const style = LEVEL_BADGE[entry.level] ?? LEVEL_BADGE.DEBUG;
                const isMultiline = entry.message.includes('\n');
                const isExpanded = expandedRows.has(i);
                const displayMsg = isExpanded || !isMultiline
                  ? entry.message
                  : entry.message.split('\n')[0];
                return (
                  <tr key={i}>
                    <td style={{ borderColor: 'var(--border-light)', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {entry.timestamp}
                    </td>
                    <td style={{ borderColor: 'var(--border-light)' }}>
                      <span style={{
                        background: style.bg,
                        color: style.color,
                        borderRadius: 4,
                        padding: '1px 6px',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                      }}>
                        {entry.level}
                      </span>
                    </td>
                    <td style={{ borderColor: 'var(--border-light)', color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.logger}
                    </td>
                    <td style={{ borderColor: 'var(--border-light)', maxWidth: 600 }}>
                      <pre style={{
                        margin: 0,
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                        whiteSpace: isExpanded ? 'pre-wrap' : 'nowrap',
                        overflow: isExpanded ? 'visible' : 'hidden',
                        textOverflow: 'ellipsis',
                        color: 'var(--text-primary)',
                      }}>
                        {displayMsg}
                      </pre>
                      {isMultiline && (
                        <button
                          onClick={() => toggleRow(i)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.72rem', padding: '2px 0' }}
                        >
                          {isExpanded ? 'collapse' : 'show traceback'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
