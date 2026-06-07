import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, AdminFeatureSettings } from '@/api/admin';

type FormState = AdminFeatureSettings;

export const FeatureSettingsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'feature-settings'],
    queryFn: () => adminApi.getFeatureSettings(),
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (query.data?.data) {
      setForm({ use_satori_rank_card: query.data.data.use_satori_rank_card });
    }
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (payload: FormState) => adminApi.updateFeatureSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feature-settings'] });
      setSavedAt(Date.now());
    },
  });

  if (query.isLoading || !form) {
    return <p className="text-muted">Loading...</p>;
  }

  if (query.error) {
    return <p style={{ color: '#f87171' }}>Error: {String(query.error)}</p>;
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h3 className="mb-4">Feature Flags</h3>
      <p className="text-muted mb-4">
        Bot-wide feature toggles. Changes take effect immediately across all servers.
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
              checked={form.use_satori_rank_card}
              onChange={(e) => setForm({ ...form, use_satori_rank_card: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: 'var(--primary-color)' }}
            />
            <span style={{ fontWeight: 600 }}>Satori rank cards</span>
          </label>
          <p className="text-muted small mb-0 mt-1" style={{ marginLeft: 30 }}>
            Render <code>/rank</code> cards via the Satori Azure service. When off (or if the
            render fails), the bot falls back to the legacy PIL renderer.
          </p>
        </div>

        <div className="d-flex align-items-center gap-3">
          <button type="submit" className="btn primary" disabled={mutation.isPending}>
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
