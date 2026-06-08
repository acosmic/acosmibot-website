import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { itemsApi, type ItemEffect } from '@/api/items';

/**
 * Owner-only inventory + active boosts on the profile page. Items are acquired
 * and used from Discord (`/shop`, `/buy`, `/use`); this is the read-only view.
 */

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

const effectLabel = (e: ItemEffect): string => {
  const type = (e.type || '').replace(/_/g, ' ');
  const where = e.scope === 'global' ? 'every server' : 'this server';
  const dur = e.duration_seconds ? `${Math.round(e.duration_seconds / 3600)}h` : 'permanent';
  return `+${Math.round((e.magnitude ?? 0) * 100)}% ${type} · ${where} · ${dur}`;
};

const timeLeft = (iso: string | null): string => {
  if (!iso) return 'permanent';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
};

export const InventorySection: React.FC = () => {
  const inventory = useQuery({ queryKey: ['items', 'inventory'], queryFn: () => itemsApi.getInventory() });
  const active = useQuery({ queryKey: ['items', 'active-effects'], queryFn: () => itemsApi.getActiveEffects() });

  const items = inventory.data?.items ?? [];
  const effects = active.data?.effects ?? [];

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ color: 'var(--text-primary)', marginBottom: 12 }}>🎒 Inventory</h3>

      {/* Active boosts */}
      {effects.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {effects.map((e) => (
            <span key={e.id} style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border-light)',
              borderRadius: 999, padding: '4px 12px', fontSize: '0.8rem', color: 'var(--text-primary)',
            }}>
              ⚡ +{Math.round((e.magnitude ?? 0) * 100)}% {(e.effect_type || '').replace(/_/g, ' ')}
              <span style={{ color: 'var(--text-muted)' }}> · {timeLeft(e.expires_at)}</span>
            </span>
          ))}
        </div>
      )}

      {inventory.isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : inventory.error ? (
        <p style={{ color: '#f87171' }}>Couldn't load your inventory.</p>
      ) : items.length === 0 ? (
        <p className="text-muted">
          Your inventory is empty. Buy items with <code>/shop</code> and <code>/buy</code> in Discord.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {items.map((it) => (
            <div key={it.item_id} style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border-light)',
              borderLeft: `3px solid ${RARITY_COLORS[it.rarity] ?? 'var(--border-light)'}`,
              borderRadius: 10, padding: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>{it.icon}</span>
                <strong style={{ color: 'var(--text-primary)' }}>{it.name}</strong>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.85rem' }}>×{it.quantity}</span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 6 }}>
                {(it.effects ?? []).map((e, i) => <div key={i}>{effectLabel(e)}</div>)}
                {(!it.effects || it.effects.length === 0) && (it.description || '—')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
