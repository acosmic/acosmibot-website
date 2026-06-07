import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type AdminCosmetic } from '@/api/admin';

/**
 * Admin: rank-card cosmetics catalog. Lets an admin retune the price and
 * availability of each cosmetic (the Card Studio shop reads `is_available`).
 * Editing is per-row: change price / availability, then Save that row.
 */

type Draft = { price: number; is_available: boolean };

const TYPE_LABELS: Record<AdminCosmetic['type'], string> = {
  accent: 'Accent',
  background: 'Background',
  ring: 'Avatar Ring',
};

const TYPE_ORDER: AdminCosmetic['type'][] = ['accent', 'background', 'ring'];

const swatchStyle = (c: AdminCosmetic): React.CSSProperties =>
  c.type === 'background' && /gradient/i.test(c.value)
    ? { background: c.value }
    : { backgroundColor: c.value };

export const CosmeticsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'cosmetics'],
    queryFn: () => adminApi.getCosmetics(),
  });

  // Per-row working copy of the editable fields, keyed by cosmetic id.
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [savedId, setSavedId] = useState<number | null>(null);

  useEffect(() => {
    if (!query.data?.data) return;
    const next: Record<number, Draft> = {};
    for (const c of query.data.data) next[c.id] = { price: c.price, is_available: c.is_available };
    setDrafts(next);
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: ({ id, draft }: { id: number; draft: Draft }) => adminApi.updateCosmetic(id, draft),
    onSuccess: (_res, vars) => {
      setSavedId(vars.id);
      queryClient.invalidateQueries({ queryKey: ['admin', 'cosmetics'] });
    },
  });

  const byType = useMemo(() => {
    const map: Record<AdminCosmetic['type'], AdminCosmetic[]> = { accent: [], background: [], ring: [] };
    for (const c of query.data?.data ?? []) map[c.type].push(c);
    return map;
  }, [query.data]);

  if (query.isLoading) return <p className="text-muted">Loading...</p>;
  if (query.error) return <p style={{ color: '#f87171' }}>Error: {String(query.error)}</p>;

  const isDirty = (c: AdminCosmetic) => {
    const d = drafts[c.id];
    return d && (d.price !== c.price || d.is_available !== c.is_available);
  };

  const setDraft = (id: number, patch: Partial<Draft>) =>
    setDrafts((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  return (
    <div>
      <h3 className="mb-1">Cosmetics</h3>
      <p className="text-muted mb-4">
        Set the price and availability of rank-card cosmetics sold in Card Studio.
        Unavailable items are hidden from the shop but kept for anyone who already owns them.
      </p>

      {TYPE_ORDER.map((type) => (
        <div key={type} style={{ marginBottom: 28 }}>
          <h5 style={{ color: 'var(--text-primary)', marginBottom: 12 }}>{TYPE_LABELS[type]}</h5>
          <div style={{ display: 'grid', gap: 10 }}>
            {byType[type].map((c) => {
              const d = drafts[c.id] ?? { price: c.price, is_available: c.is_available };
              return (
                <div
                  key={c.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-light)',
                    borderRadius: 10, padding: '10px 14px',
                  }}
                >
                  <div style={{ ...swatchStyle(c), width: 56, height: 36, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />

                  <div style={{ minWidth: 140 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                    <div className="text-muted" style={{ fontSize: '0.78rem', textTransform: 'capitalize' }}>{c.rarity}</div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Price
                    <input
                      type="number"
                      min={0}
                      value={d.price}
                      onChange={(e) => setDraft(c.id, { price: Number(e.target.value) })}
                      className="form-control"
                      style={{ width: 120, background: 'var(--bg-primary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                    />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={d.is_available}
                      onChange={(e) => setDraft(c.id, { is_available: e.target.checked })}
                      style={{ width: 16, height: 16, accentColor: 'var(--primary-color)' }}
                    />
                    Available
                  </label>

                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {savedId === c.id && !isDirty(c) && !mutation.isPending && (
                      <span style={{ color: '#4ade80', fontSize: '0.82rem' }}>Saved</span>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm primary"
                      disabled={!isDirty(c) || mutation.isPending}
                      onClick={() => mutation.mutate({ id: c.id, draft: d })}
                    >
                      {mutation.isPending && mutation.variables?.id === c.id ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              );
            })}
            {byType[type].length === 0 && <p className="text-muted small mb-0">No items.</p>}
          </div>
        </div>
      ))}

      {mutation.error && <p style={{ color: '#f87171' }}>Error: {String(mutation.error)}</p>}
    </div>
  );
};
