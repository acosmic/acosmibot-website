import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import '@/styles/admin-growth.css';

type Feature = { kind: 'command' | 'ai'; feature: string; records: number };
type Server = { guild_id: string; guild_name: string | null; connected: boolean | null; commands: number; ai_records: number; first_record_at: string | null; last_record_at: string | null; features: Feature[] };
type Install = { id: string; guild_name: string | null; guild_id: string; joined_at: string; removed_at: string | null; source: string; baseline: boolean; attempts: number; successes: number };
type Growth = {
  collector: { last_seen: string; guild_count: number } | null;
  history?: { servers: Server[]; features: (Feature & { servers: number })[]; command_events: number; ai_records: number; active_servers: number; departed_servers: number; servers_with_usage: number };
  invites: { source: string; starts: number; authorizations: number }[];
  cohorts: { source: string; installs: number; removed: number; removed_under_day: number }[];
  installs: Install[];
};
const date = (value: string | null) => value ? new Date(value).toLocaleString() : 'Not available';
const count = (value: number) => value.toLocaleString();
const source = (value: string) => value === 'topgg' ? 'Top.gg' : value === 'website' ? 'Website' : 'Unattributed';
const featureName = (feature: Feature) => feature.kind === 'command' ? `/${feature.feature}` : `AI · ${feature.feature.replaceAll('_', ' ')}`;

export function GrowthTab() {
  const [days, setDays] = useState(30);
  const [serverFilter, setServerFilter] = useState('used');
  const [showAll, setShowAll] = useState(false);
  const { data, isPending, error, refetch, isFetching, dataUpdatedAt } = useQuery({ queryKey: ['admin-growth', days], queryFn: () => api.fetch<Growth>(`/api/admin/growth?days=${days}`) });
  const history = data?.history;
  const servers = history?.servers.filter(s => serverFilter === 'all' || (serverFilter === 'used' ? Boolean(s.commands || s.ai_records) : serverFilter === 'connected' ? s.connected === true : s.connected === false)) ?? [];
  const installs = data?.installs.filter(i => !i.baseline || i.removed_at) ?? [];
  return <section className="admin-growth" aria-label="Growth analytics">
    <header className="growth-toolbar">
      <p>See which servers use Acosmibot, what they try, and where new installs come from.</p>
      <div className="growth-controls">
        <label>Period <select value={days} onChange={e => setDays(Number(e.target.value))}>{[7, 30, 90].map(n => <option key={n} value={n}>Last {n} days</option>)}</select></label>
        <button type="button" onClick={() => void refetch()} disabled={isFetching}>Refresh</button>
      </div>
    </header>
    <p role="status" aria-live="polite">{isFetching && !isPending ? 'Refreshing growth data…' : dataUpdatedAt ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString()}` : ''}</p>
    {isPending && <p role="status">Loading server activity…</p>}
    {error && <p role="alert">Growth data could not be loaded. Use Refresh to try again.</p>}
    {data && <>
      {history ? <>
        <h3>Server activity</h3>
        <p className="growth-summary"><strong>{count(history.command_events)} command uses</strong> and <strong>{count(history.ai_records)} AI usage records</strong> across {history.servers_with_usage} servers in the last {days} days.</p>
        <p className="growth-note">Includes existing command and AI history from before this page launched. Counts are usage records, not success rates; a command can also produce an AI record. Background AI processing is excluded.</p>
        <div className="growth-controls growth-server-filter">
          <label>Servers <select value={serverFilter} onChange={e => { setServerFilter(e.target.value); setShowAll(false); }}><option value="used">With usage ({history.servers_with_usage})</option><option value="all">All directory servers ({history.servers.length})</option><option value="connected">Connected ({history.active_servers})</option><option value="left">Left ({history.departed_servers})</option></select></label>
          <span>{servers.length} matching servers · most recently used first</span>
        </div>
        {!servers.length ? <p>No servers match this filter.</p> : <div className="growth-table-wrap"><table>
          <caption>Usage in the selected period · connection status from the bot’s server directory</caption>
          <thead><tr><th>Server</th><th>Status</th><th>Last recorded use</th><th>Command uses</th><th>AI records</th><th>Features used</th></tr></thead>
          <tbody>{(showAll ? servers : servers.slice(0, 10)).map(s => <tr key={s.guild_id}>
            <th scope="row" data-label="Server">{s.guild_name || 'Server name unavailable'}<small>{s.guild_id}</small></th>
            <td data-label="Status">{s.connected === true ? 'Connected' : s.connected === false ? 'Left' : 'Status unavailable'}</td>
            <td data-label="Last recorded use">{s.last_record_at ? date(s.last_record_at) : `None in ${days} days`}</td>
            <td data-label="Command uses">{count(s.commands)}</td><td data-label="AI records">{count(s.ai_records)}</td>
            <td data-label="Features used">{s.features.length ? <><details><summary>{s.features.length} {s.features.length === 1 ? 'feature' : 'features'}</summary><ul>{s.features.map(f => <li key={`${f.kind}:${f.feature}`}>{featureName(f)} · {count(f.records)}</li>)}</ul></details><span className="growth-feature-preview">{s.features.slice(0, 3).map(featureName).join(', ')}</span></> : `None recorded in ${days} days`}</td>
          </tr>)}</tbody>
        </table></div>}
        {servers.length > 10 && <div className="growth-controls growth-server-filter"><button type="button" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show first 10 servers' : `Show all ${servers.length} matching servers`}</button></div>}
        <h3>Most-used features</h3>
        {!history.features.length ? <p>No command or foreground AI usage is recorded in this period.</p> : <div className="growth-table-wrap"><table><caption>Top 10 features by recorded usage · commands and AI records are counted separately</caption><thead><tr><th>Feature</th><th>Recorded uses</th><th>Servers</th></tr></thead><tbody>{history.features.slice(0, 10).map(f => <tr key={`${f.kind}:${f.feature}`}><th scope="row" data-label="Feature">{featureName(f)}</th><td data-label="Recorded uses">{count(f.records)}</td><td data-label="Servers">{f.servers}</td></tr>)}</tbody></table></div>}
      </> : <p role="status">Historical usage is not available yet. Refresh after the server update finishes.</p>}
      <h3>New installs by source</h3>
      <p className="growth-note">Source tracking began October 13, 2026. Earlier installs are excluded here because their referral source was never recorded. An invite start means the install screen was opened; it is not a completed install.</p>
      <div className="growth-table-wrap"><table><caption>New tracking only · filtered to the selected period</caption><thead><tr><th>Source</th><th>Invite starts</th><th>Authorized</th><th>Confirmed installs</th><th>Removed</th><th>Left within 24h</th></tr></thead><tbody>{['topgg', 'website', ...((data.cohorts.some(c => c.source === 'unknown' && c.installs)) ? ['unknown'] : [])].map(s => {
        const a = data.invites.find(x => x.source === s); const c = data.cohorts.find(x => x.source === s);
        return <tr key={s}><th scope="row" data-label="Source">{source(s)}</th><td data-label="Invite starts">{s === 'unknown' ? '—' : a?.starts ?? 0}</td><td data-label="Authorized">{s === 'unknown' ? '—' : a?.authorizations ?? 0}</td><td data-label="Confirmed installs">{c?.installs ?? 0}</td><td data-label="Removed">{c?.removed ?? 0}</td><td data-label="Left within 24h">{c?.removed_under_day ?? 0}</td></tr>;
      })}</tbody></table></div>
      <h3>Install and removal timeline</h3>
      {!installs.length ? <p>No new installs or removals recorded since tracking began. Existing servers and their historical usage are listed above.</p> : <div className="growth-table-wrap"><table><caption>Recorded installation cycles · dates in your local time</caption><thead><tr><th>Server</th><th>Source</th><th>Joined</th><th>Removed</th><th>Tracked attempts / successful</th></tr></thead><tbody>{installs.map(i => <tr key={i.id}><th scope="row" data-label="Server">{i.guild_name || i.guild_id}</th><td data-label="Source">{i.baseline ? 'Predates source tracking' : source(i.source)}</td><td data-label="Joined">{date(i.joined_at)}</td><td data-label="Removed">{i.removed_at ? date(i.removed_at) : 'No removal event'}</td><td data-label="Tracked attempts / successful">{i.attempts} / {i.successes}</td></tr>)}</tbody></table></div>}
      <details className="growth-coverage"><summary>Data coverage and collection</summary><p className="growth-note">Historical usage comes from the existing command and AI ledgers. It does not establish when a server first tried a feature, whether each request succeeded, or why the bot was removed. Exact earlier removal dates have not been imported from email.</p><p className="growth-note">{data.collector ? `The install collector last checked ${date(data.collector.last_seen)} and saw ${data.collector.guild_count} connected servers. Checks run every 30 minutes; new joins and removals are also captured as they happen.` : 'Waiting for the install collector’s first check.'}</p><p className="growth-note">Invite starts and authorizations are separate events, not a conversion rate. Verified attribution requires Discord authorization and a matching server join. New feature and invite records are kept for 90 days; removed installation records expire 90 days after removal.</p></details>
    </>}
  </section>;
}
