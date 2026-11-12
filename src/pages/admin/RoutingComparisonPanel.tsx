import { useQuery } from '@tanstack/react-query';
import { adminApi, type AiRoutingMode } from '@/api/admin';
import './RoutingComparisonPanel.css';

export const ROUTING_MODES: { value: AiRoutingMode; label: string; description: string }[] = [
  { value: 'llm_shadow_jev', label: 'LLM active · Jev shadow', description: 'Current LLM runs the flow. Jev logs its proposals.' },
  { value: 'jev_shadow_llm', label: 'Jev active · LLM shadow', description: 'Jev routes the request. The LLM also logs a comparison proposal.' },
  { value: 'jev_only', label: 'Jev only', description: 'Jev routing with LLM narration and logged handoffs. No shadow.' },
  { value: 'llm_only', label: 'LLM only', description: 'Current LLM routing. No shadow router.' },
];
const label = (mode: string) => ROUTING_MODES.find(item => item.value === mode)?.label ?? mode;
const money = (cost: string) => `$${Number(cost).toFixed(5)}`;

export function RoutingComparisonPanel({ days, onSelectTrace }: { days: number; onSelectTrace: (id: string) => void }) {
  const query = useQuery({ queryKey: ['admin-routing-comparison', days],
    queryFn: () => adminApi.getRoutingComparison(days), refetchInterval: 30_000 });
  const data = query.data;
  return <section className="routing-comparison" aria-labelledby="routing-comparison-title">
    <h3 id="routing-comparison-title">Jev / LLM routing comparison</h3>
    <p className="text-muted">Proposals at the same step, using the actual flow’s observations. Shadow tools never run. Agreement measures matching choices, not correctness or a fully executed alternative flow.</p>
    {query.isLoading && <p role="status">Loading routing measurements…</p>}
    {query.error && <p role="alert">Could not load routing measurements. <button type="button" onClick={() => void query.refetch()}>Retry</button></p>}
    {data && <>
      {!data.providers.length && <p>No routing measurements in this window. New chat requests will appear here.</p>}
      {data.comparisons.length > 0 && <ul className="routing-comparison__outcomes">
        {data.comparisons.map(row => <li key={`${row.mode}-${row.agreement}`}><strong>{row.count}</strong> {row.agreement} <span>{label(row.mode)}</span></li>)}
      </ul>}
      {data.providers.length > 0 && <div className="routing-comparison__table" role="region" aria-label="Routing provider measurements" tabIndex={0}>
        <table><thead><tr><th scope="col">Mode / provider</th><th scope="col">Role</th><th scope="col">Calls</th><th scope="col">Mean time</th><th scope="col">Known cost</th><th scope="col">Failures</th></tr></thead>
          <tbody>{data.providers.map(row => <tr key={`${row.mode}-${row.engine}-${row.role}-${row.provider}-${row.model}-${row.experiment_version}-${row.entrypoint}`}>
            <th scope="row">{label(row.mode)}<small>{row.engine === 'jev' ? 'Jev' : 'LLM'} · {row.model}{row.experiment_version && ` · ${row.experiment_version}`}{row.entrypoint && ` · ${row.entrypoint}`}</small></th>
            <td>{row.role}</td><td>{row.calls}</td><td>{Math.round(row.mean_ms)} ms</td>
            <td>{money(row.cost_usd)}{row.unknown_cost_calls > 0 && <small>{row.unknown_cost_calls} unpriced calls</small>}</td><td>{row.failed_calls}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      {data.recent_trace_ids.length > 0 && <div className="routing-comparison__traces"><span>Recent comparisons</span>
        {data.recent_trace_ids.map(id => <button key={id} type="button" onClick={() => onSelectTrace(id)} aria-label={`Open comparison trace ${id}`}>{id.slice(0, 8)}</button>)}
      </div>}
    </>}
  </section>;
}
