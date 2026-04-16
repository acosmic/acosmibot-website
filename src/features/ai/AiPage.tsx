import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAiConfig, AiConfig } from './useAiConfig';
import { FeatureToggle, SaveBar, CollapsibleSection, LoadingSpinner } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';
import { useGuildChannels } from '@/hooks/useGuildChannels';

const INSTRUCTIONS_MAX = 2000;

const MODEL_OPTIONS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & Efficient)' },
  { value: 'gpt-4o', label: 'GPT-4o (Balanced)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo (Advanced)' },
];

export const AiPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { data, hasAccess, tier, isLoading, save, isSaving, saveError } = useAiConfig(guildId!);
  const { form, setForm, isDirty, resetForm } = useDirtyState<AiConfig>(data);
  const { data: channels } = useGuildChannels(guildId!);

  const textChannels = useMemo(
    () => (channels ?? []).filter(c => c.type === 0 || c.type === 5),
    [channels],
  );

  if (isLoading) return <LoadingSpinner />;

  if (!hasAccess) {
    return (
      <div className="card p-5 text-center mt-5 mx-auto" style={{ maxWidth: '600px', border: '2px solid var(--border-cyan)', background: 'linear-gradient(135deg, var(--bg-primary), var(--bg-secondary))' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🤖</div>
        <h2 className="mb-3 fs-3 fw-bold text-primary">AI Customization is Premium</h2>
        <p className="mb-4 text-muted">Personalize your server's AI assistant with unique personalities and behaviors. This feature requires the <strong>Premium + AI</strong> tier.</p>
        <div className="d-flex flex-column gap-3">
          <Link to={`/server/${guildId}/premium`} className="btn primary py-3 fw-bold">Upgrade to Premium + AI</Link>
          <p className="small text-muted mb-0">Your current tier: <span className="text-white text-capitalize">{tier.replace(/_/g, ' ')}</span></p>
        </div>
      </div>
    );
  }

  if (!form) return <div>No data found.</div>;

  const charCount = (form.instructions || '').length;

  const toggleChannel = (channelId: string, listKey: 'excluded_channels' | 'allowed_channels') => {
    const current = form[listKey] || [];
    const next = current.includes(channelId)
      ? current.filter(id => id !== channelId)
      : [...current, channelId];
    setForm({ [listKey]: next });
  };

  return (
    <div className="feature-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>AI Customization</h1>
        <p>Give your server's AI a unique personality and set of rules.</p>
      </div>

      <FeatureToggle
        enabled={form.enabled}
        onChange={(v) => setForm({ enabled: v })}
        description="Enable AI chat and image generation for this server."
      />

      {/* Model Selection */}
      <CollapsibleSection title="AI Model" defaultOpen={true}>
        <label className="form-label mb-2 d-block">Model</label>
        <select
          className="form-control"
          value={form.model || 'gpt-4o-mini'}
          onChange={(e) => setForm({ model: e.target.value })}
        >
          {MODEL_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <p className="text-muted small mt-2">Choose which AI model powers your bot's responses.</p>
      </CollapsibleSection>

      {/* Instructions */}
      <CollapsibleSection title="Instructions / Personality" defaultOpen={true}>
        <label className="form-label mb-2 d-block">System Instructions</label>
        <textarea
          className="form-control"
          rows={8}
          value={form.instructions || ''}
          onChange={(e) => {
            const text = e.target.value;
            if (text.length <= INSTRUCTIONS_MAX) {
              setForm({ instructions: text });
            }
          }}
          placeholder="Describe how the AI should act (e.g., 'helpful assistant', 'grumpy robot', 'friendly tour guide')..."
        />
        <div className="d-flex justify-content-between mt-2">
          <p className="text-muted small mb-0">Define the AI's personality, tone, and any rules it should follow.</p>
          <span style={{
            fontSize: '12px',
            fontWeight: 500,
            color: charCount > 1800 ? 'var(--error-color)' : charCount > 1500 ? 'var(--warning-color)' : 'var(--text-muted)',
          }}>
            {charCount} / {INSTRUCTIONS_MAX}
          </span>
        </div>
      </CollapsibleSection>

      {/* Channel Restrictions */}
      <CollapsibleSection title="Channel Restrictions" defaultOpen={false}>
        <label className="form-label mb-2 d-block">Channel Mode</label>
        <div className="d-flex gap-3 mb-3">
          {(['all', 'exclude', 'include'] as const).map(mode => (
            <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="channel_mode"
                checked={form.channel_mode === mode}
                onChange={() => setForm({ channel_mode: mode })}
                style={{ accentColor: 'var(--primary-color)' }}
              />
              <span style={{ color: 'var(--text-primary)', fontSize: '14px', textTransform: 'capitalize' }}>
                {mode === 'all' ? 'All Channels' : mode === 'exclude' ? 'Exclude Specific' : 'Include Only'}
              </span>
            </label>
          ))}
        </div>

        {form.channel_mode === 'exclude' && (
          <div>
            <p className="text-muted small mb-3">The AI will respond in all channels <strong>except</strong> the ones selected below.</p>
            <div style={{ maxHeight: '240px', overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border-light)', padding: '8px' }}>
              {textChannels.map(ch => (
                <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', cursor: 'pointer', borderRadius: '6px', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-overlay)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <input
                    type="checkbox"
                    checked={(form.excluded_channels || []).includes(ch.id)}
                    onChange={() => toggleChannel(ch.id, 'excluded_channels')}
                    style={{ accentColor: 'var(--primary-color)', width: '16px', height: '16px' }}
                  />
                  <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}># {ch.name}</span>
                </label>
              ))}
              {textChannels.length === 0 && (
                <p className="text-muted small p-2 mb-0">No channels available.</p>
              )}
            </div>
          </div>
        )}

        {form.channel_mode === 'include' && (
          <div>
            <p className="text-muted small mb-3">The AI will <strong>only</strong> respond in the channels selected below.</p>
            <div style={{ maxHeight: '240px', overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border-light)', padding: '8px' }}>
              {textChannels.map(ch => (
                <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', cursor: 'pointer', borderRadius: '6px', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-overlay)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <input
                    type="checkbox"
                    checked={(form.allowed_channels || []).includes(ch.id)}
                    onChange={() => toggleChannel(ch.id, 'allowed_channels')}
                    style={{ accentColor: 'var(--primary-color)', width: '16px', height: '16px' }}
                  />
                  <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}># {ch.name}</span>
                </label>
              ))}
              {textChannels.length === 0 && (
                <p className="text-muted small p-2 mb-0">No channels available.</p>
              )}
            </div>
          </div>
        )}

        {form.channel_mode === 'all' && (
          <p className="text-muted small mb-0">The AI will respond in all channels where it has access.</p>
        )}
      </CollapsibleSection>

      <SaveBar
        isDirty={isDirty}
        onSave={() => save(form)}
        onDiscard={resetForm}
        isSaving={isSaving}
        saveError={saveError}
      />
    </div>
  );
};
