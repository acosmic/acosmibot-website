import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, AdminFeatureSettings, StripeMode } from '@/api/admin';

type FormState = Pick<
  AdminFeatureSettings,
  'use_satori_rank_card' | 'billing_enabled' | 'stripe_mode'
>;

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
      setForm({
        use_satori_rank_card: query.data.data.use_satori_rank_card,
        billing_enabled: query.data.data.billing_enabled,
        stripe_mode: query.data.data.stripe_mode,
      });
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

  const testConfigured = query.data?.data.stripe_test_configured ?? false;
  const liveConfigured = query.data?.data.stripe_live_configured ?? false;
  const targetMode: StripeMode = form.stripe_mode === 'live' ? 'test' : 'live';
  const targetConfigured = targetMode === 'live' ? liveConfigured : testConfigured;

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

        <div className="mb-4" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: targetConfigured ? 'pointer' : 'not-allowed' }}>
            <input
              type="checkbox"
              checked={form.stripe_mode === 'live'}
              disabled={!targetConfigured}
              onChange={(e) => setForm({
                ...form,
                stripe_mode: e.target.checked ? 'live' : 'test',
                // Mode changes are deliberately two-step: save with billing off,
                // verify the selected account, then re-enable checkout.
                billing_enabled: false,
              })}
              style={{ width: 18, height: 18, accentColor: '#ef4444' }}
            />
            <span style={{ fontWeight: 600 }}>
              Live Stripe payments
            </span>
            <span className={`badge ${form.stripe_mode === 'live' ? 'bg-danger' : 'bg-warning text-dark'}`}>
              {form.stripe_mode === 'live' ? 'LIVE' : 'TEST'}
            </span>
          </label>
          <p className="text-muted small mb-2 mt-1" style={{ marginLeft: 30 }}>
            Test mode uses Stripe sandbox data. Live mode creates real charges. Changing
            modes automatically turns billing off; save once, verify the mode, then
            enable Stripe billing and save again.
          </p>
          <div className="small" style={{ marginLeft: 30, display: 'flex', gap: 16 }}>
            <span style={{ color: testConfigured ? '#4ade80' : '#f87171' }}>
              Test {testConfigured ? 'configured' : 'incomplete'}
            </span>
            <span style={{ color: liveConfigured ? '#4ade80' : '#f87171' }}>
              Live {liveConfigured ? 'configured' : 'incomplete'}
            </span>
          </div>
          {!targetConfigured && (
            <p style={{ color: '#f87171', marginLeft: 30 }} className="small mt-2 mb-0">
              {targetMode === 'live' ? 'Live' : 'Test'} mode cannot be selected until its
              secret key, six Price IDs, and webhook secret are configured on the API.
            </p>
          )}
        </div>

        <div className="mb-4">
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.billing_enabled}
              onChange={(e) => setForm({ ...form, billing_enabled: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: 'var(--primary-color)' }}
            />
            <span style={{ fontWeight: 600 }}>Stripe billing</span>
          </label>
          <p className="text-muted small mb-0 mt-1" style={{ marginLeft: 30 }}>
            Enable checkout and plan changes on the website. When off, the pricing page
            shows &ldquo;coming soon&rdquo; and the API refuses new purchases. Existing
            subscribers can still cancel and open the billing portal.
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
