import React, { useEffect, useState } from 'react';
import { Check, MessageCircle } from 'lucide-react';
import { CollapsibleSection, FeatureToggle, NumberInput } from '@/components/ui';
import { AiConfig, AiPersonality, AiPersonaProfile, AiTrait, DEFAULT_PROFILE, TRAIT_CATEGORY_OPTIONS, TraitCategory } from './useAiConfig';
import { CATEGORY_LABELS, EFFECT_DESCRIPTIONS, FEATURED_PERSONALITY_IDS, PERSONALITY_PRESENTATION, effectName, remainingEffectTime, personalityExample } from './personalityPresentation';
import { INTENSITY_LEVELS, normalizePersonalityIntensity } from './personalityIntensity';
import './personality.css';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(Math.trunc(value), min), max);
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
const uniqueName = (base: string, items: { name: string }[]) => {
  let name = base.slice(0, 48);
  for (let i = 2; items.some(item => item.name.toLowerCase() === name.toLowerCase()); i++) {
    const suffix = ` ${i}`;
    name = `${base.slice(0, 48 - suffix.length)}${suffix}`;
  }
  return name;
};

type Listing = Pick<AiTrait, 'member_enabled' | 'price_acosmicoins' | 'duration_minutes'>;
const ListingControls = ({ item, onChange, allowPermanent = false }: { item: Listing; onChange: (updates: Partial<Listing>) => void; allowPermanent?: boolean }) => (
  <div className="personality-listing">
    <label><span>Price · Acosmicoins</span><NumberInput className="form-control" min={0} max={1000000000} value={item.price_acosmicoins} onValueChange={value => onChange({ price_acosmicoins: clamp(value, 0, 1000000000) })} /><small>0 makes this effect free.</small></label>
    <div>
      {allowPermanent && <label><span>Duration</span><select className="form-control" value={item.duration_minutes === 0 ? 'permanent' : 'temporary'} onChange={event => onChange({ duration_minutes: event.target.value === 'permanent' ? 0 : 10 })}><option value="temporary">Temporary</option><option value="permanent">Permanent</option></select></label>}
      {item.duration_minutes !== 0 && <label><span>{allowPermanent ? 'Minutes' : 'Duration · minutes'}</span><NumberInput className="form-control" min={5} max={10080} value={item.duration_minutes} onValueChange={value => onChange({ duration_minutes: clamp(value, 5, 10080) })} /></label>}
      {allowPermanent && <small>{item.duration_minutes === 0 ? 'Sets the server personality until changed. Admins can restore Acosmibot above.' : 'Acosmibot returns when the time is up.'}</small>}
    </div>
  </div>
);

type EndEffect = { kind: 'persona' | 'trait'; id: string; expires_at: string };

export function PersonalitySettings({ form, setForm, saved, onEndEffect }: { form: AiConfig; setForm: (updates: Partial<AiConfig>) => void; saved?: AiConfig; onEndEffect?: (effect: EndEffect) => Promise<unknown> }) {
  const [browsingId, setBrowsingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const [pendingEnd, setPendingEnd] = useState<EndEffect | null>(null);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState('');
  const [endMessage, setEndMessage] = useState('');
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);
  const active = form.personalities.find(item => item.id === form.active_personality_id) || form.personalities[0];
  const selected = form.personalities.find(item => item.id === browsingId) || active;
  if (!active || !selected) return null;
  const presentation = selected.built_in ? PERSONALITY_PRESENTATION[selected.id] : undefined;
  const intensity = normalizePersonalityIntensity(form.personality_intensity);
  const intensityLevel = INTENSITY_LEVELS[intensity - 1];
  const custom = form.personalities.filter(item => !item.built_in);
  const more = form.personalities.filter(item => !FEATURED_PERSONALITY_IDS.includes(item.id));
  const savedActive = saved?.personalities.find(item => item.id === saved.active_personality_id) || active;
  const runtime = saved || form;
  const personaLease = runtime.active_personality_effect && Date.parse(runtime.active_personality_effect.expires_at) > now ? runtime.active_personality_effect : null;
  const traitLeases = runtime.active_trait_effects.filter(item => Date.parse(item.expires_at) > now);
  const leasedName = personaLease ? form.personalities.find(item => item.id === personaLease.personality_id)?.name : null;
  const inUse = selected.id === form.active_personality_id;
  const isEditing = editingId === selected.id && !selected.built_in;
  const updatePersonality = (id: string, updates: Partial<AiPersonality>) => setForm({ personalities: form.personalities.map(item => item.id === id ? { ...item, ...updates } : item) });
  const updateProfile = (updates: Partial<AiPersonaProfile>) => updatePersonality(selected.id, { profile: { ...selected.profile, ...updates }, legacy_unstructured: false });
  const updateFacet = (category: TraitCategory, value: string) => updateProfile({ facets: { ...selected.profile.facets, [category]: value } });
  const updateTrait = (id: string, updates: Partial<AiTrait>) => setForm({ traits: form.traits.map(item => item.id === id ? { ...item, ...updates } : item) });
  const createPersonality = (copy: boolean) => {
    const personality: AiPersonality = {
      id: newId('custom'), name: uniqueName(copy ? `${selected.name} Copy` : 'My Personality', form.personalities), instructions: '', built_in: false,
      profile: structuredClone(copy ? selected.profile : DEFAULT_PROFILE), member_enabled: false, price_acosmicoins: 0, duration_minutes: 10, legacy_unstructured: false,
    };
    setForm({ personalities: [...form.personalities, personality] });
    setBrowsingId(personality.id);
    setEditingId(personality.id);
  };
  const deletePersonality = () => {
    if (selected.built_in || personaLease?.personality_id === selected.id) return;
    const fallback = form.personalities.find(item => item.id === 'default')!;
    setForm({ personalities: form.personalities.filter(item => item.id !== selected.id), ...(inUse ? { active_personality_id: fallback.id, instructions: fallback.instructions } : {}) });
    setBrowsingId(null);
    setEditingId(null);
  };
  const choose = (id: string) => { setBrowsingId(id); setEditingId(null); };
  const requestEnd = (effect: EndEffect) => { setPendingEnd(effect); setEndError(''); setEndMessage(''); };
  const confirmEnd = async () => {
    if (!pendingEnd || !onEndEffect) return;
    setEnding(true);
    setEndError('');
    try {
      await onEndEffect(pendingEnd);
      setPendingEnd(null);
      setEndMessage('Effect ended. Acosmicoins were not refunded.');
    } catch (error) {
      setEndError(error instanceof Error ? error.message : 'Could not end the effect. Try again.');
    } finally { setEnding(false); }
  };
  const choice = (item: AiPersonality) => (
    <button key={item.id} type="button" className="personality-choice" aria-pressed={selected.id === item.id} onClick={() => choose(item.id)}>
      <span><strong>{item.name}</strong>{item.id === form.active_personality_id && <small><Check size={14} aria-hidden="true" /> Selected for server</small>}</span>
      <span>{(item.built_in && PERSONALITY_PRESENTATION[item.id]?.description) || item.profile.role}</span>
    </button>
  );
  return <>
    <CollapsibleSection title="Personality" defaultOpen={true}>
      <div className="personality-status" role="status">
        <span>Server personality: <strong>{savedActive.name}</strong>{active.id !== savedActive.id && <> → {active.name} <span>(unsaved)</span></>}</span>
        {personaLease && <span className="personality-lease">{leasedName || 'Temporary personality'} · {remainingEffectTime(personaLease.expires_at, now)}{onEndEffect && <button className="btn" type="button" disabled={ending} onClick={() => requestEnd({ kind: 'persona', id: personaLease.personality_id, expires_at: personaLease.expires_at })}>End effect</button>}</span>}
        {!personaLease && traitLeases.map(lease => <span className="personality-lease" key={lease.trait_id}>{effectName(lease.trait_id, form.traits.find(item => item.id === lease.trait_id)?.name || 'Temporary effect')} · {remainingEffectTime(lease.expires_at, now)}{onEndEffect && <button className="btn" type="button" disabled={ending} onClick={() => requestEnd({ kind: 'trait', id: lease.trait_id, expires_at: lease.expires_at })}>End effect</button>}</span>)}
        {endMessage && <span>{endMessage}</span>}
      </div>
      {pendingEnd && <div className="personality-end-confirmation">
        <p>End this effect now? It stops immediately for the whole server. Acosmicoins will not be refunded.</p>
        <div className="personality-actions"><button type="button" className="btn" disabled={ending} onClick={confirmEnd}>{ending ? 'Ending…' : 'End now'}</button><button type="button" className="btn" disabled={ending} onClick={() => setPendingEnd(null)}>Keep effect</button></div>
        {endError && <p role="alert">{endError}</p>}
      </div>}
      <p className="ai-control-intro">Always Acosmibot, your AI Discord bot. Pick the voice he uses for your server.</p>
      <div className="personality-workspace">
        <div className="personality-library">
          <div className="personality-choices" aria-label="Built-in personalities">{FEATURED_PERSONALITY_IDS.flatMap(id => { const item = form.personalities.find(p => p.id === id); return item ? [choice(item)] : []; })}</div>
          {more.length > 0 && <details className="personality-details" open={more.some(item => item.id === selected.id) || undefined}>
            <summary>More personalities & custom creations ({more.length})</summary>
            <div className="personality-choices">{more.map(choice)}</div>
          </details>}
          <button type="button" className="btn personality-create" disabled={custom.length >= 12} onClick={() => createPersonality(false)}>Create a personality</button>
          {custom.length >= 12 && <p className="personality-note">You have 12 custom personalities. Edit or remove one to make room.</p>}
        </div>
        <div className="personality-preview" aria-label="Selected personality">
          <h3>{selected.name}</h3>
          <p>{presentation?.description || selected.profile.role}</p>
          {presentation ? <div className="personality-example" aria-live="polite">
            <span className="personality-example-label"><MessageCircle size={16} aria-hidden="true" /> Example conversation</span>
            <p><strong>Member</strong>Why did we lose that match?</p>
            <p><strong>Acosmibot{selected.id !== 'default' && ` · ${selected.name} voice`}</strong>{personalityExample(selected.id, intensity)}</p>
            <small>Written example of this voice. Actual replies vary.</small>
          </div> : <div className="personality-example">
            <span className="personality-example-label">Your character</span>
            <p>{selected.profile.role}</p>
            <small>Save and mention Acosmibot in Discord to try your custom voice.</small>
          </div>}
          <div className="personality-intensity">
            <div className="personality-intensity-heading"><label htmlFor="personality-intensity">Character intensity</label><output htmlFor="personality-intensity">{intensity}/5 · {intensityLevel.label}</output></div>
            <input id="personality-intensity" type="range" min={1} max={5} step={1} value={intensity}
              aria-valuetext={`${intensity} of 5: ${intensityLevel.label}`} aria-describedby="personality-intensity-help"
              onChange={event => setForm({ personality_intensity: normalizePersonalityIntensity(event.target.value) })} />
            <div className="personality-intensity-ticks" aria-hidden="true">{INTENSITY_LEVELS.map(level => <span key={level.value}>{level.value}</span>)}</div>
            <p id="personality-intensity-help" className="personality-note">{intensityLevel.description} Applies server-wide; he stays Acosmibot at every level.</p>
          </div>
          <div className="personality-actions">
            <button type="button" className="btn primary" disabled={inUse} onClick={() => setForm({ active_personality_id: selected.id, instructions: selected.instructions })}>{inUse ? 'Selected for server' : 'Use this personality'}</button>
            <button type="button" className="btn" disabled={selected.built_in && custom.length >= 12} onClick={() => selected.built_in ? createPersonality(true) : setEditingId(isEditing ? null : selected.id)}>{isEditing ? 'Close editor' : 'Customize'}</button>
          </div>
          <p className="personality-note">Apply your choices with Save Changes below.</p>
        </div>
      </div>
      {isEditing && <section className="personality-editor" aria-label="Customize personality" key={selected.id}>
        <h3>Make {selected.name} yours</h3>
        {selected.legacy_unstructured && <p className="ai-boundary-note">This saved personality uses an older format. Describe its voice below to update it.</p>}
        <div className="personality-simple-fields">
          <label><span>Name</span><input autoFocus className="form-control" maxLength={48} value={selected.name} onChange={event => updatePersonality(selected.id, { name: event.target.value })} /></label>
          <label><span>Reply length</span><select className="form-control" value={selected.profile.facets.brevity} onChange={event => updateFacet('brevity', event.target.value)}><option value="balanced">Balanced</option><option value="ultra_terse">Short & direct</option></select></label>
          <label className="personality-description"><span>Personality description</span><textarea className="form-control" rows={3} maxLength={180} value={selected.profile.role} onChange={event => updateProfile({ role: event.target.value })} placeholder="A friendly space mechanic who explains things plainly and occasionally compares problems to broken engines." /><small>Describe how it sounds. {selected.profile.role.length}/180</small></label>
        </div>
        <details className="personality-details">
          <summary>Fine-tune character</summary>
          <div className="ai-profile-fields">{(['origin', 'motivation', 'flaw'] as const).map(field => <label key={field}><span>{{ origin: 'Backstory', motivation: 'Motivation', flaw: 'Comedic quirk' }[field]}</span><input className="form-control" maxLength={180} value={selected.profile[field]} onChange={event => updateProfile({ [field]: event.target.value })} /></label>)}</div>
          <div className="ai-facet-grid">{(Object.entries(TRAIT_CATEGORY_OPTIONS) as [TraitCategory, typeof TRAIT_CATEGORY_OPTIONS[TraitCategory]][]).filter(([category]) => category !== 'brevity').map(([category, definition]) => <label key={category}><span>{CATEGORY_LABELS[category]}</span><select className="form-control" value={selected.profile.facets[category]} onChange={event => updateFacet(category, event.target.value)}>{definition.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}</div>
          <div className="ai-profile-fields ai-profile-fields--speech">{(['catchphrases', 'motifs', 'terms_of_address'] as const).map(key => <label key={key}><span>{{ catchphrases: 'Catchphrases', motifs: 'Recurring themes', terms_of_address: 'Names for the audience' }[key]}</span><input className="form-control" value={selected.profile[key].join(', ')} onChange={event => updateProfile({ [key]: event.target.value.split(',').map(item => item.trim()) })} placeholder="Separate with commas; used sparingly" /></label>)}</div>
          <button className="btn personality-remove" type="button" onClick={deletePersonality} disabled={personaLease?.personality_id === selected.id}>Remove this custom personality</button>
          {personaLease?.personality_id === selected.id && <p className="personality-note">This personality can be removed after its active member effect ends.</p>}
        </details>
      </section>}
    </CollapsibleSection>

    <CollapsibleSection title="Member personalities" defaultOpen={true}>
      <FeatureToggle label="Let members choose a personality" enabled={form.personality_marketplace_enabled} onChange={enabled => setForm({ personality_marketplace_enabled: enabled })} description="Choose the personalities members can buy with Acosmicoins using /ai style. Purchases apply to the whole server." />
      {!form.personality_marketplace_enabled && (personaLease || traitLeases.length > 0) && <p className="personality-note">New purchases are off. Active effects keep their remaining time.</p>}
      {form.personality_marketplace_enabled && <>
        <p className="personality-note">The same personality library as the admin picker, without the default Acosmibot voice. Timed purchases return to Acosmibot; permanent purchases stay until changed.</p>
        <div className="personality-effect-catalog" aria-label="Personalities members can purchase">
          {form.personalities.filter(item => item.id !== 'default').map(item => <div className="personality-effect" key={item.id}>
            <label className="personality-effect-toggle"><input type="checkbox" checked={item.member_enabled} onChange={event => updatePersonality(item.id, { member_enabled: event.target.checked })} /><span><strong>{item.name}</strong><small>{(item.built_in && PERSONALITY_PRESENTATION[item.id]?.description) || item.profile.role}</small></span></label>
            {item.member_enabled && <ListingControls item={item} allowPermanent onChange={updates => updatePersonality(item.id, updates)} />}
          </div>)}
        </div>
        <details className="personality-details">
          <summary>Advanced · traits & stacking</summary>
          <p className="personality-note">Traits change one aspect of the voice. They can stack with other categories, but not with a timed full personality.</p>
        <div className="personality-effect-catalog">{form.traits.map(trait => <div className="personality-effect" key={trait.id}>
          <label className="personality-effect-toggle"><input type="checkbox" checked={trait.member_enabled} onChange={event => updateTrait(trait.id, { member_enabled: event.target.checked })} /><span><strong>{effectName(trait.id, trait.name)}</strong><small>{EFFECT_DESCRIPTIONS[trait.id] || trait.style_note || `${CATEGORY_LABELS[trait.category]}: ${TRAIT_CATEGORY_OPTIONS[trait.category].options.find(option => option.value === trait.value)?.label || trait.value}`}</small></span></label>
          {trait.member_enabled && <ListingControls item={trait} onChange={updates => updateTrait(trait.id, updates)} />}
        </div>)}</div>
          <div className="ai-effect-rule"><div><strong>Effects combine automatically.</strong><span>One effect per style category. Conflicting purchases are blocked.</span></div><label><span>Maximum simultaneous effects</span><select className="form-control" value={form.max_active_traits} onChange={event => setForm({ max_active_traits: Number(event.target.value) })}>{[1, 2, 3].map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>
          <h3>Custom effects</h3>
          {form.traits.filter(trait => !trait.built_in).map(trait => <details className="personality-details" key={trait.id}>
            <summary>Edit {trait.name}</summary>
            <div className="ai-trait-fields">
              <label><span>Name</span><input className="form-control" maxLength={48} value={trait.name} onChange={event => updateTrait(trait.id, { name: event.target.value })} /></label>
              <label><span>Changes</span><select className="form-control" value={trait.category} onChange={event => { const category = event.target.value as TraitCategory; updateTrait(trait.id, { category, value: TRAIT_CATEGORY_OPTIONS[category].options[0].value }); }}>{Object.entries(CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label><span>Style</span><select className="form-control" value={trait.value} onChange={event => updateTrait(trait.id, { value: event.target.value })}>{TRAIT_CATEGORY_OPTIONS[trait.category].options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label className="ai-trait-fields__note"><span>Extra flavor</span><textarea className="form-control" rows={2} maxLength={240} value={trait.style_note} onChange={event => updateTrait(trait.id, { style_note: event.target.value })} placeholder="For example: sounds delighted by even the smallest success." /></label>
            </div>
            <button className="btn personality-remove" type="button" disabled={traitLeases.some(lease => lease.trait_id === trait.id)} onClick={() => setForm({ traits: form.traits.filter(item => item.id !== trait.id) })}>Remove effect</button>
          </details>)}
          <button className="btn" type="button" disabled={form.traits.filter(trait => !trait.built_in).length >= 24} onClick={() => setForm({ traits: [...form.traits, { id: newId('trait'), name: uniqueName('My Effect', form.traits), category: 'mood', value: 'overenthusiastic', style_note: '', built_in: false, member_enabled: false, price_acosmicoins: 0, duration_minutes: 10 }] })}>Create an effect</button>
        </details>
      </>}
    </CollapsibleSection>
  </>;
}
