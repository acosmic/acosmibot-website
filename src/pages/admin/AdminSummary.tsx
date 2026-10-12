/** Shared owner summary: compact ledgers inherit the existing admin console. */
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { apiBase, clearExpiredSession } from '@/lib/auth';
import { PremiumTierIcon, PREMIUM_TIER_LABELS } from '@/components/ui';

const TIERS = ['free', 'plus', 'pro', 'max'] as const;
interface Summary {
  servers: { active: number; inactive: number; total: number };
  tiers: Record<typeof TIERS[number], { servers: number; active: number; inactive: number; total: number }>;
  unique_members: number;
  updated_at: string;
  website: { signed_in: number; active: number; ever_logged_in: number } | null;
}
const count = (value: number | undefined) => value === undefined ? '—' : value.toLocaleString();

export function AdminSummary() {
  const { data, isError, isFetching, refetch } = useQuery<Summary>({
    queryKey: ['admin-summary'],
    queryFn: async ({ signal }) => {
      const response = await fetch(`${apiBase()}/api/admin/summary`, { credentials: 'include', signal });
      if (response.status === 401) clearExpiredSession();
      if (!response.ok) throw new Error('Summary unavailable');
      return response.json();
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
    retry: 1,
  });
  return (
    <section className="admin-summary" aria-labelledby="admin-summary-title" aria-busy={isFetching}>
      <header className="admin-summary__header">
        <h2 id="admin-summary-title">Network overview</h2>
        <div>
          <span role="status">{isError ? 'Refresh failed — retry to update' : data ? `Updated ${new Date(data.updated_at).toLocaleTimeString()}` : 'Loading overview…'}</span>
          <button type="button" onClick={() => void refetch()} disabled={isFetching} aria-label="Refresh network overview">
            <RefreshCw size={15} aria-hidden="true" /> Refresh
          </button>
        </div>
      </header>
      <div className="admin-summary__body">
        <div className="admin-summary__network">
          <h3>Discord servers</h3>
          <dl className="admin-summary__counts">
            <div><dt>Active</dt><dd>{count(data?.servers.active)}</dd></div>
            <div><dt>Inactive</dt><dd>{count(data?.servers.inactive)}</dd></div>
            <div><dt>Total</dt><dd>{count(data?.servers.total)}</dd></div>
          </dl>
          <div className="admin-summary__members"><span>Unique members</span><strong>{count(data?.unique_members)}</strong></div>
          <p>Current members across connected servers, counted once.</p>
        </div>
        <div className="admin-summary__tiers">
          <h3>Subscription tiers</h3>
          <table>
            <caption className="admin-summary__caption">Server tiers include complimentary access. Subscription counts are paid records.</caption>
            <thead><tr><th scope="col">Tier</th><th scope="col">Servers</th><th scope="col">Active</th><th scope="col">Inactive</th><th scope="col">Total</th></tr></thead>
            <tbody>{TIERS.map(tier => <tr key={tier}>
              <th scope="row"><span><PremiumTierIcon tier={tier} size={20} />{PREMIUM_TIER_LABELS[tier]}</span></th>
              <td>{count(data?.tiers[tier].servers)}</td>
              <td>{tier === 'free' ? '—' : count(data?.tiers[tier].active)}</td>
              <td>{tier === 'free' ? '—' : count(data?.tiers[tier].inactive)}</td>
              <td>{tier === 'free' ? '—' : count(data?.tiers[tier].total)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="admin-summary__website">
          <h3>Website users</h3>
          <dl className="admin-summary__website-counts">
            <div><dt>Signed in <small>Current login sessions</small></dt><dd>{count(data?.website?.signed_in)}</dd></div>
            <div><dt>Active now <small>Visible website tab in the last 5 minutes</small></dt><dd>{count(data?.website?.active)}</dd></div>
            <div><dt>Ever signed in <small>All-time unique users</small></dt><dd>{count(data?.website?.ever_logged_in)}</dd></div>
          </dl>
          {data && !data.website && <p role="status">Website counts unavailable. Retry with Refresh.</p>}
        </div>
      </div>
    </section>
  );
}
