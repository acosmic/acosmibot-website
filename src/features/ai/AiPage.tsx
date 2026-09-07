import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, Bot, WalletCards } from 'lucide-react';
import {
  useAiConfig,
  AiConfig,
  AI_TOOL_CATALOG,
} from './useAiConfig';
import { PersonalitySettings } from './PersonalitySettings';
import { AiMemorySection } from './AiMemorySection';
import { AiServerMemorySection } from './AiServerMemorySection';
import { FeatureToggle, SaveBar, CollapsibleSection, LoadingSpinner, NumberInput, TimezoneSelect } from '@/components/ui';
import { detectBrowserTimezone } from '@/components/ui/TimezoneSelect';
import { useDirtyState } from '@/hooks/useDirtyState';
import { useGuildChannels } from '@/hooks/useGuildChannels';

// Ambient chat bounds — must mirror acosmibot-core ai_personalities.
const AMBIENT_MIN_COOLDOWN_MIN = 2;     // 120s
const AMBIENT_MAX_COOLDOWN_MIN = 1440;  // 24h
const AMBIENT_CHANCE_MIN_PCT = 1;
const AMBIENT_CHANCE_MAX_PCT = 25;
const AMBIENT_IMAGE_DAILY_MAX = 5;

const clamp = (value: number, min: number, max: number) =>
  Number.isNaN(value) ? min : Math.min(Math.max(value, min), max);

const AIPaidOveragePanel: React.FC<{ guildId: string }> = ({ guildId }) => (
  <section className="ai-paid-overage-panel" aria-labelledby="ai-paid-overage-heading">
    <div className="ai-paid-overage-panel__signal" aria-hidden="true"><WalletCards /></div>
    <div>
      <span className="ai-paid-overage-panel__kicker">Included quota first</span>
      <h2 id="ai-paid-overage-heading">AI Credits are controlled overage.</h2>
      <p>Server administrators can enable a guild wallet and choose eligible operations after the plan quota. Personal fallback needs member consent too; credits never unlock Pro/Max configuration or ambient spending.</p>
      <div className="ai-paid-overage-panel__actions">
        <Link to={`/server/${guildId}/billing`} className="btn primary">Open Billing policy <ArrowRight aria-hidden="true" /></Link>
        <Link to="/credits" className="ai-paid-overage-panel__link">Personal wallet <ArrowRight aria-hidden="true" /></Link>
      </div>
    </div>
  </section>
);

export const AiPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { data, hasAccess, tier, isLoading, save, isSaving, saveError, endEffect } = useAiConfig(guildId!);
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

        <AIPaidOveragePanel guildId={guildId!} />

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

  const saveAiConfig = () => {
    if (!activePersonality) return;
    const {
      active_personality_effect: _activePersonalityEffect,
      active_trait_effects: _activeTraitEffects,
      ...editableConfig
    } = form;
    save({
      ...editableConfig,
      active_personality_id: activePersonality.id,
      instructions: activePersonality.built_in ? activePersonality.instructions : '',
      web_search: form.tools.web_search,
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
        <p>Choose your server’s AI voice and how it joins the conversation.</p>
      </div>

      <PersonalitySettings form={form} setForm={setForm} saved={data} onEndEffect={endEffect} />

      <AIPaidOveragePanel guildId={guildId!} />

      <FeatureToggle
        label="AI Chat"
        enabled={form.enabled}
        onChange={(v) => setForm({ enabled: v })}
        description="Enable AI chat and advanced AI tools for this server."
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

      <CollapsibleSection title="AI Tools" defaultOpen={false}>
        <p className="ai-control-intro">Each switch filters the tool out before model planning and is checked again before execution. Slash commands remain available.</p>
        <fieldset className="ai-tool-matrix ai-safety-options mb-4">
          <legend className="form-label mb-2">Generated-image safety</legend>
          <label className="ai-tool-row">
            <span>
              <strong>Standard filtering</strong>
              <small>OpenAI's default image safety setting. Recommended for most servers.</small>
            </span>
            <input
              type="radio"
              name="image_moderation"
              value="auto"
              checked={form.image_moderation === 'auto'}
              onChange={() => setForm({ image_moderation: 'auto' })}
            />
          </label>
          <label className="ai-tool-row">
            <span>
              <strong>Reduced filtering in age-restricted channels</strong>
              <small>
                Requests use OpenAI's less restrictive mode only in Discord channels marked
                age-restricted. Standard filtering still applies everywhere else and to ambient images.
                OpenAI may still reject explicit content.
              </small>
            </span>
            <input
              type="radio"
              name="image_moderation"
              value="low"
              checked={form.image_moderation === 'low'}
              onChange={() => setForm({ image_moderation: 'low' })}
            />
          </label>
        </fieldset>
        <div className="ai-tool-matrix">
          {AI_TOOL_CATALOG.map(tool => (
            <label key={tool.name} className="ai-tool-row">
              <span><strong>{tool.label}</strong><small>{tool.description}</small></span>
              <input type="checkbox" role="switch" checked={form.tools[tool.name]} onChange={(event) => setForm({ tools: { ...form.tools, [tool.name]: event.target.checked }, ...(tool.name === 'web_search' ? { web_search: event.target.checked } : {}) })} />
            </label>
          ))}
        </div>
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
