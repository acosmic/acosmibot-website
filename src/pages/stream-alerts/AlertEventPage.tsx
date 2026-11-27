import React, { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import {
  streamAlertsApi,
  StreamAlertAccount,
  StreamAlertAlerts,
  StreamAlertAsset,
  StreamAlertKindSettings,
  StreamAlertResolvedKind,
  StreamAlertType,
} from '@/api/streamAlerts';
import { PageNotice, plainError } from '@/utils/streamAlertAccounts';
import {
  alertForApi,
  animationNames,
  apiField,
  changeConditionType,
  conditionFromInput,
  conditionInput,
  conditionProblem,
  conditionTypeLabel,
  conditionTypesFor,
  describeCondition,
  draftPreviewConfig,
  FieldProblem,
  fieldScope,
  MAX_VARIATIONS,
  moveVariation,
  normalizeAlert,
  PreviewConfig,
  removeVariation,
  templateVariables,
  TIERS,
  updateVariation,
  validateAlert,
} from '@/utils/streamAlertBox';
import { DESIGN_FONTS, fieldTextIndex, SampleValues, sampleFireOptions, sampleTemplateValues, sampleTestInput } from '@/utils/streamAlertDesigns';
import { LookForm, SettingsCard } from './LookForm';
import { PreviewPane } from './PreviewPane';
import { previewProblem, type PreviewHandle } from './previewHandle';
import { SampleValuesForm } from './SampleValuesForm';
import { FieldError } from './TextBoxProperties';

/**
 * One alert kind, or one variation of it: settings on the left, the preview on the right, and
 * Save settings at the bottom. The kind is saved whole (its look and every variation), so
 * moving between the kind and its variations keeps the unsaved changes; the shell asks before
 * anything else throws them away.
 */
export const AlertEventPage: React.FC<{
  account: StreamAlertAccount;
  kind: StreamAlertType;
  title: string;
  variationId: string | null;
  /** The kind's settings with any unsaved changes. */
  alert: StreamAlertKindSettings;
  saved: StreamAlertKindSettings;
  dirty: boolean;
  data: StreamAlertAlerts | undefined;
  assets: StreamAlertAsset[];
  assetsLoading: boolean;
  savedConfig: PreviewConfig;
  preview: React.MutableRefObject<PreviewHandle | null>;
  background: string;
  onBackground: (colour: string) => void;
  samples: SampleValues;
  onSamples: (next: SampleValues) => void;
  onChange: (next: StreamAlertKindSettings) => void;
  onDiscard: () => void;
  onSaved: (alert: StreamAlertKindSettings, resolved: StreamAlertResolvedKind | null) => void;
  /** Opens the kind (null) or one of its variations. */
  onOpen: (variation: string | null) => void;
  onAddVariation: () => void;
}> = ({
  account, kind, title, variationId, alert, saved, dirty, data, assets, assetsLoading, savedConfig, preview, background, onBackground,
  samples, onSamples, onChange, onDiscard, onSaved, onOpen, onAddVariation,
}) => {
  const accountId = account.id;
  const [triedSave, setTriedSave] = useState(false);
  const [serverProblem, setServerProblem] = useState<FieldProblem | null>(null);
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fonts = data?.fonts?.length ? data.fonts : DESIGN_FONTS;
  const names = animationNames(data?.names);
  const variables = templateVariables(kind, data?.variables?.[kind]);
  const allowedConditions = data?.conditions?.[kind] ?? null;
  const index = variationId ? alert.variations.findIndex((item) => item.id === variationId) : -1;
  const variation = index >= 0 ? alert.variations[index] : null;
  const look = variation ? variation.look : alert.look;
  const lookPrefix = variation ? `variations.${index}.look.` : 'look.';
  const savedVariation = variation ? saved.variations.some((item) => item.id === variation.id) : true;

  const localProblems = useMemo(
    () => validateAlert(alert, kind, { assets, fonts, variables, names, conditions: allowedConditions }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alert, kind, assets, fonts, variables.join('|'), allowedConditions],
  );
  const problemAt = (field: string): string | null => {
    if (serverProblem?.field === field) return serverProblem.error;
    if (!triedSave) return null;
    return localProblems.find((item) => item.field === field)?.error ?? null;
  };
  /** The first problem that is not on this page, so the page can say where it is. */
  const elsewhere = (() => {
    const all = serverProblem ? [serverProblem] : triedSave ? localProblems : [];
    return all.find((item) => {
      const scope = fieldScope(item.field);
      return variation ? scope.variation !== index : scope.variation !== null;
    }) ?? null;
  })();
  const elsewhereVariation = elsewhere ? fieldScope(elsewhere.field).variation : null;
  const focusText = serverProblem ? fieldTextIndex(serverProblem.field.replace(`${lookPrefix}custom.`, '')) : null;

  const change = (next: StreamAlertKindSettings) => {
    onChange(next);
    setServerProblem(null);
    setNotice(null);
  };
  const setLook = (next: StreamAlertKindSettings['look']) => change(variation ? updateVariation(alert, variation.id, { look: next }) : { ...alert, look: next });

  const save = useMutation({
    mutationFn: (input: StreamAlertKindSettings) => streamAlertsApi.saveAlert(accountId, kind, alertForApi(input, kind)),
    onMutate: () => { setServerProblem(null); setNotice(null); },
    onSuccess: (result, input) => {
      setTriedSave(false);
      onSaved(normalizeAlert(result.alert ?? input, kind), result.resolved ?? null);
      setNotice({ tone: 'ok', text: `Saved. OBS now uses these settings for ${title}.` });
    },
    onError: (error) => {
      const field = apiField(error instanceof ApiError ? error.body.field : null);
      setServerProblem({ field, error: plainError(error) });
    },
  });
  const submit = () => {
    if (save.isPending) return;
    setTriedSave(true);
    if (localProblems.length > 0) {
      setNotice({ tone: 'error', text: 'Nothing was saved. Fix the parts marked in red first.' });
      return;
    }
    save.mutate(alert);
  };

  const sendToObs = useMutation({
    mutationFn: () => streamAlertsApi.fireAlert(accountId, { ...sampleTestInput(kind, samples), variation: variation ? variation.id : 'base' }),
    onSuccess: () => setNotice({ tone: 'ok', text: `Sent a test to OBS with the saved ${variation ? `"${variation.name}" variation` : 'look'}.` }),
    onError: (error) => setNotice({ tone: 'error', text: `Could not send: ${plainError(error)}` }),
  });

  const runPreview = async () => {
    setNotice(null);
    const handle = preview.current;
    if (!handle) { setNotice({ tone: 'error', text: previewProblem('loading') ?? '' }); return; }
    const built = draftPreviewConfig({ saved: savedConfig, kind, draft: alert, variation: variation?.id ?? null, assets });
    if (built.problem) { setNotice({ tone: 'error', text: built.problem }); return; }
    const result = await handle.playDraft(built.config, kind, { ...sampleFireOptions(kind, samples), variation: variation ? variation.id : 'base' });
    const problem = previewProblem(result);
    if (problem) setNotice({ tone: 'error', text: problem });
  };

  const values = sampleTemplateValues(samples, kind);
  const conditionTypes = conditionTypesFor(kind, allowedConditions);
  const conditionError = variation ? problemAt(`variations.${index}.condition.value`) ?? problemAt(`variations.${index}.condition.type`) ?? problemAt(`variations.${index}.condition`) : null;
  const liveConditionError = variation && triedSave ? conditionProblem(kind, variation.condition, allowedConditions) : null;

  return (
    <div className="stream-box__page">
      <header className="stream-box__page-head">
        <h2>{title}</h2>
        <p>
          {variation
            ? 'A variation is another look for this alert. The first enabled variation whose condition matches is used; otherwise the alert uses its own look.'
            : 'How this alert looks and sounds on stream. Add variations for special cases, such as big cheers.'}
        </p>
      </header>

      <div className="stream-box__columns">
        <div className="stream-box__settings">
          {!variation && (
            <SettingsCard title="Alert" id={`stream-${kind}-enabled-title`}>
              <label className="stream-props__check stream-box__toggle">
                <input type="checkbox" checked={alert.enabled} onChange={(event) => change({ ...alert, enabled: event.target.checked })} />
                <span>{alert.enabled ? 'On: this alert shows in OBS' : 'Off: this alert never shows in OBS'}</span>
              </label>
              <FieldError id={`stream-${kind}-enabled`} text={problemAt('enabled')} />
            </SettingsCard>
          )}

          {variation && (
            <SettingsCard title="Variation" id={`stream-${variation.id}-title`}>
              <div className="stream-box__grid">
                <label className="stream-props__field is-wide">
                  <span>Name</span>
                  <input
                    className="form-control"
                    value={variation.name}
                    maxLength={40}
                    aria-invalid={Boolean(problemAt(`variations.${index}.name`))}
                    onChange={(event) => change(updateVariation(alert, variation.id, { name: event.target.value }))}
                  />
                  <FieldError id={`stream-${variation.id}-name`} text={problemAt(`variations.${index}.name`)} />
                </label>
                <label className="stream-props__check">
                  <input type="checkbox" checked={variation.enabled} onChange={(event) => change(updateVariation(alert, variation.id, { enabled: event.target.checked }))} />
                  <span>Variation is on</span>
                </label>
              </div>
              <fieldset className="stream-box__condition">
                <legend>Used when</legend>
                <label className="stream-props__field">
                  <span>Condition</span>
                  <select
                    className="form-control"
                    value={variation.condition.type}
                    onChange={(event) => change(updateVariation(alert, variation.id, { condition: changeConditionType(kind, event.target.value as never) }))}
                  >
                    {!conditionTypes.includes(variation.condition.type) && <option value={variation.condition.type}>{variation.condition.type} (not available)</option>}
                    {conditionTypes.map((type) => <option key={type} value={type}>{conditionTypeLabel(kind, type)}</option>)}
                  </select>
                </label>
                <label className="stream-props__field">
                  <span>
                    {variation.condition.type === 'random' ? 'Chance (percent)'
                      : variation.condition.type === 'viewer' ? 'Viewer name'
                        : variation.condition.type === 'tier' ? 'Tier'
                          : kind === 'donation' && variation.condition.type.startsWith('amount') ? 'Amount (dollars)' : 'Number'}
                  </span>
                  {variation.condition.type === 'tier' ? (
                    <select
                      className="form-control"
                      value={String(variation.condition.value)}
                      aria-invalid={Boolean(conditionError ?? liveConditionError)}
                      onChange={(event) => change(updateVariation(alert, variation.id, { condition: { type: 'tier', value: event.target.value } }))}
                    >
                      {TIERS.map((tier) => <option key={tier.value} value={tier.value}>{tier.label}</option>)}
                    </select>
                  ) : (
                    <input
                      className="form-control"
                      type={variation.condition.type === 'viewer' ? 'text' : 'number'}
                      inputMode={variation.condition.type === 'viewer' ? undefined : 'decimal'}
                      min={variation.condition.type === 'viewer' ? undefined : kind === 'donation' ? 0.01 : 1}
                      max={variation.condition.type === 'random' ? 100 : undefined}
                      step={kind === 'donation' && variation.condition.type.startsWith('amount') ? 0.01 : 1}
                      maxLength={variation.condition.type === 'viewer' ? 32 : undefined}
                      value={conditionInput(kind, variation.condition)}
                      aria-invalid={Boolean(conditionError ?? liveConditionError)}
                      aria-describedby={conditionError ?? liveConditionError ? `stream-${variation.id}-condition` : undefined}
                      onChange={(event) => change(updateVariation(alert, variation.id, { condition: conditionFromInput(kind, variation.condition.type, event.target.value) }))}
                    />
                  )}
                </label>
                <FieldError id={`stream-${variation.id}-condition`} text={conditionError ?? liveConditionError} />
              </fieldset>
              <p className="stream-props__hint">
                Checked {ordinal(index + 1)} of {alert.variations.length}. {describeCondition(kind, variation.condition)}.
              </p>
              <div className="stream-accounts__buttons">
                <button type="button" disabled={index === 0} onClick={() => change(moveVariation(alert, variation.id, -1))}>Move up</button>
                <button type="button" disabled={index === alert.variations.length - 1} onClick={() => change(moveVariation(alert, variation.id, 1))}>Move down</button>
                {!confirmDelete && <button type="button" onClick={() => setConfirmDelete(true)}>Delete variation</button>}
              </div>
              {confirmDelete && (
                <div className="stream-accounts__confirm" role="group" aria-label={`Confirm deleting ${variation.name}`}>
                  <strong>Delete the &quot;{variation.name || 'Variation'}&quot; variation?</strong>
                  <p>It is removed when you save. Until then, Discard changes brings it back.</p>
                  <div className="stream-accounts__buttons">
                    <button
                      type="button"
                      className="is-danger"
                      onClick={() => { setConfirmDelete(false); change(removeVariation(alert, variation.id)); onOpen(null); }}
                    >
                      Yes, delete it
                    </button>
                    <button type="button" autoFocus onClick={() => setConfirmDelete(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </SettingsCard>
          )}

          <LookForm
            key={variation?.id ?? 'base'}
            accountId={account.id}
            idPrefix={`stream-${kind}-${variation?.id ?? 'base'}`}
            kind={kind}
            look={look}
            onChange={setLook}
            mode="alert"
            assets={assets}
            assetsLoading={assetsLoading}
            fonts={fonts}
            variables={variables}
            names={names}
            values={values}
            problem={(field) => problemAt(`${lookPrefix}${field}`)}
            focusText={focusText}
          />

          {!variation && (
            <SettingsCard title="Variations" id={`stream-${kind}-variations-title`} about="Checked from the top. The first one that is on and matches wins.">
              {alert.variations.length === 0 ? (
                <p className="stream-accounts__empty">No variations yet.</p>
              ) : (
                <ol className="stream-box__variations">
                  {alert.variations.map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => onOpen(item.id)}>
                        <strong>{item.name || 'Variation'}</strong>
                        <small>{item.enabled ? describeCondition(kind, item.condition) : 'Off'}</small>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <div className="stream-accounts__buttons">
                <button type="button" disabled={alert.variations.length >= MAX_VARIATIONS} onClick={onAddVariation}>
                  {alert.variations.length >= MAX_VARIATIONS ? `Up to ${MAX_VARIATIONS} variations` : '+ Add variation'}
                </button>
              </div>
            </SettingsCard>
          )}
        </div>

        <aside className="stream-box__side">
          <PreviewPane savedConfig={savedConfig} handleRef={preview} background={background} onBackground={onBackground} tools={false}>
            <div className="stream-box__preview-actions">
              <button type="button" className="is-primary" onClick={runPreview}>Preview</button>
              <button
                type="button"
                disabled={sendToObs.isPending || !savedVariation}
                title={savedVariation ? undefined : 'Save first: OBS only knows saved variations.'}
                onClick={() => sendToObs.mutate()}
              >
                {sendToObs.isPending ? 'Sending…' : 'Send to OBS'}
              </button>
            </div>
            <p className="stream-alerts__hint">
              Preview shows your unsaved changes here. Send to OBS plays the saved {variation ? 'variation' : 'look'} on stream, with a TEST tag.
              {!savedVariation && ' Save this new variation before sending it.'}
            </p>
            <SampleValuesForm kind={kind} samples={samples} onChange={onSamples} />
          </PreviewPane>
        </aside>
      </div>

      <footer className="stream-box__savebar">
        <div className="stream-box__savebar-text" aria-live="polite">
          {elsewhere && (
            <p className="stream-accounts__notice is-error" role="alert">
              Not saved: {elsewhere.error}{' '}
              {elsewhereVariation !== null && alert.variations[elsewhereVariation] && (
                <button type="button" className="stream-box__link" onClick={() => onOpen(alert.variations[elsewhereVariation].id)}>
                  Open {alert.variations[elsewhereVariation].name || 'that variation'}
                </button>
              )}
              {elsewhereVariation === null && variation && (
                <button type="button" className="stream-box__link" onClick={() => onOpen(null)}>Open {title.split(':')[0]}</button>
              )}
            </p>
          )}
          {serverProblem && !elsewhere && <p className="stream-accounts__notice is-error" role="alert">Not saved: {serverProblem.error}</p>}
          {notice && <p className={`stream-accounts__notice is-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
          {!notice && !elsewhere && dirty && <p className="stream-box__unsaved">You have unsaved changes.</p>}
        </div>
        {dirty && <button type="button" disabled={save.isPending} onClick={() => { setTriedSave(false); setServerProblem(null); setNotice(null); onDiscard(); }}>Discard changes</button>}
        <button type="button" className="is-primary" disabled={!dirty || save.isPending} onClick={submit}>
          {save.isPending ? 'Saving…' : 'Save settings'}
        </button>
      </footer>
    </div>
  );
};

function ordinal(n: number): string {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${tail}`;
}
