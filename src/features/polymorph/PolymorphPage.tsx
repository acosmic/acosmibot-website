import React from 'react';
import { useParams } from 'react-router-dom';
import { FeatureToggle, LoadingSpinner, NumberInput, SaveBar } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';
import { PolymorphConfig } from '@/types/features';
import { usePolymorphConfig } from './usePolymorphConfig';

export const PolymorphPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { data, isLoading, save, isSaving, saveError } = usePolymorphConfig(guildId!);
  const { form, setForm, isDirty, resetForm } = useDirtyState<PolymorphConfig>(data);

  if (isLoading) return <LoadingSpinner />;
  if (!form) return <div>No data found.</div>;

  const updateNumber = (field: 'cost' | 'duration_minutes', value: number) =>
    setForm({ [field]: Math.trunc(value) });

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

      <div className="dashboard-workflow-ledger">
        <section className="dashboard-workflow-section">
          <h3 style={{ margin: '0 0 16px 0', fontSize: 18 }}>Cost and Duration</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div>
              <label className="form-label mb-2 d-block">Credit Cost</label>
              <NumberInput
                className="form-control"
                min={0}
                value={form.cost}
                onValueChange={(value) => updateNumber('cost', value)}
              />
              <p className="text-muted small mt-2 mb-0">Credits charged for each successful polymorph.</p>
            </div>
            <div>
              <label className="form-label mb-2 d-block">Duration Minutes</label>
              <NumberInput
                className="form-control"
                min={1}
                value={form.duration_minutes}
                onValueChange={(value) => updateNumber('duration_minutes', value)}
              />
              <p className="text-muted small mt-2 mb-0">Nickname is restored after this many minutes.</p>
            </div>
          </div>
        </section>

        <section className="dashboard-workflow-section">
          <h3 style={{ margin: '0 0 16px 0', fontSize: 18 }}>AI Random Names</h3>
          <label className="d-flex align-items-start gap-3" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              className="form-check-input mt-1"
              checked={form.allow_ai_random_names}
              onChange={(e) => setForm({
                allow_ai_random_names: e.target.checked,
                mode: e.target.checked ? 'ai_random' : 'manual',
              })}
            />
            <span>
              <strong>Allow blank nicknames to use AI</strong>
              <span className="d-block text-muted small mt-1">
                Members can still type a specific nickname. When this is enabled, leaving the nickname blank lets AI generate one from recent channel context.
              </span>
            </span>
          </label>
        </section>
      </div>

      <SaveBar
        isDirty={isDirty}
        onSave={() => save({
          ...form,
          cost: Math.max(0, Math.floor(form.cost || 0)),
          duration_minutes: Math.max(1, Math.floor(form.duration_minutes || 1)),
          mode: form.allow_ai_random_names ? 'ai_random' : 'manual',
        })}
        onDiscard={resetForm}
        isSaving={isSaving}
        saveError={saveError}
      />
    </div>
  );
};
