import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminApi,
  type AdminItem,
  type AdminItemInput,
  type AdminItemEffect,
} from '@/api/admin';

/**
 * Admin: items management. Create/edit catalog items, configure the effects
 * they grant (xp/credit boosts, global or per-server, timed or permanent),
 * pricing & flags (giftable/tradeable/purchasable), and grant items to users.
 */

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

type Draft = AdminItemInput;

const emptyDraft = (): Draft => ({
  slug: '',
  name: '',
  description: '',
  icon: '🎁',
  rarity: 'common',
  item_type: 'consumable',
  effects: [],
  is_consumable: true,
  max_stack: 99,
  is_giftable: false,
  is_tradeable: false,
  is_equippable: false,
  equip_slot: null,
  price_credits: null,
  is_purchasable: false,
  is_available: false,
  sort_order: 0,
  available_until: null,
});

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-light)',
  color: 'var(--text-primary)',
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
    {label}
    {children}
  </label>
);

const ITEM_TYPE_META: Record<string, { title: string; description: string }> = {
  consumable: {
    title: 'Consumables',
    description: 'One-use items that apply a timed or permanent effect when consumed.',
  },
  equipment: {
    title: 'Equipment',
    description: 'Items users equip into a slot for ongoing bonuses or cosmetic loadouts.',
  },
  permanent: {
    title: 'Permanent',
    description: 'Persistent unlocks or account-level items that are not consumed.',
  },
};

const typeMeta = (type: string) => ITEM_TYPE_META[type] ?? {
  title: `${type.charAt(0).toUpperCase()}${type.slice(1)} Items`,
  description: 'Catalog items grouped by their configured item type.',
};

const typeOrder = (type: string) => {
  const ordered = ['consumable', 'equipment', 'permanent'];
  const index = ordered.indexOf(type);
  return index === -1 ? ordered.length : index;
};

const formatCredits = (credits: number | null | undefined) =>
  credits == null ? 'Not for sale' : `${credits.toLocaleString()} credits`;

const summarizeEffects = (effects: AdminItemEffect[] | undefined) => {
  if (!effects?.length) return 'No effects';
  return effects.map((e) => {
    const magnitude = `${Math.round((e.magnitude ?? 0) * 100)}%`;
    const scope = e.scope === 'global' ? 'all servers' : 'this server';
    const duration = e.duration_seconds == null ? 'permanent' : `${Math.round(e.duration_seconds / 3600)}h`;
    return `${magnitude} ${e.type.replace(/_/g, ' ')} · ${scope} · ${duration}`;
  }).join(', ');
};

/** Editor for the effects[] array of an item. Magnitude is shown as a percent. */
const EffectsEditor: React.FC<{
  effects: AdminItemEffect[];
  effectTypes: string[];
  effectScopes: string[];
  onChange: (next: AdminItemEffect[]) => void;
}> = ({ effects, effectTypes, effectScopes, onChange }) => {
  const update = (i: number, patch: Partial<AdminItemEffect>) =>
    onChange(effects.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const remove = (i: number) => onChange(effects.filter((_, idx) => idx !== i));
  const add = () =>
    onChange([
      ...effects,
      { type: effectTypes[0] ?? 'xp_boost', scope: 'global', magnitude: 0.25, duration_seconds: 86400 },
    ]);

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: 6 }}>Effects</div>
      {effects.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 8px' }}>
          No effects — this item does nothing when used. Add one below.
        </p>
      )}
      {effects.map((e, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          <select className="form-select form-select-sm" style={{ ...inputStyle, maxWidth: 160 }} value={e.type}
            onChange={(ev) => update(i, { type: ev.target.value })}>
            {effectTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="form-select form-select-sm" style={{ ...inputStyle, maxWidth: 120 }} value={e.scope}
            onChange={(ev) => update(i, { scope: ev.target.value as AdminItemEffect['scope'] })}>
            {effectScopes.map((s) => <option key={s} value={s}>{s === 'global' ? 'every server' : 'this server'}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" className="form-control form-control-sm" style={{ ...inputStyle, maxWidth: 80 }}
              value={Math.round((e.magnitude ?? 0) * 100)}
              onChange={(ev) => update(i, { magnitude: Number(ev.target.value) / 100 })} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" className="form-control form-control-sm" style={{ ...inputStyle, maxWidth: 90 }}
              placeholder="permanent"
              value={e.duration_seconds == null ? '' : e.duration_seconds / 3600}
              onChange={(ev) => update(i, { duration_seconds: ev.target.value ? Number(ev.target.value) * 3600 : null })} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>hrs</span>
          </div>
          <button type="button" className="btn btn-sm" style={{ color: '#f87171', border: '1px solid #f87171', background: 'transparent' }}
            onClick={() => remove(i)}>×</button>
        </div>
      ))}
      <button type="button" className="btn btn-sm" style={{ color: 'var(--text-muted)', border: '1px solid var(--border-light)', background: 'transparent' }}
        onClick={add}>＋ Add effect</button>
    </div>
  );
};

/** Shared editor body used by both the create form and per-row edit. */
const ItemFields: React.FC<{
  draft: Draft;
  onChange: (patch: Draft) => void;
  effectTypes: string[];
  effectScopes: string[];
  rarities: string[];
  itemTypes: string[];
  showSlug?: boolean;
}> = ({ draft, onChange, effectTypes, effectScopes, rarities, itemTypes, showSlug }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
    {showSlug && (
      <Field label="Slug (letters, numbers, _ -)">
        <input className="form-control" style={inputStyle} value={draft.slug ?? ''} placeholder="e.g. xp_boost_24h"
          onChange={(e) => onChange({ ...draft, slug: e.target.value })} />
      </Field>
    )}
    <Field label="Name">
      <input className="form-control" style={inputStyle} value={draft.name ?? ''}
        onChange={(e) => onChange({ ...draft, name: e.target.value })} />
    </Field>
    <Field label="Icon (emoji)">
      <input className="form-control" style={inputStyle} value={draft.icon ?? ''}
        onChange={(e) => onChange({ ...draft, icon: e.target.value })} />
    </Field>
    <Field label="Rarity">
      <select className="form-select" style={inputStyle} value={draft.rarity ?? 'common'}
        onChange={(e) => onChange({ ...draft, rarity: e.target.value as Draft['rarity'] })}>
        {rarities.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
    </Field>
    <Field label="Type">
      <select className="form-select" style={inputStyle} value={draft.item_type ?? 'consumable'}
        onChange={(e) => onChange({ ...draft, item_type: e.target.value })}>
        {itemTypes.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </Field>
    <Field label="Price (credits, blank = not for sale)">
      <input type="number" min={0} className="form-control" style={inputStyle}
        value={draft.price_credits == null ? '' : draft.price_credits}
        onChange={(e) => onChange({ ...draft, price_credits: e.target.value ? Number(e.target.value) : null })} />
    </Field>
    <Field label="Max stack">
      <input type="number" min={1} className="form-control" style={inputStyle} value={draft.max_stack ?? 99}
        onChange={(e) => onChange({ ...draft, max_stack: Number(e.target.value) })} />
    </Field>
    <Field label="Sort order">
      <input type="number" className="form-control" style={inputStyle} value={draft.sort_order ?? 0}
        onChange={(e) => onChange({ ...draft, sort_order: Number(e.target.value) })} />
    </Field>
    <Field label="Available until (optional)">
      <input className="form-control" style={inputStyle} placeholder="YYYY-MM-DD or blank"
        value={draft.available_until ?? ''}
        onChange={(e) => onChange({ ...draft, available_until: e.target.value || null })} />
    </Field>
    <Field label="Equip slot (if equippable, e.g. amulet)">
      <input className="form-control" style={inputStyle} placeholder="blank = not equippable"
        value={draft.equip_slot ?? ''}
        onChange={(e) => onChange({ ...draft, equip_slot: e.target.value || null })} />
    </Field>
    <Field label="Description">
      <input className="form-control" style={inputStyle} value={draft.description ?? ''}
        onChange={(e) => onChange({ ...draft, description: e.target.value })} />
    </Field>
    <EffectsEditor effects={draft.effects ?? []} effectTypes={effectTypes} effectScopes={effectScopes}
      onChange={(next) => onChange({ ...draft, effects: next })} />
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, paddingBottom: 6, flexWrap: 'wrap', gridColumn: '1 / -1' }}>
      {([
        ['is_available', 'Available'],
        ['is_purchasable', 'Purchasable'],
        ['is_consumable', 'Consumable'],
        ['is_equippable', 'Equippable'],
        ['is_giftable', 'Giftable'],
        ['is_tradeable', 'Tradeable'],
      ] as const).map(([key, label]) => (
        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!(draft as any)[key]} style={{ accentColor: 'var(--primary-color)' }}
            onChange={(e) => onChange({ ...draft, [key]: e.target.checked })} />
          {label}
        </label>
      ))}
    </div>
  </div>
);

export const ItemsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'items'], queryFn: () => adminApi.getItems() });

  const effectTypes = query.data?.effect_types ?? ['xp_boost', 'credit_boost'];
  const effectScopes = query.data?.effect_scopes ?? ['global', 'guild'];
  const rarities = query.data?.rarities ?? ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const itemTypes = query.data?.item_types ?? ['consumable', 'permanent'];

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [createDraft, setCreateDraft] = useState<Draft>(emptyDraft());
  const [showCreate, setShowCreate] = useState(false);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(() => new Set());

  // Grant tool state.
  const [grantUser, setGrantUser] = useState('');
  const [grantSlug, setGrantSlug] = useState('');
  const [grantQty, setGrantQty] = useState(1);
  const [grantMsg, setGrantMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!query.data?.data) return;
    const next: Record<string, Draft> = {};
    for (const it of query.data.data) next[it.slug] = { ...it };
    setDrafts(next);
  }, [query.data]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'items'] });

  const createMutation = useMutation({
    mutationFn: (draft: Draft) => adminApi.createItem(draft),
    onSuccess: () => { setShowCreate(false); setCreateDraft(emptyDraft()); invalidate(); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ slug, draft }: { slug: string; draft: Draft }) => adminApi.updateItem(slug, draft),
    onSuccess: (_r, vars) => { setSavedSlug(vars.slug); invalidate(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (slug: string) => adminApi.deleteItem(slug),
    onSuccess: invalidate,
  });
  const grantMutation = useMutation({
    mutationFn: () => adminApi.grantItem({ user_id: grantUser.trim(), slug: grantSlug.trim(), quantity: grantQty }),
    onSuccess: (r) => { setGrantMsg(r.message); setGrantUser(''); setGrantSlug(''); setGrantQty(1); },
    onError: (e) => setGrantMsg(String(e)),
  });

  const grouped = useMemo(() => {
    const map: Record<string, AdminItem[]> = {};
    for (const it of query.data?.data ?? []) (map[it.item_type] ??= []).push(it);
    return map;
  }, [query.data]);

  if (query.isLoading) return <p className="text-muted">Loading...</p>;
  if (query.error) return <p style={{ color: '#f87171' }}>Error: {String(query.error)}</p>;

  const isDirty = (it: AdminItem) => JSON.stringify(drafts[it.slug] ?? {}) !== JSON.stringify({ ...it });
  const anyError = createMutation.error || updateMutation.error || deleteMutation.error;
  const toggleExpanded = (slug: string) => {
    setExpandedSlugs((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3 className="mb-0">Items</h3>
        {!showCreate && (
          <button type="button" className="btn btn-sm primary" onClick={() => setShowCreate(true)}>
            ＋ New Item
          </button>
        )}
      </div>
      <p className="text-muted mb-4">
        Define what an item does via its effects (xp/credit boosts, every-server or one-server,
        timed or permanent), set pricing and flags, and grant items to users. Items default to
        <strong> not available</strong> — flip "Available" when ready.
      </p>

      {/* Grant tool */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 10, padding: 14, marginBottom: 24, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Field label="Grant to user ID">
          <input className="form-control form-control-sm" style={inputStyle} value={grantUser}
            onChange={(e) => setGrantUser(e.target.value)} placeholder="Discord user id" />
        </Field>
        <Field label="Item slug">
          <input className="form-control form-control-sm" style={inputStyle} value={grantSlug}
            onChange={(e) => setGrantSlug(e.target.value)} placeholder="e.g. xp_boost_24h" list="item-slugs" />
          <datalist id="item-slugs">
            {(query.data?.data ?? []).map((it) => <option key={it.slug} value={it.slug}>{it.name}</option>)}
          </datalist>
        </Field>
        <Field label="Qty">
          <input type="number" min={1} className="form-control form-control-sm" style={{ ...inputStyle, maxWidth: 80 }}
            value={grantQty} onChange={(e) => setGrantQty(Number(e.target.value))} />
        </Field>
        <button type="button" className="btn btn-sm primary"
          disabled={!grantUser.trim() || !grantSlug.trim() || grantMutation.isPending}
          onClick={() => { setGrantMsg(null); grantMutation.mutate(); }}>
          {grantMutation.isPending ? 'Granting...' : 'Grant'}
        </button>
        {grantMsg && <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{grantMsg}</span>}
      </div>

      {showCreate && (
        <div className="admin-config-panel" style={{ marginBottom: 24 }}>
          <div className="admin-config-panel-header">
            <div>
              <h5 style={{ color: 'var(--text-primary)', margin: 0 }}>New Item</h5>
              <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '0.82rem' }}>
                Draft the catalog entry here, then make it available after the configuration is ready.
              </p>
            </div>
            <button type="button" className="btn btn-sm" onClick={() => { setShowCreate(false); setCreateDraft(emptyDraft()); }}>
              Cancel
            </button>
          </div>
          <ItemFields draft={createDraft} onChange={setCreateDraft} effectTypes={effectTypes}
            effectScopes={effectScopes} rarities={rarities} itemTypes={itemTypes} showSlug />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn btn-sm primary"
              disabled={!createDraft.slug || !createDraft.name || createMutation.isPending}
              onClick={() => createMutation.mutate(createDraft)}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {Object.keys(grouped).sort((a, b) => typeOrder(a) - typeOrder(b) || a.localeCompare(b)).map((type) => {
        const meta = typeMeta(type);
        return (
        <section key={type} className="admin-catalog-section">
          <div className="admin-catalog-section-header">
            <div>
              <h5>{meta.title}</h5>
              <p>{meta.description}</p>
            </div>
            <span>{grouped[type].length} {grouped[type].length === 1 ? 'item' : 'items'}</span>
          </div>
          <div style={{ display: 'grid', gap: 14 }}>
            {grouped[type].map((it) => {
              const d = drafts[it.slug] ?? { ...it };
              const dirty = isDirty(it);
              const expanded = expandedSlugs.has(it.slug) || dirty;
              return (
                <div key={it.slug} className="admin-catalog-card">
                  <button type="button" className="admin-catalog-row" onClick={() => toggleExpanded(it.slug)}
                    aria-expanded={expanded}>
                    <span className="admin-row-toggle">{expanded ? '−' : '+'}</span>
                    <span className="admin-row-icon">{it.icon}</span>
                    <span className="admin-row-main">
                      <span className="admin-row-title">
                        <strong>{it.name}</strong>
                        <span style={{ color: RARITY_COLORS[it.rarity] }}>{it.rarity}</span>
                        {!it.is_available && <span className="admin-status-danger">Disabled</span>}
                        {dirty && <span className="admin-status-warning">Unsaved</span>}
                      </span>
                      <span className="admin-row-subtitle">
                        <code>{it.slug}</code>
                        <span>{formatCredits(it.price_credits)}</span>
                        <span>{summarizeEffects(it.effects)}</span>
                      </span>
                    </span>
                    <span className="admin-row-action">{expanded ? 'Hide config' : 'Configure'}</span>
                  </button>
                  {expanded && (
                    <div className="admin-catalog-config">
                      <ItemFields draft={d} onChange={(patch) => setDrafts((s) => ({ ...s, [it.slug]: patch }))}
                        effectTypes={effectTypes} effectScopes={effectScopes} rarities={rarities} itemTypes={itemTypes} showSlug />
                      {d.slug !== it.slug && (
                        <p style={{ color: '#fbbf24', fontSize: '0.78rem', marginTop: 8, marginBottom: 0 }}>
                          Renaming slug <code>{it.slug}</code> → <code>{d.slug}</code> on Save.
                        </p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
                        {savedSlug === it.slug && !dirty && !updateMutation.isPending && (
                          <span style={{ color: '#4ade80', fontSize: '0.82rem' }}>Saved</span>
                        )}
                        <button type="button" className="btn btn-sm"
                          style={{ color: '#f87171', border: '1px solid #f87171', background: 'transparent' }}
                          disabled={deleteMutation.isPending}
                          onClick={() => { if (confirm(`Delete item "${it.name}"?`)) deleteMutation.mutate(it.slug); }}>
                          Delete
                        </button>
                        <button type="button" className="btn btn-sm primary"
                          disabled={!dirty || updateMutation.isPending}
                          onClick={() => updateMutation.mutate({ slug: it.slug, draft: { ...d, new_slug: d.slug } })}>
                          {updateMutation.isPending && updateMutation.variables?.slug === it.slug ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      );})}

      {anyError && <p style={{ color: '#f87171' }}>Error: {String(anyError)}</p>}
    </div>
  );
};
