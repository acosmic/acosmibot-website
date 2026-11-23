/**
 * Import & export (§11.4, §12.10.3): bring commands and timers over from
 * Nightbot (pasted export) or StreamElements (channel name or pasted export),
 * preview every item with its translation, warnings and the web addresses it
 * would call, apply the chosen items once, and download the channel's
 * configuration (broadcaster only). All third-party text is rendered as text.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileDown, Upload } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui';
import { showToast } from '@/utils/toast';
import type { SectionProps } from '../types';
import {
  EmptyState,
  Field,
  RecordTable,
  RoleGate,
  SectionPage,
  StatusChip,
  formatNumber,
  formatRelative,
  hasRole,
  isTwitchApiError,
  tk,
  twitchErrorMessage,
  twitchRetry,
  useChannelMutation,
  type Column,
} from '../shared/ui';
import { downloadExport, importsApi } from './api';
import {
  IMPORT_MAX_BYTES,
  SOURCE_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
  defaultSelection,
  describeApply,
  describeConflict,
  describePreview,
  isSelectable,
  pasteBytes,
  previewBody,
  previewInputProblem,
  reconcileSelection,
  sourceAllowsChannel,
  translatedText,
  type ImportApplyResponse,
  type ImportInputKind,
  type ImportItem,
  type ImportJob,
  type ImportPreviewResponse,
  type ImportSource,
  type OnConflict,
} from './model';
import './admin.css';

const ItemCard: React.FC<{
  item: ImportItem;
  checked: boolean;
  selectable: boolean;
  onToggle: (checked: boolean) => void;
}> = ({ item, checked, selectable, onToggle }) => {
  const id = `tw-import-item-${item.index}`;
  const conflict = describeConflict(item);
  const text = translatedText(item);
  return (
    <li className={`tw-import-item${checked ? ' is-selected' : ''}`}>
      <div className="tw-import-item__head">
        <div className="tw-checkbox">
          <input id={id} type="checkbox" className="form-check-input" checked={checked} disabled={!selectable}
            onChange={(event) => onToggle(event.target.checked)} />
          <label htmlFor={id}>
            <span className="tw-import-item__name">{item.name || `Item ${item.index + 1}`}</span>
            <span className="tw-muted"> · {item.kind === 'command' ? 'Command' : 'Timer'}</span>
          </label>
        </div>
        <StatusChip tone={STATUS_TONES[item.status]}>{STATUS_LABELS[item.status]}</StatusChip>
      </div>
      {conflict && <p className="tw-import-item__note">{conflict}</p>}
      {item.errors.length > 0 && (
        <ul className="tw-import-item__list tw-import-item__list--error" aria-label="Problems">
          {item.errors.map((error, n) => <li key={n}>{error}</li>)}
        </ul>
      )}
      {item.warnings.length > 0 && (
        <ul className="tw-import-item__list" aria-label="Warnings">
          {item.warnings.map((warning, n) => <li key={n}>{warning}</li>)}
        </ul>
      )}
      {(item.fetch_urls?.length ?? 0) > 0 && (
        <div className="tw-import-item__fetch">
          <p>Each use calls these web addresses:</p>
          <ul>{item.fetch_urls!.map((url, n) => <li key={n}><code className="tw-code-list">{url}</code></li>)}</ul>
        </div>
      )}
      {text && (
        <div className="tw-import-item__text">
          <span className="tw-import-item__label">{item.kind === 'command' ? 'Response here' : 'Message here'}</span>
          <code>{text}</code>
        </div>
      )}
      {item.original && item.original !== text && (
        <details className="tw-import-item__original">
          <summary>Original text</summary>
          <code>{item.original}</code>
        </details>
      )}
    </li>
  );
};

export const ImportExportPage: React.FC<SectionProps> = ({ channelId, channel, role }) => {
  const jobsKey = tk(channelId, 'import', 'jobs');
  const jobs = useQuery({ queryKey: jobsKey, queryFn: () => importsApi.jobs(channelId), retry: twitchRetry });

  const [source, setSource] = useState<ImportSource>('streamelements');
  const [kind, setKind] = useState<ImportInputKind>('channel');
  const [paste, setPaste] = useState('');
  const [seLogin, setSeLogin] = useState(channel.login);
  const [inputProblem, setInputProblem] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [onConflict, setOnConflict] = useState<OnConflict>('skip');
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmApply, setConfirmApply] = useState(false);
  const [result, setResult] = useState<ImportApplyResponse | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!sourceAllowsChannel(source) && kind === 'channel') setKind('paste');
  }, [source, kind]);

  const items = preview?.items ?? [];
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectableCount = items.filter((item) => isSelectable(item, onConflict)).length;
  const overwriting = onConflict === 'overwrite' && items.some((item) => item.status === 'conflict' && selectedSet.has(item.index));

  const runPreview = useChannelMutation({
    mutationFn: () => importsApi.preview(channelId, previewBody(source, kind, paste, seLogin)),
    invalidate: [jobsKey],
    errorMessage: false,
    onSuccess: (data) => {
      setPreview(data);
      setResult(null);
      setOnConflict('skip');
      setSelected(defaultSelection(data.items, 'skip'));
    },
    onError: (error) => {
      setInputProblem(isTwitchApiError(error, 'rate_limited')
        ? 'Too many previews this hour. Try again later.'
        : twitchErrorMessage(error, 'The preview could not be made.'));
    },
  });

  const apply = useChannelMutation({
    mutationFn: () => importsApi.apply(channelId, preview!.job_id, selected, onConflict),
    invalidate: [jobsKey, tk(channelId, 'commands'), tk(channelId, 'timers')],
    errorMessage: false,
    onSuccess: (data) => {
      setConfirmApply(false);
      setResult(data);
      setPreview(null);
      showToast(describeApply(data.summary), data.summary.failed || data.summary.interrupted ? 'info' : 'success');
    },
    onError: (error) => {
      setConfirmApply(false);
      showToast(isTwitchApiError(error, 'invalid_state')
        ? 'This preview was already imported. Preview again to import more.'
        : twitchErrorMessage(error, 'The import failed.'), 'error');
    },
  });

  const startPreview = () => {
    const problem = previewInputProblem(source, kind, paste, seLogin);
    setInputProblem(problem);
    if (!problem) runPreview.mutate();
  };

  const changeConflict = (next: OnConflict) => {
    setOnConflict(next);
    setSelected((current) => {
      const kept = reconcileSelection(current, items, next);
      if (next === 'overwrite') {
        const conflicts = items.filter((item) => item.status === 'conflict' && isSelectable(item, next)).map((item) => item.index);
        return [...new Set([...kept, ...conflicts])];
      }
      return kept;
    });
  };

  const toggle = (index: number, checked: boolean) =>
    setSelected((current) => (checked ? [...new Set([...current, index])] : current.filter((value) => value !== index)));

  const doExport = async () => {
    setExporting(true);
    try {
      await downloadExport(channelId, channel.login);
      showToast('Export downloaded.', 'success');
    } catch (error) {
      showToast(twitchErrorMessage(error, 'The export could not be created.'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const jobColumns: Column<ImportJob>[] = [
    { key: 'source', header: 'Source', primary: true, render: (job) => `${SOURCE_LABELS[job.source] ?? job.source} (${job.input_kind === 'channel' ? 'channel' : 'paste'})` },
    {
      key: 'status', header: 'Status',
      render: (job) => (
        <StatusChip tone={job.status === 'applied' ? 'active' : job.status === 'failed' ? 'error' : 'neutral'}>
          {job.status === 'applied' ? 'Imported' : job.status === 'failed' ? 'Failed' : 'Preview only'}
        </StatusChip>
      ),
    },
    {
      key: 'result', header: 'Result',
      render: (job) => (job.status === 'applied' && typeof job.summary.created === 'number'
        ? describeApply({ created: job.summary.created ?? 0, updated: job.summary.updated ?? 0, skipped: job.summary.skipped ?? 0,
          failed: job.summary.failed ?? 0, builtins_disabled: job.summary.builtins_disabled ?? [], interrupted: job.summary.interrupted })
        : typeof job.summary.total === 'number' ? `${formatNumber(job.summary.total)} items previewed` : ''),
    },
    { key: 'when', header: 'When', hideOnMobile: true, render: (job) => formatRelative(job.applied_at ?? job.created_at) },
  ];

  const bytes = kind === 'paste' ? pasteBytes(paste) : 0;

  return (
    <SectionPage
      title="Import & export"
      description="Move commands and timers from another bot, and keep a copy of this channel’s Acosmibot configuration."
      query={jobs}
    >
      <section className="tw-admin-card" aria-labelledby="tw-import-title">
        <h2 id="tw-import-title" className="tw-admin-card__title">Import from another bot</h2>
        <p className="tw-admin-card__lead">
          Nothing is changed until you review the preview and choose Import. Variables are translated to Acosmibot’s;
          anything that cannot be translated is kept as plain text and flagged.
        </p>
        <form onSubmit={(event) => { event.preventDefault(); startPreview(); }} noValidate>
          <fieldset className="tw-admin-choice">
            <legend className="form-label">Import from</legend>
            {(['streamelements', 'nightbot'] as const).map((value) => (
              <div className="tw-checkbox" key={value}>
                <input id={`tw-import-source-${value}`} type="radio" name="tw-import-source" className="form-check-input"
                  checked={source === value} onChange={() => { setSource(value); setInputProblem(null); }} />
                <label htmlFor={`tw-import-source-${value}`}>{SOURCE_LABELS[value]}</label>
              </div>
            ))}
          </fieldset>
          {sourceAllowsChannel(source) && (
            <fieldset className="tw-admin-choice">
              <legend className="form-label">How</legend>
              <div className="tw-checkbox">
                <input id="tw-import-kind-channel" type="radio" name="tw-import-kind" className="form-check-input"
                  checked={kind === 'channel'} onChange={() => { setKind('channel'); setInputProblem(null); }} />
                <label htmlFor="tw-import-kind-channel">By channel name (public commands)</label>
              </div>
              <div className="tw-checkbox">
                <input id="tw-import-kind-paste" type="radio" name="tw-import-kind" className="form-check-input"
                  checked={kind === 'paste'} onChange={() => { setKind('paste'); setInputProblem(null); }} />
                <label htmlFor="tw-import-kind-paste">Paste an export</label>
              </div>
            </fieldset>
          )}
          {kind === 'channel' ? (
            <Field label="StreamElements channel name"
              help="Acosmibot reads the channel’s public command list from StreamElements. Timers are not public, so they are not included.">
              {(control) => (
                <input {...control} className="form-control" type="text" maxLength={26} autoComplete="off" spellCheck={false}
                  value={seLogin} onChange={(event) => { setSeLogin(event.target.value); setInputProblem(null); }} />
              )}
            </Field>
          ) : (
            <Field label={source === 'nightbot' ? 'Nightbot export (JSON)' : 'StreamElements export (JSON)'}
              help={source === 'nightbot'
                ? 'A list of Nightbot commands, or an object with "commands" and "timers" lists, in the JSON format Nightbot’s API returns.'
                : 'The list of commands in the JSON format StreamElements’ API returns.'}>
              {(control) => (
                <>
                  <textarea {...control} className="form-control tw-import-paste" rows={8} spellCheck={false} value={paste}
                    onChange={(event) => { setPaste(event.target.value); setInputProblem(null); }} />
                  <p className={`tw-field__help${bytes > IMPORT_MAX_BYTES ? ' tw-admin-over' : ''}`}>
                    {formatNumber(Math.ceil(bytes / 1024))} KB of 1,024 KB
                  </p>
                </>
              )}
            </Field>
          )}
          {inputProblem && <p className="tw-field__error" role="alert">{inputProblem}</p>}
          <div className="tw-admin-actions">
            <button type="submit" className="btn primary" disabled={runPreview.isPending} aria-busy={runPreview.isPending}>
              <Upload size={16} aria-hidden="true" /> {runPreview.isPending ? 'Reading…' : 'Preview import'}
            </button>
          </div>
        </form>
      </section>

      {preview && (
        <section className="tw-admin-section" aria-labelledby="tw-import-preview">
          <h2 id="tw-import-preview" className="tw-section-title">Preview</h2>
          <p className="tw-muted tw-admin-section__lead">{describePreview(preview.summary)}</p>
          {preview.summary.conflict > 0 && (
            <fieldset className="tw-admin-choice">
              <legend className="form-label">When a name is already used here</legend>
              <div className="tw-checkbox">
                <input id="tw-import-conflict-skip" type="radio" name="tw-import-conflict" className="form-check-input"
                  checked={onConflict === 'skip'} onChange={() => changeConflict('skip')} />
                <label htmlFor="tw-import-conflict-skip">Skip it and keep what is here</label>
              </div>
              <div className="tw-checkbox">
                <input id="tw-import-conflict-overwrite" type="radio" name="tw-import-conflict" className="form-check-input"
                  checked={onConflict === 'overwrite'} onChange={() => changeConflict('overwrite')} />
                <label htmlFor="tw-import-conflict-overwrite">Replace it (built-in commands with that name are turned off)</label>
              </div>
            </fieldset>
          )}
          <div className="tw-admin-actions">
            <button type="button" className="btn" onClick={() => setSelected(defaultSelection(items, onConflict))}
              disabled={selectableCount === 0}>Select all</button>
            <button type="button" className="btn" onClick={() => setSelected([])} disabled={selected.length === 0}>Select none</button>
            <span className="tw-muted" role="status">{selected.length} of {selectableCount} selected</span>
          </div>
          <ol className="tw-import-list">
            {items.map((item) => (
              <ItemCard key={item.index} item={item} checked={selectedSet.has(item.index)}
                selectable={isSelectable(item, onConflict)} onToggle={(checked) => toggle(item.index, checked)} />
            ))}
          </ol>
          <div className="tw-admin-actions">
            <button type="button" className="btn primary" disabled={selected.length === 0 || apply.isPending} aria-busy={apply.isPending}
              onClick={() => (overwriting ? setConfirmApply(true) : apply.mutate())}>
              {apply.isPending ? 'Importing…' : `Import ${selected.length} item${selected.length === 1 ? '' : 's'}`}
            </button>
            <button type="button" className="btn" onClick={() => setPreview(null)} disabled={apply.isPending}>Discard preview</button>
          </div>
        </section>
      )}

      {result && (
        <section className="tw-admin-section" aria-labelledby="tw-import-result">
          <h2 id="tw-import-result" className="tw-section-title">Import result</h2>
          <p className="tw-muted tw-admin-section__lead">{describeApply(result.summary)}</p>
          {result.summary.builtins_disabled.length > 0 && (
            <p className="tw-muted">Built-in commands turned off: <span className="tw-code-list">{result.summary.builtins_disabled.join(', ')}</span>.</p>
          )}
          <ul className="tw-import-report">
            {result.report.map((entry) => (
              <li key={`${entry.kind}-${entry.index}`}>
                <StatusChip tone={entry.result === 'created' || entry.result === 'updated' ? 'active' : entry.result === 'failed' ? 'error' : 'neutral'}>
                  {entry.result === 'created' ? 'Created' : entry.result === 'updated' ? 'Replaced' : entry.result === 'failed' ? 'Failed' : 'Skipped'}
                </StatusChip>
                <span className="tw-import-report__name">{entry.name}</span>
                {entry.reason && <span className="tw-muted">{entry.reason}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="tw-admin-section" aria-labelledby="tw-import-history">
        <h2 id="tw-import-history" className="tw-section-title">Recent imports</h2>
        <RecordTable rows={jobs.data?.items ?? []} columns={jobColumns} rowKey={(job) => job.id} caption="Recent imports"
          empty={<EmptyState title="No imports yet" description="Previews and imports from Nightbot or StreamElements are listed here for 30 days." />} />
      </section>

      <section className="tw-admin-card" aria-labelledby="tw-export-title">
        <h2 id="tw-export-title" className="tw-admin-card__title">Export</h2>
        <p className="tw-admin-card__lead">
          One JSON file with this channel’s settings, commands, built-in command changes, timers, blocked terms, quotes,
          counters, store items, trivia questions, regulars, channel point actions and viewers’ points and watch time.
          It never contains passwords, tokens, chat or moderation logs, or Twitch user ids.
        </p>
        <RoleGate min="broadcaster" role={role} fallback={<p className="tw-muted">Only the broadcaster can download the export.</p>}>
          <button type="button" className="btn" onClick={() => void doExport()} disabled={exporting} aria-busy={exporting}>
            {exporting ? <FileDown size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
            {exporting ? ' Preparing…' : ' Download export'}
          </button>
        </RoleGate>
      </section>

      {confirmApply && hasRole(role, 'editor') && (
        <ConfirmDialog
          kicker="Import" title="Replace existing items?" confirmLabel="Import and replace" tone="primary"
          pending={apply.isPending} onConfirm={() => apply.mutate()} onClose={() => setConfirmApply(false)}
        >
          <p>Selected items whose names are already used here replace those commands or timers. Built-in commands with the
            same name are turned off; you can turn them back on under Commands.</p>
        </ConfirmDialog>
      )}
    </SectionPage>
  );
};
