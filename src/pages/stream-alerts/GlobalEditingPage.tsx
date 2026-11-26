import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { streamAlertsApi, StreamAlertAccount, StreamAlertAlerts, StreamAlertAsset, StreamAlertKindSettings, StreamAlertLook } from '@/api/streamAlerts';
import { PageNotice, plainError } from '@/utils/streamAlertAccounts';
import { animationNames, apiField, APPLY_PARTS, applyFields, defaultsPreviewConfig, FieldProblem, normalizeGeneral, PreviewConfig } from '@/utils/streamAlertBox';
import { DESIGN_FONTS, SampleValues, sampleFireOptions, sampleTemplateValues } from '@/utils/streamAlertDesigns';
import { LookForm, SettingsCard } from './LookForm';
import { PreviewPane } from './PreviewPane';
import { previewProblem, type PreviewHandle } from './previewHandle';

/**
 * The defaults look, and "Apply to all alerts", which copies the ticked parts of the saved
 * defaults into every alert's own look (variations stay as they are), after an in-page confirm.
 */
export const GlobalEditingPage: React.FC<{
  account: StreamAlertAccount;
  defaults: StreamAlertLook;
  dirty: boolean;
  data: StreamAlertAlerts | undefined;
  followAlert: StreamAlertKindSettings;
  assets: StreamAlertAsset[];
  assetsLoading: boolean;
  savedConfig: PreviewConfig;
  preview: React.MutableRefObject<PreviewHandle | null>;
  background: string;
  onBackground: (colour: string) => void;
  samples: SampleValues;
  onChange: (next: StreamAlertLook) => void;
  onDiscard: () => void;
  onSaved: (general: ReturnType<typeof normalizeGeneral>) => void;
  onApplied: (alerts: StreamAlertAlerts['alerts']) => void;
}> = ({ account, defaults, dirty, data, followAlert, assets, assetsLoading, savedConfig, preview, background, onBackground, samples, onChange, onDiscard, onSaved, onApplied }) => {
  const [serverProblem, setServerProblem] = useState<FieldProblem | null>(null);
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const [ticked, setTicked] = useState<string[]>(APPLY_PARTS.map((part) => part.key));
  const [confirming, setConfirming] = useState(false);
  const fonts = data?.fonts?.length ? data.fonts : DESIGN_FONTS;
  const names = animationNames(data?.names);

  const save = useMutation({
    mutationFn: (look: StreamAlertLook) => streamAlertsApi.saveAlertSettings(account.id, { defaults: look }),
    onMutate: () => { setServerProblem(null); setNotice(null); },
    onSuccess: (result) => {
      onSaved(normalizeGeneral(result.general));
      setNotice({ tone: 'ok', text: 'Defaults saved. Use Apply to all alerts to copy them into your alerts.' });
    },
    onError: (error) => {
      const field = apiField(error instanceof ApiError ? error.body.field : null).replace(/^defaults\./, '');
      setServerProblem({ field, error: plainError(error) });
    },
  });
  const apply = useMutation({
    mutationFn: () => streamAlertsApi.applyDefaults(account.id, applyFields(ticked)),
    onSuccess: (result) => {
      setConfirming(false);
      onApplied(result.alerts ?? {});
      setNotice({ tone: 'ok', text: 'Applied. Every alert now uses these parts of the defaults. Their variations did not change.' });
    },
    onError: (error) => { setConfirming(false); setNotice({ tone: 'error', text: `Could not apply the defaults: ${plainError(error)}` }); },
  });

  const runPreview = async () => {
    setNotice(null);
    const handle = preview.current;
    if (!handle) { setNotice({ tone: 'error', text: previewProblem('loading') ?? '' }); return; }
    const config = defaultsPreviewConfig(savedConfig, 'follow', defaults, followAlert, assets);
    const result = await handle.playDraft(config, 'follow', { ...sampleFireOptions('follow', samples), variation: 'base' });
    const problem = previewProblem(result);
    if (problem) setNotice({ tone: 'error', text: problem });
  };

  const fields = applyFields(ticked);

  return (
    <div className="stream-box__page">
      <header className="stream-box__page-head">
        <h2>Global editing</h2>
        <p>Set a look once, then copy the parts you pick into every alert. Media, messages and sounds stay as each alert has them.</p>
      </header>
      <div className="stream-box__columns">
        <div className="stream-box__settings">
          <LookForm
            idPrefix="stream-defaults"
            kind="follow"
            look={defaults}
            onChange={(next) => { onChange(next); setServerProblem(null); setNotice(null); }}
            mode="defaults"
            assets={assets}
            assetsLoading={assetsLoading}
            fonts={fonts}
            variables={['name']}
            names={names}
            values={sampleTemplateValues(samples, 'follow')}
            problem={(field) => (serverProblem?.field === field ? serverProblem.error : null)}
          />

          <SettingsCard title="Apply to all alerts" id="stream-apply-title" about="Copies the ticked parts of the saved defaults into each alert's own look.">
            <fieldset className="stream-box__ticks">
              <legend className="visually-hidden">Parts to copy</legend>
              {APPLY_PARTS.map((part) => (
                <label key={part.key} className="stream-props__check">
                  <input
                    type="checkbox"
                    checked={ticked.includes(part.key)}
                    onChange={(event) => setTicked(event.target.checked ? [...ticked, part.key] : ticked.filter((key) => key !== part.key))}
                  />
                  <span>{part.label}</span>
                </label>
              ))}
            </fieldset>
            {dirty && <p className="stream-props__hint">Save the defaults first. Apply copies the saved defaults.</p>}
            {!confirming && (
              <div className="stream-accounts__buttons">
                <button type="button" className="is-primary" disabled={dirty || fields.length === 0 || apply.isPending} onClick={() => { setNotice(null); setConfirming(true); }}>
                  Apply to all alerts
                </button>
              </div>
            )}
            {confirming && (
              <div className="stream-accounts__confirm" role="group" aria-label="Confirm applying the defaults to all alerts">
                <strong>Apply {APPLY_PARTS.filter((part) => ticked.includes(part.key)).map((part) => part.label.toLowerCase()).join(', ')} to all alerts?</strong>
                <p>Each alert&apos;s own look changes right away, in OBS too. Variations stay as they are. This cannot be undone.</p>
                <div className="stream-accounts__buttons">
                  <button type="button" className="is-danger" disabled={apply.isPending} onClick={() => apply.mutate()}>
                    {apply.isPending ? 'Applying…' : 'Yes, apply to all alerts'}
                  </button>
                  <button type="button" autoFocus disabled={apply.isPending} onClick={() => setConfirming(false)}>Cancel</button>
                </div>
              </div>
            )}
          </SettingsCard>
        </div>
        <aside className="stream-box__side">
          <PreviewPane savedConfig={savedConfig} handleRef={preview} background={background} onBackground={onBackground} tools={false}>
            <div className="stream-box__preview-actions">
              <button type="button" className="is-primary" onClick={runPreview}>Preview on a follow</button>
            </div>
            <p className="stream-alerts__hint">Plays a follow with these defaults in the Preset style, using the follow alert&apos;s media and message.</p>
          </PreviewPane>
        </aside>
      </div>
      <footer className="stream-box__savebar">
        <div className="stream-box__savebar-text" aria-live="polite">
          {serverProblem && <p className="stream-accounts__notice is-error" role="alert">Not saved: {serverProblem.error}</p>}
          {notice && <p className={`stream-accounts__notice is-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
          {!notice && !serverProblem && dirty && <p className="stream-box__unsaved">You have unsaved changes.</p>}
        </div>
        {dirty && <button type="button" disabled={save.isPending} onClick={() => { setServerProblem(null); setNotice(null); onDiscard(); }}>Discard changes</button>}
        <button type="button" className="is-primary" disabled={!dirty || save.isPending} onClick={() => save.mutate(defaults)}>{save.isPending ? 'Saving…' : 'Save settings'}</button>
      </footer>
    </div>
  );
};
