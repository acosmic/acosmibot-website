import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAiConfig, AiConfig, AiPersonality } from './useAiConfig';
import { FeatureToggle, SaveBar, CollapsibleSection, LoadingSpinner } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';
import { useGuildChannels } from '@/hooks/useGuildChannels';

const INSTRUCTIONS_MAX = 2000;
const NAME_MAX = 48;

const createPersonalityId = () => `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const uniqueName = (baseName: string, personalities: AiPersonality[]) => {
  const existingNames = new Set(personalities.map(p => p.name.toLowerCase()));
  let name = baseName.slice(0, NAME_MAX);
  let index = 2;
  while (existingNames.has(name.toLowerCase())) {
    const suffix = ` ${index}`;
    name = `${baseName.slice(0, NAME_MAX - suffix.length)}${suffix}`;
    index += 1;
  }
  return name;
};

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

  const activePersonality = form.personalities.find(p => p.id === form.active_personality_id) || form.personalities[0];
  if (!activePersonality) return <div>No AI personalities found.</div>;

  const charCount = (activePersonality?.instructions || '').length;
  const customPersonalities = form.personalities.filter(p => !p.built_in);

  const updatePersonalities = (personalities: AiPersonality[], activeId = form.active_personality_id) => {
    const active = personalities.find(p => p.id === activeId) || personalities[0];
    setForm({
      personalities,
      active_personality_id: active.id,
      instructions: active.instructions,
    });
  };

  const selectPersonality = (personalityId: string) => {
    updatePersonalities(form.personalities, personalityId);
  };

  const updateActivePersonality = (updates: Partial<AiPersonality>) => {
    const next = form.personalities.map(p =>
      p.id === activePersonality.id ? { ...p, ...updates } : p
    );
    updatePersonalities(next, activePersonality.id);
  };

  const addPersonality = () => {
    const nextPersonality: AiPersonality = {
      id: createPersonalityId(),
      name: uniqueName('Custom Personality', form.personalities),
      instructions: activePersonality?.instructions || '',
      built_in: false,
    };
    updatePersonalities([...form.personalities, nextPersonality], nextPersonality.id);
  };

  const copyBuiltIn = () => {
    if (!activePersonality) return;
    const copy: AiPersonality = {
      id: createPersonalityId(),
      name: uniqueName(`${activePersonality.name} Copy`, form.personalities),
      instructions: activePersonality.instructions,
      built_in: false,
    };
    updatePersonalities([...form.personalities, copy], copy.id);
  };

  const deleteActivePersonality = () => {
    if (!activePersonality || activePersonality.built_in) return;
    const next = form.personalities.filter(p => p.id !== activePersonality.id);
    updatePersonalities(next, 'default');
  };

  const saveAiConfig = () => {
    if (!activePersonality) return;
    save({
      ...form,
      active_personality_id: activePersonality.id,
      instructions: activePersonality.instructions,
    });
  };

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

      <CollapsibleSection title="Personalities" defaultOpen={true}>
        <div className="d-flex justify-content-between align-items-center gap-3 mb-3 flex-wrap">
          <div>
            <label className="form-label mb-1 d-block">Active Personality</label>
            <p className="text-muted small mb-0">Slash command switching uses this same saved list.</p>
          </div>
          <button className="btn primary" type="button" onClick={addPersonality}>
            New Personality
          </button>
        </div>

        <div className="d-flex flex-wrap gap-2 mb-4">
          {form.personalities.map(personality => (
            <button
              key={personality.id}
              type="button"
              className={`btn ${personality.id === activePersonality.id ? 'primary' : ''}`}
              onClick={() => selectPersonality(personality.id)}
              style={{
                minHeight: '38px',
                borderColor: personality.id === activePersonality.id ? 'var(--primary-color)' : 'var(--border-light)',
              }}
            >
              {personality.name}
            </button>
          ))}
        </div>

        <div className="d-flex justify-content-between align-items-start gap-3 mb-3 flex-wrap">
          <div style={{ flex: '1 1 280px' }}>
            <label className="form-label mb-2 d-block">Personality Name</label>
            <input
              className="form-control"
              value={activePersonality.name}
              disabled={activePersonality.built_in}
              maxLength={NAME_MAX}
              onChange={(e) => updateActivePersonality({ name: e.target.value })}
            />
          </div>
          <div className="d-flex gap-2 mt-4">
            {activePersonality.built_in ? (
              <button className="btn" type="button" onClick={copyBuiltIn}>
                Copy
              </button>
            ) : (
              <button
                className="btn"
                type="button"
                onClick={deleteActivePersonality}
                disabled={customPersonalities.length === 0}
              >
                Delete
              </button>
            )}
          </div>
        </div>

        <label className="form-label mb-2 d-block">System Instructions</label>
        <textarea
          className="form-control"
          rows={8}
          value={activePersonality.instructions || ''}
          disabled={activePersonality.built_in}
          onChange={(e) => {
            const text = e.target.value;
            if (text.length <= INSTRUCTIONS_MAX) {
              updateActivePersonality({ instructions: text });
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
        {activePersonality.built_in && (
          <p className="text-muted small mt-3 mb-0">Built-in personalities cannot be edited. Copy one to customize it.</p>
        )}
      </CollapsibleSection>

      {/* Channel Restrictions */}
      <CollapsibleSection title="Channel Restrictions" defaultOpen={false}>
        <label className="form-label mb-2 d-block">Channel Mode</label>
        <div className="d-flex gap-3 mb-3">
          {(['all', 'exclude', 'specific'] as const).map(mode => (
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

        {form.channel_mode === 'specific' && (
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
        onSave={saveAiConfig}
        onDiscard={resetForm}
        isSaving={isSaving}
        saveError={saveError}
      />
    </div>
  );
};
