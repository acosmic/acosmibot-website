import React from 'react';
import { useParams } from 'react-router-dom';
import { FeatureToggle, LoadingSpinner, SaveBar } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';
import { PolymorphConfig, PolymorphMode } from '@/types/features';
import { usePolymorphConfig } from './usePolymorphConfig';

export const PolymorphPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { data, isLoading, save, isSaving, saveError } = usePolymorphConfig(guildId!);
  const { form, setForm, isDirty, resetForm } = useDirtyState<PolymorphConfig>(data);

  if (isLoading) return <LoadingSpinner />;
  if (!form) return <div>No data found.</div>;

  const updateNumber = (field: 'cost' | 'duration_minutes', value: string) => {
    const parsed = parseInt(value, 10);
    setForm({ [field]: Number.isFinite(parsed) ? parsed : 0 });
  };

  const setMode = (mode: PolymorphMode) => {
    setForm({ mode });
  };

  return (
    <div className="feature-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>Polymorph</h1>
        <p>Let members spend credits to temporarily rename someone.</p>
      </div>

      <FeatureToggle
        enabled={form.enabled}
        onChange={(v) => setForm({ enabled: v })}
        description="Enable the /polymorph command in this server."
      />

      <div className="card p-4 mb-4">
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18 }}>Cost and Duration</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div>
            <label className="form-label mb-2 d-block">Credit Cost</label>
            <input
              className="form-control"
              type="number"
              min={0}
              value={form.cost}
              onChange={(e) => updateNumber('cost', e.target.value)}
            />
            <p className="text-muted small mt-2 mb-0">Credits charged for each successful polymorph.</p>
          </div>
          <div>
            <label className="form-label mb-2 d-block">Duration Minutes</label>
            <input
              className="form-control"
              type="number"
              min={1}
              value={form.duration_minutes}
              onChange={(e) => updateNumber('duration_minutes', e.target.value)}
            />
            <p className="text-muted small mt-2 mb-0">Nickname is restored after this many minutes.</p>
          </div>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18 }}>Nickname Mode</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className="btn"
            style={{
              textAlign: 'left',
              padding: 16,
              border: `1px solid ${form.mode === 'manual' ? 'var(--border-cyan)' : 'var(--border-light)'}`,
              background: form.mode === 'manual' ? 'var(--bg-overlay)' : 'var(--bg-card)',
              color: 'var(--text-primary)',
            }}
          >
            <strong>User typed nickname</strong>
            <span className="d-block text-muted small mt-1">Members provide the new nickname in the command.</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('ai_random')}
            className="btn"
            style={{
              textAlign: 'left',
              padding: 16,
              border: `1px solid ${form.mode === 'ai_random' ? 'var(--border-cyan)' : 'var(--border-light)'}`,
              background: form.mode === 'ai_random' ? 'var(--bg-overlay)' : 'var(--bg-card)',
              color: 'var(--text-primary)',
            }}
          >
            <strong>AI chooses nickname</strong>
            <span className="d-block text-muted small mt-1">Uses recent channel context to generate one nickname.</span>
          </button>
        </div>
      </div>

      <SaveBar
        isDirty={isDirty}
        onSave={() => save({
          ...form,
          cost: Math.max(0, Math.floor(form.cost || 0)),
          duration_minutes: Math.max(1, Math.floor(form.duration_minutes || 1)),
        })}
        onDiscard={resetForm}
        isSaving={isSaving}
        saveError={saveError}
      />
    </div>
  );
};
