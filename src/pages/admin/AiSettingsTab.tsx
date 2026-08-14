import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, AdminAiSettings, AdminAiTier, AdminAiTierLimits, type AdminAiLabCase, type AdminAiLabJob, type AiProvider } from '@/api/admin';
import { TimezoneSelect, detectBrowserTimezone } from '@/components/ui/TimezoneSelect';
import './AiSettingsTab.css';

type FormState = Pick<AdminAiSettings, 'enabled' | 'response_notice' | 'model' | 'polymorph_model' | 'timezone' | 'web_search_provider' | 'tier_limits' | 'provider_layers'>;

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
      const { enabled, response_notice, model, polymorph_model, timezone, web_search_provider, tier_limits, provider_layers } = query.data.data;
      setForm({
        enabled,
        response_notice: response_notice ?? true,
        model,
        polymorph_model,
        timezone: timezone || 'UTC',
        web_search_provider: web_search_provider || 'tavily',
        tier_limits,
        provider_layers,
      });
    }
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (payload: FormState) => adminApi.updateAiSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai-settings'] });
      setSavedAt(Date.now());
      window.setTimeout(() => setSavedAt(null), 4000);
    },
  });

  if (query.error) {
    return <p style={{ color: 'var(--error-color)' }}>Could not load AI settings: {String(query.error)}</p>;
  }

  if (query.isLoading || !form) {
    return <p className="text-muted">Loading AI settings…</p>;
  }

  const availableWebSearchProviders = query.data?.data.available_web_search_providers ?? ['tavily', 'exa'];
  const updateProviderLayer = (layerKey: string, patch: Partial<AdminAiSettings['provider_layers'][string]>) => {
    setForm({
      ...form,
      provider_layers: {
        ...form.provider_layers,
        [layerKey]: { ...form.provider_layers[layerKey], ...patch },
      },
    });
  };
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
    <div style={{ maxWidth: 760 }}>
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
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.response_notice}
              onChange={(e) => setForm({ ...form, response_notice: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: 'var(--primary-color)' }}
            />
            <span style={{ fontWeight: 600 }}>Show disclaimer &amp; tool used</span>
          </label>
          <p className="text-muted small mb-0 mt-1" style={{ marginLeft: 30 }}>
            The small grey line under every AI reply — “AI responses may not be accurate · Used
            Web Search Tool”. Turn off to hide it everywhere.
          </p>
        </div>

        <div className="mb-4">
          <label className="form-label mb-2 d-block">Provider routing by layer</label>
          <p className="text-muted small mt-0 mb-3">
            Switch one workload at a time. The inactive model is saved too, so comparisons do not erase your setup.
            Gemini requires <code>GEMINI_API_KEY</code> in the bot’s <code>.env</code> and a bot restart.
            Moderation remains on OpenAI regardless of these switches.
          </p>
          <div style={{ display: 'grid', gap: 12 }}>
            {Object.entries(form.provider_layers).map(([layerKey, layer]) => {
              const selectedModelField = layer.provider === 'openai' ? 'openai_model' : 'gemini_model';
              return (
                <div key={layerKey} className="ai-provider-row">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 600 }}>{layer.label}</div>
                    <div role="group" aria-label={`${layer.label} provider`} className="ai-provider-toggle">
                      {(['openai', 'gemini'] as const).map((provider) => (
                        <button
                          key={provider}
                          type="button"
                          onClick={() => updateProviderLayer(layerKey, { provider })}
                          aria-pressed={layer.provider === provider}
                          className={`ai-provider-toggle__option${layer.provider === provider ? ' is-active' : ''}`}
                        >
                          {provider === 'openai' ? 'OpenAI' : 'Gemini'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <select
                    className="form-control mt-2"
                    aria-label={`${layer.label} ${layer.provider} model`}
                    value={layer[selectedModelField]}
                    onChange={(e) => updateProviderLayer(layerKey, { [selectedModelField]: e.target.value })}
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                  >
                    {layer.available_models[layer.provider].map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                  {layerKey === 'emote_image' && layer.provider === 'gemini' && (
                    <p className="small mb-0 mt-2" style={{ color: 'var(--warning-color)' }}>
                      Experimental: generated emotes still must pass the real-alpha transparency check. Gemini does not guarantee transparent output.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
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
                  className="ai-plan-limit-row"
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{label}</div>
                    <div className="text-muted small">{description}</div>
                  </div>
                  <div className="ai-plan-limit-fields">
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
                    <label className="small">
                      Image search monthly
                      <select
                        className="form-control mt-1"
                        value={limits.image_search_monthly_limit}
                        onChange={(e) => setTierLimit(tier, 'image_search_monthly_limit', Number(e.target.value))}
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                      >
                        {limitOptions(limits.image_search_monthly_limit, IMAGE_LIMIT_OPTIONS).map((value) => (
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
            <span role="alert" style={{ color: 'var(--error-color)' }}>Save failed: {String(mutation.error)}</span>
          )}
          {!mutation.error && savedAt && (
            <span role="status" style={{ color: 'var(--success-color)' }}>Saved</span>
          )}
        </div>
      </form>
      <AiLabPanel
        form={form}
        onApply={(layerKey, provider, model) => {
          const field = provider === 'openai' ? 'openai_model' : 'gemini_model';
          updateProviderLayer(layerKey, { provider, [field]: model });
        }}
      />
    </div>
  );
};

const AiLabPanel: React.FC<{
  form: FormState;
  onApply: (layer: string, provider: AiProvider, model: string) => void;
}> = ({ form, onApply }) => {
  const queryClient = useQueryClient();
  const cases = useQuery({
    queryKey: ['admin', 'ai-lab', 'cases'],
    queryFn: () => adminApi.getAiLabCases(),
  });
  const jobs = useQuery({
    queryKey: ['admin', 'ai-lab', 'jobs'],
    queryFn: () => adminApi.getAiLabJobs(),
    refetchInterval: 4000,
  });
  const labCases: AdminAiLabCase[] = cases.data?.cases ?? [];
  const [caseKey, setCaseKey] = useState('chat_conversation');
  const selectedCase = labCases.find((item) => item.key === caseKey);
  const selectedLayer = form.provider_layers[selectedCase?.layer ?? 'chat'];
  const [provider, setProvider] = useState<AiProvider>(selectedLayer?.provider ?? 'openai');
  const modelField = provider === 'openai' ? 'openai_model' : 'gemini_model';
  const [model, setModel] = useState(selectedLayer?.[modelField] ?? selectedLayer?.available_models?.[provider]?.[0] ?? '');
  const [compareProviders, setCompareProviders] = useState(false);
  useEffect(() => {
    setModel(selectedLayer?.[modelField] ?? selectedLayer?.available_models?.[provider]?.[0] ?? '');
  }, [modelField, provider, selectedLayer]);
  const labJobs: AdminAiLabJob[] = jobs.data?.jobs ?? [];
  const activeCount = labJobs.filter((job) => job.status === 'queued' || job.status === 'running').length;
  const requestedSlots = compareProviders && selectedCase?.kind !== 'image' ? 2 : 1;
  const create = useMutation({
    mutationFn: async () => {
      const confirmImage = selectedCase?.requires_image_confirmation ? { confirm_image: true as const } : {};
      const primary = await adminApi.createAiLabJob({ case_key: caseKey, provider, model, confirm: true, ...confirmImage });
      if (!compareProviders || selectedCase?.kind === 'image') return primary;
      const comparisonProvider: AiProvider = provider === 'openai' ? 'gemini' : 'openai';
      const comparisonField = comparisonProvider === 'openai' ? 'openai_model' : 'gemini_model';
      const comparisonModel = selectedLayer?.[comparisonField] ?? selectedLayer?.available_models?.[comparisonProvider]?.[0];
      if (!comparisonModel) return primary;
      const comparison = await adminApi.createAiLabJob({ case_key: caseKey, provider: comparisonProvider, model: comparisonModel, confirm: true });
      return [primary, comparison];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai-lab', 'jobs'] });
    },
  });
  const rate = useMutation({
    mutationFn: ({ jobId, rating }: { jobId: string; rating: -1 | 1 }) => adminApi.rateAiLabJob(jobId, rating),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'ai-lab', 'jobs'] }),
  });

  return (
    <section className="ai-lab-panel" aria-labelledby="ai-lab-title">
      <div className="ai-lab-panel__header">
        <div>
          <span className="ai-lab-panel__kicker">Owner instrument</span>
          <h3 id="ai-lab-title">AI Lab</h3>
          <p className="text-muted mb-0">
            Run curated layer checks through the same gateway used in production.
            Tests are billable, context-free, and never accept arbitrary prompts or tools.
          </p>
        </div>
        <span className="ai-lab-panel__guard">Super-admin only</span>
      </div>

      <div className="ai-lab-panel__controls">
        <label className="small">
          Case
          <select className="form-control mt-1" value={caseKey} onChange={(event) => setCaseKey(event.target.value)}>
            {labCases.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </label>
        <label className="small">
          Provider
          <select className="form-control mt-1" value={provider} onChange={(event) => setProvider(event.target.value as AiProvider)}>
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
          </select>
        </label>
        <label className="small">
          Model
          <select className="form-control mt-1" value={model} onChange={(event) => setModel(event.target.value)} disabled={!selectedLayer}>
            {selectedLayer?.available_models?.[provider]?.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="ai-lab-panel__compare">
          <input
            type="checkbox"
            checked={compareProviders}
            disabled={selectedCase?.kind === 'image' || activeCount > 0}
            onChange={(event) => setCompareProviders(event.target.checked)}
          />
          Compare both providers
        </label>
        <button
          type="button"
          className="btn primary ai-lab-panel__run"
          disabled={!selectedCase || !model || activeCount + requestedSlots > 2 || create.isPending}
          onClick={() => {
            if (window.confirm(
              `Run ${compareProviders && selectedCase?.kind !== 'image' ? 'both provider checks' : 'this provider check'} now? Maximum per-call estimate: $${selectedCase?.estimated_max_cost_usd ?? '0.00'}.`,
            )) create.mutate();
          }}
        >
          {create.isPending ? 'Queueing…' : activeCount + requestedSlots > 2 ? 'Not enough queue slots' : 'Run test'}
        </button>
      </div>

      {selectedCase && (
        <p className="text-muted small mb-3">
          {selectedCase.description} Maximum configured estimate: ${selectedCase.estimated_max_cost_usd}.
        </p>
      )}
      {create.error && <p className="ai-lab-panel__error" role="alert">{String(create.error)}</p>}

      <div className="ai-lab-panel__ledger" aria-live="polite">
        <div className="ai-lab-panel__ledger-heading">
          <span>Recent checks</span>
          <span>Last 20 · two queued comparisons</span>
        </div>
        {jobs.isLoading ? <p className="text-muted small mb-0">Loading lab history…</p> : labJobs.length === 0 ? (
          <p className="text-muted small mb-0">No checks yet. Choose a curated case to establish a baseline.</p>
        ) : labJobs.slice(0, 5).map((job) => (
          <div className="ai-lab-job" key={job.job_id}>
            <div>
              <strong>{job.model}</strong>
              <span>{job.provider} · {job.case_key} · {job.duration_ms ? `${job.duration_ms} ms` : 'pending'}</span>
            </div>
            <span className={`ai-lab-job__status is-${job.status}`}>{job.status}</span>
            {job.status === 'succeeded' && (
              <span className={`ai-lab-job__check ${job.automatic_pass ? 'is-pass' : 'is-review'}`}>
                {job.automatic_pass ? 'Auto pass' : 'Review needed'}
              </span>
            )}
            {job.status === 'succeeded' && <p>{job.response_text || 'No response text returned.'}</p>}
            {job.status === 'failed' && <p className="ai-lab-panel__error">Failed: {job.error_type || 'provider error'}</p>}
            {job.cost_usd && <small>{job.cost_usd} USD · {job.cost_estimate_quality || 'unrated'} cost estimate</small>}
            {job.status === 'succeeded' && (
              <div className="ai-lab-job__actions">
                <button type="button" className="btn btn-sm" aria-label="Rate output good" aria-pressed={job.quality_rating === 1} onClick={() => rate.mutate({ jobId: job.job_id, rating: 1 })}>Good</button>
                <button type="button" className="btn btn-sm" aria-label="Rate output poor" aria-pressed={job.quality_rating === -1} onClick={() => rate.mutate({ jobId: job.job_id, rating: -1 })}>Poor</button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    if (window.confirm(`Stage ${job.provider} / ${job.model} for the ${job.layer} layer? You must still Save AI Settings.`)) {
                      onApply(job.layer, job.provider, job.model);
                    }
                  }}
                >
                  Stage for layer
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
