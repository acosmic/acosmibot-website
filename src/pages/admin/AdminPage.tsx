import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { RagTab } from './RagTab';
import { BotStatsTab } from './BotStatsTab';
import { AiSettingsTab } from './AiSettingsTab';
import { EconomySettingsTab } from './EconomySettingsTab';

const OWNER_ID = '110637665128325120';

function IpCell({ ip }: { ip: string | null }) {
  const [revealed, setRevealed] = useState(false);
  if (!ip) return <span>—</span>;
  if (revealed) return <span style={{ cursor: 'pointer', fontFamily: 'monospace' }} onClick={() => setRevealed(false)}>{ip}</span>;
  return (
    <span
      onClick={() => setRevealed(true)}
      style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem', userSelect: 'none' }}
    >
      click to show
    </span>
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
  member_count: number;
  active: boolean;
  joined_at: string | null;
  subscription_tier: string;
  settings: string | null;
}

function useAdminData<T>(url: string, token: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const apiBase = (window as any).AppConfig?.apiBaseUrl ?? 'https://api.acosmibot.com';
    fetch(`${apiBase}${url}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [url, token]);

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
    <div>
      <div className="d-flex gap-3 mb-3 align-items-center flex-wrap">
        <input
          className="form-control"
          style={{ maxWidth: 320, background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
          placeholder="Search..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
        />
        <span className="text-muted small">{filtered.length} results</span>
        <select
          className="form-select"
          style={{ maxWidth: 100, background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
          value={perPage}
          onChange={e => { setPerPage(Number(e.target.value)); setPage(0); }}
        >
          {[25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="table table-dark table-hover" style={{ fontSize: '0.85rem' }}>
          <thead>
            <tr>
              {columns.map(c => (
                <th
                  key={c.key}
                  onClick={() => handleSort(c.key)}
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', borderColor: 'var(--border-light)' }}
                >
                  {c.label} {sortKey === c.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
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
                  <td key={c.key} style={{ borderColor: 'var(--border-light)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="d-flex gap-2 align-items-center justify-content-center mt-3">
          <button className="btn btn-sm btn-outline-secondary" disabled={page === 0} onClick={() => setPage(0)}>«</button>
          <button className="btn btn-sm btn-outline-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</button>
          <span className="text-muted small">Page {page + 1} of {totalPages}</span>
          <button className="btn btn-sm btn-outline-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>›</button>
          <button className="btn btn-sm btn-outline-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</button>
        </div>
      )}
    </div>
  );
}

const TIER_COLORS: Record<string, string> = {
  free: 'var(--text-muted)',
  premium: '#a78bfa',
  premium_plus_ai: '#f59e0b',
};

const SettingsCell: React.FC<{ json: string | null }> = ({ json }) => {
  const [open, setOpen] = useState(false);
  if (!json) return <span className="text-muted">—</span>;
  let pretty = json;
  try { pretty = JSON.stringify(JSON.parse(json), null, 2); } catch {}
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ background: 'none', border: '1px solid var(--border-light)', borderRadius: 4, padding: '2px 8px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
      >
        {open ? 'Hide' : 'View'}
      </button>
      {open && (
        <pre style={{
          marginTop: 8, padding: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-light)',
          borderRadius: 6, fontSize: '0.72rem', maxHeight: 400, overflowY: 'auto',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-primary)',
          position: 'absolute', zIndex: 100, minWidth: 360, maxWidth: 600,
        }}>
          {pretty}
        </pre>
      )}
    </div>
  );
};

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const [tab, setTab] = useState<'signins' | 'servers' | 'rag' | 'botstats' | 'ai' | 'economy'>('signins');
  const [authChecked, setAuthChecked] = useState(false);

  const signinResult = useAdminData<{ logs: SigninLog[] }>('/api/admin/signin-logs?limit=1000', token);
  const guildsResult = useAdminData<{ guilds: Guild[] }>('/api/admin/guilds?limit=100', token);

  useEffect(() => {
    if (!token) { navigate('/'); return; }
    const apiBase = (window as any).AppConfig?.apiBaseUrl ?? 'https://api.acosmibot.com';
    fetch(`${apiBase}/api/admin/check`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (!d.is_admin) navigate('/');
        else setAuthChecked(true);
      })
      .catch(() => navigate('/'));
  }, [token]);

  if (!authChecked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        Verifying access...
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
    { key: 'owner_id', label: 'Owner ID' },
    { key: 'member_count', label: 'Members', render: (r: Guild) => r.member_count?.toLocaleString() ?? '—' },
    { key: 'active', label: 'Active', render: (r: Guild) => r.active ? <span style={{ color: '#4ade80' }}>Yes</span> : <span style={{ color: '#f87171' }}>No</span> },
    { key: 'subscription_tier', label: 'Tier', render: (r: Guild) => <span style={{ color: TIER_COLORS[r.subscription_tier] ?? 'inherit', fontWeight: 600, textTransform: 'capitalize' }}>{r.subscription_tier?.replace(/_/g, ' ') ?? '—'}</span> },
    { key: 'joined_at', label: 'Date Joined', render: (r: Guild) => r.joined_at ? new Date(r.joined_at).toLocaleDateString() : '—' },
    { key: 'settings', label: 'Settings', render: (r: Guild) => <SettingsCell json={r.settings} /> },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Nav */}
      <nav style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)', padding: '12px 0' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/images/acosmibot_website-logo.png" alt="Acosmibot" style={{ height: 32 }} />
          </a>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>/</span>
          <span style={{ fontWeight: 600, color: '#f59e0b' }}>Admin</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {user?.username}
          </span>
        </div>
      </nav>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ marginBottom: 8 }}>Admin Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>Site-wide oversight</p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border-light)', paddingBottom: 0 }}>
          {(['signins', 'servers', 'rag', 'botstats', 'ai', 'economy'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 20px',
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '2px solid #5865F2' : '2px solid transparent',
                color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: tab === t ? 600 : 400,
                cursor: 'pointer',
                fontSize: '0.95rem',
                marginBottom: -1,
              }}
            >
              {t === 'signins' ? 'Sign-In Log' : t === 'servers' ? 'Servers' : t === 'rag' ? 'RAG Docs' : t === 'botstats' ? 'Bot Stats' : t === 'ai' ? 'AI Settings' : 'Economy'}
            </button>
          ))}
        </div>

        {/* Sign-In Log */}
        {tab === 'signins' && (
          <div className="card p-4">
            <h3 className="mb-4">Sign-In Log</h3>
            {signinResult.loading ? (
              <p className="text-muted">Loading...</p>
            ) : signinResult.error ? (
              <p style={{ color: '#f87171' }}>Error: {signinResult.error}</p>
            ) : (
              <SortableTable rows={signinResult.data?.logs ?? []} columns={signinColumns} />
            )}
          </div>
        )}

        {/* Servers */}
        {tab === 'servers' && (
          <div className="card p-4">
            <h3 className="mb-4">Servers</h3>
            {guildsResult.loading ? (
              <p className="text-muted">Loading...</p>
            ) : guildsResult.error ? (
              <p style={{ color: '#f87171' }}>Error: {guildsResult.error}</p>
            ) : (
              <SortableTable rows={guildsResult.data?.guilds ?? []} columns={guildColumns} />
            )}
          </div>
        )}

        {/* RAG Docs */}
        {tab === 'rag' && <RagTab token={token} />}

        {/* Bot Stats */}
        {tab === 'botstats' && (
          <div className="card p-4">
            <h3 className="mb-4">Bot Stats</h3>
            <BotStatsTab token={token} />
          </div>
        )}

        {/* AI Settings */}
        {tab === 'ai' && (
          <div className="card p-4">
            <AiSettingsTab />
          </div>
        )}

        {/* Economy Settings */}
        {tab === 'economy' && (
          <div className="card p-4">
            <EconomySettingsTab />
          </div>
        )}
      </div>
    </div>
  );
};
