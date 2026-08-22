/**
 * THESIS: Owner administration is a subsystem console, not a long strip of interchangeable tabs.
 * OWN-WORLD: Restrained observatory shell, persistent module rail, dense ledgers, and literal status signals.
 * STORY: Verify the owner boundary, select one operational subsystem, inspect or change it with confidence.
 * FIRST VIEWPORT: An owner-only header resolves into a module rail and one focused workspace.
 * FORM: Third-ranked subsystem-console structure; established world; seed 04af1d35.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  BarChart3,
  Bot,
  Coins,
  Fingerprint,
  Flag,
  LockKeyhole,
  Package,
  Palette,
  Server,
  Sparkles,
  Trophy,
  Waypoints,
} from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import {
  InlineIcon,
  PremiumTierIcon,
  PREMIUM_TIER_LABELS,
  normalizePremiumTier,
} from '@/components/ui';
import { clearExpiredSession } from '@/lib/auth';
import { BotStatsTab } from './BotStatsTab';
import { AiSettingsTab } from './AiSettingsTab';
import { AiTracesTab } from './AiTracesTab';
import { EconomySettingsTab } from './EconomySettingsTab';
import { FeatureSettingsTab } from './FeatureSettingsTab';
import { CosmeticsTab } from './CosmeticsTab';
import { AchievementsTab } from './AchievementsTab';
import { ItemsTab } from './ItemsTab';
import { AnalyticsTab } from './AnalyticsTab';
import { AdminDetailDialog } from './AdminDetailDialog';
import { PremiumGrantsTab } from './PremiumGrantsTab';
import '@/styles/admin.css';

const ADMIN_TABS = [
  { id: 'signins', label: 'Sign-In Log', group: 'Security', description: 'Review recent website authentication events and reveal network details only when needed.', icon: Fingerprint },
  { id: 'servers', label: 'Servers', group: 'Network', description: 'Inspect every connected Discord server, its status, subscription, and stored configuration.', icon: Server },
  { id: 'grants', label: 'Premium Grants', group: 'Network', description: 'Issue, schedule, extend, revoke, and restore audited complimentary server access.', icon: BadgeCheck },
  { id: 'botstats', label: 'Bot Stats', group: 'Telemetry', description: 'Observe bot health, runtime signals, and system-wide operating totals.', icon: Activity },
  { id: 'aitraces', label: 'AI Traces', group: 'Telemetry', description: 'Follow content-free AI routing, provider, tool, safety, delivery, and settlement spans.', icon: Waypoints },
  { id: 'ai', label: 'AI Settings', group: 'Intelligence', description: 'Configure the shared AI model policy, limits, and system behavior.', icon: Bot },
  { id: 'economy', label: 'Economy', group: 'Systems', description: 'Manage global economy behavior and operational defaults.', icon: Coins },
  { id: 'features', label: 'Feature Flags', group: 'Systems', description: 'Control global feature availability and release-state switches.', icon: Flag },
  { id: 'cosmetics', label: 'Cosmetics', group: 'Catalog', description: 'Maintain the global cosmetic catalog and presentation metadata.', icon: Palette },
  { id: 'achievements', label: 'Achievements', group: 'Catalog', description: 'Manage achievement definitions, requirements, and rewards.', icon: Trophy },
  { id: 'items', label: 'Items', group: 'Catalog', description: 'Operate item definitions, effects, availability, and grants.', icon: Package },
  { id: 'analytics', label: 'Analytics', group: 'Telemetry', description: 'Inspect global usage patterns across commands, AI, and community activity.', icon: BarChart3 },
] as const;

type AdminTab = typeof ADMIN_TABS[number]['id'];

function IpCell({ ip }: { ip: string | null }) {
  const [revealed, setRevealed] = useState(false);
  if (!ip) return <span>—</span>;
  return (
    <button
      type="button"
      className={`admin-ip-toggle${revealed ? ' is-revealed' : ''}`}
      onClick={() => setRevealed((current) => !current)}
      aria-label={revealed ? 'Hide IP address' : 'Reveal IP address'}
    >
      {revealed ? ip : 'Reveal'}
    </button>
  );
}

type SortDir = 'asc' | 'desc';

interface SigninLog {
  id: number;
  discord_id: string;
  username: string;
  global_name: string | null;
  avatar_hash: string | null;
  ip_address: string | null;
  user_agent: string | null;
  signed_in_at: string;
}

interface Guild {
  id: string;
  name: string;
  owner_id: string;
  owner_username: string | null;
  member_count: number;
  active: boolean;
  joined_at: string | null;
  subscription_tier: string;
  settings: string | null;
}

function useAdminData<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const apiBase = (window as any).AppConfig?.apiBaseUrl ?? 'https://api.acosmibot.com';
    setLoading(true);
    setError(null);
    fetch(`${apiBase}${url}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async response => {
        if (response.status === 401) clearExpiredSession();
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.error ?? body?.message ?? `Request failed (${response.status})`);
        }
        return body as T;
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setData(null);
        setError(error instanceof Error ? error.message : String(error));
        setLoading(false);
      });
    return () => controller.abort();
  }, [url]);

  return { data, loading, error };
}

function SortableTable<T extends Record<string, any>>({
  rows,
  columns,
}: {
  rows: T[];
  columns: { key: string; label: string; render?: (row: T) => React.ReactNode }[];
}) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string>(columns[0].key);
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(25);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r =>
      !q || columns.some(c => String(r[c.key] ?? '').toLowerCase().includes(q))
    );
  }, [rows, search, columns]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / perPage);
  const pageRows = sorted.slice(page * perPage, (page + 1) * perPage);

  const handleSort = (key: string) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(0);
  };

  return (
    <div className="admin-ledger">
      <div className="admin-table-tools">
        <label className="admin-table-search">
          <span>Search ledger</span>
          <input
            placeholder="Search all columns"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
          />
        </label>
        <span className="admin-result-count">{filtered.length} results</span>
        <label className="admin-page-size">
          <span>Rows</span>
          <select
            value={perPage}
            onChange={e => { setPerPage(Number(e.target.value)); setPage(0); }}
          >
            {[25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
        </label>
      </div>

      <div className="admin-table-desktop">
        <table className="admin-data-table">
          <thead>
            <tr>
              {columns.map(c => (
                <th
                  key={c.key}
                  aria-sort={sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button type="button" onClick={() => handleSort(c.key)}>
                    {c.label}
                    {sortKey === c.key && <InlineIcon icon={sortDir === 'asc' ? ArrowUp : ArrowDown} size={12} />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center text-muted py-4">No results</td></tr>
            ) : pageRows.map((row, i) => (
              <tr key={i}>
                {columns.map(c => (
                  <td key={c.key}>
                    {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-mobile-sort">
        <label>
          <span>Sort by</span>
          <select value={sortKey} onChange={(event) => handleSort(event.target.value)}>
            {columns.map(column => (
              <option key={column.key} value={column.key}>{column.label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setSortDir(direction => direction === 'asc' ? 'desc' : 'asc');
            setPage(0);
          }}
          aria-label={`Sort ${sortDir === 'asc' ? 'descending' : 'ascending'}`}
        >
          <InlineIcon icon={sortDir === 'asc' ? ArrowUp : ArrowDown} size={14} />
          {sortDir === 'asc' ? 'Ascending' : 'Descending'}
        </button>
      </div>

      <div className="admin-card-list">
        {pageRows.length === 0 ? (
          <div className="admin-mobile-row text-muted">No results</div>
        ) : pageRows.map((row, i) => (
          <div className="admin-mobile-row" key={i}>
            {columns.map((c, columnIndex) => (
              <div className={columnIndex === 0 ? 'admin-mobile-field primary' : 'admin-mobile-field'} key={c.key}>
                <span className="admin-mobile-label">{c.label}</span>
                <span className="admin-mobile-value">{c.render ? c.render(row) : String(row[c.key] ?? '—')}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="admin-pagination" aria-label="Table pagination">
          <button type="button" disabled={page === 0} onClick={() => setPage(0)} aria-label="First page">«</button>
          <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)} aria-label="Previous page">‹</button>
          <span>Page {page + 1} of {totalPages}</span>
          <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} aria-label="Next page">›</button>
          <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)} aria-label="Last page">»</button>
        </div>
      )}
    </div>
  );
}

const TierCell: React.FC<{ tier: string }> = ({ tier }) => {
  const normalizedTier = normalizePremiumTier(tier);
  return (
    <span className="admin-tier-cell">
      <PremiumTierIcon tier={normalizedTier} size={26} />
      {PREMIUM_TIER_LABELS[normalizedTier]}
    </span>
  );
};

const SettingsCell: React.FC<{ json: string | null }> = ({ json }) => {
  const [open, setOpen] = useState(false);
  if (!json) return <span className="text-muted">—</span>;
  let pretty = json;
  try { pretty = JSON.stringify(JSON.parse(json), null, 2); } catch {}
  return (
    <div>
      <button
        type="button"
        className="admin-settings-trigger"
        onClick={() => setOpen(v => !v)}
      >
        {open ? 'Hide' : 'View'}
      </button>
      {open && (
        <AdminDetailDialog
          title="Server Settings"
          label="server settings"
          onClose={() => setOpen(false)}
        >
          <pre>{pretty}</pre>
        </AdminDetailDialog>
      )}
    </div>
  );
};

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>('signins');
  const [authChecked, setAuthChecked] = useState(false);
  const activeTab = ADMIN_TABS.find((item) => item.id === tab) ?? ADMIN_TABS[0];
  const ActiveIcon = activeTab.icon;

  const signinResult = useAdminData<{ logs: SigninLog[] }>('/api/admin/signin-logs?limit=1000');
  const guildsResult = useAdminData<{ guilds: Guild[] }>('/api/admin/guilds?limit=100');
  const activeDataResult = tab === 'signins'
    ? signinResult
    : tab === 'servers'
      ? guildsResult
      : null;
  const workspaceState = activeDataResult
    ? activeDataResult.loading
      ? { label: 'Loading data', tone: 'loading' }
      : activeDataResult.error
        ? { label: 'Data unavailable', tone: 'error' }
        : { label: 'Live data', tone: 'live' }
    : { label: 'Owner module', tone: 'neutral' };

  useEffect(() => {
    const apiBase = (window as any).AppConfig?.apiBaseUrl ?? 'https://api.acosmibot.com';
    fetch(`${apiBase}/api/admin/check`, { credentials: 'include' })
      .then(r => {
        if (r.status === 401) clearExpiredSession();
        return r.json();
      })
      .then(d => {
        // The panel and every /api/admin route require super-admin; a plain
        // 'admin' row (or anyone else) is bounced here too.
        if (!d.is_super_admin) navigate('/');
        else setAuthChecked(true);
      })
      .catch(() => navigate('/'));
  }, [navigate]);

  if (!authChecked) {
    return (
      <div className="admin-access-check" role="status" aria-live="polite">
        <div className="admin-access-check__orbit" aria-hidden="true">
          <span /><span />
          <img src="/images/acosmibot-logo.png" alt="" />
        </div>
        <div>
          <span><LockKeyhole aria-hidden="true" /> Owner boundary</span>
          <strong>Verifying control access…</strong>
        </div>
      </div>
    );
  }

  const signinColumns = [
    { key: 'signed_in_at', label: 'Time', render: (r: SigninLog) => new Date(r.signed_in_at).toLocaleString() },
    { key: 'username', label: 'Username' },
    { key: 'global_name', label: 'Display Name', render: (r: SigninLog) => r.global_name ?? '—' },
    { key: 'discord_id', label: 'Discord ID' },
    { key: 'ip_address', label: 'IP Address', render: (r: SigninLog) => <IpCell ip={r.ip_address} /> },
    { key: 'user_agent', label: 'User Agent', render: (r: SigninLog) => <span title={r.user_agent ?? ''}>{r.user_agent ? r.user_agent.slice(0, 60) + (r.user_agent.length > 60 ? '…' : '') : '—'}</span> },
  ];

  const guildColumns = [
    { key: 'name', label: 'Server Name' },
    { key: 'id', label: 'Server ID' },
    { key: 'owner_username', label: 'Owner Username', render: (r: Guild) => <span title={r.owner_username ?? undefined}>{r.owner_username ?? '—'}</span> },
    { key: 'owner_id', label: 'Owner ID' },
    { key: 'member_count', label: 'Members', render: (r: Guild) => r.member_count?.toLocaleString() ?? '—' },
    { key: 'active', label: 'Active', render: (r: Guild) => r.active ? <span className="admin-status admin-status--active">Yes</span> : <span className="admin-status admin-status--inactive">No</span> },
    { key: 'subscription_tier', label: 'Tier', render: (r: Guild) => <TierCell tier={r.subscription_tier} /> },
    { key: 'joined_at', label: 'Date Joined', render: (r: Guild) => r.joined_at ? new Date(r.joined_at).toLocaleDateString() : '—' },
    { key: 'settings', label: 'Settings', render: (r: Guild) => <SettingsCell json={r.settings} /> },
  ];

  return (
    <div className="admin-page">
      <PublicNav variant="observatory" />

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p className="admin-kicker">Owner control plane</p>
            <h1>Acosmibot operations.</h1>
            <p>Site-wide oversight for the systems behind every connected community.</p>
          </div>
          <div className="admin-header__status">
            <span className="admin-header__lock"><LockKeyhole aria-hidden="true" /></span>
            <div>
              <strong>Super-admin verified</strong>
              <span>Owner-only surface · {ADMIN_TABS.length} modules</span>
            </div>
          </div>
        </header>

        <div className="admin-console">
          <aside className="admin-module-rail" aria-label="Admin modules">
            <div className="admin-module-rail__core">
              <img src="/images/acosmibot-logo.png" alt="" />
              <div><strong>Control core</strong><span><i /> Owner verified</span></div>
            </div>
            <nav className="admin-tabs">
              {ADMIN_TABS.map((item) => {
                const Icon = item.icon;
                return (
            <button
              type="button"
              key={item.id}
              onClick={() => setTab(item.id)}
              className={tab === item.id ? 'is-active' : ''}
              aria-current={tab === item.id ? 'page' : undefined}
            >
                    <Icon aria-hidden="true" />
                    <span><strong>{item.label}</strong><small>{item.group}</small></span>
                    <i aria-hidden="true" />
            </button>
                );
              })}
            </nav>
            <div className="admin-module-rail__footer">
              <Sparkles aria-hidden="true" />
              <span>Global changes affect every server.</span>
            </div>
          </aside>

          <section className="admin-workspace" aria-labelledby="admin-workspace-title">
            <header className="admin-workspace__header">
              <span className="admin-workspace__icon"><ActiveIcon aria-hidden="true" /></span>
              <div>
                <p>{activeTab.group} subsystem</p>
                <h2 id="admin-workspace-title">{activeTab.label}</h2>
                <span>{activeTab.description}</span>
              </div>
              <div className={`admin-workspace__readout is-${workspaceState.tone}`} aria-live="polite">
                <i /> {workspaceState.label}
              </div>
            </header>

            <div className="admin-workspace__body">
        {tab === 'signins' && (
          <div className="admin-surface">
            {signinResult.loading ? (
              <AdminLoadingState label="Loading authentication events" />
            ) : signinResult.error ? (
              <AdminErrorState error={signinResult.error} />
            ) : (
              <SortableTable rows={signinResult.data?.logs ?? []} columns={signinColumns} />
            )}
          </div>
        )}

        {/* Servers */}
        {tab === 'servers' && (
          <div className="admin-surface">
            {guildsResult.loading ? (
              <AdminLoadingState label="Loading connected servers" />
            ) : guildsResult.error ? (
              <AdminErrorState error={guildsResult.error} />
            ) : (
              <SortableTable rows={guildsResult.data?.guilds ?? []} columns={guildColumns} />
            )}
          </div>
        )}

        {tab === 'grants' && (
          <div className="admin-surface">
            <PremiumGrantsTab />
          </div>
        )}

        {/* Bot Stats */}
        {tab === 'botstats' && (
          <div className="admin-surface">
            <BotStatsTab />
          </div>
        )}

        {tab === 'aitraces' && (
          <div className="admin-surface">
            <AiTracesTab />
          </div>
        )}

        {/* AI Settings */}
        {tab === 'ai' && (
          <div className="admin-surface">
            <AiSettingsTab />
          </div>
        )}

        {/* Economy Settings */}
        {tab === 'economy' && (
          <div className="admin-surface">
            <EconomySettingsTab />
          </div>
        )}

        {/* Feature Flags */}
        {tab === 'features' && (
          <div className="admin-surface">
            <FeatureSettingsTab />
          </div>
        )}

        {/* Cosmetics */}
        {tab === 'cosmetics' && (
          <div className="admin-surface">
            <CosmeticsTab />
          </div>
        )}

        {/* Achievements */}
        {tab === 'achievements' && (
          <div className="admin-surface">
            <AchievementsTab />
          </div>
        )}

        {/* Items */}
        {tab === 'items' && (
          <div className="admin-surface">
            <ItemsTab />
          </div>
        )}

        {tab === 'analytics' && (
          <div className="admin-surface">
            <AnalyticsTab />
          </div>
        )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

const AdminLoadingState: React.FC<{ label: string }> = ({ label }) => (
  <div className="admin-loading-state" role="status" aria-live="polite">
    <span /><span /><span />
    <strong>{label}…</strong>
  </div>
);

const AdminErrorState: React.FC<{ error: string }> = ({ error }) => (
  <div className="admin-error-state" role="alert">
    <strong>Subsystem data could not be loaded.</strong>
    <span>{error}</span>
  </div>
);
