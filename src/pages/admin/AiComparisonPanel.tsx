/* THESIS: Compare complete test outcomes before individual model calls.
 * OWN-WORLD: Existing observatory surfaces; cyan LLM and violet Jev labels.
 * STORY: Inspect cohorts, cost completeness, provider work, then the exact trace.
 * FIRST VIEWPORT: Shared time window, aligned cohort matrix, latency comparison.
 * INTERACTION: Switch detail lens; select a recent run to inspect its waterfall. */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FlaskConical, RefreshCw, ArrowDownRight, ChevronRight } from 'lucide-react';
import { adminApi } from '@/api/admin';
import './AiComparisonPanel.css';

const labels: Record<string, string> = { control: 'LLM control', jev: 'Jev assisted', shadow: 'Jev shadow' };
const reasons: Record<string, string> = { direct_stats: 'Direct stats route', llm_fallback: 'LLM fallback',
  control: 'LLM control', ineligible: 'Existing route retained', missing_key: 'Key unavailable',
  invalid_decision: 'Invalid decision · fallback', connection_failed: 'Connection failed · fallback',
  provider_rejected: 'Provider rejected', provider_unknown: 'Outcome unresolved', admission_failed: 'Budget unavailable' };
function duration(value: number | null) { return value == null ? '—' : value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(2)} s`; }
function money(value: string | null, precision = 4) {
  return value == null ? 'Unknown' : new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: precision,
  }).format(Number(value));
}

export function AiComparisonPanel({ days, onSelectTrace }: { days: number; onSelectTrace: (id: string) => void }) {
  const [lens, setLens] = useState<'calls' | 'baseline' | 'runs'>('calls');
  const report = useQuery({ queryKey: ['admin-ai-comparison', days],
    queryFn: () => adminApi.getAiComparison(days), refetchInterval: 30_000 });
  const data = report.data;
  const maxLatency = Math.max(1, ...(data?.cohorts.map(c => c.mean_ms ?? 0) ?? []));
  return <section className="ai-comparison" aria-labelledby="ai-comparison-title">
    <header className="ai-comparison__header">
      <div><span className="ai-comparison__label"><FlaskConical size={16} aria-hidden="true" /> TEST EXPERIMENT</span>
        <h3 id="ai-comparison-title">Jev, measured against the LLM</h3>
        <p>Whole replies first. Every decision, fallback, and provider call remains visible.</p></div>
      <button type="button" className="ai-comparison__refresh" onClick={() => void report.refetch()} disabled={report.isFetching}>
        <RefreshCw size={16} aria-hidden="true" /> Refresh comparison
      </button>
    </header>
    {report.isLoading ? <p className="ai-comparison__state" role="status">Loading test measurements…</p>
      : report.isError ? <p className="ai-comparison__state" role="alert">Comparison unavailable. Refresh to retry. The trace ledger below is still available.</p>
        : data && <>
          <div className="ai-comparison__context"><span>Last {days} {days === 1 ? 'day' : 'days'} · {data.experiment_version}</span>
            <span>Updated {new Date(data.generated_at).toLocaleTimeString()}</span></div>
          {data.truncated && <p role="status">Showing the latest 10,000 records. Choose a shorter window for a complete comparison.</p>}
          {data.cohorts.length === 0 ? <div className="ai-comparison__empty">
            <FlaskConical size={28} aria-hidden="true" /><div><h4>Ready for the first comparison</h4>
              <p>Send a few messages to the test bot. Try “who is richest in this server?” and “show my stats”. Cohorts appear after labeled traces arrive.</p>
              <span>Empty means no measurements yet, not zero cost or zero latency.</span></div>
          </div> : <div className="ai-comparison__scroll"><table className="ai-comparison__table">
            <caption>Test interaction cohorts · observed traffic, not paired requests</caption>
            <thead><tr><th scope="col">Path</th><th scope="col">Replies</th><th scope="col">Average end to end</th><th scope="col">p95</th><th scope="col">Cost / 1K priced interactions</th><th scope="col">Tokens</th><th scope="col">Known spend</th></tr></thead>
            <tbody>{data.cohorts.map(c => <tr key={c.cohort}>
              <th scope="row"><span className={`ai-comparison__cohort is-${c.cohort}`}>{labels[c.cohort] ?? c.cohort}</span></th>
              <td>{c.success_count}<small>of {c.count} interactions</small></td>
              <td><strong>{duration(c.mean_ms)}</strong><small>{c.latency_count} timed</small><span className="ai-comparison__bar" aria-hidden="true"><i className={`is-${c.cohort}`} style={{ width: `${(c.mean_ms ?? 0) / maxLatency * 100}%` }} /></span></td>
              <td>{duration(c.p95_ms)}</td><td>{money(c.cost_per_1000_usd)}<small>{c.priced_count} priced · {c.unknown_cost_count} unresolved</small></td>
              <td>{c.token_count ? c.total_tokens.toLocaleString() : 'Unknown'}<small>{c.token_count} with recorded usage</small></td>
              <td>{c.unknown_cost_count ? 'Known ' : ''}{money(c.known_cost_usd)}{c.unknown_cost_count > 0 && <small>+ unresolved costs</small>}<small>{c.failed_count} failed</small></td>
            </tr>)}</tbody></table></div>}
          <p className="ai-comparison__note">Jev assisted includes fallback work. End-to-end time includes safety and delivery; observed provider spend can include background memory. Cohorts may contain different requests.</p>
          <nav className="ai-comparison__tabs" aria-label="Comparison detail">
            {(['calls', 'baseline', 'runs'] as const).map(key => <button key={key} type="button" aria-pressed={lens === key} onClick={() => setLens(key)}>
              {{ calls: 'Provider costs & speed', baseline: 'Production reference', runs: 'Recent experiment traces' }[key]}</button>)}
          </nav>
          {lens === 'calls' && <>
            <div className="ai-comparison__scroll"><table className="ai-comparison__table">
              <caption>Individual provider calls · compare equivalent work, not model names alone</caption>
              <thead><tr><th scope="col">Model / operation</th><th scope="col">Calls</th><th scope="col">Average</th><th scope="col">p95</th><th scope="col">Cost / 1K priced calls</th><th scope="col">Tokens</th></tr></thead>
              <tbody>{data.provider_groups.map(g => <tr key={`${g.provider}-${g.model}-${g.operation}-${g.phase}`}>
                <th scope="row"><span className={g.provider === 'typesafe' ? 'ai-comparison__jev' : ''}>{g.provider === 'typesafe' ? 'Jev · ' : ''}{g.model}</span><small>{g.operation.replaceAll('_', ' ')}{g.phase !== 'all' ? ` · ${g.phase}` : ''}</small></th>
                <td>{g.count}<small>{g.failed_count} failed</small></td><td>{duration(g.mean_ms)}<small>{g.latency_count} timed</small></td><td>{duration(g.p95_ms)}</td>
                <td>{money(g.cost_per_1000_usd)}<small>{g.priced_count} priced · {g.unknown_cost_count} unknown</small></td><td>{g.total_tokens.toLocaleString()}<small>{g.input_tokens.toLocaleString()} in · {g.output_tokens.toLocaleString()} out</small></td>
              </tr>)}</tbody></table></div>
            {data.provider_groups.length === 0 && <p className="ai-comparison__state">No provider calls in this window.</p>}
          </>}
          {lens === 'baseline' && <>
            <p className="ai-comparison__note">Frozen production snapshot · {new Date(data.baseline.window_start).toLocaleDateString()}–{new Date(data.baseline.window_end).toLocaleDateString()}. Adjacent Jev figures measure typed decisions only; chat still needs narration, and a memory gate only filters extraction. These are different stages, not an end-to-end savings claim.</p>
            <div className="ai-comparison__scroll"><table className="ai-comparison__table">
              <caption>Production reference · successful calls with provider response IDs</caption>
              <thead><tr><th scope="col">Workload</th><th scope="col">Sample</th><th scope="col">Average</th><th scope="col">p95</th><th scope="col">Cost / 1K priced calls</th><th scope="col">Average input tokens</th><th scope="col">Test Jev decision</th></tr></thead>
              <tbody>{data.baseline.groups.map(g => <tr key={g.label}><th scope="row">{g.label}<small>{g.model}</small></th><td>{g.count}{g.count < 30 && <small>Small sample</small>}</td><td>{duration(g.mean_ms)}</td><td>{duration(g.p95_ms)}</td><td>{money(g.cost_per_1000_usd)}</td><td>{Math.round(g.mean_input_tokens).toLocaleString()}</td><td>{(() => {
                const j = data.provider_groups.find(p => p.provider === 'typesafe' && p.operation === (g.label.toLowerCase().includes('memory') ? 'jev_memory' : 'jev_routing'));
                return j ? <><strong className="ai-comparison__jev">{duration(j.mean_ms)}</strong><small>{money(j.cost_per_1000_usd)} / 1K priced calls · n={j.count}</small><small>{Math.round(j.input_tokens / j.count).toLocaleString()} average input tokens</small></> : 'Awaiting Jev measurements';
              })()}</td></tr>)}</tbody>
            </table></div><p className="ai-comparison__note">{data.baseline.method}</p>
          </>}
          {lens === 'runs' && <div className="ai-comparison__runs">
            {data.recent.length === 0 ? <p>No labeled traces yet.</p> : data.recent.map(r => <button type="button" key={r.trace_id} onClick={() => onSelectTrace(r.trace_id)}>
              <ArrowDownRight size={18} aria-hidden="true" /><span><strong>{labels[r.cohort] ?? r.cohort}</strong><small>{reasons[r.reason] ?? r.reason} · {r.route.replaceAll('_', ' ')}</small></span>
              <span>{duration(r.duration_ms)}<small>{r.unknown_cost_count ? 'Cost incomplete' : money(r.cost_usd)} · {r.status}</small></span><ChevronRight size={18} aria-hidden="true" />
            </button>)}
          </div>}
        </>}
  </section>;
}
