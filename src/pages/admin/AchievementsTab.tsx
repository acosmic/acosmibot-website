import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminApi,
  type AdminAchievement,
  type AdminAchievementInput,
  type AdminCosmeticOption,
  type AdminItemOption,
} from '@/api/admin';

/**
 * Admin: achievements management. Create brand-new achievements and configure
 * both their requirement (metric + threshold, or an event-type granted by the
 * bot) and their reward (bank credits + an optional cosmetic, incl. the OG card).
 * Existing achievements can be edited per-row or deleted.
 */

const CATEGORIES = ['leveling', 'social', 'economy', 'games', 'special'];
const TIERS = ['bronze', 'silver', 'gold', 'legendary'];

const TIER_COLORS: Record<string, string> = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
  legendary: '#a855f7',
};

const CATEGORY_META: Record<string, string> = {
  leveling: 'Progression achievements based on level, XP, and message activity.',
  social: 'Community participation and relationship achievements.',
  economy: 'Currency, shop, and banking achievements.',
  games: 'Achievements earned through game and minigame activity.',
  special: 'Manual, event-driven, seasonal, or otherwise unique achievements.',
};

const categoryDescription = (category: string) =>
  CATEGORY_META[category] ?? 'Achievements grouped by their configured category.';

const categoryOrder = (category: string) => {
  const index = CATEGORIES.indexOf(category);
  return index === -1 ? CATEGORIES.length : index;
};

const summarizeRequirement = (a: AdminAchievement) => (
  a.condition_type === 'event'
    ? 'Bot-granted event'
    : `${a.metric ?? 'metric'} >= ${a.threshold}`
);

const summarizeReward = (a: AdminAchievement) => {
  const rewards = [];
  if (a.reward_credits) rewards.push(`${a.reward_credits.toLocaleString()} credits`);
  if (a.reward_cosmetic_id != null) rewards.push('cosmetic');
  if (a.reward_item_id != null) rewards.push('item');
  return rewards.length ? rewards.join(' + ') : 'No reward';
};

type Draft = AdminAchievementInput;

const emptyDraft = (): Draft => ({
  key: '',
  name: '',
  description: '',
  category: 'special',
  icon: '🏆',
  tier: 'bronze',
  condition_type: 'metric',
  metric: 'global_level',
  threshold: 0,
  reward_credits: 0,
  reward_cosmetic_id: null,
  reward_item_id: null,
  is_secret: false,
  is_available: true,
  sort_order: 0,
  available_until: null,
});

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-light)',
  color: 'var(--text-primary)',
};

/** Shared editor body used by both the create form and the per-row edit. */
const AchievementFields: React.FC<{
  draft: Draft;
  onChange: (patch: Draft) => void;
  metrics: string[];
  cosmetics: AdminCosmeticOption[];
  items: AdminItemOption[];
  showKey?: boolean;
}> = ({ draft, onChange, metrics, cosmetics, items, showKey }) => {
  const isMetric = (draft.condition_type ?? 'metric') === 'metric';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
      {showKey && (
        <Field label="Key (letters, numbers, _ -)">
          <input className="form-control" style={inputStyle} value={draft.key ?? ''}
            placeholder="e.g. level_25"
            onChange={(e) => onChange({ ...draft, key: e.target.value })} />
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
      <Field label="Category">
        <select className="form-select" style={inputStyle} value={draft.category ?? 'special'}
          onChange={(e) => onChange({ ...draft, category: e.target.value })}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Tier">
        <select className="form-select" style={inputStyle} value={draft.tier ?? 'bronze'}
          onChange={(e) => onChange({ ...draft, tier: e.target.value as Draft['tier'] })}>
          {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Requirement">
        <select className="form-select" style={inputStyle} value={draft.condition_type ?? 'metric'}
          onChange={(e) => onChange({ ...draft, condition_type: e.target.value as Draft['condition_type'] })}>
          <option value="metric">Metric threshold</option>
          <option value="event">Event (bot-granted)</option>
        </select>
      </Field>
      {isMetric && (
        <>
          <Field label="Metric">
            <select className="form-select" style={inputStyle} value={draft.metric ?? metrics[0]}
              onChange={(e) => onChange({ ...draft, metric: e.target.value })}>
              {metrics.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Threshold">
            <input type="number" min={0} className="form-control" style={inputStyle} value={draft.threshold ?? 0}
              onChange={(e) => onChange({ ...draft, threshold: Number(e.target.value) })} />
          </Field>
        </>
      )}
      <Field label="Reward credits">
        <input type="number" min={0} className="form-control" style={inputStyle} value={draft.reward_credits ?? 0}
          onChange={(e) => onChange({ ...draft, reward_credits: Number(e.target.value) })} />
      </Field>
      <Field label="Reward cosmetic">
        <select className="form-select" style={inputStyle}
          value={draft.reward_cosmetic_id == null ? '' : String(draft.reward_cosmetic_id)}
          onChange={(e) => onChange({ ...draft, reward_cosmetic_id: e.target.value ? Number(e.target.value) : null })}>
          <option value="">None</option>
          {cosmetics.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
        </select>
      </Field>
      <Field label="Reward item">
        <select className="form-select" style={inputStyle}
          value={draft.reward_item_id == null ? '' : String(draft.reward_item_id)}
          onChange={(e) => onChange({ ...draft, reward_item_id: e.target.value ? Number(e.target.value) : null })}>
          <option value="">None</option>
          {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
        </select>
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
      <Field label="Description">
        <input className="form-control" style={inputStyle} value={draft.description ?? ''}
          onChange={(e) => onChange({ ...draft, description: e.target.value })} />
      </Field>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, paddingBottom: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!draft.is_available} style={{ accentColor: 'var(--primary-color)' }}
            onChange={(e) => onChange({ ...draft, is_available: e.target.checked })} />
          Available
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!draft.is_secret} style={{ accentColor: 'var(--primary-color)' }}
            onChange={(e) => onChange({ ...draft, is_secret: e.target.checked })} />
          Secret
        </label>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
    {label}
    {children}
  </label>
);

export const AchievementsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'achievements'],
    queryFn: () => adminApi.getAchievements(),
  });

  const metrics = query.data?.metrics ?? [];
  const cosmetics = query.data?.cosmetics ?? [];
  const items = query.data?.items ?? [];

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [createDraft, setCreateDraft] = useState<Draft>(emptyDraft());
  const [showCreate, setShowCreate] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!query.data?.data) return;
    const next: Record<string, Draft> = {};
    for (const a of query.data.data) next[a.key] = { ...a };
    setDrafts(next);
  }, [query.data]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'achievements'] });

  const createMutation = useMutation({
    mutationFn: (draft: Draft) => adminApi.createAchievement(draft),
    onSuccess: () => { setShowCreate(false); setCreateDraft(emptyDraft()); invalidate(); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ key, draft }: { key: string; draft: Draft }) => adminApi.updateAchievement(key, draft),
    onSuccess: (_r, vars) => { setSavedKey(vars.key); invalidate(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (key: string) => adminApi.deleteAchievement(key),
    onSuccess: invalidate,
  });

  const grouped = useMemo(() => {
    const map: Record<string, AdminAchievement[]> = {};
    for (const a of query.data?.data ?? []) (map[a.category] ??= []).push(a);
    return map;
  }, [query.data]);

  if (query.isLoading) return <p className="text-muted">Loading...</p>;
  if (query.error) return <p style={{ color: '#f87171' }}>Error: {String(query.error)}</p>;

  const isDirty = (a: AdminAchievement) => {
    const d = drafts[a.key];
    if (!d) return false;
    return (Object.keys(a) as (keyof AdminAchievement)[]).some((k) => (d as any)[k] !== a[k]);
  };

  const anyError = createMutation.error || updateMutation.error || deleteMutation.error;
  const toggleExpanded = (key: string) => {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3 className="mb-0">Achievements</h3>
        {!showCreate && (
          <button type="button" className="btn btn-sm primary" onClick={() => setShowCreate(true)}>
            ＋ New Achievement
          </button>
        )}
      </div>
      <p className="text-muted mb-4">
        Define a requirement (a metric threshold, or an event the bot grants) and a reward
        (bank credits and/or a cosmetic). Unlocking awards the badge immediately; the reward
        is delivered via a claimable notification.
      </p>

      {showCreate && (
        <div className="admin-config-panel" style={{ marginBottom: 24 }}>
          <div className="admin-config-panel-header">
            <div>
              <h5 style={{ color: 'var(--text-primary)', margin: 0 }}>New Achievement</h5>
              <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '0.82rem' }}>
                Define the unlock requirement and reward before adding it to the catalog.
              </p>
            </div>
            <button type="button" className="btn btn-sm" onClick={() => { setShowCreate(false); setCreateDraft(emptyDraft()); }}>
              Cancel
            </button>
          </div>
          <AchievementFields draft={createDraft} onChange={setCreateDraft} metrics={metrics} cosmetics={cosmetics} items={items} showKey />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn btn-sm primary"
              disabled={!createDraft.key || !createDraft.name || createMutation.isPending}
              onClick={() => createMutation.mutate(createDraft)}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {Object.keys(grouped).sort((a, b) => categoryOrder(a) - categoryOrder(b) || a.localeCompare(b)).map((category) => (
        <section key={category} className="admin-catalog-section">
          <div className="admin-catalog-section-header">
            <div>
              <h5>{category}</h5>
              <p>{categoryDescription(category)}</p>
            </div>
            <span>{grouped[category].length} {grouped[category].length === 1 ? 'achievement' : 'achievements'}</span>
          </div>
          <div style={{ display: 'grid', gap: 14 }}>
            {grouped[category].map((a) => {
              const d = drafts[a.key] ?? { ...a };
              const dirty = isDirty(a);
              const expanded = expandedKeys.has(a.key) || dirty;
              return (
                <div key={a.key} className="admin-catalog-card">
                  <button type="button" className="admin-catalog-row" onClick={() => toggleExpanded(a.key)}
                    aria-expanded={expanded}>
                    <span className="admin-row-toggle">{expanded ? '−' : '+'}</span>
                    <span className="admin-row-icon">{a.icon}</span>
                    <span className="admin-row-main">
                      <span className="admin-row-title">
                        <strong>{a.name}</strong>
                        <span style={{ color: TIER_COLORS[a.tier] }}>{a.tier}</span>
                        {!a.is_available && <span className="admin-status-danger">Disabled</span>}
                        {a.is_secret && <span className="admin-status-muted">Secret</span>}
                        {dirty && <span className="admin-status-warning">Unsaved</span>}
                      </span>
                      <span className="admin-row-subtitle">
                        <code>{a.key}</code>
                        <span>{summarizeRequirement(a)}</span>
                        <span>{summarizeReward(a)}</span>
                      </span>
                    </span>
                    <span className="admin-row-action">{expanded ? 'Hide config' : 'Configure'}</span>
                  </button>
                  {expanded && (
                    <div className="admin-catalog-config">
                      <AchievementFields draft={d} onChange={(patch) => setDrafts((s) => ({ ...s, [a.key]: patch }))} metrics={metrics} cosmetics={cosmetics} items={items} showKey />
                      {d.key !== a.key && (
                        <p style={{ color: '#fbbf24', fontSize: '0.78rem', marginTop: 8, marginBottom: 0 }}>
                          Renaming key <code>{a.key}</code> → <code>{d.key}</code> on Save. This cascades to existing unlocks and rewards.
                          {a.key === 'og_member' && ' Note: the bot grants OG by the key "og_member" — renaming it will stop OG grants until the bot code is updated.'}
                        </p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
                        {savedKey === a.key && !dirty && !updateMutation.isPending && (
                          <span style={{ color: '#4ade80', fontSize: '0.82rem' }}>Saved</span>
                        )}
                        <button type="button" className="btn btn-sm"
                          style={{ color: '#f87171', border: '1px solid #f87171', background: 'transparent' }}
                          disabled={deleteMutation.isPending}
                          onClick={() => { if (confirm(`Delete achievement "${a.name}"?`)) deleteMutation.mutate(a.key); }}>
                          Delete
                        </button>
                        <button type="button" className="btn btn-sm primary"
                          disabled={!dirty || updateMutation.isPending}
                          onClick={() => updateMutation.mutate({ key: a.key, draft: { ...d, new_key: d.key } })}>
                          {updateMutation.isPending && updateMutation.variables?.key === a.key ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {anyError && <p style={{ color: '#f87171' }}>Error: {String(anyError)}</p>}
    </div>
  );
};
