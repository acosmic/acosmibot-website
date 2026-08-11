import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, AdminFeatureSettings, StripeMode, type AdminStripeReadiness } from '@/api/admin';

type FormState = Pick<
  AdminFeatureSettings,
  'use_satori_rank_card' | 'use_satori_weather_card' | 'billing_enabled' |
  'ai_credit_sales_enabled' | 'ai_credit_spending_enabled' | 'ai_credit_dm_enabled' |
  'stripe_mode'
>;

const readableReadinessReason = (reason: string) => reason.replaceAll('_', ' ');

const formatPromotionEnd = (value: string | undefined) => {
  if (!value) return 'the configured deadline';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'the configured deadline';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
};

export const FeatureSettingsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'feature-settings'],
    queryFn: () => adminApi.getFeatureSettings(),
  });
  const readiness = useQuery({
    queryKey: ['admin', 'stripe-readiness'],
    queryFn: () => adminApi.getStripeReadiness(),
    staleTime: 60_000,
    retry: false,
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (query.data?.data) {
      setForm({
        use_satori_rank_card: query.data.data.use_satori_rank_card,
        use_satori_weather_card: query.data.data.use_satori_weather_card ?? false,
        billing_enabled: query.data.data.billing_enabled,
        ai_credit_sales_enabled: query.data.data.ai_credit_sales_enabled ?? false,
        ai_credit_spending_enabled: query.data.data.ai_credit_spending_enabled ?? false,
        ai_credit_dm_enabled: query.data.data.ai_credit_dm_enabled ?? false,
        stripe_mode: query.data.data.stripe_mode,
      });
    }
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (payload: FormState) => adminApi.updateFeatureSettings(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'feature-settings'] });
      setSavedAt(Date.now());
    },
  });

  if (query.isLoading || !form) {
    return <p className="text-muted">Loading...</p>;
  }

  if (query.error) {
    return <p style={{ color: 'var(--error-color)' }}>Error: {String(query.error)}</p>;
  }

  const testConfigured = query.data?.data.stripe_test_configured ?? false;
  const liveConfigured = query.data?.data.stripe_live_configured ?? false;
  const persistedMode = query.data?.data.stripe_mode ?? 'test';
  const modeChangePending = form.stripe_mode !== persistedMode;
  const targetMode: StripeMode = form.stripe_mode === 'live' ? 'test' : 'live';
  const targetConfigured = targetMode === 'live' ? liveConfigured : testConfigured;
  const pendingModeLabel = form.stripe_mode === 'live' ? 'Live' : 'Test';

  const handleModeChange = (checked: boolean) => {
    const nextMode: StripeMode = checked ? 'live' : 'test';
    mutation.reset();
    setSavedAt(null);
    setForm((current) => current ? {
      ...current,
      stripe_mode: nextMode,
      billing_enabled: nextMode === persistedMode
        ? (query.data?.data.billing_enabled ?? false)
        : false,
      ai_credit_sales_enabled: nextMode === persistedMode
        ? (query.data?.data.ai_credit_sales_enabled ?? false)
        : false,
    } : current);
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <h3 className="mb-4">Feature Flags</h3>
      <p className="text-muted mb-4">
        Bot-wide feature toggles. Changes take effect immediately across all servers.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(
            modeChangePending ? { ...form, billing_enabled: false, ai_credit_sales_enabled: false } : form,
          );
        }}
      >
        <div className="mb-4">
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.use_satori_rank_card}
              disabled={mutation.isPending}
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
          <h4 className="mb-2">AI Credits rollout</h4>
          <p className="text-muted small mb-3">Enable each stage independently. Keep sales off until the selected Stripe credit catalog is ready; keep spending off until migrations and reconciliation checks pass.</p>
          {([
            ['ai_credit_sales_enabled', 'Sell AI Credits', 'Allow new one-time Stripe credit purchases.'],
            ['ai_credit_spending_enabled', 'Spend AI Credits', 'Allow foreground AI requests to reserve and settle prepaid credits.'],
            ['ai_credit_dm_enabled', 'Personal DM AI', 'Allow explicit Discord DMs to use personal credits. Spending must also be enabled.'],
          ] as const).map(([field, label, description]) => (
            <div className="mb-3" key={field}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: modeChangePending || mutation.isPending ? 'not-allowed' : 'pointer', opacity: modeChangePending ? 0.62 : 1 }}>
                <input
                  type="checkbox"
                  checked={form[field]}
                  disabled={modeChangePending || mutation.isPending || (field === 'ai_credit_dm_enabled' && !form.ai_credit_spending_enabled)}
                  onChange={(event) => {
                    mutation.reset();
                    setSavedAt(null);
                    setForm({
                      ...form,
                      [field]: event.target.checked,
                      ...(field === 'ai_credit_spending_enabled' && !event.target.checked
                        ? { ai_credit_dm_enabled: false }
                        : {}),
                    });
                  }}
                  style={{ width: 18, height: 18, accentColor: 'var(--primary-color)' }}
                />
                <span style={{ fontWeight: 600 }}>{label}</span>
              </label>
              <p className="text-muted small mb-0 mt-1" style={{ marginLeft: 30 }}>{description}</p>
            </div>
          ))}
        </div>

        <div className="mb-4">
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.use_satori_weather_card}
              disabled={mutation.isPending}
              onChange={(e) => setForm({ ...form, use_satori_weather_card: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: 'var(--primary-color)' }}
            />
            <span style={{ fontWeight: 600 }}>Satori weather cards</span>
          </label>
          <p className="text-muted small mb-0 mt-1" style={{ marginLeft: 30 }}>
            Render the weather card image for <code>/weather</code> and AI weather answers via
            the Satori Azure service. When off (or if the render fails), the bot posts a plain
            embed instead.
          </p>
        </div>

        <div className="mb-4" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: targetConfigured ? 'pointer' : 'not-allowed' }}>
            <input
              type="checkbox"
              checked={form.stripe_mode === 'live'}
              disabled={!targetConfigured || mutation.isPending}
              onChange={(e) => handleModeChange(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--error-color)' }}
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
            <span style={{ color: testConfigured ? 'var(--success-color)' : 'var(--error-color)' }}>
              Test {testConfigured ? 'configured' : 'incomplete'}
            </span>
            <span style={{ color: liveConfigured ? 'var(--success-color)' : 'var(--error-color)' }}>
              Live {liveConfigured ? 'configured' : 'incomplete'}
            </span>
          </div>
          {modeChangePending && (
            <div
              role="status"
              className="small mt-3"
              style={{
                marginLeft: 30,
                padding: '12px 14px',
                color: 'var(--text-secondary)',
                background: 'color-mix(in srgb, var(--warning-color) 9%, var(--bg-tertiary))',
                border: '1px solid color-mix(in srgb, var(--warning-color) 38%, var(--border-light))',
                borderRadius: 10,
                lineHeight: 1.55,
              }}
            >
              <strong style={{ color: 'var(--text-primary)' }}>
                {pendingModeLabel} mode selected.
              </strong>{' '}
              Billing is locked off for this save. Verify the {pendingModeLabel.toLowerCase()}{' '}
              badge afterward, then enable Stripe billing and save once more.
            </div>
          )}
          {!targetConfigured && (
            <p style={{ color: 'var(--error-color)', marginLeft: 30 }} className="small mt-2 mb-0">
              {targetMode === 'live' ? 'Live' : 'Test'} mode cannot be selected until its
              secret key, six Price IDs, and webhook secret are configured on the API.
            </p>
          )}
        </div>

        <div className="mb-4">
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: modeChangePending || mutation.isPending ? 'not-allowed' : 'pointer',
            opacity: modeChangePending ? 0.62 : 1,
          }}>
            <input
              type="checkbox"
              checked={form.billing_enabled}
              disabled={modeChangePending || mutation.isPending}
              onChange={(e) => {
                mutation.reset();
                setSavedAt(null);
                setForm({ ...form, billing_enabled: e.target.checked });
              }}
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
            {mutation.isPending
              ? 'Saving...'
              : modeChangePending
                ? `Switch to ${pendingModeLabel} safely`
                : 'Save'}
          </button>
          {mutation.error && (
            <span role="alert" style={{ color: 'var(--error-color)' }}>
              {mutation.error instanceof Error
                ? mutation.error.message
                : String(mutation.error)}
            </span>
          )}
          {!mutation.error && savedAt && Date.now() - savedAt < 4000 && (
            <span style={{ color: 'var(--success-color)' }}>Saved</span>
          )}
        </div>
      </form>
      <section
        aria-labelledby="stripe-readiness-title"
        style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border-light)' }}
      >
        <h4 id="stripe-readiness-title" className="mb-2">Stripe catalog readiness</h4>
        <p className="text-muted small mb-3">
          Remote Product, Price, and launch-coupon objects must match the versioned catalog before
          checkout can run. Price IDs, coupon IDs, and secrets are never shown here.
        </p>
        {readiness.isLoading ? <p className="text-muted small">Checking catalog…</p> : readiness.error ? (
          <p className="small" style={{ color: 'var(--error-color)' }}>Readiness check unavailable.</p>
        ) : (['test', 'live'] as const).map((mode) => {
          const status: AdminStripeReadiness | undefined = readiness.data?.data?.[mode];
          return (
            <div key={mode} style={{ marginBottom: 14, padding: 12, border: '1px solid var(--border-light)', borderRadius: 10, background: 'var(--bg-secondary)' }}>
              <div className="d-flex justify-content-between align-items-center gap-2">
                <strong>{mode === 'live' ? 'Live' : 'Test'} mode</strong>
                <span style={{ color: status?.configured ? 'var(--success-color)' : 'var(--warning-color)' }}>
                  {status?.configured ? 'Ready' : 'Needs attention'}
                </span>
              </div>
              {status?.missing?.length ? <p className="small text-muted mb-0 mt-2">Missing configuration: {status.missing.join(', ')}</p> : (
                <div className="small mt-2" style={{ display: 'grid', gap: 7 }}>
                  {(status?.rows ?? []).map((row) => (
                    <div
                      key={`${row.tier}-${row.cadence}`}
                      style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 0.35fr) minmax(0, 1fr)', gap: 12 }}
                    >
                      <span>{row.tier} · {row.cadence}</span>
                      <span style={{ color: row.status === 'valid' ? 'var(--success-color)' : 'var(--error-color)', overflowWrap: 'anywhere', textAlign: 'end' }}>
                        {row.status === 'valid'
                          ? 'valid'
                          : row.reasons.map(readableReadinessReason).join(', ') || row.status}
                      </span>
                    </div>
                  ))}
                  {status?.promotion && (
                    <div
                      style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 0.35fr) minmax(0, 1fr)', gap: 12, paddingTop: 7, borderTop: '1px solid var(--border-light)' }}
                    >
                      <span>monthly launch offer</span>
                      <span
                        style={{
                          color: ['valid', 'ended'].includes(status.promotion.status)
                            ? 'var(--success-color)'
                            : 'var(--error-color)',
                          overflowWrap: 'anywhere',
                          textAlign: 'end',
                        }}
                      >
                        {status.promotion.status === 'valid'
                          ? `${status.promotion.percent_off}% off · first ${status.promotion.duration_in_months} months · through ${formatPromotionEnd(status.promotion.redeem_by)}`
                          : status.promotion.status === 'ended'
                            ? 'offer ended · full monthly price active'
                            : status.promotion.reasons.map(readableReadinessReason).join(', ') || status.promotion.status}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
};
