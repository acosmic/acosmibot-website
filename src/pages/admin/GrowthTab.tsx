import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import '@/styles/admin-growth.css';

type Install = { id: string; guild_id: string; guild_name: string | null; joined_at: string; removed_at: string | null; source: string; baseline: boolean; first_feature_at: string | null; attempts: number; successes: number; features: { feature: string; outcome: string; attempts: number }[] };
type Growth = { collector: { last_seen: string; guild_count: number } | null; days: number; retention_days: number; invites: { source: string; starts: number; authorizations: number; verified_guilds: number }[]; cohorts: { source: string; installs: number; retained: number; removed: number; removed_under_day: number }[]; installs: Install[]; features: { feature: string; outcome: string; attempts: number; servers: number }[] };
const date = (value: string | null) => value ? new Date(value).toLocaleString() : '—';
const source = (value: string) => value === 'topgg' ? 'Top.gg' : value === 'website' ? 'Website' : 'Unknown';
function duration(install: Install) {
  if (!install.removed_at) return 'No recorded removal';
  const minutes = Math.max(0, Math.floor((Date.parse(install.removed_at) - Date.parse(install.joined_at)) / 60000));
  return minutes < 60 ? `${minutes} min` : minutes < 1440 ? `${Math.floor(minutes / 60)} hr` : `${Math.floor(minutes / 1440)} days`;
}

export function GrowthTab() {
  const [days, setDays] = useState(30);
  const { data, isPending, error, refetch, isFetching, dataUpdatedAt } = useQuery({ queryKey: ['admin-growth', days], queryFn: () => api.fetch<Growth>(`/api/admin/growth?days=${days}`) });
  return <section className="admin-growth" aria-labelledby="growth-title">
    <header className="growth-toolbar"><div><h2 id="growth-title">Growth &amp; Retention</h2><p>Follow invitations through installation, feature use, and removal.</p></div>
      <div className="growth-controls"><label>Period <select value={days} onChange={e => setDays(Number(e.target.value))}>{[7, 30, 90].map(n => <option key={n} value={n}>Last {n} days</option>)}</select></label>
      <button type="button" onClick={() => void refetch()} disabled={isFetching}>Refresh</button></div></header>
    <p role="status" aria-live="polite">{isFetching && !isPending ? "Refreshing growth data…" : dataUpdatedAt ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString()}` : ""}</p>
    {isPending && <p role="status">Loading growth data…</p>}
    {error && <p role="alert">Growth data could not be loaded. {error.message} Use Refresh to try again.</p>}
    {data && <>
      <p className="growth-note">Sources require a verified Discord authorization and a matching bot join. Invite starts are requests, not unique people. Existing installations are marked “Before tracking”; their source stays unknown.</p>
      <p className="growth-note">{data.collector ? `Collector last checked ${date(data.collector.last_seen)} · ${data.collector.guild_count} connected servers at that check. Checks run every 30 minutes.` : "Waiting for the bot collector’s first check. Zero values do not yet establish that there was no activity."}</p>
      <h3>Acquisition by source</h3>
      <div className="growth-table-wrap"><table><caption>New-install cohorts for the selected period</caption><thead><tr><th>Source</th><th>Invite starts</th><th>Authorized</th><th>Confirmed installs</th><th>No recorded removal</th><th>Removed</th><th>Left within 24h</th></tr></thead>
        <tbody>{['topgg', 'website', 'unknown'].map(s => { const a = data.invites.find(x => x.source === s); const c = data.cohorts.find(x => x.source === s); return <tr key={s}><th scope="row" data-label="Source">{source(s)}</th><td data-label="Invite starts">{s === 'unknown' ? '—' : a?.starts ?? 0}</td><td data-label="Authorized">{s === 'unknown' ? '—' : a?.authorizations ?? 0}</td><td data-label="Confirmed installs">{c?.installs ?? 0}</td><td data-label="No recorded removal">{c?.retained ?? 0}</td><td data-label="Removed">{c?.removed ?? 0}</td><td data-label="Left within 24h">{c?.removed_under_day ?? 0}</td></tr>; })}</tbody></table></div>
      <p className="growth-note">Authorization can reinstall an existing bot without creating a new install. These columns use their own event dates and are not a conversion-rate calculation.</p>
      <h3>Installation history</h3>
      {!data.installs.length ? <p>No installations recorded yet. Collection starts when the updated bot is running; earlier email history has not been imported.</p> : <div className="growth-table-wrap"><table><caption>Latest 100 observed installation cycles · dates in your local time</caption><thead><tr><th>Server</th><th>Source</th><th>Joined</th><th>Removed</th><th>Duration</th><th>First feature</th><th>Attempts / successful</th></tr></thead><tbody>{data.installs.map(i => <tr key={i.id}><th scope="row" data-label="Server">{i.guild_name || 'Unknown server'}<small>{i.guild_id}</small>{i.baseline && <small>Before tracking</small>}</th><td data-label="Source">{source(i.source)}</td><td data-label="Joined">{date(i.joined_at)}</td><td data-label="Removed">{date(i.removed_at)}</td><td data-label="Duration">{duration(i)}</td><td data-label="First feature">{date(i.first_feature_at)}</td><td data-label="Attempts / successful">{i.attempts} / {i.successes}{i.features.length > 0 && <details><summary>Features tried</summary><ul>{i.features.map(f => <li key={`${f.feature}:${f.outcome}`}>{f.feature}: {f.attempts} {f.outcome}</li>)}</ul></details>}</td></tr>)}</tbody></table></div>}
      <h3>Features tried</h3>
      <p className="growth-note">Recorded command attempts and AI conversations across all observed servers. Background activity and unfinished attempts are excluded; no message content is collected here.</p>
      {!data.features.length ? <p>No completed feature attempts recorded in this period.</p> : <div className="growth-table-wrap"><table><caption>Feature outcomes over the selected period</caption><thead><tr><th>Feature</th><th>Outcome</th><th>Attempts</th><th>Servers</th></tr></thead><tbody>{data.features.map(f => <tr key={`${f.feature}:${f.outcome}`}><th scope="row" data-label="Feature">{f.feature}</th><td data-label="Outcome">{f.outcome}</td><td data-label="Attempts">{f.attempts}</td><td data-label="Servers">{f.servers}</td></tr>)}</tbody></table></div>}
      <p className="growth-note">Feature and invite records are retained for {data.retention_days} days; departed installation records expire 90 days after removal. Historical source attribution cannot be recovered from email timestamps alone.</p>
    </>}
  </section>;
}
