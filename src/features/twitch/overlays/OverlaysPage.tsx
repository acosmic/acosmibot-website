/**
 * Overlays (§11.4, §12.9): the widget catalogue, the channel's overlay links
 * (create, edit, replace, delete), test alerts and the `overlays` settings.
 *
 * An overlay link carries a secret token. It is returned once by create and
 * rotate; this page keeps it only in component state until the person closes
 * the panel, and never puts it in a query key, the URL, storage or a log.
 */
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, RefreshCw, Send } from 'lucide-react';
import { ConfirmDialog, FeatureToggle } from '@/components/ui';
import type { SectionProps } from '../types';
import {
  EditorDrawer,
  EmptyState,
  Field,
  ReadOnlyNotice,
  RecordTable,
  SectionPage,
  SettingsSaveBar,
  StatusChip,
  Switch,
  formatDateTime,
  formatRelative,
  hasRole,
  isTwitchApiError,
  tk,
  twitchErrorMessage,
  twitchRetry,
  useChannelMutation,
  useSectionSettings,
  type Column,
} from '../shared/ui';
import { overlaysApi } from './api';
import { ConfigFields } from './ConfigFields';
import { OverlayUrlPanel } from './OverlayUrlPanel';
import {
  ALERT_KINDS,
  ALERT_KIND_LABELS,
  OVERLAY_LIMITS,
  WIDGETS,
  WIDGET_INFO,
  configForApi,
  configProblems,
  defaultConfig,
  isWidgetKind,
  nameProblem,
  normalizeConfig,
  oneLine,
  overlayErrorMessage,
  sameConfig,
  suggestName,
  widgetLabel,
  type AlertKind,
  type ConfigProblem,
  type Overlay,
  type OverlaysSettings,
  type WidgetConfig,
  type WidgetKind,
} from './model';
import './overlays.css';

type Editing = { kind: 'new'; widget: WidgetKind } | { kind: 'edit'; overlay: Overlay } | null;
interface Draft { widget: WidgetKind; name: string; config: WidgetConfig }
/** The one-time link (token inside); cleared when the panel closes. */
interface Reveal { url: string; name: string; widget: WidgetKind; replaced: boolean }

const errorText = (error: unknown): string =>
  overlayErrorMessage(isTwitchApiError(error) ? error.code : null) ?? twitchErrorMessage(error);

export const OverlaysPage: React.FC<SectionProps> = ({ channelId, role }) => {
  const canEdit = hasRole(role, 'editor');
  const settings = useSectionSettings<OverlaysSettings>(channelId, 'overlays');
  const list = useQuery({
    queryKey: tk(channelId, 'overlays'),
    queryFn: () => overlaysApi.list(channelId),
    retry: twitchRetry,
    refetchInterval: 60_000,
  });
  const overlays = list.data?.items ?? [];
  const limit = list.data?.limit ?? OVERLAY_LIMITS.maxOverlays;
  const atLimit = overlays.length >= limit;

  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [base, setBase] = useState<Draft | null>(null);
  const [problems, setProblems] = useState<ConfigProblem[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [confirmRotate, setConfirmRotate] = useState<Overlay | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Overlay | null>(null);
  const [testKind, setTestKind] = useState<AlertKind>('follow');

  const open = (target: Editing) => {
    if (!target) return;
    const next: Draft = target.kind === 'new'
      ? { widget: target.widget, name: suggestName(target.widget, overlays), config: defaultConfig(target.widget) }
      : {
        widget: isWidgetKind(target.overlay.widget) ? target.overlay.widget : 'alerts',
        name: target.overlay.name,
        config: normalizeConfig(isWidgetKind(target.overlay.widget) ? target.overlay.widget : 'alerts', target.overlay.config),
      };
    setDraft(next);
    setBase(next);
    setProblems([]);
    setNameError(null);
    save.reset();
    setEditing(target);
  };

  const save = useChannelMutation({
    mutationFn: async (value: Draft) => {
      const name = oneLine(value.name);
      const config = configForApi(value.widget, value.config);
      if (editing?.kind === 'edit') return { kind: 'edit' as const, result: await overlaysApi.update(channelId, editing.overlay.id, { name, config }) };
      return { kind: 'new' as const, result: await overlaysApi.create(channelId, { widget: value.widget, name, config }) };
    },
    invalidate: [tk(channelId, 'overlays')],
    errorMessage: false,
    successMessage: (data) => (data.kind === 'edit' ? 'Overlay saved' : 'Overlay created'),
    onSuccess: (data) => {
      setEditing(null);
      if (data.kind === 'new' && 'url' in data.result) {
        const { overlay, url } = data.result;
        setReveal({ url, name: overlay.name, widget: isWidgetKind(overlay.widget) ? overlay.widget : 'alerts', replaced: false });
      }
    },
  });

  const rotate = useChannelMutation({
    mutationFn: (overlay: Overlay) => overlaysApi.rotate(channelId, overlay.id),
    invalidate: [tk(channelId, 'overlays')],
    errorMessage: false,
    successMessage: 'Link replaced',
    onSuccess: ({ overlay, url }) => {
      setConfirmRotate(null);
      setReveal({ url, name: overlay.name, widget: isWidgetKind(overlay.widget) ? overlay.widget : 'alerts', replaced: true });
    },
  });

  const remove = useChannelMutation({
    mutationFn: (overlay: Overlay) => overlaysApi.remove(channelId, overlay.id),
    invalidate: [tk(channelId, 'overlays')],
    successMessage: (_data, overlay) => `${overlay.name} deleted`,
    errorMessage: 'Could not delete the overlay.',
    onSuccess: () => { setConfirmDelete(null); setEditing(null); },
    onError: () => setConfirmDelete(null),
  });

  const test = useChannelMutation({
    mutationFn: (kind: AlertKind) => overlaysApi.test(channelId, kind),
    errorMessage: false,
    successMessage: (_data, kind) => `Test ${ALERT_KIND_LABELS[kind].toLowerCase()} alert sent`,
  });

  const submit = () => {
    if (!draft) return;
    const nextName = nameProblem(draft.name);
    const nextProblems = configProblems(draft.widget, draft.config);
    setNameError(nextName);
    setProblems(nextProblems);
    if (!nextName && nextProblems.length === 0) save.mutate(draft);
  };

  const dirty = Boolean(draft && base && (draft.name !== base.name || !sameConfig(draft.config, base.config)));

  const columns: Column<Overlay>[] = useMemo(() => [
    { key: 'name', header: 'Name', primary: true, render: (overlay) => overlay.name },
    { key: 'widget', header: 'Widget', render: (overlay) => widgetLabel(overlay.widget) },
    {
      key: 'connected', header: 'Connection', width: '150px',
      render: (overlay) => (
        <StatusChip tone={overlay.connected ? 'active' : 'neutral'}
          title={overlay.connected ? 'This overlay asked for events in the last two minutes.' : 'No browser source has used this link in the last two minutes.'}>
          {overlay.connected ? 'Connected' : 'Not connected'}
        </StatusChip>
      ),
    },
    {
      key: 'used', header: 'Last used', width: '140px', hideOnMobile: true,
      render: (overlay) => (overlay.last_used_at
        ? <time dateTime={overlay.last_used_at} title={formatDateTime(overlay.last_used_at)}>{formatRelative(overlay.last_used_at)}</time>
        : 'Never'),
    },
    { key: 'created', header: 'Created', width: '190px', hideOnMobile: true, render: (overlay) => formatDateTime(overlay.created_at) },
  ], []);

  const saveError = save.error ? errorText(save.error) : null;
  const rotateError = rotate.error ? errorText(rotate.error) : null;
  const testError = test.error ? errorText(test.error) : null;
  const hasAlertWidget = overlays.some((overlay) => overlay.widget === 'alerts' || overlay.widget === 'events');

  return (
    <SectionPage
      title="Overlays"
      description="Browser sources for OBS and other streaming software. Each overlay has its own private link; it updates live while Acosmibot is connected to your channel."
      query={list}
      actions={(
        <button type="button" className="btn primary" disabled={!canEdit || atLimit} onClick={() => open({ kind: 'new', widget: 'alerts' })}>
          <Plus size={16} aria-hidden="true" /> New overlay
        </button>
      )}
    >
      <div className="tw-ov-stack">
        {reveal && (
          <OverlayUrlPanel url={reveal.url} name={reveal.name} widget={reveal.widget} replaced={reveal.replaced} onDone={() => setReveal(null)} />
        )}

        <section aria-labelledby="tw-ov-mine">
          <div className="tw-ov-heading">
            <h2 id="tw-ov-mine" className="tw-ov-heading__title">Your overlays</h2>
            <span className="tw-muted">{overlays.length} of {limit}</span>
          </div>
          {atLimit && (
            <p className="tw-ov-note" role="status">
              This channel has {limit} overlays, the most it can have. Delete one you no longer use to add another.
            </p>
          )}
          <RecordTable
            rows={overlays} columns={columns} rowKey={(overlay) => overlay.id} caption="Overlays"
            onRowClick={canEdit ? (overlay) => open({ kind: 'edit', overlay }) : undefined}
            rowLabel={(overlay) => `Edit ${overlay.name}`}
            activeKey={editing?.kind === 'edit' ? editing.overlay.id : null}
            rowActions={canEdit ? (overlay) => (
              <span className="tw-ov-row-actions">
                <button type="button" className="btn" onClick={() => setConfirmRotate(overlay)} aria-label={`Replace the link of ${overlay.name}`}>
                  Replace link
                </button>
                <button type="button" className="btn" onClick={() => setConfirmDelete(overlay)} aria-label={`Delete ${overlay.name}`}>
                  Delete
                </button>
              </span>
            ) : undefined}
            empty={(
              <EmptyState
                title="No overlays yet"
                description="Pick a widget below to create an overlay and get its link for OBS."
              />
            )}
          />
        </section>

        <section aria-labelledby="tw-ov-catalogue">
          <div className="tw-ov-heading">
            <h2 id="tw-ov-catalogue" className="tw-ov-heading__title">Widgets</h2>
          </div>
          <ul className="tw-ov-catalogue">
            {WIDGETS.map((widget) => (
              <li key={widget} className="tw-ov-widget">
                <h3 className="tw-ov-widget__title">{WIDGET_INFO[widget].label}</h3>
                <p className="tw-ov-widget__text">{WIDGET_INFO[widget].description}</p>
                <button type="button" className="btn" disabled={!canEdit || atLimit}
                  onClick={() => open({ kind: 'new', widget })} aria-label={`Create a ${WIDGET_INFO[widget].label} overlay`}>
                  <Plus size={16} aria-hidden="true" /> Create
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="tw-ov-card" aria-labelledby="tw-ov-test">
          <h2 id="tw-ov-test" className="tw-ov-card__title">Test alerts</h2>
          <p className="tw-ov-card__lead">
            Sends a sample event, marked as a test, to your Alert box and Event list overlays. Nothing is posted in chat and nothing is recorded in the activity log.
          </p>
          {!hasAlertWidget && overlays.length > 0 && (
            <p className="tw-muted">You have no Alert box or Event list overlay yet, so a test will not appear anywhere.</p>
          )}
          <form className="tw-ov-inline" onSubmit={(event) => { event.preventDefault(); if (canEdit) test.mutate(testKind); }}>
            <Field label="Alert type">
              {(control) => (
                <select {...control} className="form-select" value={testKind} disabled={!canEdit}
                  onChange={(event) => setTestKind(event.target.value as AlertKind)}>
                  {ALERT_KINDS.map((kind) => <option key={kind} value={kind}>{ALERT_KIND_LABELS[kind]}</option>)}
                </select>
              )}
            </Field>
            <button type="submit" className="btn primary" disabled={!canEdit || test.isPending} aria-busy={test.isPending}>
              <Send size={16} aria-hidden="true" /> {test.isPending ? 'Sending…' : 'Send test alert'}
            </button>
          </form>
          {testError && <p className="tw-field__error" role="alert">{testError}</p>}
        </section>

        {settings.form && (
          <section className="tw-ov-card" aria-labelledby="tw-ov-settings">
            <h2 id="tw-ov-settings" className="tw-ov-card__title">Overlay settings</h2>
            {!settings.canWrite && <ReadOnlyNotice required={settings.writeRole} role={role} />}
            <FeatureToggle
              label="Overlays"
              description="When off, overlays show no live events and Acosmibot stops sending chat lines to the chat box. Links keep working once it is on again."
              enabled={settings.form.enabled}
              onChange={(enabled) => settings.canWrite && settings.setForm({ enabled })}
            />
            <div className="tw-ov-switches">
              <Switch
                label="Hide chat commands in the chat box"
                description="Messages that start with the channel's command prefix are not shown."
                checked={settings.form.chat_hide_commands} disabled={!settings.canWrite}
                onChange={(chat_hide_commands) => settings.setForm({ chat_hide_commands })}
              />
              <Switch
                label="Hide known bots in the chat box"
                description="Messages from well-known chat bots such as Nightbot and StreamElements are not shown."
                checked={settings.form.chat_hide_bots} disabled={!settings.canWrite}
                onChange={(chat_hide_bots) => settings.setForm({ chat_hide_bots })}
              />
            </div>
          </section>
        )}
        {settings.query.isError && (
          <div className="tw-inline-failed" role="alert">
            <span>Overlay settings didn't load.</span>
            <button type="button" className="btn" onClick={() => void settings.query.refetch()}>
              <RefreshCw size={16} aria-hidden="true" /> Retry
            </button>
          </div>
        )}
        <SettingsSaveBar settings={settings} />
      </div>

      <EditorDrawer
        open={editing !== null && draft !== null}
        title={editing?.kind === 'edit' ? `Edit ${editing.overlay.name}` : `New ${draft ? WIDGET_INFO[draft.widget].label : ''} overlay`}
        description={editing?.kind === 'edit'
          ? 'The link stays the same. Refresh the browser source in OBS to apply the changes.'
          : 'You get the link after creating the overlay. It is shown only once.'}
        onClose={() => setEditing(null)}
        onSubmit={submit}
        submitting={save.isPending}
        error={saveError}
        dirty={dirty}
        submitLabel={editing?.kind === 'edit' ? 'Save overlay' : 'Create overlay'}
        secondaryAction={editing?.kind === 'edit' ? (
          <button type="button" className="btn" onClick={() => setConfirmDelete(editing.overlay)}>Delete</button>
        ) : undefined}
      >
        {draft && (
          <>
            {editing?.kind === 'new' ? (
              <Field label="Widget" help={WIDGET_INFO[draft.widget].description}>
                {(control) => (
                  <select {...control} className="form-select" value={draft.widget}
                    onChange={(event) => {
                      const widget = event.target.value as WidgetKind;
                      const suggested = suggestName(draft.widget, overlays);
                      setProblems([]);
                      setDraft({
                        widget,
                        name: draft.name === suggested ? suggestName(widget, overlays) : draft.name,
                        config: defaultConfig(widget),
                      });
                    }}>
                    {WIDGETS.map((widget) => <option key={widget} value={widget}>{WIDGET_INFO[widget].label}</option>)}
                  </select>
                )}
              </Field>
            ) : (
              <p className="tw-muted">Widget: {WIDGET_INFO[draft.widget].label}</p>
            )}
            <Field label="Name" error={nameError ?? undefined} help={`For you only; viewers never see it. ${draft.name.length} of ${OVERLAY_LIMITS.nameMax} characters.`}>
              {(control) => (
                <input {...control} className="form-control" type="text" maxLength={OVERLAY_LIMITS.nameMax} value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              )}
            </Field>
            <ConfigFields widget={draft.widget} config={draft.config} problems={problems} idPrefix="tw-ov-config"
              onChange={(config) => setDraft({ ...draft, config })} />
          </>
        )}
      </EditorDrawer>

      {confirmRotate && (
        <ConfirmDialog
          kicker="Replace link" title={`Replace the link of ${confirmRotate.name}?`} confirmLabel="Replace link" tone="primary"
          pending={rotate.isPending}
          onConfirm={() => rotate.mutate(confirmRotate)}
          onClose={() => { setConfirmRotate(null); rotate.reset(); }}
        >
          <p>The current link stops working right away. You get a new link to paste into OBS; the settings stay the same.</p>
          {rotateError && <p className="confirm-dialog__warn" role="alert">{rotateError}</p>}
        </ConfirmDialog>
      )}

      {confirmDelete && (
        <ConfirmDialog
          kicker="Delete overlay" title={`Delete ${confirmDelete.name}?`} confirmLabel="Delete overlay"
          pending={remove.isPending}
          onConfirm={() => remove.mutate(confirmDelete)} onClose={() => setConfirmDelete(null)}
        >
          <p>Its link stops working right away and the browser source in OBS goes blank. This cannot be undone.</p>
        </ConfirmDialog>
      )}
    </SectionPage>
  );
};
