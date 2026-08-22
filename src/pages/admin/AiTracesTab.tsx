import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ChevronRight,
  CircleAlert,
  Clock3,
  Cpu,
  RefreshCw,
  Route,
  Send,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  WalletCards,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  adminApi,
  type AdminAiTraceSpan,
  type AdminAiTraceStatus,
  type AdminAiTraceSummary,
} from '@/api/admin';

const SPAN_ICONS: Record<string, LucideIcon> = {
  root: Activity,
  routing: Route,
  provider: Cpu,
  tool: Wrench,
  safety: ShieldCheck,
  delivery: Send,
  credit: WalletCards,
};

const WINDOWS = [1, 7, 30] as const;
const STATUS_FILTERS: { value: '' | AdminAiTraceStatus; label: string }[] = [
  { value: '', label: 'All outcomes' },
  { value: 'failed', label: 'Failed' },
  { value: 'success', label: 'Successful' },
  { value: 'in_progress', label: 'In progress' },
];

function parseUtc(value: string | null): number {
  if (!value) return 0;
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`;
  return new Date(normalized).getTime();
}

function formatDuration(value: number | null): string {
  if (value == null) return 'running';
  if (value < 1000) return `${value} ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)} s`;
  return `${(value / 60_000).toFixed(1)} min`;
}

function formatCost(value: string | null): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return '$0';
  return amount < 0.01 ? `$${amount.toFixed(5)}` : `$${amount.toFixed(3)}`;
}

function shortId(value: string | null): string {
  return value ? value.slice(0, 8) : 'unknown';
}

function statusLabel(status: string): string {
  return status.replaceAll('_', ' ');
}

function TraceRow({
  trace,
  selected,
  onSelect,
}: {
  trace: AdminAiTraceSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`ai-trace-row${selected ? ' is-selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className={`ai-trace-status is-${trace.status}`} aria-label={statusLabel(trace.status)} />
      <span className="ai-trace-row__main">
        <strong>{trace.entrypoint || 'AI interaction'}</strong>
        <span>{shortId(trace.trace_id)} · {trace.context_type || 'system'}</span>
      </span>
      <span className="ai-trace-row__metrics">
        <strong>{formatDuration(trace.duration_ms)}</strong>
        <span>{trace.span_count} spans · {formatCost(trace.cost_usd)}</span>
      </span>
      <ChevronRight aria-hidden="true" />
    </button>
  );
}

function SpanRow({
  span,
  traceStart,
  traceDuration,
}: {
  span: AdminAiTraceSpan;
  traceStart: number;
  traceDuration: number;
}) {
  const Icon = SPAN_ICONS[span.span_type] ?? Activity;
  const offset = Math.max(0, parseUtc(span.started_at) - traceStart);
  const left = Math.min(98, (offset / traceDuration) * 100);
  const width = Math.max(1.5, Math.min(100 - left, ((span.duration_ms ?? 0) / traceDuration) * 100));
  const metadata = Object.entries(span.metadata || {}).filter(([key]) => key !== 'trace_schema_version');

  return (
    <li className={`ai-span is-${span.status}`}>
      <div className="ai-span__identity">
        <span className="ai-span__icon"><Icon aria-hidden="true" /></span>
        <div>
          <strong>{span.name.replaceAll('_', ' ')}</strong>
          <span>{span.span_type}{span.provider !== 'internal' ? ` · ${span.provider}` : ''}</span>
        </div>
        <span className="ai-span__duration">{formatDuration(span.duration_ms)}</span>
      </div>
      <div className="ai-span__track" aria-hidden="true">
        <span style={{ marginLeft: `${left}%`, width: `${width}%` }} />
      </div>
      <div className="ai-span__details">
        {span.model !== '-' && <span>model <strong>{span.model}</strong></span>}
        {span.provider_total_tokens != null && <span>tokens <strong>{span.provider_total_tokens.toLocaleString()}</strong></span>}
        {span.cost_usd != null && <span>cost <strong>{formatCost(span.cost_usd)}</strong></span>}
        {span.error_code && <span className="is-error">error <strong>{span.error_code}</strong></span>}
        {metadata.map(([key, value]) => (
          <span key={key}>{key.replaceAll('_', ' ')} <strong>{Array.isArray(value) ? value.join(', ') : String(value)}</strong></span>
        ))}
      </div>
    </li>
  );
}

export const AiTracesTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(7);
  const [status, setStatus] = useState<'' | AdminAiTraceStatus>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedbackReason, setFeedbackReason] = useState('quality');

  const tracesQuery = useQuery({
    queryKey: ['admin-ai-traces', days, status],
    queryFn: () => adminApi.getAiTraces(days, status || undefined),
    refetchInterval: 30_000,
  });
  const traces = useMemo(
    () => tracesQuery.data?.traces ?? [],
    [tracesQuery.data?.traces],
  );

  useEffect(() => {
    if (!selectedId || !traces.some(trace => trace.trace_id === selectedId)) {
      setSelectedId(traces[0]?.trace_id ?? null);
    }
  }, [selectedId, traces]);

  const detailQuery = useQuery({
    queryKey: ['admin-ai-trace', selectedId],
    queryFn: () => adminApi.getAiTrace(selectedId as string),
    enabled: Boolean(selectedId),
    refetchInterval: selectedId ? 30_000 : false,
  });
  const feedbackMutation = useMutation({
    mutationFn: ({ rating, reason }: { rating: -1 | 1; reason: string }) =>
      adminApi.rateAiTrace(selectedId as string, rating, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-ai-trace', selectedId] }),
  });

  const trace = detailQuery.data?.trace;
  const traceDuration = Math.max(1, trace?.duration_ms ?? 1);
  const traceStart = parseUtc(trace?.started_at ?? null);
  const spans = useMemo(
    () => [...(detailQuery.data?.spans ?? [])].sort((a, b) => parseUtc(a.started_at) - parseUtc(b.started_at)),
    [detailQuery.data?.spans],
  );

  return (
    <div className="ai-traces">
      <header className="ai-traces__controls">
        <div>
          <strong>Content-free trace ledger</strong>
          <span>Routing, provider, tools, safety, delivery, and settlement — never prompts or outputs.</span>
        </div>
        <div className="ai-traces__filters">
          <div role="group" aria-label="Trace time window">
            {WINDOWS.map(window => (
              <button key={window} type="button" aria-pressed={days === window} onClick={() => setDays(window)}>
                {window}d
              </button>
            ))}
          </div>
          <label>
            <span className="sr-only">Trace status</span>
            <select value={status} onChange={event => setStatus(event.target.value as '' | AdminAiTraceStatus)}>
              {STATUS_FILTERS.map(filter => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
            </select>
          </label>
          <button
            type="button"
            className="ai-traces__refresh"
            onClick={() => { void tracesQuery.refetch(); void detailQuery.refetch(); }}
            disabled={tracesQuery.isFetching || detailQuery.isFetching}
          >
            <RefreshCw aria-hidden="true" /> Refresh
          </button>
        </div>
      </header>

      <div className="ai-traces__console">
        <section className="ai-trace-index" aria-label="Recent AI traces">
          <header><span>Recent traces</span><strong>{traces.length}</strong></header>
          {tracesQuery.isLoading ? (
            <div className="ai-trace-state" role="status"><Activity aria-hidden="true" /><span>Loading trace ledger…</span></div>
          ) : tracesQuery.isError ? (
            <div className="ai-trace-state is-error" role="alert"><CircleAlert aria-hidden="true" /><span>Trace ledger unavailable. Refresh to retry.</span></div>
          ) : traces.length === 0 ? (
            <div className="ai-trace-state"><Clock3 aria-hidden="true" /><span>No traces in this window yet.</span></div>
          ) : traces.map(item => (
            <TraceRow key={item.trace_id} trace={item} selected={item.trace_id === selectedId} onSelect={() => setSelectedId(item.trace_id)} />
          ))}
        </section>

        <section className="ai-trace-detail" aria-live="polite">
          {detailQuery.isLoading ? (
            <div className="ai-trace-state" role="status"><Activity aria-hidden="true" /><span>Resolving trace spans…</span></div>
          ) : detailQuery.isError ? (
            <div className="ai-trace-state is-error" role="alert"><CircleAlert aria-hidden="true" /><span>Trace detail unavailable. Select the trace again or refresh.</span></div>
          ) : !trace ? (
            <div className="ai-trace-state"><Route aria-hidden="true" /><span>Select a trace to inspect its path.</span></div>
          ) : (
            <>
              <header className="ai-trace-detail__header">
                <div>
                  <span>Trace {shortId(trace.trace_id)}</span>
                  <h3>{trace.entrypoint || 'AI interaction'}</h3>
                  <p>{trace.outcome ? statusLabel(trace.outcome) : statusLabel(trace.status)} · {trace.context_type || 'system'} context</p>
                </div>
                <span className={`ai-trace-outcome is-${trace.status}`}>{statusLabel(trace.status)}</span>
              </header>
              <dl className="ai-trace-summary">
                <div><dt>End to end</dt><dd>{formatDuration(trace.duration_ms)}</dd></div>
                <div><dt>Provider calls</dt><dd>{trace.provider_call_count}</dd></div>
                <div><dt>Total tokens</dt><dd>{trace.provider_total_tokens.toLocaleString()}</dd></div>
                <div><dt>Estimated cost</dt><dd>{formatCost(trace.cost_usd)}</dd></div>
              </dl>
              <div className="ai-trace-scale"><span>Start</span><i /><span>{formatDuration(trace.duration_ms)}</span></div>
              {spans.length === 0 ? (
                <div className="ai-trace-state"><Clock3 aria-hidden="true" /><span>No completed spans have arrived yet.</span></div>
              ) : (
                <ol className="ai-span-list">
                  {spans.map(span => <SpanRow key={span.span_id} span={span} traceStart={traceStart} traceDuration={traceDuration} />)}
                </ol>
              )}
              <footer className="ai-trace-detail__footer">
                <span>build <strong>{shortId(trace.build_sha)}</strong></span>
                <span>delivery <strong>{trace.delivery_outcome || 'not recorded'}</strong></span>
                <span>failed calls <strong>{trace.failed_call_count}</strong></span>
              </footer>
              <div className="ai-trace-feedback">
                <div>
                  <strong>Owner evaluation</strong>
                  <span>Keep this as bounded feedback. Promotion to a reusable test case stays manual and sanitized.</span>
                </div>
                <label>
                  <span className="sr-only">Feedback reason</span>
                  <select value={feedbackReason} onChange={event => setFeedbackReason(event.target.value)}>
                    <option value="quality">Response quality</option>
                    <option value="routing">Routing</option>
                    <option value="tool_choice">Tool choice</option>
                    <option value="safety">Safety</option>
                    <option value="delivery">Delivery</option>
                    <option value="cost">Cost</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <div role="group" aria-label="Rate this trace">
                  <button
                    type="button"
                    className={trace.feedback_rating === 1 ? 'is-selected' : ''}
                    disabled={feedbackMutation.isPending}
                    onClick={() => feedbackMutation.mutate({ rating: 1, reason: 'useful' })}
                    aria-label="Mark trace outcome useful"
                  ><ThumbsUp aria-hidden="true" /> Useful</button>
                  <button
                    type="button"
                    className={trace.feedback_rating === -1 ? 'is-selected is-negative' : ''}
                    disabled={feedbackMutation.isPending}
                    onClick={() => feedbackMutation.mutate({ rating: -1, reason: feedbackReason })}
                    aria-label="Mark trace outcome needs review"
                  ><ThumbsDown aria-hidden="true" /> Needs review</button>
                </div>
                {feedbackMutation.isError && <span className="ai-trace-feedback__error" role="alert">Feedback could not be saved. Try again.</span>}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};
