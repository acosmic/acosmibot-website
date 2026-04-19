import React, { useState, useMemo } from 'react';

interface Giveaway {
  id: number;
  prize: string;
  description?: string;
  end_time: string;
  entry_count: number;
  winner_id?: string;
  winner_name?: string;
  config?: Record<string, any>;
}

interface Props {
  giveaways: Giveaway[];
}

const PAGE_SIZE = 20;

type SortKey = 'date' | 'prize' | 'winner';
type SortDir = 'asc' | 'desc';

export const RecentGiveaways: React.FC<Props> = ({ giveaways }) => {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return giveaways.filter(g => {
      if (!q) return true;
      return (
        g.prize.toLowerCase().includes(q) ||
        (g.winner_name ?? '').toLowerCase().includes(q) ||
        (g.winner_id ?? '').includes(q)
      );
    });
  }, [giveaways, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') {
        cmp = new Date(a.end_time).getTime() - new Date(b.end_time).getTime();
      } else if (sortKey === 'prize') {
        cmp = a.prize.localeCompare(b.prize);
      } else if (sortKey === 'winner') {
        const aw = a.winner_name ?? a.winner_id ?? '';
        const bw = b.winner_name ?? b.winner_id ?? '';
        cmp = aw.localeCompare(bw);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  };

  const onSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const SortBtn: React.FC<{ k: SortKey; label: string }> = ({ k, label }) => (
    <button
      className="btn btn-sm"
      onClick={() => toggleSort(k)}
      style={{
        background: sortKey === k ? 'var(--accent-color, #0dcaf0)' : 'var(--bg-tertiary)',
        color: sortKey === k ? '#000' : 'var(--text-muted)',
        border: 'none',
        borderRadius: 6,
        padding: '3px 10px',
        fontSize: '0.78rem',
        fontWeight: sortKey === k ? 600 : 400,
      }}
    >
      {label} {sortKey === k ? (sortDir === 'desc' ? '↓' : '↑') : ''}
    </button>
  );

  return (
    <div>
      {/* Controls */}
      <div className="d-flex gap-2 flex-wrap align-items-center mb-3">
        <input
          type="text"
          className="form-control form-control-sm"
          placeholder="Search prize, winner…"
          value={search}
          onChange={e => onSearch(e.target.value)}
          style={{ maxWidth: 240 }}
        />
        <div className="d-flex gap-1 ms-auto align-items-center">
          <span className="text-muted small me-1">Sort:</span>
          <SortBtn k="date" label="Date" />
          <SortBtn k="prize" label="Prize" />
          <SortBtn k="winner" label="Winner" />
        </div>
      </div>

      {/* Count */}
      {search && (
        <div className="text-muted small mb-2">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Rows */}
      {paginated.length === 0 ? (
        <p className="text-muted small">No giveaways found.</p>
      ) : (
        <div className="d-flex flex-column gap-2">
          {paginated.map(g => {
            const isOpen = expandedId === g.id;
            const winnerLabel = g.winner_name ?? null;
            const hasWinner = !!g.winner_id && g.winner_id !== '0';
            const date = new Date(g.end_time);

            return (
              <div
                key={g.id}
                className="rounded"
                style={{ background: 'var(--bg-tertiary)', overflow: 'hidden' }}
              >
                {/* Compact row */}
                <button
                  className="w-100 text-start border-0 p-3"
                  style={{ background: 'transparent', cursor: 'pointer' }}
                  onClick={() => setExpandedId(isOpen ? null : g.id)}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-semibold" style={{ fontSize: '0.95rem' }}>{g.prize}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </div>
                  <div className="d-flex gap-3 mt-1 flex-wrap" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <span>🎟️ {(g.entry_count || 0).toLocaleString()} entries</span>
                    {hasWinner
                      ? <span>🏆 {winnerLabel ?? g.winner_id}</span>
                      : <span style={{ color: 'var(--text-muted)' }}>No winner</span>
                    }
                    <span>📅 {date.toLocaleDateString()}</span>
                  </div>
                </button>

                {/* Expanded details */}
                {isOpen && (
                  <div
                    className="px-3 pb-3"
                    style={{ borderTop: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}
                  >
                    <div className="pt-3 d-flex flex-column gap-2" style={{ fontSize: '0.85rem' }}>
                      {hasWinner && (
                        <div>
                          <span className="text-muted">Winner</span>
                          <div className="fw-semibold mt-1">
                            {winnerLabel && <span>{winnerLabel}</span>}
                            <span className="text-muted ms-2" style={{ fontSize: '0.78rem', fontFamily: 'monospace' }}>
                              {g.winner_id}
                            </span>
                          </div>
                        </div>
                      )}
                      {g.description && (
                        <div>
                          <span className="text-muted">Description</span>
                          <div className="mt-1">{g.description}</div>
                        </div>
                      )}
                      <div className="d-flex gap-4 flex-wrap">
                        <div>
                          <span className="text-muted d-block">Ended</span>
                          <span>{date.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted d-block">Entries</span>
                          <span>{(g.entry_count || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-center align-items-center gap-2 mt-3">
          <button
            className="btn btn-sm"
            style={{ background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-muted)' }}
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            ←
          </button>
          <span className="text-muted small">Page {page} of {totalPages}</span>
          <button
            className="btn btn-sm"
            style={{ background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-muted)' }}
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
};
