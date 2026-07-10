import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, AdminAiSettings, AdminAiTier, AdminAiTierLimits } from '@/api/admin';
import { TimezoneSelect, detectBrowserTimezone } from '@/components/ui/TimezoneSelect';

type FormState = Pick<AdminAiSettings, 'enabled' | 'model' | 'polymorph_model' | 'timezone' | 'web_search_provider' | 'tier_limits'>;

const PLAN_LIMITS: Array<{ tier: AdminAiTier; label: string; description: string }> = [
  { tier: 'free', label: 'Free', description: 'Basic AI chat' },
  { tier: 'plus', label: 'Plus', description: 'Basic AI chat' },
  { tier: 'pro', label: 'Pro', description: 'AI tools, memory, and personalities' },
  { tier: 'max', label: 'Max', description: 'Higher-volume AI workflows' },
];

const DAILY_LIMIT_OPTIONS = [1, 3, 5, 10, 25, 50, 100, 200, 300, 500, 1000];
const MONTHLY_LIMIT_OPTIONS = [30, 90, 100, 250, 500, 1000, 2000, 3000, 6000, 10000, 20000];
const IMAGE_LIMIT_OPTIONS = [0, 5, 10, 25, 50, 75, 100, 200, 300, 500, 1000];

const limitOptions = (currentValue: number, options: number[]) =>
  options.includes(currentValue) ? options : [currentValue, ...options].sort((a, b) => a - b);

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
      const { enabled, model, polymorph_model, timezone, web_search_provider, tier_limits } = query.data.data;
      setForm({
        enabled,
        model,
        polymorph_model,
        timezone: timezone || 'UTC',
        web_search_provider: web_search_provider || 'tavily',
        tier_limits,
      });
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
  const availableWebSearchProviders = query.data?.data.available_web_search_providers ?? ['tavily', 'exa'];
  const setTierLimit = (tier: AdminAiTier, field: keyof AdminAiTierLimits[AdminAiTier], value: number) => {
    setForm({
      ...form,
      tier_limits: {
        ...form.tier_limits,
        [tier]: { ...form.tier_limits[tier], [field]: value },
      },
    });
  };

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
          <label className="form-label mb-2 d-block">Fallback timezone</label>
          <TimezoneSelect
            value={form.timezone || 'UTC'}
            onChange={(tz) => setForm({ ...form, timezone: tz })}
          />
          <div className="mt-2">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setForm({ ...form, timezone: detectBrowserTimezone() })}
            >
              Use my current timezone ({detectBrowserTimezone().replace(/_/g, ' ')})
            </button>
          </div>
          <p className="text-muted small mt-2 mb-0">
            Used for the AI clock only when neither the member nor the server has set a timezone.
          </p>
        </div>

        <div className="mb-4">
          <label className="form-label mb-2 d-block">Web Search Provider</label>
          <select
            className="form-control"
            value={form.web_search_provider}
            onChange={(e) => setForm({ ...form, web_search_provider: e.target.value })}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
          >
            {availableWebSearchProviders.map((provider) => (
              <option key={provider} value={provider}>
                {provider === 'exa' ? 'Exa AI' : 'Tavily'}
              </option>
            ))}
          </select>
          <p className="text-muted small mt-2 mb-0">
            Provider used when server AI web search is enabled and a member asks for live web information.
          </p>
        </div>

        <div className="mb-4">
          <label className="form-label mb-2 d-block">AI chat limits by plan</label>
          <p className="text-muted small mt-0 mb-3">
            Limits apply per server. Defaults match the limits shown on the pricing page.
          </p>
          <div style={{ display: 'grid', gap: 12 }}>
            {PLAN_LIMITS.map(({ tier, label, description }) => {
              const limits = form.tier_limits[tier];
              return (
                <div
                  key={tier}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(110px, 1fr) minmax(0, 2fr)',
                    gap: 12,
                    alignItems: 'end',
                    padding: '12px',
                    border: '1px solid var(--border-light)',
                    borderRadius: 8,
                    background: 'var(--bg-secondary)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{label}</div>
                    <div className="text-muted small">{description}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(140px, 1fr))', gap: 12 }}>
                    <label className="small">
                      Chat daily
                      <select
                        className="form-control mt-1"
                        value={limits.daily_limit}
                        onChange={(e) => setTierLimit(tier, 'daily_limit', Number(e.target.value))}
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                      >
                        {limitOptions(limits.daily_limit, DAILY_LIMIT_OPTIONS).map((value) => (
                          <option key={value} value={value}>{value.toLocaleString()} / day</option>
                        ))}
                      </select>
                    </label>
                    <label className="small">
                      Chat monthly
                      <select
                        className="form-control mt-1"
                        value={limits.monthly_limit}
                        onChange={(e) => setTierLimit(tier, 'monthly_limit', Number(e.target.value))}
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                      >
                        {limitOptions(limits.monthly_limit, MONTHLY_LIMIT_OPTIONS).map((value) => (
                          <option key={value} value={value}>{value.toLocaleString()} / month</option>
                        ))}
                      </select>
                    </label>
                    <label className="small">
                      Image generation monthly
                      <select
                        className="form-control mt-1"
                        value={limits.image_monthly_limit}
                        onChange={(e) => setTierLimit(tier, 'image_monthly_limit', Number(e.target.value))}
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                      >
                        {limitOptions(limits.image_monthly_limit, IMAGE_LIMIT_OPTIONS).map((value) => (
                          <option key={value} value={value}>{value === 0 ? 'Not included' : `${value.toLocaleString()} / month`}</option>
                        ))}
                      </select>
                    </label>
                    <label className="small">
                      Image analysis monthly
                      <select
                        className="form-control mt-1"
                        value={limits.image_analysis_monthly_limit}
                        onChange={(e) => setTierLimit(tier, 'image_analysis_monthly_limit', Number(e.target.value))}
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                      >
                        {limitOptions(limits.image_analysis_monthly_limit, IMAGE_LIMIT_OPTIONS).map((value) => (
                          <option key={value} value={value}>{value === 0 ? 'Not included' : `${value.toLocaleString()} / month`}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
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
