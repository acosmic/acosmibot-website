import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AdminDetailDialog } from './AdminDetailDialog';
import { parseRuntimeLogTimestamp } from '@/utils/runtimeLogTimestamp';

interface PerformanceTotals {
  messages_processed: number;
  messages_per_min: number;
  xp_grants: number;
  xp_pct_of_messages: number;
  level_ups: number;
  daily_rewards: number;
  games_played: number;
  currency_updates: number;
  cache_hit_rate_pct: number;
  cache_hits: number;
  cache_misses: number;
  daily_skip_rate_pct: number;
  daily_checks_skipped: number;
  daily_checks_performed: number;
  xp_writes_saved: number;
  total_db_writes_saved: number;
}

interface SessionStats {
  available: boolean;
  active: number;
  dirty: number;
  currency_pending: number;
}

interface BotReport {
  generated_at: string;
  uptime_seconds: number;
  uptime_minutes: number;
  guild_count: number;
  latency_ms: number | null;
  totals: PerformanceTotals;
  sessions: SessionStats;
}

interface SafeStackFrame {
  file: string;
  line: number | null;
  function: string;
}

interface LogEntry {
  timestamp: string;
  source: 'bot' | 'api';
  level: 'ERROR' | 'WARNING' | 'CRITICAL' | 'INFO' | 'DEBUG';
  logger: string;
  event_name?: string;
  message: string;
  guild_id: string;
  user_id: string;
  channel_id: string;
  turn_id: string;
  message_id: string;
  reply_to_message_id: string;
  entrypoint: string;
  trace_id?: string;
  span_id?: string;
  call_id?: string;
  error_category?: string;
  error_code?: string;
  exception_type?: string;
  stack?: SafeStackFrame[];
  ip: string;
  method: string;
  path: string;
}

type LogSource = 'bot' | 'api';
type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

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

// Render both legacy file timestamps and schema-v1 journal ISO timestamps in
// US Central (auto-handles CST/CDT).
const CENTRAL_TZ = 'America/Chicago';
const centralFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: CENTRAL_TZ,
  month: 'numeric', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', second: '2-digit',
  hour12: true, timeZoneName: 'short',
});

function parseLogTs(ts: string): Date | null {
  return parseRuntimeLogTimestamp(ts);
}

function formatCentral(ts: string): string {
  const d = parseLogTs(ts);
  if (!d) return ts;
  return centralFmt.format(d).replace(',', '');
}

function relativeLogTime(ts: string): string {
  const d = parseLogTs(ts);
  if (!d) return '';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const LEVEL_BADGE: Record<string, { bg: string; color: string }> = {
  CRITICAL: { bg: '#7f1d1d', color: '#fca5a5' },
  ERROR:    { bg: '#450a0a', color: '#f87171' },
  WARNING:  { bg: '#451a03', color: '#fbbf24' },
  INFO:     { bg: '#1e3a5f', color: '#93c5fd' },
  DEBUG:    { bg: 'var(--bg-secondary)', color: 'var(--text-muted)' },
};

const BLANK = new Set(['', '-', '—']);

function contextItems(entry: LogEntry): { label: string; value: string }[] {
  const items: { label: string; value: string }[] = [];
  const push = (label: string, value: string) => {
    if (value && !BLANK.has(value)) items.push({ label, value });
  };
  push('guild', entry.guild_id);
  push('user', entry.user_id);
  push('channel', entry.channel_id);
  push('turn', entry.turn_id);
  push('message', entry.message_id);
  push('reply', entry.reply_to_message_id);
  push('entry', entry.entrypoint);
  push('error', [entry.error_category, entry.error_code].filter(value => value && !BLANK.has(value)).join(' / '));
  push('type', entry.exception_type ?? '');
  push('trace', entry.trace_id ?? '');
  push('span', entry.span_id ?? '');
  push('call', entry.call_id ?? '');
  push('ip', entry.ip);
  if (entry.path && !BLANK.has(entry.path)) {
    push('route', `${entry.method && !BLANK.has(entry.method) ? `${entry.method} ` : ''}${entry.path}`);
  }
  return items;
}

function ContextChips({ entry, wrap = true }: { entry: LogEntry; wrap?: boolean }) {
  const items = contextItems(entry);
  if (items.length === 0) return <span className="admin-log-context__empty">—</span>;
  return (
    <div className={`admin-log-context${wrap ? '' : ' is-nowrap'}`}>
      {items.map(({ label, value }) => (
        <span key={label} className="admin-log-context__chip">
          <span style={{ opacity: 0.6 }}>{label}</span>
          <span style={{ color: 'var(--text-primary)' }}>{value}</span>
        </span>
      ))}
    </div>
  );
}

function StatRow({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="admin-stat-row">
      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
      {detail && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{detail}</span>}
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

export const BotStatsTab: React.FC = () => {
  const [report, setReport] = useState<BotReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [invalidLogCount, setInvalidLogCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [logLimit, setLogLimit] = useState(50);
  const [logSource, setLogSource] = useState<LogSource>('bot');
  const [logLevel, setLogLevel] = useState<LogLevel>('WARNING');
  const [logSearch, setLogSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [detailLog, setDetailLog] = useState<LogEntry | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const apiBase = (window as any).AppConfig?.apiBaseUrl ?? 'https://api.acosmibot.com';
  const fetchAll = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        source: logSource,
        level: logLevel,
        limit: String(logLimit),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);

      const [statsRes, logsRes] = await Promise.all([
        fetch(`${apiBase}/api/admin/bot/stats`, { credentials: 'include' }),
        fetch(`${apiBase}/api/admin/logs?${params.toString()}`, { credentials: 'include' }),
      ]);
      const statsData = await statsRes.json();
      const logsData = await logsRes.json();

      if (statsData.success) setReport(statsData.report);
      else setReportError(statsData.error ?? 'Unknown error');

      if (logsData.success) {
        setLogs(logsData.entries ?? []);
        setInvalidLogCount(logsData.invalid_record_count ?? 0);
        setLogsError(null);
      } else {
        setLogs([]);
        setInvalidLogCount(0);
        setLogsError(logsData.error ?? 'Unknown error');
      }

      setLastFetch(new Date());
    } catch (e) {
      setReportError(String(e));
    } finally {
      setLoading(false);
    }
  }, [logSource, logLevel, logLimit, debouncedSearch, apiBase]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(logSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [logSearch]);

  useEffect(() => {
    setLoading(true);
    fetchAll();
    intervalRef.current = setInterval(fetchAll, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll]);

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
        <div className="admin-stats-grid">
          {/* ── Left column: activity ── */}
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              Activity
            </div>
            <StatRow label="Messages" value={(report.totals?.messages_processed ?? 0).toLocaleString()} detail={report.totals?.messages_per_min != null ? `${report.totals.messages_per_min}/min` : undefined} />
            <StatRow label="XP Grants" value={(report.totals?.xp_grants ?? 0).toLocaleString()} detail={report.totals?.xp_pct_of_messages != null ? `${report.totals.xp_pct_of_messages}% of messages` : undefined} />
            <StatRow label="Level-ups" value={(report.totals?.level_ups ?? 0).toLocaleString()} />
            <StatRow label="Daily Rewards" value={(report.totals?.daily_rewards ?? 0).toLocaleString()} />
            <StatRow label="Games Played" value={(report.totals?.games_played ?? 0).toLocaleString()} />
            <StatRow label="Currency Updates" value={(report.totals?.currency_updates ?? 0).toLocaleString()} />
          </div>

          {/* ── Right column: efficiency ── */}
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              Efficiency
            </div>
            <StatRow label="Config Cache" value={`${report.totals?.cache_hit_rate_pct ?? 0}%`} detail={`${(report.totals?.cache_hits ?? 0).toLocaleString()} DB reads saved`} />
            <StatRow label="Daily Cache" value={`${report.totals?.daily_skip_rate_pct ?? 0}%`} detail={`${(report.totals?.daily_checks_skipped ?? 0).toLocaleString()} checks skipped`} />
            <StatRow label="DB Writes Saved" value={(report.totals?.total_db_writes_saved ?? 0).toLocaleString()} detail="XP + games + currency" />
            <StatRow
              label="Sessions"
              value={report.sessions?.available ? `${report.sessions.active} active` : (report.sessions ? 'Unavailable' : '—')}
              detail={(report.sessions?.dirty ?? 0) > 0 ? `${report.sessions!.dirty} pending flush` : undefined}
            />
            <StatRow label="Currency Queued" value={report.sessions?.currency_pending ?? '—'} />
          </div>
        </div>
      )}

      {/* ── Logs ── */}
      <div className="admin-log-tools">
        <h5>Runtime Logs</h5>
        <select
          aria-label="Runtime log source"
          value={logSource}
          onChange={e => setLogSource(e.target.value as LogSource)}
        >
          <option value="bot">Bot</option>
          <option value="api">API</option>
        </select>
        <select
          aria-label="Minimum runtime log level"
          value={logLevel}
          onChange={e => setLogLevel(e.target.value as LogLevel)}
        >
          {(['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'] as LogLevel[]).map(level => (
            <option key={level} value={level}>{level}+</option>
          ))}
        </select>
        <select
          aria-label="Runtime log entry limit"
          value={logLimit}
          onChange={e => setLogLimit(Number(e.target.value))}
        >
          {[50, 100, 200, 500].map(n => <option key={n} value={n}>Last {n}</option>)}
        </select>
        <input
          aria-label="Search runtime logs"
          value={logSearch}
          onChange={e => setLogSearch(e.target.value)}
          placeholder="Search message, event, trace, or Discord ID..."
        />
        <span className="admin-log-tools__count">
          {logs.length} entries{invalidLogCount > 0 ? ` · ${invalidLogCount} compatibility` : ''}
        </span>
      </div>
      <p className="admin-log-scope-note">
        Local journal · raw Discord IDs appear only on error and critical records; Sentry remains pseudonymized.
      </p>

      {logsError ? (
        <p style={{ color: '#f87171', fontSize: '0.85rem' }}>{logsError}</p>
      ) : logs.length === 0 ? (
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>No matching log entries found.</p>
      ) : (
        <>
        <div className="admin-table-desktop">
          <table className="admin-data-table admin-log-table">
            <colgroup>
              <col className="admin-log-table__time-col" />
              <col className="admin-log-table__source-col" />
              <col className="admin-log-table__level-col" />
              <col className="admin-log-table__logger-col" />
              <col className="admin-log-table__message-col" />
              <col className="admin-log-table__context-col" />
            </colgroup>
            <thead>
              <tr>
                <th>Timestamp <span>(CT)</span></th>
                <th>Source</th>
                <th>Level</th>
                <th>Logger</th>
                <th>Message</th>
                <th>Context</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((entry, i) => {
                const style = LEVEL_BADGE[entry.level] ?? LEVEL_BADGE.DEBUG;
                const hasStack = (entry.stack?.length ?? 0) > 0;
                const displayMsg = entry.message.split('\n')[0];
                return (
                  <tr
                    key={i}
                    onClick={() => setDetailLog(entry)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setDetailLog(entry);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`Open ${entry.level.toLowerCase()} log from ${formatCentral(entry.timestamp)}`}
                    title="Click to expand"
                  >
                    <td className="admin-log-table__time">
                      {formatCentral(entry.timestamp)}
                    </td>
                    <td className="admin-log-table__source">
                      {entry.source ?? logSource}
                    </td>
                    <td>
                      <span
                        className="admin-log-table__level"
                        style={{ background: style.bg, color: style.color }}
                      >
                        {entry.level}
                      </span>
                    </td>
                    <td className="admin-log-table__logger">
                      <span>{entry.logger}</span>
                      {entry.event_name && entry.event_name !== 'runtime_log' && (
                        <small>{entry.event_name}</small>
                      )}
                    </td>
                    <td>
                      <div className="admin-log-table__message">
                        <span>{displayMsg}</span>
                        <small>
                          {hasStack ? 'open safe stack ›' : '›'}
                        </small>
                      </div>
                    </td>
                    <td>
                      <ContextChips entry={entry} wrap={false} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="admin-card-list">
          {logs.map((entry, i) => {
            const style = LEVEL_BADGE[entry.level] ?? LEVEL_BADGE.DEBUG;
            const firstLine = entry.message.split('\n')[0];
            const hasStack = (entry.stack?.length ?? 0) > 0;
            const ctx = contextItems(entry);
            return (
              <div
                className="admin-mobile-row"
                key={i}
                onClick={() => setDetailLog(entry)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setDetailLog(entry);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Open ${entry.level.toLowerCase()} log from ${formatCentral(entry.timestamp)}`}
                style={{ cursor: 'pointer' }}
              >
                <div className="admin-mobile-row-header">
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
                  <span className="text-muted">{formatCentral(entry.timestamp)}</span>
                </div>
                <div className="admin-mobile-field primary">
                  <span className="admin-mobile-label">Message</span>
                  <span className="admin-mobile-value">{firstLine}</span>
                </div>
                <div className="admin-mobile-field">
                  <span className="admin-mobile-label">Logger</span>
                  <span className="admin-mobile-value">{entry.logger || '—'}</span>
                </div>
                {entry.event_name && entry.event_name !== 'runtime_log' && (
                  <div className="admin-mobile-field">
                    <span className="admin-mobile-label">Event</span>
                    <span className="admin-mobile-value">{entry.event_name}</span>
                  </div>
                )}
                {ctx.length > 0 && (
                  <div className="admin-mobile-field">
                    <span className="admin-mobile-label">Context</span>
                    <span className="admin-mobile-value"><ContextChips entry={entry} /></span>
                  </div>
                )}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 8 }}>
                  Tap to expand{hasStack ? ' · safe stack' : ''} ›
                </span>
              </div>
            );
          })}
        </div>
        </>
      )}
      {detailLog && (
        <AdminDetailDialog
          title={`${detailLog.level} Log`}
          label="runtime log detail"
          className="admin-log-detail"
          onClose={() => setDetailLog(null)}
        >
          <div className="admin-log-meta">
            <span>{formatCentral(detailLog.timestamp)}</span>
            <span>{relativeLogTime(detailLog.timestamp)}</span>
            <span style={{ textTransform: 'uppercase' }}>{detailLog.source ?? logSource}</span>
            <span>{detailLog.logger}</span>
          </div>
          {contextItems(detailLog).length > 0 && (
            <div style={{ margin: '4px 0 12px' }}>
              <ContextChips entry={detailLog} />
            </div>
          )}
          <div className="admin-log-detail__body">
            <section className="admin-log-detail__section">
              <h5>Sanitized message</h5>
              <pre>{detailLog.message}</pre>
            </section>
            {(detailLog.stack?.length ?? 0) > 0 && (
              <section className="admin-log-detail__section">
                <h5>Safe stack frames</h5>
                <pre>{detailLog.stack!.map(frame => (
                  `${frame.file}${frame.line == null ? '' : `:${frame.line}`} in ${frame.function}`
                )).join('\n')}</pre>
              </section>
            )}
          </div>
        </AdminDetailDialog>
      )}
    </div>
  );
};
