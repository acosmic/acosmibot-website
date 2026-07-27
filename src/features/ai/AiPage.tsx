import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Bot } from 'lucide-react';
import {
  useAiConfig,
  AiConfig,
  AiPersonality,
} from './useAiConfig';
import { AiMemorySection } from './AiMemorySection';
import { AiServerMemorySection } from './AiServerMemorySection';
import { FeatureToggle, SaveBar, CollapsibleSection, LoadingSpinner, NumberInput, TimezoneSelect } from '@/components/ui';
import { detectBrowserTimezone } from '@/components/ui/TimezoneSelect';
import { useDirtyState } from '@/hooks/useDirtyState';
import { useGuildChannels } from '@/hooks/useGuildChannels';

const INSTRUCTIONS_MAX = 2000;
const NAME_MAX = 48;

// Ambient chat bounds — must mirror acosmibot-core ai_personalities.
const AMBIENT_MIN_COOLDOWN_MIN = 2;     // 120s
const AMBIENT_MAX_COOLDOWN_MIN = 1440;  // 24h
const AMBIENT_CHANCE_MIN_PCT = 1;
const AMBIENT_CHANCE_MAX_PCT = 25;
const AMBIENT_IMAGE_DAILY_MAX = 5;

const clamp = (value: number, min: number, max: number) =>
  Number.isNaN(value) ? min : Math.min(Math.max(value, min), max);

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

  if (!form) return <div>No data found.</div>;

  if (!hasAccess) {
    return (
      <div className="feature-page">
        <div className="page-header text-start mt-0 mb-4">
          <h1>AI Customization</h1>
          <p>Control whether members can mention Acosmibot for AI replies.</p>
        </div>

        <FeatureToggle
          label="AI Chat"
          enabled={form.enabled}
          onChange={(enabled) => setForm({ enabled })}
          description="Allow members to mention Acosmibot for basic AI chat. This is enabled by default and uses your plan's daily and monthly reply limits."
        />

        <section className="ai-upgrade-panel" aria-labelledby="advanced-ai-heading">
          <div className="ai-upgrade-panel__signal" aria-hidden="true">
            <Bot size={30} strokeWidth={1.8} />
          </div>
          <div className="ai-upgrade-panel__content">
            <div className="ai-upgrade-panel__heading">
              <div>
                <span className="ai-upgrade-panel__kicker">Pro / Max controls</span>
                <h2 id="advanced-ai-heading">Unlock advanced AI customization</h2>
              </div>
              <span className="ai-upgrade-panel__tier">
                {tier.replace(/_/g, ' ')} plan
              </span>
            </div>
            <p>
              Upgrade to shape how your server's AI behaves and give it richer
              ways to join the conversation.
            </p>
            <ul className="ai-upgrade-panel__features" aria-label="Advanced AI features">
              <li>Custom personalities</li>
              <li>Memory</li>
              <li>Web search</li>
              <li>Ambient chat</li>
              <li>AI media tools</li>
            </ul>
            <Link to={`/pricing?guild=${guildId}`} className="btn primary">
              View Pro and Max plans
            </Link>
          </div>
        </section>

        <SaveBar
          isDirty={isDirty}
          onSave={() => save({ enabled: form.enabled })}
          onDiscard={resetForm}
          isSaving={isSaving}
          saveError={saveError}
        />
      </div>
    );
  }

  const activePersonality = form.personalities.find(p => p.id === form.active_personality_id) || form.personalities[0];
  if (!activePersonality) return <div>No AI personalities found.</div>;

  const charCount = (activePersonality?.instructions || '').length;
  const customPersonalities = form.personalities.filter(p => !p.built_in);
  const ambientDailyMax = tier === 'max' ? 100 : 25;
  const ambientFrequencyPct = clamp(
    Math.round((form.ambient_frequency ?? 0.03) * 100),
    AMBIENT_CHANCE_MIN_PCT,
    AMBIENT_CHANCE_MAX_PCT,
  );
  const ambientFrequencySliderProgress = (
    (ambientFrequencyPct - AMBIENT_CHANCE_MIN_PCT)
    / (AMBIENT_CHANCE_MAX_PCT - AMBIENT_CHANCE_MIN_PCT)
  ) * 100;
  const ambientImageChancePct = clamp(
    Math.round((form.ambient_image_chance ?? 0.15) * 100),
    AMBIENT_CHANCE_MIN_PCT,
    AMBIENT_CHANCE_MAX_PCT,
  );
  const ambientImageSliderProgress = (
    (ambientImageChancePct - AMBIENT_CHANCE_MIN_PCT)
    / (AMBIENT_CHANCE_MAX_PCT - AMBIENT_CHANCE_MIN_PCT)
  ) * 100;

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
        label="AI Chat"
        enabled={form.enabled}
        onChange={(v) => setForm({ enabled: v })}
        description="Enable AI chat and advanced AI tools for this server."
      />

      <FeatureToggle
        label="Web Search"
        enabled={form.web_search}
        onChange={(v) => setForm({ web_search: v })}
        description="Let the AI look up live information from the web when members ask it to search, look something up, or find current info."
      />

      <FeatureToggle
        label="Memory"
        enabled={form.memory_enabled}
        onChange={(v) => setForm({ memory_enabled: v })}
        description="Let the AI remember facts members share about themselves (favorite game, timezone, running jokes) and use them in future replies. Members can review or clear their own memory with /ai memory."
      />

      <AiMemorySection guildId={guildId!} enabled={form.memory_enabled} />
      <AiServerMemorySection guildId={guildId!} enabled={form.memory_enabled} />

      <CollapsibleSection title="Timezone" defaultOpen={false}>
        <p className="text-muted small mb-3">
          The default timezone the AI uses for dates and times (e.g. "what's today?",
          "how long until the weekend?"). Members can override this with their own
          timezone in their profile settings.
        </p>
        <label className="form-label mb-2 d-block">Server default timezone</label>
        <TimezoneSelect
          value={form.timezone || 'UTC'}
          onChange={(tz) => setForm({ timezone: tz })}
        />
        <div className="mt-2">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setForm({ timezone: detectBrowserTimezone() })}
          >
            Use my current timezone ({detectBrowserTimezone().replace(/_/g, ' ')})
          </button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Ambient Chat" defaultOpen={false}>
        <p className="text-muted small mb-4">
          When enabled, the AI will occasionally join conversations on its own — without being
          mentioned — in your server's chosen personality. Tune how often and how much it does so below.
        </p>

        <FeatureToggle
          label="Enable ambient chat"
          enabled={form.ambient_enabled}
          onChange={(v) => setForm({ ambient_enabled: v })}
          description="Allow the AI to chime in unprompted on eligible messages."
        />

        {form.ambient_enabled && (
          <div className="ambient-settings-grid mt-4">
            <div className="ambient-chance-control">
              <div className="ambient-control-heading">
                <label className="form-label mb-0" htmlFor="ambient-frequency">
                  Chime-in chance
                </label>
                <span className="ambient-chance-value">
                  {ambientFrequencyPct}%
                </span>
              </div>

              <input
                id="ambient-frequency"
                className="ambient-chance-slider"
                type="range"
                min={AMBIENT_CHANCE_MIN_PCT}
                max={AMBIENT_CHANCE_MAX_PCT}
                step={1}
                value={ambientFrequencyPct}
                style={{
                  '--ambient-slider-progress': `${ambientFrequencySliderProgress}%`,
                } as React.CSSProperties}
                aria-describedby="ambient-frequency-help"
                aria-valuetext={`${ambientFrequencyPct} percent of eligible messages`}
                onChange={(event) => setForm({
                  ambient_frequency: Number(event.currentTarget.value) / 100,
                })}
              />

              <div className="ambient-chance-labels" aria-hidden="true">
                <span><strong>Minimum</strong><small>1%</small></span>
                <span><strong>Midpoint</strong><small>13%</small></span>
                <span><strong>Maximum</strong><small>25%</small></span>
              </div>
              <p id="ambient-frequency-help" className="text-muted small mt-2 mb-0">
                Applies to eligible messages with at least 25 characters.
              </p>
            </div>

            <div className="ambient-number-control">
              <label className="form-label mb-1 d-block">Cooldown</label>
              <div className="d-flex align-items-center gap-2">
                <NumberInput
                  className="form-control"
                  min={AMBIENT_MIN_COOLDOWN_MIN}
                  max={AMBIENT_MAX_COOLDOWN_MIN}
                  step={1}
                  value={Math.round((form.ambient_cooldown_seconds ?? 600) / 60)}
                  onValueChange={(value) => setForm({
                    ambient_cooldown_seconds: clamp(
                      Math.trunc(value),
                      AMBIENT_MIN_COOLDOWN_MIN,
                      AMBIENT_MAX_COOLDOWN_MIN,
                    ) * 60,
                  })}
                  style={{ maxWidth: '110px' }}
                />
                <span className="text-muted">minutes</span>
              </div>
              <p className="text-muted small mt-1 mb-0">
                Quiet period per channel after it speaks. Minimum 2 minutes.
              </p>
            </div>

            <div className="ambient-number-control">
              <label className="form-label mb-1 d-block">Daily limit</label>
              <NumberInput
                className="form-control"
                min={1}
                max={ambientDailyMax}
                step={1}
                value={Math.min(form.ambient_daily_limit ?? 25, ambientDailyMax)}
                onValueChange={(value) => setForm({
                  ambient_daily_limit: clamp(Math.trunc(value), 1, ambientDailyMax),
                })}
                style={{ maxWidth: '110px' }}
              />
              <p className="text-muted small mt-1 mb-0">
                Up to {ambientDailyMax} ambient replies per day on {tier === 'max' ? 'Max' : 'Pro'}.
              </p>
            </div>
          </div>
        )}

        {form.ambient_enabled && (
          <div className="mt-4">
            <FeatureToggle
              label="Meme images"
              enabled={form.ambient_images_enabled}
              onChange={(v) => setForm({ ambient_images_enabled: v })}
              description="Let a share of ambient replies include an AI-generated meme or image riffing on the conversation (may use participants' avatars). Counts toward the monthly image generation limit."
            />

            {form.ambient_images_enabled && (
              <div className="ambient-settings-grid mt-4">
                <div className="ambient-chance-control">
                  <div className="ambient-control-heading">
                    <label className="form-label mb-0" htmlFor="ambient-image-chance">
                      Image chance
                    </label>
                    <span className="ambient-chance-value">
                      {ambientImageChancePct}%
                    </span>
                  </div>

                  <input
                    id="ambient-image-chance"
                    className="ambient-chance-slider"
                    type="range"
                    min={AMBIENT_CHANCE_MIN_PCT}
                    max={AMBIENT_CHANCE_MAX_PCT}
                    step={1}
                    value={ambientImageChancePct}
                    style={{
                      '--ambient-slider-progress': `${ambientImageSliderProgress}%`,
                    } as React.CSSProperties}
                    aria-describedby="ambient-image-chance-help"
                    aria-valuetext={`${ambientImageChancePct} percent of ambient replies`}
                    onChange={(event) => setForm({
                      ambient_image_chance: Number(event.currentTarget.value) / 100,
                    })}
                  />

                  <div className="ambient-chance-labels" aria-hidden="true">
                    <span><strong>Minimum</strong><small>1%</small></span>
                    <span><strong>Midpoint</strong><small>13%</small></span>
                    <span><strong>Maximum</strong><small>25%</small></span>
                  </div>
                  <p id="ambient-image-chance-help" className="text-muted small mt-2 mb-0">
                    Share of ambient replies that may generate an image. The AI may
                    still skip it when the moment doesn't call for one.
                  </p>
                </div>

                <div className="ambient-number-control">
                  <label className="form-label mb-1 d-block">Image cooldown</label>
                  <div className="d-flex align-items-center gap-2">
                    <NumberInput
                      className="form-control"
                      min={AMBIENT_MIN_COOLDOWN_MIN}
                      max={AMBIENT_MAX_COOLDOWN_MIN}
                      step={1}
                      value={Math.round(
                        (form.ambient_image_cooldown_seconds ?? 600) / 60,
                      )}
                      onValueChange={(value) => setForm({
                        ambient_image_cooldown_seconds: clamp(
                          Math.trunc(value),
                          AMBIENT_MIN_COOLDOWN_MIN,
                          AMBIENT_MAX_COOLDOWN_MIN,
                        ) * 60,
                      })}
                      style={{ maxWidth: '110px' }}
                    />
                    <span className="text-muted">minutes</span>
                  </div>
                  <p className="text-muted small mt-1 mb-0">
                    Quiet period per channel after a meme image. Minimum 2 minutes.
                  </p>
                </div>

                <div className="ambient-number-control">
                  <label className="form-label mb-1 d-block">Image daily limit</label>
                  <NumberInput
                    className="form-control"
                    min={1}
                    max={AMBIENT_IMAGE_DAILY_MAX}
                    step={1}
                    value={Math.min(
                      form.ambient_image_daily_limit ?? AMBIENT_IMAGE_DAILY_MAX,
                      AMBIENT_IMAGE_DAILY_MAX,
                    )}
                    onValueChange={(value) => setForm({
                      ambient_image_daily_limit: clamp(
                        Math.trunc(value),
                        1,
                        AMBIENT_IMAGE_DAILY_MAX,
                      ),
                    })}
                    style={{ maxWidth: '110px' }}
                  />
                  <p className="text-muted small mt-1 mb-0">
                    Up to {AMBIENT_IMAGE_DAILY_MAX} ambient meme images per day.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Personalities" defaultOpen={true}>
        <div className="d-flex justify-content-between align-items-end gap-3 mb-4 flex-wrap">
          <div style={{ flex: '0 1 420px', minWidth: '260px' }}>
            <label className="form-label mb-1 d-block">Active Personality</label>
            <select
              className="form-control"
              value={activePersonality.id}
              onChange={(e) => selectPersonality(e.target.value)}
              style={{ maxWidth: '420px' }}
            >
              {form.personalities.map(personality => (
                <option key={personality.id} value={personality.id}>
                  {personality.name}{personality.built_in ? ' (Built-in)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button className="btn primary" type="button" onClick={addPersonality}>
              New Personality
            </button>
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

        <div className="mb-3" style={{ maxWidth: '420px' }}>
          <label className="form-label mb-2 d-block">Personality Name</label>
          <input
            className="form-control"
            value={activePersonality.name}
            disabled={activePersonality.built_in}
            maxLength={NAME_MAX}
            onChange={(e) => updateActivePersonality({ name: e.target.value })}
          />
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
