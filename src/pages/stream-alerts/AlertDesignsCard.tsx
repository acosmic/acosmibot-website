import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import {
  streamAlertsApi,
  StreamAlertAccount,
  StreamAlertDesign,
  StreamAlertDesigns,
  StreamAlertDesignText,
  StreamAlertTier,
  StreamAlertType,
} from '@/api/streamAlerts';
import { PageNotice, plainError } from '@/utils/streamAlertAccounts';
import {
  alertLength,
  assetsQueryKey,
  defaultText,
  DESIGN_FONTS,
  DESIGN_KINDS,
  DesignProblem,
  designsQueryKey,
  fieldTextIndex,
  formatLength,
  KIND_LABELS,
  MAX_TEXTS,
  newDesign,
  normalizeDesign,
  normalizeField,
  resolveDraft,
  sameDesign,
  SampleValues,
  sampleFireOptions,
  sampleTemplateValues,
  sampleTestInput,
  DEFAULT_SAMPLES,
  validateDesign,
  variableLabel,
  variablesFor,
} from '@/utils/streamAlertDesigns';
import { useAssets } from './MediaLibraryCard';
import { DesignStage, BOX_COLOURS } from './DesignStage';
import { FieldError, TextBoxProperties } from './TextBoxProperties';
import { useDesignFonts } from './designFonts';
import './StreamAlertDesigns.css';
import type { PreviewHandle } from './previewHandle';

const TIERS: { value: StreamAlertTier; label: string }[] = [
  { value: '1000', label: 'Tier 1' },
  { value: '2000', label: 'Tier 2' },
  { value: '3000', label: 'Tier 3' },
  { value: 'prime', label: 'Prime' },
];

/** Fields the page has an input for. Any other field the API names is shown beside Save. */
const TOP_FIELDS = ['video', 'image', 'sound', 'duration_ms', 'x', 'y', 'scale', 'volume', 'texts'];
const TEXT_FIELDS = ['template', 'font', 'size', 'color', 'appear_ms', 'disappear_ms'];

/**
 * One tab per alert kind. A kind uses the built-in card until it has a custom design: a video
 * or picture from the media library, placed on the screen, with up to four text boxes on it.
 * Unsaved changes are never dropped silently: switching kind asks first here, and switching
 * account asks first in the workspace (told through `onDirtyChange`).
 */
export const AlertDesignsCard: React.FC<{
  account: StreamAlertAccount;
  preview: React.MutableRefObject<PreviewHandle | null>;
  /** The kind with unsaved changes ("Follow"), or null when there are none. */
  onDirtyChange: (label: string | null) => void;
}> = ({ account, preview, onDirtyChange }) => {
  const queryClient = useQueryClient();
  const accountId = account.id;
  const designsKey = designsQueryKey(accountId);
  const assetsKey = assetsQueryKey(accountId);
  const designs = useQuery({ queryKey: designsKey, queryFn: () => streamAlertsApi.getDesigns(accountId) });
  const library = useAssets(accountId);
  const assets = useMemo(() => library.data?.assets ?? [], [library.data]);
  const cardRef = useRef<HTMLElement>(null);
  const previewButton = useRef<HTMLButtonElement>(null);

  const [kind, setKind] = useState<StreamAlertType>('follow');
  const [draft, setDraft] = useState<StreamAlertDesign | null>(null);
  /** The saved design the draft started from, and for which kind. */
  const [loaded, setLoaded] = useState<{ kind: StreamAlertType; base: StreamAlertDesign | null } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [time, setTime] = useState(0);
  const [samples, setSamples] = useState<SampleValues>(DEFAULT_SAMPLES);
  const [triedSave, setTriedSave] = useState(false);
  const [serverProblem, setServerProblem] = useState<DesignProblem | null>(null);
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const [pendingKind, setPendingKind] = useState<StreamAlertType | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [startWith, setStartWith] = useState('');

  const data = designs.data;
  const kinds = useMemo(() => {
    const fromApi = data?.kinds?.length ? DESIGN_KINDS.filter((item) => data.kinds.includes(item)) : [];
    return fromApi.length ? fromApi : DESIGN_KINDS;
  }, [data]);
  const fonts = data?.fonts?.length ? data.fonts : DESIGN_FONTS;
  const variables = variablesFor(kind, data?.variables?.[kind]);
  const savedRaw = data?.designs?.[kind];
  const base = useMemo(() => (savedRaw ? normalizeDesign(savedRaw) : null), [savedRaw]);
  const dirty = Boolean(loaded) && !sameDesign(draft, base);
  const fontsVersion = useDesignFonts(fonts, assets);

  const readyMedia = assets.filter((asset) => asset.status === 'ready' && asset.url && (asset.kind === 'video' || asset.kind === 'image'));
  const readySounds = assets.filter((asset) => asset.status === 'ready' && asset.url && asset.kind === 'sound');
  const readyFonts = assets.filter((asset) => asset.status === 'ready' && asset.url && asset.kind === 'font');
  const mediaId = draft ? draft.video ?? draft.image : null;
  const media = mediaId === null ? null : assets.find((asset) => asset.id === mediaId) ?? null;
  const mediaReady = media && media.status === 'ready' && media.url ? media : null;
  const length = draft ? alertLength(draft, draft.video !== null ? media : null) : 0;

  // Take the saved design into the draft when a kind opens, and when it changes on the server
  // while nothing here is being edited. Edits in progress are kept.
  useEffect(() => {
    if (!data) return;
    if (loaded && loaded.kind === kind) {
      if (sameDesign(loaded.base, base)) return;
      if (!sameDesign(draft, loaded.base)) { setLoaded({ kind, base }); return; }
    }
    setDraft(base);
    setLoaded({ kind, base });
    setSelected(base && base.texts.length > 0 ? 0 : null);
    setTriedSave(false);
    setServerProblem(null);
    setConfirmReset(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, kind, base]);

  // A new kind (or a newly loaded video) starts the scrubber in the middle, where the text usually shows.
  const lengthKey = `${kind}:${mediaId}:${length}`;
  useEffect(() => { setTime(Math.round(length / 2)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lengthKey]);

  useEffect(() => { onDirtyChange(dirty ? KIND_LABELS[kind] : null); }, [dirty, kind, onDirtyChange]);
  useEffect(() => () => onDirtyChange(null), [onDirtyChange]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // The preview frame keeps the saved designs, so the panel's own previews look like OBS.
  useEffect(() => {
    if (data) preview.current?.setSavedDesigns(data.resolved ?? {});
  }, [data, preview]);

  const localProblems = useMemo(
    () => (draft ? validateDesign(draft, kind, assets, { variables, fonts }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, kind, assets, variables.join('|'), fonts],
  );
  const problemFor = (field: string): string | null => {
    if (serverProblem?.field === field) return serverProblem.error;
    if (!triedSave) return null;
    return localProblems.find((item) => item.field === field)?.error ?? null;
  };
  const boxProblem = (index: number): string | null => {
    const owned = TEXT_FIELDS.map((name) => `texts.${index}.${name}`);
    if (serverProblem && fieldTextIndex(serverProblem.field) === index && !owned.includes(serverProblem.field)) return serverProblem.error;
    if (!triedSave) return null;
    return localProblems.find((item) => fieldTextIndex(item.field) === index && !owned.includes(item.field))?.error ?? null;
  };
  const generalProblem = serverProblem && !TOP_FIELDS.includes(serverProblem.field) && fieldTextIndex(serverProblem.field) === null
    ? serverProblem.error : null;

  const change = (next: StreamAlertDesign | null) => {
    setDraft(next);
    setServerProblem(null);
    setNotice(null);
  };
  const changeText = (index: number, text: StreamAlertDesignText) => {
    if (!draft) return;
    change({ ...draft, texts: draft.texts.map((item, i) => (i === index ? text : item)) });
  };

  const switchKind = (next: StreamAlertType) => {
    if (next === kind) return;
    if (dirty) { setPendingKind(next); return; }
    setNotice(null);
    setKind(next);
  };
  const discardAndSwitch = () => {
    if (!pendingKind) return;
    setNotice(null);
    setKind(pendingKind);
    setPendingKind(null);
    setLoaded(null);
  };

  const startCustom = () => {
    const pick = readyMedia.find((asset) => String(asset.id) === startWith) ?? readyMedia[0];
    if (!pick) return;
    const next = newDesign(kind, pick);
    change(next);
    setSelected(0);
    setTriedSave(false);
  };

  const pickMedia = (value: string) => {
    if (!draft) return;
    const asset = readyMedia.find((item) => String(item.id) === value);
    if (!asset) return;
    const video = asset.kind === 'video' ? asset.id : null;
    change({
      ...draft,
      video,
      image: asset.kind === 'image' ? asset.id : null,
      // A video with its own sound plays that; the extra sound is for pictures and silent videos.
      sound: asset.kind === 'video' && asset.has_audio ? null : draft.sound,
    });
  };

  const addText = () => {
    if (!draft || draft.texts.length >= MAX_TEXTS) return;
    const text = defaultText(kind, draft.texts.length, mediaReady);
    change({ ...draft, texts: [...draft.texts, { ...text, appear_ms: Math.min(Math.round(time), 30000) }] });
    setSelected(draft.texts.length);
  };
  const removeText = (index: number) => {
    if (!draft) return;
    change({ ...draft, texts: draft.texts.filter((_, i) => i !== index) });
    setSelected(draft.texts.length > 1 ? Math.max(0, index - 1) : null);
  };

  const writeSaved = (kindSaved: StreamAlertType, design: StreamAlertDesign | null, resolved: StreamAlertDesigns['resolved'][StreamAlertType] | null) => {
    queryClient.setQueryData<StreamAlertDesigns>(designsKey, (old) => {
      if (!old) return old;
      const nextDesigns = { ...old.designs };
      const nextResolved = { ...old.resolved };
      if (design) nextDesigns[kindSaved] = design; else delete nextDesigns[kindSaved];
      if (resolved) nextResolved[kindSaved] = resolved; else delete nextResolved[kindSaved];
      return { ...old, designs: nextDesigns, resolved: nextResolved };
    });
  };

  const save = useMutation({
    mutationFn: (input: { kind: StreamAlertType; design: StreamAlertDesign }) => streamAlertsApi.saveDesign(accountId, input.kind, input.design),
    onMutate: () => { setServerProblem(null); setNotice(null); },
    onSuccess: (result, input) => {
      const saved = normalizeDesign(result.design ?? input.design);
      writeSaved(input.kind, saved, result.resolved ?? null);
      if (input.kind === kind) {
        setDraft(saved);
        setLoaded({ kind: input.kind, base: saved });
      }
      setTriedSave(false);
      setNotice({ tone: 'ok', text: `Saved. The ${KIND_LABELS[input.kind]} alert now uses your design on the OBS link.` });
    },
    onError: (error) => {
      const field = normalizeField(error instanceof ApiError ? error.body.field : null) ?? '';
      setServerProblem({ field, error: plainError(error) });
      const index = fieldTextIndex(field);
      if (index !== null) setSelected(index);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: designsKey });
      queryClient.invalidateQueries({ queryKey: assetsKey });
    },
  });
  const submit = () => {
    if (!draft || save.isPending) return;
    setTriedSave(true);
    if (localProblems.length > 0) {
      const index = fieldTextIndex(localProblems[0].field);
      if (index !== null) setSelected(index);
      setNotice({ tone: 'error', text: 'Nothing was saved. Fix the parts marked in red first.' });
      return;
    }
    save.mutate({ kind, design: draft });
  };

  const reset = useMutation({
    mutationFn: (kindReset: StreamAlertType) => streamAlertsApi.resetDesign(accountId, kindReset),
    onSuccess: (_result, kindReset) => {
      writeSaved(kindReset, null, null);
      if (kindReset === kind) {
        setDraft(null);
        setLoaded({ kind: kindReset, base: null });
      }
      setConfirmReset(false);
      setNotice({ tone: 'ok', text: `The ${KIND_LABELS[kindReset]} alert uses the built-in card again. Your files stay in the media library.` });
    },
    onError: (error) => setNotice({ tone: 'error', text: `Could not go back to the built-in card: ${plainError(error)}` }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: designsKey });
      queryClient.invalidateQueries({ queryKey: assetsKey });
    },
  });

  const sendToObs = useMutation({
    mutationFn: () => streamAlertsApi.fireAlert(accountId, sampleTestInput(kind, samples)),
    onSuccess: () => setNotice({ tone: 'ok', text: `Sent a test ${KIND_LABELS[kind].toLowerCase()} alert to OBS with the saved design.` }),
    onError: (error) => setNotice({ tone: 'error', text: `Could not send: ${plainError(error)}` }),
  });

  const backToDesigner = () => {
    cardRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    previewButton.current?.focus({ preventScroll: true });
  };
  const runPreview = async () => {
    setNotice(null);
    const handle = preview.current;
    if (!handle) { setNotice({ tone: 'error', text: 'The preview is still loading. Try again in a moment.' }); return; }
    const saved = { ...(data?.resolved ?? {}) };
    if (draft) {
      const resolved = resolveDraft(draft, assets);
      if (!resolved) {
        setNotice({ tone: 'error', text: 'This design needs a file that is not ready yet, so it cannot be previewed.' });
        return;
      }
      saved[kind] = resolved;
    } else {
      delete saved[kind];
    }
    const result = await handle.playDesign(saved, kind, sampleFireOptions(kind, samples), { label: KIND_LABELS[kind], onBack: backToDesigner });
    if (result === 'unsupported') {
      setNotice({ tone: 'error', text: 'The preview on this page is an older copy of the overlay that cannot show custom designs yet. Save your design and use Send to OBS to see it on the OBS link.' });
    } else if (result === 'loading') {
      setNotice({ tone: 'error', text: 'The preview is still loading. Try again in a moment.' });
    } else if (result === 'failed') {
      setNotice({ tone: 'error', text: 'The preview could not load this design. Try again, or check that its files still play.' });
    }
  };

  const owner = account.role === 'owner' ? 'your' : `${account.owner_username.trim() || 'the owner'}'s`;
  const values = sampleTemplateValues(samples, kind);
  const busy = save.isPending || reset.isPending;

  const sampleInput = (name: keyof SampleValues, numeric = false) => (
    <label key={name} className="stream-props__field">
      <span>{variableLabel(name)}</span>
      <input
        className="form-control"
        type={numeric ? 'number' : 'text'}
        inputMode={numeric ? 'numeric' : undefined}
        min={numeric ? 1 : undefined}
        maxLength={numeric ? undefined : name === 'message' ? 200 : 32}
        value={samples[name]}
        onChange={(event) => setSamples({ ...samples, [name]: event.target.value })}
      />
    </label>
  );

  return (
    <section className="stream-accounts__card stream-designs" aria-labelledby="stream-designs-title" ref={cardRef}>
      <div className="stream-accounts__card-head">
        <h3 id="stream-designs-title">Alert designs</h3>
        <p>
          Give any alert {owner} own look: a video or picture from the media library, with the viewer&apos;s name and other details drawn on top. Alerts without a design use the built-in card.
        </p>
      </div>
      <ul className="stream-designs__notes">
        <li>Custom alerts play on the OBS link (the hosted overlay) and in the preview on this page.</li>
        {account.legacy_overlay && (
          <li>
            The overlay already installed in {account.role === 'owner' ? 'your' : `${account.owner_username.trim() || 'the owner'}'s`} OBS keeps the built-in look until OBS is moved to the OBS link.
          </li>
        )}
      </ul>

      {designs.isLoading && <p className="stream-accounts__empty" role="status">Loading the alert designs…</p>}
      {designs.error && !data && (
        <div className="stream-accounts__load-error" role="alert">
          <p className="stream-accounts__notice is-error">Could not load the alert designs: {plainError(designs.error)}</p>
          <button type="button" disabled={designs.isFetching} onClick={() => designs.refetch()}>{designs.isFetching ? 'Trying again…' : 'Try again'}</button>
        </div>
      )}

      {data && (
        <>
          <div className="stream-designs__tabs" role="tablist" aria-label="Alert kind">
            {kinds.map((item) => {
              const custom = Boolean(data.designs?.[item]);
              const current = item === kind;
              return (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  id={`stream-design-tab-${item}`}
                  aria-selected={current}
                  aria-controls="stream-design-panel"
                  className={current ? 'is-current' : ''}
                  onClick={() => switchKind(item)}
                >
                  <span>{KIND_LABELS[item]}</span>
                  <small>{current && dirty ? 'Unsaved' : custom ? 'Custom' : 'Built-in'}</small>
                </button>
              );
            })}
          </div>

          {pendingKind && (
            <div className="stream-accounts__confirm" role="group" aria-label="Unsaved changes">
              <strong>You have unsaved changes to the {KIND_LABELS[kind]} alert.</strong>
              <p>Switching to {KIND_LABELS[pendingKind]} throws them away. Keep editing to save them first.</p>
              <div className="stream-accounts__buttons">
                <button type="button" className="is-danger" onClick={discardAndSwitch}>Discard changes and switch</button>
                <button type="button" autoFocus onClick={() => setPendingKind(null)}>Keep editing</button>
              </div>
            </div>
          )}

          <div className="stream-designs__panel" role="tabpanel" id="stream-design-panel" aria-labelledby={`stream-design-tab-${kind}`}>
            {!draft && (
              <div className="stream-designs__builtin">
                <p><strong>The {KIND_LABELS[kind]} alert uses the built-in card.</strong></p>
                {readyMedia.length === 0 ? (
                  <p className="stream-accounts__empty">
                    {library.isLoading ? 'Loading the media library…' : 'To make a custom design, upload a video or a picture in the Media library first.'}
                  </p>
                ) : (
                  <div className="stream-designs__start">
                    <label className="stream-props__field">
                      <span>Start with</span>
                      <select className="form-control" value={startWith || String(readyMedia[0].id)} onChange={(event) => setStartWith(event.target.value)}>
                        {readyMedia.map((asset) => <option key={asset.id} value={asset.id}>{asset.original_name}</option>)}
                      </select>
                    </label>
                    <button type="button" className="is-primary" onClick={startCustom}>Make a custom design</button>
                  </div>
                )}
              </div>
            )}

            {draft && (
              <>
                {base && !data.resolved?.[kind] && !dirty && (
                  <p className="stream-accounts__note">
                    A file this design uses is not ready, so OBS shows the built-in card for this alert for now.
                  </p>
                )}
                <div className="stream-designs__media">
                  <label className="stream-props__field">
                    <span>Video or picture</span>
                    <select
                      className="form-control"
                      value={mediaId === null ? '' : String(mediaId)}
                      aria-invalid={Boolean(problemFor('video') || problemFor('image'))}
                      onChange={(event) => pickMedia(event.target.value)}
                    >
                      {mediaId === null && <option value="">Pick one</option>}
                      {mediaId !== null && !mediaReady && <option value={String(mediaId)}>{media?.original_name ?? 'A file that is gone'} (not ready)</option>}
                      {readyMedia.some((asset) => asset.kind === 'video') && (
                        <optgroup label="Videos">
                          {readyMedia.filter((asset) => asset.kind === 'video').map((asset) => (
                            <option key={asset.id} value={asset.id}>{asset.original_name} ({formatLength(asset.duration_ms)})</option>
                          ))}
                        </optgroup>
                      )}
                      {readyMedia.some((asset) => asset.kind === 'image') && (
                        <optgroup label="Pictures">
                          {readyMedia.filter((asset) => asset.kind === 'image').map((asset) => <option key={asset.id} value={asset.id}>{asset.original_name}</option>)}
                        </optgroup>
                      )}
                    </select>
                    <FieldError id="stream-design-video" text={problemFor('video') ?? problemFor('image')} />
                  </label>
                  <label className="stream-props__field">
                    <span>Extra sound</span>
                    <select
                      className="form-control"
                      value={draft.sound === null ? '' : String(draft.sound)}
                      disabled={Boolean(media?.kind === 'video' && media.has_audio)}
                      aria-invalid={Boolean(problemFor('sound'))}
                      onChange={(event) => change({ ...draft, sound: event.target.value ? Number(event.target.value) : null })}
                    >
                      <option value="">None</option>
                      {readySounds.map((asset) => <option key={asset.id} value={asset.id}>{asset.original_name}</option>)}
                    </select>
                    {media?.kind === 'video' && media.has_audio && <small className="stream-props__hint">This video has its own sound, so it plays that.</small>}
                    <FieldError id="stream-design-sound" text={problemFor('sound')} />
                  </label>
                  {draft.video === null && (
                    <label className="stream-props__field">
                      <span>Shows for (seconds)</span>
                      <input
                        className="form-control"
                        type="number"
                        min={1}
                        max={30}
                        step={0.5}
                        value={draft.duration_ms / 1000}
                        aria-invalid={Boolean(problemFor('duration_ms'))}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (event.target.value !== '' && Number.isFinite(value)) change({ ...draft, duration_ms: Math.round(value * 1000) });
                        }}
                      />
                      <FieldError id="stream-design-duration" text={problemFor('duration_ms')} />
                    </label>
                  )}
                </div>

                <div className="stream-designs__work">
                  <div className="stream-designs__stage">
                    <DesignStage
                      design={draft}
                      media={mediaReady}
                      length={length}
                      time={time}
                      onTime={setTime}
                      values={values}
                      selected={selected}
                      onSelect={setSelected}
                      onChange={change}
                      fontsVersion={fontsVersion}
                    />
                    <FieldError id="stream-design-position" text={problemFor('x') ?? problemFor('y')} />
                    <div className="stream-designs__sliders">
                      <label className="stream-props__field">
                        <span>Size: {Math.round(draft.scale * 100)}%</span>
                        <input
                          type="range"
                          min={10}
                          max={300}
                          step={5}
                          value={Math.round(draft.scale * 100)}
                          aria-valuetext={`${Math.round(draft.scale * 100)}%`}
                          onChange={(event) => change({ ...draft, scale: Number(event.target.value) / 100 })}
                        />
                        <FieldError id="stream-design-scale" text={problemFor('scale')} />
                      </label>
                      <label className="stream-props__field">
                        <span>Volume: {Math.round(draft.volume * 100)}%</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={Math.round(draft.volume * 100)}
                          aria-valuetext={`${Math.round(draft.volume * 100)}%`}
                          onChange={(event) => change({ ...draft, volume: Number(event.target.value) / 100 })}
                        />
                        <FieldError id="stream-design-volume" text={problemFor('volume')} />
                      </label>
                      <button type="button" onClick={() => change({ ...draft, x: 960, y: 540 })}>Centre on screen</button>
                    </div>
                  </div>

                  <div className="stream-designs__side">
                    <div className="stream-designs__boxes" role="group" aria-label="Text boxes">
                      {draft.texts.map((text, index) => (
                        <button
                          key={index}
                          type="button"
                          aria-pressed={selected === index}
                          className={selected === index ? 'is-current' : ''}
                          style={{ '--box-colour': BOX_COLOURS[index] } as React.CSSProperties}
                          onClick={() => setSelected(index)}
                        >
                          Text {index + 1}
                        </button>
                      ))}
                      <button type="button" disabled={draft.texts.length >= MAX_TEXTS} onClick={addText}>
                        {draft.texts.length >= MAX_TEXTS ? 'Up to 4 texts' : 'Add text'}
                      </button>
                    </div>
                    <FieldError id="stream-design-texts" text={problemFor('texts')} />
                    {selected !== null && draft.texts[selected] ? (
                      <TextBoxProperties
                        key={selected}
                        index={selected}
                        text={draft.texts[selected]}
                        kind={kind}
                        variables={variables}
                        fonts={fonts}
                        uploadedFonts={readyFonts}
                        time={time}
                        length={length}
                        problem={(name) => problemFor(`texts.${selected}.${name}`)}
                        boxProblem={boxProblem(selected)}
                        onChange={(next) => changeText(selected, next)}
                        onRemove={() => removeText(selected)}
                      />
                    ) : (
                      <p className="stream-accounts__empty">
                        {draft.texts.length === 0 ? 'No text yet. Add text to draw the viewer’s name on the alert.' : 'Pick a text box on the stage or above to change it.'}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            <fieldset className="stream-designs__samples">
              <legend>Sample values for the preview</legend>
              <div className="stream-designs__sample-grid">
                {variables.map((name) => {
                  if (name === 'name' && kind === 'hypetrain') {
                    return <p key={name} className="stream-props__hint">A hype train has no viewer, so {'{name}'} shows &quot;Hype Train&quot;.</p>;
                  }
                  if (name === 'tier') {
                    return (
                      <label key={name} className="stream-props__field">
                        <span>{variableLabel(name)}</span>
                        <select className="form-control" value={samples.tier} onChange={(event) => setSamples({ ...samples, tier: event.target.value as StreamAlertTier })}>
                          {TIERS.map((tier) => <option key={tier.value} value={tier.value}>{tier.label}</option>)}
                        </select>
                      </label>
                    );
                  }
                  if (!(name in samples)) return null;
                  return sampleInput(name as keyof SampleValues, ['months', 'count', 'bits', 'viewers', 'level'].includes(name));
                })}
              </div>
            </fieldset>

            <div className="stream-designs__actions">
              {draft && (
                <button type="button" className="is-primary" disabled={!dirty || busy} onClick={submit}>
                  {save.isPending ? 'Saving…' : 'Save'}
                </button>
              )}
              {dirty && (
                <button type="button" disabled={busy} onClick={() => { change(base); setTriedSave(false); setSelected(base && base.texts.length ? 0 : null); }}>
                  Discard changes
                </button>
              )}
              <button type="button" ref={previewButton} onClick={runPreview}>Preview</button>
              <button type="button" disabled={sendToObs.isPending} onClick={() => sendToObs.mutate()}>
                {sendToObs.isPending ? 'Sending…' : 'Send to OBS'}
              </button>
              {base && !confirmReset && (
                <button type="button" disabled={busy} onClick={() => { setNotice(null); setConfirmReset(true); }}>Use the built-in card</button>
              )}
            </div>
            {dirty && <p className="stream-props__hint">Preview shows your unsaved changes. Send to OBS uses the saved design.</p>}
            {confirmReset && base && (
              <div className="stream-accounts__confirm" role="group" aria-label={`Confirm using the built-in card for ${KIND_LABELS[kind]}`}>
                <strong>Use the built-in card for the {KIND_LABELS[kind]} alert?</strong>
                <p>The custom design for this alert is removed. Its files stay in the media library.</p>
                <div className="stream-accounts__buttons">
                  <button type="button" className="is-danger" disabled={reset.isPending} onClick={() => reset.mutate(kind)}>
                    {reset.isPending ? 'Switching…' : 'Yes, use the built-in card'}
                  </button>
                  <button type="button" autoFocus disabled={reset.isPending} onClick={() => setConfirmReset(false)}>Cancel</button>
                </div>
              </div>
            )}
            {generalProblem && <p className="stream-accounts__notice is-error" role="alert">Not saved: {generalProblem}</p>}
            {notice && (
              <p className={`stream-accounts__notice is-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p>
            )}
          </div>
        </>
      )}
    </section>
  );
};
