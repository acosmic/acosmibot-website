import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, AdminAiSettings } from '@/api/admin';

type FormState = Pick<AdminAiSettings, 'enabled' | 'model' | 'polymorph_model' | 'daily_limit' | 'monthly_limit'>;

export const AiSettingsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'ai-settings'],
    queryFn: () => adminApi.getAiSettings(),
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (query.data?.data) {
      const { enabled, model, polymorph_model, daily_limit, monthly_limit } = query.data.data;
      setForm({ enabled, model, polymorph_model, daily_limit, monthly_limit });
    }
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (payload: FormState) => adminApi.updateAiSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai-settings'] });
      setSavedAt(Date.now());
    },
  });

  if (query.isLoading || !form) {
    return <p className="text-muted">Loading...</p>;
  }

  if (query.error) {
    return <p style={{ color: '#f87171' }}>Error: {String(query.error)}</p>;
  }

  const availableModels = query.data?.data.available_models ?? [];

  return (
    <div style={{ maxWidth: 640 }}>
      <h3 className="mb-4">AI Settings</h3>
      <p className="text-muted mb-4">
        Bot-wide AI configuration. Changes take effect immediately across all servers.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(form);
        }}
      >
        <div className="mb-4">
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: 'var(--primary-color)' }}
            />
            <span style={{ fontWeight: 600 }}>AI Enabled (Master Switch)</span>
          </label>
          <p className="text-muted small mb-0 mt-1" style={{ marginLeft: 30 }}>
            When off, AI is disabled in every server regardless of their per-guild toggle.
          </p>
        </div>

        <div className="mb-4">
          <label className="form-label mb-2 d-block">Model</label>
          <select
            className="form-control"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
          >
            {availableModels.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <p className="text-muted small mt-2 mb-0">OpenAI chat model used by every server.</p>
        </div>

        <div className="mb-4">
          <label className="form-label mb-2 d-block">Polymorph Model</label>
          <select
            className="form-control"
            value={form.polymorph_model}
            onChange={(e) => setForm({ ...form, polymorph_model: e.target.value })}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
          >
            {availableModels.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <p className="text-muted small mt-2 mb-0">OpenAI chat model used when Polymorph generates a nickname.</p>
        </div>

        <div className="mb-4">
          <label className="form-label mb-2 d-block">Daily limit (per server)</label>
          <input
            type="number"
            min={1}
            className="form-control"
            value={form.daily_limit}
            onChange={(e) => setForm({ ...form, daily_limit: parseInt(e.target.value, 10) || 0 })}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', maxWidth: 200 }}
          />
          <p className="text-muted small mt-2 mb-0">Each guild may send this many AI chats per day before being rate-limited.</p>
        </div>

        <div className="mb-4">
          <label className="form-label mb-2 d-block">Monthly limit (per server)</label>
          <input
            type="number"
            min={1}
            className="form-control"
            value={form.monthly_limit}
            onChange={(e) => setForm({ ...form, monthly_limit: parseInt(e.target.value, 10) || 0 })}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', maxWidth: 200 }}
          />
          <p className="text-muted small mt-2 mb-0">Each guild's monthly AI chat ceiling.</p>
        </div>

        <div className="d-flex align-items-center gap-3">
          <button
            type="submit"
            className="btn primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Saving...' : 'Save'}
          </button>
          {mutation.error && (
            <span style={{ color: '#f87171' }}>Error: {String(mutation.error)}</span>
          )}
          {!mutation.error && savedAt && Date.now() - savedAt < 4000 && (
            <span style={{ color: '#4ade80' }}>Saved</span>
          )}
        </div>
      </form>
    </div>
  );
};
