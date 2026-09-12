import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Bot, CircleAlert, Clock3, Cpu, Expand, FileJson2, Globe2, Pause, Play, RefreshCw, ScrollText, TerminalSquare, X } from 'lucide-react';
import { adminApi, type AdminAiTraceDetail, type AdminAiTraceSpan } from '@/api/admin';

type Category = 'command' | 'ai' | 'website';
type Outcome = 'running' | 'success' | 'error' | 'blocked' | 'cancelled';

interface LiveEvent {
  activity_id: string;
  revision: number;
  cursor?: string;
  source: 'bot' | 'api';
  category: Category;
  action: string;
  outcome: Outcome;
  occurred_at: string;
  completed_at?: string | null;
  user_name?: string | null;
  user_id?: string | null;
  guild_name?: string | null;
  guild_id?: string | null;
  parent_activity_id?: string | null;
  trace_id?: string | null;
  metadata?: Record<string, unknown>;
}

interface RuntimeLogEntry {
  timestamp: string;
  source: 'bot' | 'api';
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  logger: string;
  event_name?: string;
  message: string;
  trace_id?: string;
  error_category?: string;
  error_code?: string;
  exception_type?: string;
  stack?: Array<{ file: string; line: number | null; function: string }>;
  [key: string]: unknown;
}

interface RuntimeLogResponse {
  success: boolean;
  entries: RuntimeLogEntry[];
  invalid_record_count: number;
}

const FILTERS: Array<{ id: Category; label: string; icon: typeof Activity }> = [
  { id: 'command', label: 'Commands', icon: TerminalSquare },
  { id: 'ai', label: 'AI usage', icon: Bot },
  { id: 'website', label: 'Website actions', icon: Globe2 },
];

const apiBase = () => (window as any).AppConfig?.apiBaseUrl ?? 'https://api.acosmibot.com';

function upsert(events: LiveEvent[], incoming: LiveEvent[]) {
  const byId = new Map(events.map((event) => [event.activity_id, event]));
  for (const event of incoming) {
    const current = byId.get(event.activity_id);
    if (!current || event.revision >= current.revision) byId.set(event.activity_id, event);
  }
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))
    .slice(0, 500);
}

function elapsed(event: LiveEvent) {
  const end = event.completed_at ? Date.parse(event.completed_at) : Date.now();
  const ms = Math.max(0, end - Date.parse(event.occurred_at));
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}

function locationLabel(event: LiveEvent) {
  return event.guild_name || (event.category === 'website' ? 'Website' : 'Direct / global');
}

function humanize(value: string) {
  return value.replaceAll('_', ' ');
}

function formatDurationMs(value: number | null) {
  if (value == null) return 'In progress';
  return value < 1000 ? `${value}ms` : `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}s`;
}

function formatCost(value: string | null) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '$0';
  return amount < 0.01 ? `$${amount.toFixed(5)}` : `$${amount.toFixed(3)}`;
}

function logMatchesActivityWindow(entry: RuntimeLogEntry, event: LiveEvent) {
  const timestamp = Date.parse(entry.timestamp);
  const started = Date.parse(event.occurred_at);
  const completed = event.completed_at ? Date.parse(event.completed_at) : Date.now();
  if (![timestamp, started, completed].every(Number.isFinite)) return true;
  return timestamp >= started - 30_000 && timestamp <= completed + 30_000;
}

function traceSpanSummary(span: AdminAiTraceSpan) {
  const context = [span.span_type, span.provider !== 'internal' ? span.provider : null, span.model !== '-' ? span.model : null]
    .filter(Boolean)
    .join(' · ');
  return `${context} · ${formatDurationMs(span.duration_ms)}`;
}

export const LiveActivityTab: React.FC = () => {
  const [categories, setCategories] = useState<Set<Category>>(() => {
    const stored = localStorage.getItem('admin-live-activity-filters');
    const parsed = stored?.split(',').filter((value): value is Category => FILTERS.some((item) => item.id === value));
    return new Set(parsed?.length ? parsed : FILTERS.map((item) => item.id));
  });
  const [errorsOnly, setErrorsOnly] = useState(() => (
    localStorage.getItem('admin-live-activity-errors-only') === 'true'
  ));
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connection, setConnection] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [paused, setPaused] = useState(false);
  const [buffered, setBuffered] = useState<LiveEvent[]>([]);
  const [selected, setSelected] = useState<LiveEvent | null>(null);
  const [traceDetail, setTraceDetail] = useState<AdminAiTraceDetail | null>(null);
  const [runtimeLogs, setRuntimeLogs] = useState<RuntimeLogEntry[]>([]);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [diagnosticsRevision, setDiagnosticsRevision] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef('$');
  const pausedRef = useRef(false);
  const detailRef = useRef<HTMLElement>(null);
  const selectedRef = useRef<LiveEvent | null>(null);

  const categoryParam = useMemo(() => [...categories].sort().join(','), [categories]);
  const visibleEvents = useMemo(
    () => errorsOnly ? events.filter((event) => event.outcome === 'error') : events,
    [errorsOnly, events],
  );

  const closeDetail = useCallback(() => {
    selectedRef.current = null;
    setSelected(null);
    setTraceDetail(null);
    setRuntimeLogs([]);
    setTraceError(null);
    setLogsError(null);
  }, []);

  useEffect(() => {
    localStorage.setItem('admin-live-activity-errors-only', String(errorsOnly));
  }, [errorsOnly]);

  useEffect(() => {
    localStorage.setItem('admin-live-activity-filters', categoryParam);
    setBuffered([]);
    if (!categoryParam) {
      setEvents([]);
      setConnection('offline');
      return;
    }
    let cancelled = false;
    let source: EventSource | undefined;
    setConnection('connecting');
    setError(null);
    fetch(`${apiBase()}/api/admin/activity?limit=100&categories=${categoryParam}`, { credentials: 'include' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Activity history unavailable');
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        const initial = body.events as LiveEvent[];
        setEvents(initial);
        setNextCursor(body.next_cursor || null);
        cursorRef.current = initial[0]?.cursor || '$';
        source = new EventSource(
          `${apiBase()}/api/admin/activity/stream?categories=${categoryParam}&cursor=${encodeURIComponent(cursorRef.current)}`,
          { withCredentials: true },
        );
        source.onopen = () => setConnection('live');
        source.onmessage = (message) => {
          const event = JSON.parse(message.data) as LiveEvent;
          cursorRef.current = message.lastEventId || event.cursor || cursorRef.current;
          setBuffered((pending) => pausedRef.current ? upsert(pending, [event]) : pending);
          if (!pausedRef.current) setEvents((current) => upsert(current, [event]));
        };
        source.onerror = () => setConnection('connecting');
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason));
          setConnection('offline');
        }
      });
    return () => {
      cancelled = true;
      source?.close();
    };
  }, [categoryParam]);

  const selectedActivityId = selected?.activity_id;

  useEffect(() => {
    if (!selectedActivityId) return;
    const controller = new AbortController();
    setTraceDetail(null);
    setRuntimeLogs([]);
    setTraceError(null);
    setLogsError(null);
    setDiagnosticsLoading(true);

    const loadDiagnostics = async () => {
      const detailResponse = await fetch(`${apiBase()}/api/admin/activity/${selectedActivityId}`, {
        credentials: 'include', signal: controller.signal,
      });
      const detailBody = detailResponse.ok ? await detailResponse.json() : null;
      const event = (detailBody?.event || selectedRef.current) as LiveEvent;
      if (!event) return;
      if (detailBody?.event) {
        selectedRef.current = event;
        setSelected((current) => current?.activity_id === event.activity_id ? event : current);
      }

      const logParams = new URLSearchParams({
        source: event.source || (event.category === 'website' ? 'api' : 'bot'),
        level: 'DEBUG',
        limit: '200',
      });
      if (event.trace_id) logParams.set('search', event.trace_id);
      else {
        if (event.guild_id) logParams.set('guild_id', event.guild_id);
        if (event.user_id) logParams.set('user_id', event.user_id);
      }

      const tracePromise = event.trace_id
        ? adminApi.getAiTrace(event.trace_id)
        : Promise.resolve(null);
      const logsPromise = fetch(`${apiBase()}/api/admin/logs?${logParams.toString()}`, {
        credentials: 'include', signal: controller.signal,
      }).then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Runtime logs unavailable');
        return body as RuntimeLogResponse;
      });

      const [traceResult, logsResult] = await Promise.allSettled([tracePromise, logsPromise]);
      if (traceResult.status === 'fulfilled') setTraceDetail(traceResult.value);
      else setTraceError(traceResult.reason instanceof Error ? traceResult.reason.message : 'Trace detail unavailable');
      if (logsResult.status === 'fulfilled') {
        const entries = event.trace_id
          ? logsResult.value.entries
          : logsResult.value.entries.filter((entry) => logMatchesActivityWindow(entry, event));
        setRuntimeLogs(entries);
      } else {
        setLogsError(logsResult.reason instanceof Error ? logsResult.reason.message : 'Runtime logs unavailable');
      }
    };

    void loadDiagnostics()
      .catch((reason) => {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
          setLogsError(reason instanceof Error ? reason.message : 'Diagnostics unavailable');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDiagnosticsLoading(false);
      });
    return () => controller.abort();
  }, [selectedActivityId, diagnosticsRevision]);

  useEffect(() => {
    if (!selectedActivityId) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDetail();
      if (event.key !== 'Tab' || !detailRef.current) return;
      const focusable = [...detailRef.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('keydown', close);
      document.body.style.overflow = previousBodyOverflow;
      previousFocus?.focus();
    };
  }, [selectedActivityId, closeDetail]);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  const togglePause = () => {
    if (paused && buffered.length) {
      setEvents((current) => upsert(current, buffered));
      setBuffered([]);
    }
    setPaused((value) => {
      pausedRef.current = !value;
      return !value;
    });
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (shellRef.current?.requestFullscreen) await shellRef.current.requestFullscreen();
    else setFullscreen((value) => !value);
  };

  const loadOlder = async () => {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const response = await fetch(`${apiBase()}/api/admin/activity?limit=100&categories=${categoryParam}&before=${encodeURIComponent(nextCursor)}`, { credentials: 'include' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Older activity unavailable');
      setEvents((current) => upsert(current, body.events));
      setNextCursor(body.next_cursor || null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoadingOlder(false);
    }
  };

  return (
    <div ref={shellRef} className={`live-activity${fullscreen ? ' is-fullscreen' : ''}`}>
      <div className="live-activity__topline">
        <div className={`live-activity__connection is-${connection}`} role="status">
          <i /> <span>{connection === 'live' ? 'Live across Acosmibot' : connection === 'offline' ? 'Feed unavailable' : 'Connecting…'}</span>
        </div>
        <div className="live-activity__actions">
          <button type="button" onClick={togglePause} aria-pressed={paused}>
            {paused ? <Play /> : <Pause />} {paused ? `Resume${buffered.length ? ` · ${buffered.length} new` : ''}` : 'Pause'}
          </button>
          <button type="button" onClick={() => void toggleFullscreen()}>
            <Expand /> {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>

      <div className="live-activity__filters" role="group" aria-label="Activity filters">
        {FILTERS.map(({ id, label, icon: Icon }) => {
          const active = categories.has(id);
          return <button key={id} type="button" className={active ? 'is-active' : ''} aria-pressed={active} onClick={() => {
            setCategories((current) => {
              const next = new Set(current);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            });
          }}><span><i /> <Icon /></span>{label}</button>;
        })}
        <button
          type="button"
          className={`is-error-filter${errorsOnly ? ' is-active' : ''}`}
          aria-pressed={errorsOnly}
          onClick={() => setErrorsOnly((current) => !current)}
        >
          <span><i /> <CircleAlert /></span>
          Errors only
        </button>
      </div>

      <div className="live-activity__feed" aria-live="polite" aria-busy={connection === 'connecting'}>
        {error ? <div className="live-activity__empty is-error"><CircleAlert /><strong>Activity feed unavailable</strong><span>{error}</span></div>
          : <>
            {visibleEvents.length === 0
              ? <div className="live-activity__empty">
                {errorsOnly ? <CircleAlert /> : <Activity />}
                <strong>{errorsOnly ? 'No errors in this activity' : 'Listening for activity'}</strong>
                <span>{errorsOnly ? 'No failed events are present in the loaded history.' : 'New commands, AI routes, and website actions will arrive here.'}</span>
              </div>
              : visibleEvents.map((event) => (
                <button className={`live-event is-${event.outcome}`} type="button" key={event.activity_id} onClick={() => { selectedRef.current = event; setSelected(event); }}>
                  <span className="live-event__pulse" aria-hidden="true" />
                  <span className="live-event__identity"><strong>{locationLabel(event)}</strong><span>{event.user_name || 'Acosmibot system'}</span></span>
                  <span className="live-event__action"><strong>{event.action}</strong><span>{event.outcome === 'running' ? 'In progress' : event.outcome}</span></span>
                  <span className="live-event__time"><time dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time><span>{elapsed(event)}</span></span>
                </button>
              ))}
            {nextCursor && events.length < 500 && <button type="button" className="live-activity__older" onClick={() => void loadOlder()} disabled={loadingOlder}>{loadingOlder ? 'Loading history…' : 'Load older activity'}</button>}
          </>}
      </div>

      {selected && <div className="live-detail__backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeDetail()}>
        <aside ref={detailRef} className="live-detail" role="dialog" aria-modal="true" aria-labelledby="live-detail-title">
          <header>
            <div><span>Owner diagnostics</span><h3 id="live-detail-title">{selected.action}</h3></div>
            <div className="live-detail__header-actions">
              <button type="button" onClick={() => setDiagnosticsRevision((value) => value + 1)} disabled={diagnosticsLoading} aria-label="Refresh activity diagnostics"><RefreshCw /></button>
              <button autoFocus type="button" onClick={closeDetail} aria-label="Close activity diagnostics"><X /></button>
            </div>
          </header>
          <div className="live-detail__status"><i className={`is-${selected.outcome}`} /><strong>{selected.outcome}</strong><span>{new Date(selected.occurred_at).toLocaleString()}</span></div>
          <dl>
            <div><dt>Location</dt><dd>{locationLabel(selected)}</dd></div>
            <div><dt>User</dt><dd>{selected.user_name || 'Acosmibot system'}</dd></div>
            <div><dt>Duration</dt><dd>{elapsed(selected)}</dd></div>
            <div><dt>Category</dt><dd>{selected.category}</dd></div>
            {typeof selected.metadata?.error_code === 'string' && <div><dt>Error reason</dt><dd><code>{selected.metadata.error_code}</code></dd></div>}
            {selected.user_id && <div><dt>User ID</dt><dd><code>{selected.user_id}</code></dd></div>}
            {selected.guild_id && <div><dt>Server ID</dt><dd><code>{selected.guild_id}</code></dd></div>}
            {selected.parent_activity_id && <div><dt>Parent event</dt><dd><code>{selected.parent_activity_id}</code></dd></div>}
            {selected.trace_id && <div><dt>Trace ID</dt><dd><code>{selected.trace_id}</code></dd></div>}
          </dl>

          {diagnosticsLoading && <div className="live-detail__loading" role="status"><Activity /> Loading trace and runtime records…</div>}

          <section className="live-diagnostics">
            <div className="live-diagnostics__heading">
              <div><Cpu /><span>AI trace</span></div>
              {traceDetail && <strong>{traceDetail.spans.length} spans</strong>}
            </div>
            {!selected.trace_id ? (
              <div className="live-diagnostics__state"><Clock3 /><span>This activity did not create an AI trace.</span></div>
            ) : traceError ? (
              <div className="live-diagnostics__state is-error"><CircleAlert /><span>{traceError}. The trace may still be persisting; refresh diagnostics to retry.</span></div>
            ) : traceDetail ? (
              <>
                <dl className="live-trace-summary">
                  <div><dt>Outcome</dt><dd>{humanize(traceDetail.trace.outcome || traceDetail.trace.status)}</dd></div>
                  <div><dt>Provider calls</dt><dd>{traceDetail.trace.provider_call_count}</dd></div>
                  <div><dt>Tokens</dt><dd>{traceDetail.trace.provider_total_tokens.toLocaleString()}</dd></div>
                  <div><dt>Cost</dt><dd>{formatCost(traceDetail.trace.cost_usd)}</dd></div>
                  <div><dt>Build</dt><dd><code>{traceDetail.trace.build_sha || 'not recorded'}</code></dd></div>
                  <div><dt>Delivery</dt><dd>{humanize(traceDetail.trace.delivery_outcome || 'not recorded')}</dd></div>
                </dl>
                <div className="live-trace-content__heading">
                  <div>
                    <strong>Prompts & outputs</strong>
                    <span>Exact stored content · encrypted at rest · {traceDetail.content_retention_days || 14}-day retention</span>
                  </div>
                  <b>{(traceDetail.content || []).length} attachments</b>
                </div>
                {traceDetail.content_error ? (
                  <div className="live-diagnostics__state is-error"><CircleAlert /><span>{traceDetail.content_error}</span></div>
                ) : (traceDetail.content || []).length === 0 ? (
                  <div className="live-diagnostics__state"><Clock3 /><span>No prompt or output attachment was recorded. This can happen for events created before content capture was enabled or after its retention window expired.</span></div>
                ) : (
                  <ol className="live-trace-content">
                    {(traceDetail.content || []).map((item) => (
                      <li key={item.id}>
                        <details open={item.content_type === 'user_prompt' || item.content_type === 'provider_error'}>
                          <summary>
                            <span><strong>{humanize(item.content_type)}</strong><small>{item.span_id ? `span ${item.span_id.slice(0, 10)}` : 'trace root'}{item.truncated ? ' · truncated' : ''}</small></span>
                            <b>{item.plaintext_bytes.toLocaleString()} bytes</b>
                          </summary>
                          <pre>{JSON.stringify(item.payload, null, 2)}</pre>
                        </details>
                      </li>
                    ))}
                  </ol>
                )}
                <ol className="live-trace-spans">
                  {traceDetail.spans.map((span) => (
                    <li key={span.span_id} className={`is-${span.status}`}>
                      <details open={span.status !== 'success'}>
                        <summary>
                          <i />
                          <span><strong>{humanize(span.name)}</strong><small>{traceSpanSummary(span)}</small></span>
                          <b>{humanize(span.status)}</b>
                        </summary>
                        <pre>{JSON.stringify(span, null, 2)}</pre>
                      </details>
                    </li>
                  ))}
                </ol>
                <details className="live-diagnostics__raw">
                  <summary>Full trace payload</summary>
                  <pre>{JSON.stringify(traceDetail, null, 2)}</pre>
                </details>
              </>
            ) : null}
          </section>

          <section className="live-diagnostics">
            <div className="live-diagnostics__heading">
              <div><ScrollText /><span>Runtime logs</span></div>
              {!logsError && <strong>{runtimeLogs.length} records</strong>}
            </div>
            {logsError ? (
              <div className="live-diagnostics__state is-error"><CircleAlert /><span>{logsError}. Refresh diagnostics to retry.</span></div>
            ) : !diagnosticsLoading && runtimeLogs.length === 0 ? (
              <div className="live-diagnostics__state"><Clock3 /><span>No matching structured runtime records remain in the bounded journal window.</span></div>
            ) : runtimeLogs.length ? (
              <ol className="live-runtime-logs">
                {runtimeLogs.map((entry, index) => (
                  <li key={`${entry.timestamp}-${entry.event_name || entry.logger}-${index}`} className={`is-${entry.level.toLowerCase()}`}>
                    <details open={entry.level === 'ERROR' || entry.level === 'CRITICAL'}>
                      <summary>
                        <b>{entry.level}</b>
                        <span><strong>{entry.event_name || entry.logger}</strong><small>{entry.message || 'Structured runtime event'}</small></span>
                        <time dateTime={entry.timestamp}>{new Date(entry.timestamp).toLocaleTimeString()}</time>
                      </summary>
                      <pre>{JSON.stringify(entry, null, 2)}</pre>
                    </details>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>

          <section className="live-diagnostics">
            <div className="live-diagnostics__heading"><div><FileJson2 /><span>Activity payload</span></div></div>
            <pre>{JSON.stringify(selected, null, 2)}</pre>
          </section>
          <footer>Activity ID <code>{selected.activity_id}</code> · Live payloads expire after 24 hours; AI traces and runtime logs follow their own retention windows.</footer>
        </aside>
      </div>}
    </div>
  );
};
