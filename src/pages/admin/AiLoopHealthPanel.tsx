import { useQuery } from '@tanstack/react-query';
import { adminApi, type AdminAiLoopHealth } from '@/api/admin';
import './AiLoopHealthPanel.css';

export const percent = (share: number | null | undefined) => (
  share == null ? '—' : `${(share * 100).toFixed(share > 0 && share < 0.1 ? 1 : 0)}%`
);

export const compactTokens = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return value.toLocaleString();
};

const money = (value: string | null) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return '$0';
  return amount < 0.01 ? `$${amount.toFixed(4)}` : `$${amount.toFixed(2)}`;
};

const humanize = (value: string) => value.replaceAll('_', ' ');

function CacheBar({ share }: { share: number | null }) {
  const width = Math.max(0, Math.min(100, (share ?? 0) * 100));
  return <span className="loop-health__bar" aria-hidden="true"><i style={{ width: `${width}%` }} /></span>;
}

function Kpis({ data }: { data: AdminAiLoopHealth }) {
  const first = data.rounds.find(row => row.round === 1);
  const turns = data.turn_rounds.reduce((sum, row) => sum + row.turns, 0);
  const multi = data.turn_rounds.filter(row => row.rounds > 1).reduce((sum, row) => sum + row.turns, 0);
  const marked = data.prefixes.chat_calls ? data.prefixes.marked_calls / data.prefixes.chat_calls : null;
  return <dl className="loop-health__kpis">
    <div><dt>Chat input cached</dt><dd>{percent(data.cache.cached_share)}</dd>
      <span>{compactTokens(data.cache.cached_input_tokens)} of {compactTokens(data.cache.input_tokens)} tokens</span></div>
    <div><dt>First call of a turn</dt><dd>{percent(first?.cached_share)}</dd>
      <span>{first ? `${first.calls.toLocaleString()} calls · the number the stable prefix should raise` : 'no first-round calls'}</span></div>
    <div><dt>Cache savings</dt><dd>{money(data.cache.estimated_savings_usd)}</dd>
      <span>vs. full input price · {compactTokens(data.cache.cache_write_tokens)} tokens written</span></div>
    <div><dt>Multi-step turns</dt><dd>{turns ? percent(multi / turns) : '—'}</dd>
      <span>{multi.toLocaleString()} of {turns.toLocaleString()} turns used 2+ model rounds</span></div>
    <div><dt>Prompt prefixes</dt><dd>{data.prefixes.distinct.toLocaleString()}</dd>
      <span>{marked == null ? 'no chat calls' : `${percent(marked)} of chat calls marked`}</span></div>
  </dl>;
}

export function AiLoopHealthPanel({ days }: { days: number }) {
  const query = useQuery({
    queryKey: ['admin-ai-loop-health', days],
    queryFn: () => adminApi.getAiLoopHealth(days),
    refetchInterval: 60_000,
  });
  const data = query.data;
  const toolsWithActivity = data?.tools.filter(tool => tool.executed + tool.skipped + tool.reused > 0) ?? [];

  return <section className="loop-health" aria-labelledby="loop-health-title">
    <header className="loop-health__header">
      <div>
        <h3 id="loop-health-title">Tool loop & prompt cache</h3>
        <p className="text-muted">Chat-layer provider calls grouped by loop round, plus tool outcomes. Counts and token totals only — never prompts, outputs, or identities.</p>
      </div>
      {query.isFetching && !query.isLoading && <span className="loop-health__refreshing" role="status">Refreshing…</span>}
    </header>
    {query.isLoading && <p role="status">Loading loop measurements…</p>}
    {query.error && <p role="alert">Could not load loop measurements. <button type="button" onClick={() => void query.refetch()}>Retry</button></p>}
    {data && (data.cache.chat_calls === 0 ? <p>No chat-layer calls in this window yet.</p> : <>
      <Kpis data={data} />

      <div className="loop-health__grid">
        <div className="loop-health__block">
          <h4>Cache hit rate by round</h4>
          <div className="loop-health__table" role="region" aria-label="Cache by loop round" tabIndex={0}>
            <table>
              <thead><tr><th scope="col">Round</th><th scope="col">Calls</th><th scope="col">Cached input</th><th scope="col">Writes</th><th scope="col">Mean time</th></tr></thead>
              <tbody>{data.rounds.map(row => <tr key={row.round}>
                <th scope="row">{row.round === 0 ? 'Unrecorded' : `Round ${row.round}`}</th>
                <td>{row.calls.toLocaleString()}</td>
                <td><span className="loop-health__share"><CacheBar share={row.cached_share} /><strong>{percent(row.cached_share)}</strong></span>
                  <small>{compactTokens(row.cached_input_tokens)} / {compactTokens(row.input_tokens)}</small></td>
                <td>{compactTokens(row.cache_write_tokens)}</td>
                <td>{Math.round(row.mean_ms).toLocaleString()} ms</td>
              </tr>)}</tbody>
            </table>
          </div>
          {data.turn_rounds.length > 0 && <ul className="loop-health__chips" aria-label="Model rounds per turn">
            {data.turn_rounds.map(row => <li key={row.rounds}><strong>{row.turns.toLocaleString()}</strong> {row.rounds === 1 ? '1 round' : `${row.rounds} rounds`}</li>)}
          </ul>}
        </div>

        <div className="loop-health__block">
          <h4>Models</h4>
          <div className="loop-health__table" role="region" aria-label="Cache by model" tabIndex={0}>
            <table>
              <thead><tr><th scope="col">Model</th><th scope="col">Calls</th><th scope="col">Cached</th><th scope="col">Cost</th><th scope="col">Saved</th></tr></thead>
              <tbody>{data.models.map(row => <tr key={`${row.provider}-${row.model}`}>
                <th scope="row">{row.model}<small>{row.provider}</small></th>
                <td>{row.calls.toLocaleString()}</td>
                <td>{row.input_tokens ? percent(row.cached_share) : '—'}</td>
                <td>{money(row.cost_usd)}</td>
                <td>{row.estimated_savings_usd == null ? '—' : money(row.estimated_savings_usd)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="loop-health__grid">
        <div className="loop-health__block">
          <h4>Tools</h4>
          {toolsWithActivity.length === 0 ? <p className="text-muted">No tool spans in this window.</p> : <>
            <div className="loop-health__table" role="region" aria-label="Tool outcomes" tabIndex={0}>
              <table>
                <thead><tr><th scope="col">Tool</th><th scope="col">Ran</th><th scope="col">Failed</th><th scope="col">Skipped</th><th scope="col">Reused</th><th scope="col">Mean time</th></tr></thead>
                <tbody>{toolsWithActivity.map(row => <tr key={row.tool}>
                  <th scope="row">{humanize(row.tool)}</th>
                  <td>{row.executed.toLocaleString()}</td>
                  <td className={row.failed ? 'is-warning' : undefined}>{row.failed.toLocaleString()}</td>
                  <td>{row.skipped.toLocaleString()}</td>
                  <td>{row.reused.toLocaleString()}</td>
                  <td>{row.mean_ms == null ? '—' : `${Math.round(row.mean_ms).toLocaleString()} ms`}</td>
                </tr>)}</tbody>
              </table>
            </div>
            {data.skip_reasons.length > 0 && <ul className="loop-health__chips" aria-label="Why tool calls were skipped">
              {data.skip_reasons.map(row => <li key={row.reason}><strong>{row.count.toLocaleString()}</strong> {humanize(row.reason)}</li>)}
            </ul>}
          </>}
        </div>

        <div className="loop-health__block">
          <h4>Prompt prefix variants</h4>
          <p className="text-muted">Each hash is one version of the cacheable system-prompt start. A few stable hashes means requests can share the cache; many short-lived ones mean something per-request is leaking into the prefix.</p>
          {data.prefixes.top.length === 0 ? <p className="text-muted">No calls have recorded a prefix hash yet. They appear once the cache-stable prompt is live.</p>
            : <ul className="loop-health__prefixes">
              {data.prefixes.top.map(row => <li key={row.hash}>
                <code>{row.hash}</code>
                <span>{row.calls.toLocaleString()} calls · {percent(row.cached_share)} cached · {row.chars.toLocaleString()} chars</span>
              </li>)}
            </ul>}
          {data.finish_reasons.length > 0 && <>
            <h4>Finish reasons</h4>
            <ul className="loop-health__chips" aria-label="Chat call finish reasons">
              {data.finish_reasons.map(row => <li key={row.reason}><strong>{row.count.toLocaleString()}</strong> {humanize(row.reason)}</li>)}
            </ul>
          </>}
        </div>
      </div>
    </>)}
  </section>;
}
