import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, Bot, WalletCards } from 'lucide-react';
import {
  useAiConfig,
  AiConfig,
  AiPersonality,
  AiTrait,
  AiPersonaProfile,
  TraitCategory,
  TRAIT_CATEGORY_OPTIONS,
  AI_TOOL_CATALOG,
} from './useAiConfig';
import { AiMemorySection } from './AiMemorySection';
import { AiServerMemorySection } from './AiServerMemorySection';
import { FeatureToggle, SaveBar, CollapsibleSection, LoadingSpinner, NumberInput, TimezoneSelect } from '@/components/ui';
import { detectBrowserTimezone } from '@/components/ui/TimezoneSelect';
import { useDirtyState } from '@/hooks/useDirtyState';
import { useGuildChannels } from '@/hooks/useGuildChannels';

const NAME_MAX = 48;
const PROFILE_FIELD_MAX = 180;
const TRAIT_STYLE_MAX = 240;

// Ambient chat bounds — must mirror acosmibot-core ai_personalities.
const AMBIENT_MIN_COOLDOWN_MIN = 2;     // 120s
const AMBIENT_MAX_COOLDOWN_MIN = 1440;  // 24h
const AMBIENT_CHANCE_MIN_PCT = 1;
const AMBIENT_CHANCE_MAX_PCT = 25;
const AMBIENT_IMAGE_DAILY_MAX = 5;

const clamp = (value: number, min: number, max: number) =>
  Number.isNaN(value) ? min : Math.min(Math.max(value, min), max);

const createPersonalityId = () => `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

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
  const [selectedTraitId, setSelectedTraitId] = useState('maximum-weirdness');

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

  const customPersonalities = form.personalities.filter(p => !p.built_in);
  const selectedTrait = form.traits.find(trait => trait.id === selectedTraitId) || form.traits[0];
  const leasedPersonality = form.active_personality_effect
    ? form.personalities.find(personality => personality.id === form.active_personality_effect?.personality_id)
    : null;
  const leasedTraits = form.active_trait_effects.flatMap(effect => {
    const trait = form.traits.find(item => item.id === effect.trait_id);
    return trait ? [{ effect, trait }] : [];
  });
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

  const updateActiveProfile = (updates: Partial<AiPersonaProfile>) => {
    updateActivePersonality({
      profile: { ...activePersonality.profile, ...updates },
      legacy_unstructured: false,
    });
  };

  const addPersonality = () => {
    const nextPersonality: AiPersonality = {
      id: createPersonalityId(),
      name: uniqueName('Custom Personality', form.personalities),
      instructions: '',
      built_in: false,
      profile: JSON.parse(JSON.stringify(activePersonality.profile)),
      member_enabled: false,
      price_acosmicoins: 0,
      duration_minutes: 60,
      legacy_unstructured: false,
    };
    updatePersonalities([...form.personalities, nextPersonality], nextPersonality.id);
  };

  const copyBuiltIn = () => {
    if (!activePersonality) return;
    const copy: AiPersonality = {
      id: createPersonalityId(),
      name: uniqueName(`${activePersonality.name} Copy`, form.personalities),
      instructions: '',
      built_in: false,
      profile: JSON.parse(JSON.stringify(activePersonality.profile)),
      member_enabled: false,
      price_acosmicoins: 0,
      duration_minutes: 60,
      legacy_unstructured: false,
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

  const updateTrait = (traitId: string, updates: Partial<AiTrait>) => {
    setForm({
      traits: form.traits.map(trait => trait.id === traitId ? { ...trait, ...updates } : trait),
    });
  };

  const addTrait = () => {
    const trait: AiTrait = {
      id: `trait-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: 'Custom Trait',
      category: 'mood',
      value: 'neutral',
      style_note: '',
      built_in: false,
      member_enabled: false,
      price_acosmicoins: 0,
      duration_minutes: 60,
    };
    setForm({ traits: [...form.traits, trait] });
    setSelectedTraitId(trait.id);
  };

  const deleteTrait = () => {
    if (!selectedTrait || selectedTrait.built_in) return;
    const next = form.traits.filter(trait => trait.id !== selectedTrait.id);
    setForm({ traits: next });
    setSelectedTraitId(next[0]?.id || '');
  };

  const updateFacet = (category: TraitCategory, value: string) => {
    updateActiveProfile({ facets: { ...activePersonality.profile.facets, [category]: value } });
  };

  const updateProfileList = (key: 'catchphrases' | 'motifs' | 'terms_of_address', value: string) => {
    updateActiveProfile({
      [key]: value.split(',').map(item => item.trim()).filter(Boolean),
    } as Pick<AiPersonaProfile, typeof key>);
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

      <CollapsibleSection title="Personality Studio" defaultOpen={true}>
        <p className="ai-control-intro">
          Personas shape only the finished wording. Tool choice, permissions, facts, and safety stay under Acosmibot's code-owned rules.
        </p>
        <div className="ai-studio-toolbar">
          <label>
            <span>Server persona</span>
            <select className="form-control" value={activePersonality.id} onChange={(event) => selectPersonality(event.target.value)}>
              {form.personalities.map(personality => (
                <option key={personality.id} value={personality.id}>{personality.name}{personality.built_in ? ' · built-in' : ''}</option>
              ))}
            </select>
          </label>
          <div className="ai-studio-toolbar__actions">
            <button className="btn primary" type="button" onClick={addPersonality}>New persona</button>
            {activePersonality.built_in ? (
              <button className="btn" type="button" onClick={copyBuiltIn}>Copy to edit</button>
            ) : (
              <button className="btn" type="button" onClick={deleteActivePersonality} disabled={customPersonalities.length === 0}>Delete</button>
            )}
          </div>
        </div>

        {activePersonality.legacy_unstructured && (
          <div className="ai-boundary-note" role="status">
            This persona used the retired free-form prompt format. Its old instructions are no longer executed. Complete the structured profile below to migrate it safely.
          </div>
        )}

        <div className="ai-profile-fields">
          <label><span>Name</span><input className="form-control" value={activePersonality.name} disabled={activePersonality.built_in} maxLength={NAME_MAX} onChange={(event) => updateActivePersonality({ name: event.target.value })} /></label>
          {(['role', 'origin', 'motivation', 'flaw'] as const).map(field => (
            <label key={field}>
              <span>{field === 'flaw' ? 'Comedic flaw' : field[0].toUpperCase() + field.slice(1)}</span>
              <input className="form-control" value={activePersonality.profile[field]} disabled={activePersonality.built_in} maxLength={PROFILE_FIELD_MAX} onChange={(event) => updateActiveProfile({ [field]: event.target.value })} />
            </label>
          ))}
        </div>

        <div className="ai-facet-grid" aria-label="Persona voice facets">
          {(Object.entries(TRAIT_CATEGORY_OPTIONS) as [TraitCategory, typeof TRAIT_CATEGORY_OPTIONS[TraitCategory]][]).map(([category, definition]) => (
            <label key={category}>
              <span>{definition.label}</span>
              <select className="form-control" value={activePersonality.profile.facets[category]} disabled={activePersonality.built_in} onChange={(event) => updateFacet(category, event.target.value)}>
                {definition.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          ))}
        </div>

        <div className="ai-profile-fields ai-profile-fields--speech">
          <label><span>Catchphrases</span><input className="form-control" value={activePersonality.profile.catchphrases.join(', ')} disabled={activePersonality.built_in} onChange={(event) => updateProfileList('catchphrases', event.target.value)} placeholder="Comma-separated, used sparingly" /></label>
          <label><span>Recurring motifs</span><input className="form-control" value={activePersonality.profile.motifs.join(', ')} disabled={activePersonality.built_in} onChange={(event) => updateProfileList('motifs', event.target.value)} placeholder="Stars, clocks, old machinery" /></label>
          <label><span>Terms of address</span><input className="form-control" value={activePersonality.profile.terms_of_address.join(', ')} disabled={activePersonality.built_in} onChange={(event) => updateProfileList('terms_of_address', event.target.value)} placeholder="Captain, esteemed traveler" /></label>
        </div>
        {activePersonality.built_in && <p className="text-muted small mt-3 mb-0">Built-in identities are locked. Copy one to create an editable persona.</p>}

        <div className="ai-market-listing">
          <label className="ai-market-listing__publish"><input type="checkbox" role="switch" checked={activePersonality.member_enabled} onChange={(event) => updateActivePersonality({ member_enabled: event.target.checked })} /><span>Publish this full persona for members</span></label>
          <label><span>Price</span><NumberInput className="form-control" min={0} max={1000000000} value={activePersonality.price_acosmicoins} onValueChange={(value) => updateActivePersonality({ price_acosmicoins: Math.max(0, Math.trunc(value)) })} /><small>Acosmicoins</small></label>
          <label><span>Duration</span><NumberInput className="form-control" min={5} max={10080} value={activePersonality.duration_minutes} onValueChange={(value) => updateActivePersonality({ duration_minutes: clamp(Math.trunc(value), 5, 10080) })} /><small>minutes</small></label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Member Personality Effects" defaultOpen={true}>
        <FeatureToggle label="Member effects" enabled={form.personality_marketplace_enabled} onChange={(enabled) => setForm({ personality_marketplace_enabled: enabled })} description="Let members spend Acosmicoins on the personas and traits you publish. Effects apply server-wide." />
        {(leasedPersonality || leasedTraits.length > 0) && (
          <div className="ai-active-effects" role="status">
            <strong>Active member effect{leasedTraits.length > 1 ? 's' : ''}</strong>
            {leasedPersonality && form.active_personality_effect && (
              <span>{leasedPersonality.name} · until {new Date(form.active_personality_effect.expires_at).toLocaleString()}</span>
            )}
            {leasedTraits.map(({ effect, trait }) => (
              <span key={effect.trait_id}>{trait.name} ({TRAIT_CATEGORY_OPTIONS[trait.category].label}) · until {new Date(effect.expires_at).toLocaleString()}</span>
            ))}
          </div>
        )}
        <div className="ai-effect-rule">
          <div><strong>Compatibility is automatic.</strong><span>One active trait per category; traits in different categories can stack.</span></div>
          <label><span>Maximum active traits</span><select className="form-control" value={form.max_active_traits} onChange={(event) => setForm({ max_active_traits: Number(event.target.value) })}>{[1, 2, 3].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>

        {selectedTrait && (
          <div className="ai-trait-editor">
            <div className="ai-studio-toolbar">
              <label><span>Trait</span><select className="form-control" value={selectedTrait.id} onChange={(event) => setSelectedTraitId(event.target.value)}>{form.traits.map(trait => <option key={trait.id} value={trait.id}>{trait.name} · {TRAIT_CATEGORY_OPTIONS[trait.category].label}</option>)}</select></label>
              <div className="ai-studio-toolbar__actions"><button className="btn primary" type="button" onClick={addTrait}>New trait</button>{!selectedTrait.built_in && <button className="btn" type="button" onClick={deleteTrait}>Delete</button>}</div>
            </div>
            <div className="ai-trait-fields">
              <label><span>Name</span><input className="form-control" value={selectedTrait.name} disabled={selectedTrait.built_in} maxLength={NAME_MAX} onChange={(event) => updateTrait(selectedTrait.id, { name: event.target.value })} /></label>
              <label><span>Category slot</span><select className="form-control" value={selectedTrait.category} disabled={selectedTrait.built_in} onChange={(event) => { const category = event.target.value as TraitCategory; updateTrait(selectedTrait.id, { category, value: TRAIT_CATEGORY_OPTIONS[category].options[0].value }); }}><option value="mood">Mood</option><option value="register">Register</option><option value="brevity">Brevity</option><option value="imagination">Imagination</option><option value="attitude">Attitude</option><option value="delivery">Delivery</option></select></label>
              <label><span>Style</span><select className="form-control" value={selectedTrait.value} disabled={selectedTrait.built_in} onChange={(event) => updateTrait(selectedTrait.id, { value: event.target.value })}>{TRAIT_CATEGORY_OPTIONS[selectedTrait.category].options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label className="ai-trait-fields__note"><span>Extra flavor</span><textarea className="form-control" rows={3} value={selectedTrait.style_note} disabled={selectedTrait.built_in} maxLength={TRAIT_STYLE_MAX} onChange={(event) => updateTrait(selectedTrait.id, { style_note: event.target.value })} placeholder="A bounded presentation note—never a rule or tool instruction." /></label>
            </div>
            <div className="ai-market-listing">
              <label className="ai-market-listing__publish"><input type="checkbox" role="switch" checked={selectedTrait.member_enabled} onChange={(event) => updateTrait(selectedTrait.id, { member_enabled: event.target.checked })} /><span>Publish this trait for members</span></label>
              <label><span>Price</span><NumberInput className="form-control" min={0} max={1000000000} value={selectedTrait.price_acosmicoins} onValueChange={(value) => updateTrait(selectedTrait.id, { price_acosmicoins: Math.max(0, Math.trunc(value)) })} /><small>Acosmicoins</small></label>
              <label><span>Duration</span><NumberInput className="form-control" min={5} max={10080} value={selectedTrait.duration_minutes} onValueChange={(value) => updateTrait(selectedTrait.id, { duration_minutes: clamp(Math.trunc(value), 5, 10080) })} /><small>minutes</small></label>
            </div>
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
