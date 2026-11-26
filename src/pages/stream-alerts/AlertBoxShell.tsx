import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  streamAlertsApi,
  StreamAlertAccount,
  StreamAlertAlerts,
  StreamAlertGeneral,
  StreamAlertKindSettings,
  StreamAlertLook,
  StreamAlertType,
} from '@/api/streamAlerts';
import { plainError, TwitchConnectResult } from '@/utils/streamAlertAccounts';
import {
  addVariation,
  AlertBoxView,
  alertSettingsQueryKey,
  alertsQueryKey,
  DEFAULT_VIEW,
  MAX_VARIATIONS,
  menuGroups,
  normalizeAlert,
  normalizeGeneral,
  parseView,
  sameAlert,
  sameDefaults,
  sameGeneralSettings,
  sameView,
  savedPreviewConfig,
  settleView,
  VIEW_PARAM,
  viewLabel,
  viewParam,
} from '@/utils/streamAlertBox';
import { assetsQueryKey, DEFAULT_SAMPLES, SampleValues } from '@/utils/streamAlertDesigns';
import { AlertEventPage } from './AlertEventPage';
import { EditorsCard } from './EditorsCard';
import { GeneralSettingsPage } from './GeneralSettingsPage';
import { GlobalEditingPage } from './GlobalEditingPage';
import { MediaLibraryCard, useAssets } from './MediaLibraryCard';
import { ObsLinkCard } from './ObsLinkCard';
import { PREVIEW_BACKGROUNDS, PreviewPane } from './PreviewPane';
import type { PreviewHandle } from './previewHandle';
import { RewardsCard } from './RewardsCard';
import { ActivityList, ChannelEffects, LiveControls, OverlayLight, statusQueryKey, useStreamStatus } from './StreamAlertsPanel';
import { TestMenu } from './TestMenu';
import { TwitchCard } from './TwitchCard';
import './StreamAlertBox.css';

/** Something the person asked for that would throw unsaved changes away, waiting for their answer. */
interface Pending {
  to: string;
  run: () => void;
}

/** The Twitch pill in the top bar: how Twitch stands, and a way to the Connections page. */
const TwitchPill: React.FC<{ account: StreamAlertAccount; onOpen: () => void }> = ({ account, onOpen }) => {
  const status = useStreamStatus(account.id);
  const twitch = status.data?.twitch ?? null;
  const tone = !twitch ? '' : twitch.status === 'connected' ? 'is-on' : 'is-warn';
  const text = !status.data ? 'Twitch' : !twitch ? 'Twitch not connected' : twitch.status === 'connected' ? `Twitch: ${twitch.display_name || twitch.login}` : 'Twitch: connect again';
  return (
    <button type="button" className={`stream-box__pill ${tone}`} onClick={onOpen} title="Open Connections">
      <span aria-hidden="true" />{text}
    </button>
  );
};

/**
 * The alert box for one account, in the Streamlabs layout: the top bar (whose alerts, OBS link,
 * Test menu, overlay light, Twitch and live controls), the menu of pages on the left, and the
 * page. The page is in the address (`?view=`), so a reload or a shared link comes back to it.
 * Mounted with `key={account.id}`: nothing typed for one account carries over to another.
 */
export const AlertBoxShell: React.FC<{
  account: StreamAlertAccount;
  switcher: React.ReactNode;
  twitchArrival: TwitchConnectResult | null;
  /** The page with unsaved changes ("Follows"), or null. Switching account asks first while it is set. */
  onDirtyChange: (label: string | null) => void;
}> = ({ account, switcher, twitchArrival, onDirtyChange }) => {
  const queryClient = useQueryClient();
  const accountId = account.id;
  const isOwner = account.role === 'owner';
  const legacy = account.legacy_overlay;
  const [params, setParams] = useSearchParams();
  const preview = useRef<PreviewHandle | null>(null);
  const alertsKey = alertsQueryKey(accountId);
  const settingsKey = alertSettingsQueryKey(accountId);
  const alerts = useQuery({ queryKey: alertsKey, queryFn: () => streamAlertsApi.getAlerts(accountId) });
  const settings = useQuery({ queryKey: settingsKey, queryFn: () => streamAlertsApi.getAlertSettings(accountId) });
  const library = useAssets(accountId);
  const assets = useMemo(() => library.data?.assets ?? [], [library.data]);

  const [alertDraft, setAlertDraft] = useState<{ kind: StreamAlertType; alert: StreamAlertKindSettings } | null>(null);
  const [generalDraft, setGeneralDraft] = useState<StreamAlertGeneral | null>(null);
  const [defaultsDraft, setDefaultsDraft] = useState<StreamAlertLook | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [samples, setSamples] = useState<SampleValues>(DEFAULT_SAMPLES);
  const [background, setBackground] = useState(PREVIEW_BACKGROUNDS[0]);
  const [menuOpen, setMenuOpen] = useState(false);

  const savedAlert = (kind: StreamAlertType) => normalizeAlert(alerts.data?.alerts?.[kind], kind);
  const alertFor = (kind: StreamAlertType) => (alertDraft?.kind === kind ? alertDraft.alert : savedAlert(kind));
  const savedGeneral = useMemo(() => normalizeGeneral(settings.data?.general), [settings.data]);
  const general = generalDraft ?? savedGeneral;
  const defaults = defaultsDraft ?? savedGeneral.defaults;

  const requested = parseView(params.get(VIEW_PARAM), { legacy });
  const view = settleView(requested, requested.page === 'alert' ? alertFor(requested.kind) : null);

  const alertDirty = Boolean(alertDraft && !sameAlert(alertDraft.alert, savedAlert(alertDraft.kind), alertDraft.kind));
  const generalDirty = Boolean(generalDraft && !sameGeneralSettings(generalDraft, savedGeneral));
  const defaultsDirty = Boolean(defaultsDraft && !sameDefaults(defaultsDraft, savedGeneral.defaults));
  const dirtyLabel = alertDirty && alertDraft
    ? viewLabel({ page: 'alert', kind: alertDraft.kind, variation: null })
    : generalDirty ? 'General settings' : defaultsDirty ? 'Global editing' : null;

  useEffect(() => { onDirtyChange(dirtyLabel); }, [dirtyLabel, onDirtyChange]);
  useEffect(() => () => onDirtyChange(null), [onDirtyChange]);
  useEffect(() => {
    if (!dirtyLabel) return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyLabel]);

  // Back from Twitch: the result is shown on the Connections page.
  useEffect(() => {
    if (twitchArrival && view.page !== 'connections') writeView({ page: 'connections' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twitchArrival]);

  // An address naming a variation that is not there (deleted, or never saved) is tidied to the kind.
  useEffect(() => {
    if (alerts.data && !sameView(view, requested)) writeView(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts.data, viewParam(view), viewParam(requested)]);

  function writeView(next: AlertBoxView) {
    setParams((current) => {
      const updated = new URLSearchParams(current);
      if (sameView(next, DEFAULT_VIEW)) updated.delete(VIEW_PARAM);
      else updated.set(VIEW_PARAM, viewParam(next));
      return updated;
    }, { replace: true });
  }

  /** Whether going to `next` would throw unsaved changes away. */
  const wouldLose = (next: AlertBoxView) => (
    (alertDirty && alertDraft && !(next.page === 'alert' && next.kind === alertDraft.kind))
    || (generalDirty && next.page !== 'general')
    || (defaultsDirty && next.page !== 'global')
  );
  const discardFor = (next: AlertBoxView) => {
    if (!(next.page === 'alert' && next.kind === alertDraft?.kind)) setAlertDraft(null);
    if (next.page !== 'general') setGeneralDraft(null);
    if (next.page !== 'global') setDefaultsDraft(null);
  };
  /** Goes to a page, asking first in the page when that would throw unsaved changes away. */
  const go = (next: AlertBoxView, then?: () => void) => {
    setMenuOpen(false);
    const run = () => {
      setPending(null);
      discardFor(next);
      writeView(next);
      then?.();
    };
    if (wouldLose(next)) {
      setPending({ to: viewLabel(next, next.page === 'alert' ? alertFor(next.kind) : null), run });
      return;
    }
    run();
  };

  /** Adds a variation to the kind (as an unsaved change) and opens it. */
  const startVariation = (kind: StreamAlertType) => {
    // Another kind's unsaved draft is thrown away on the way (after asking), so start from this kind's own.
    const base = alertDraft?.kind === kind ? alertDraft.alert : savedAlert(kind);
    const added = addVariation(base, kind);
    if (!added) return;
    go({ page: 'alert', kind, variation: added.id }, () => setAlertDraft({ kind, alert: added.alert }));
  };

  const writeAlertsCache = (update: (old: StreamAlertAlerts) => StreamAlertAlerts) => {
    queryClient.setQueryData<StreamAlertAlerts>(alertsKey, (old) => (old ? update(old) : old));
  };
  const writeGeneralCache = (next: StreamAlertGeneral) => {
    queryClient.setQueryData<{ success: boolean; general: StreamAlertGeneral }>(settingsKey, (old) => ({ ...(old ?? { success: true }), general: next }));
    // The live minimums for older overlay copies are in the status settings too.
    queryClient.invalidateQueries({ queryKey: statusQueryKey(accountId) });
  };

  const savedConfig = useMemo(() => savedPreviewConfig(alerts.data?.resolved, settings.data?.general), [alerts.data, settings.data]);

  const kindTitle = (kind: StreamAlertType) => viewLabel({ page: 'alert', kind, variation: null });

  const renderPage = () => {
    if (view.page === 'alert' || view.page === 'global') {
      if (alerts.isLoading) return <p className="stream-accounts__empty" role="status">Loading the alert settings…</p>;
      if (!alerts.data) {
        return (
          <div className="stream-accounts__load-error" role="alert">
            <p className="stream-accounts__notice is-error">Could not load the alert settings: {plainError(alerts.error)}</p>
            <button type="button" disabled={alerts.isFetching} onClick={() => alerts.refetch()}>{alerts.isFetching ? 'Trying again…' : 'Try again'}</button>
          </div>
        );
      }
    }
    switch (view.page) {
      case 'general':
        return (
          <GeneralSettingsPage
            account={account}
            general={general}
            dirty={generalDirty}
            loading={settings.isLoading}
            loadError={settings.data ? null : settings.error}
            onRetry={() => settings.refetch()}
            onChange={setGeneralDraft}
            onDiscard={() => setGeneralDraft(null)}
            onSaved={(next) => { writeGeneralCache(next); setGeneralDraft(null); }}
          />
        );
      case 'global':
        return (
          <GlobalEditingPage
            account={account}
            defaults={defaults}
            dirty={defaultsDirty}
            data={alerts.data}
            followAlert={alertFor('follow')}
            assets={assets}
            assetsLoading={library.isLoading}
            savedConfig={savedConfig}
            preview={preview}
            background={background}
            onBackground={setBackground}
            samples={samples}
            onChange={setDefaultsDraft}
            onDiscard={() => setDefaultsDraft(null)}
            onSaved={(next) => { writeGeneralCache(next); setDefaultsDraft(null); }}
            onApplied={(applied) => {
              writeAlertsCache((old) => ({ ...old, alerts: { ...old.alerts, ...applied } }));
              queryClient.invalidateQueries({ queryKey: alertsKey });
            }}
          />
        );
      case 'alert': {
        const { kind } = view;
        const alert = alertFor(kind);
        const variation = view.variation ? alert.variations.find((item) => item.id === view.variation) : null;
        return (
          <AlertEventPage
            key={kind}
            account={account}
            kind={kind}
            title={variation ? `${kindTitle(kind)}: ${variation.name || 'Variation'}` : kindTitle(kind)}
            variationId={variation?.id ?? null}
            alert={alert}
            saved={savedAlert(kind)}
            dirty={alertDirty && alertDraft?.kind === kind}
            data={alerts.data}
            assets={assets}
            assetsLoading={library.isLoading}
            savedConfig={savedConfig}
            preview={preview}
            background={background}
            onBackground={setBackground}
            samples={samples}
            onSamples={setSamples}
            onChange={(next) => setAlertDraft({ kind, alert: next })}
            onDiscard={() => setAlertDraft(null)}
            onSaved={(saved, resolved) => {
              writeAlertsCache((old) => {
                const nextResolved = { ...old.resolved };
                if (resolved) nextResolved[kind] = resolved; else delete nextResolved[kind];
                return { ...old, alerts: { ...old.alerts, [kind]: saved }, resolved: nextResolved };
              });
              setAlertDraft(null);
              queryClient.invalidateQueries({ queryKey: alertsKey });
              queryClient.invalidateQueries({ queryKey: assetsQueryKey(accountId) });
            }}
            onOpen={(id) => go({ page: 'alert', kind, variation: id })}
            onAddVariation={() => startVariation(kind)}
          />
        );
      }
      case 'channel-points':
        return (
          <div className="stream-box__page">
            <header className="stream-box__page-head">
              <h2>Channel points</h2>
              <p>Choose what each channel point reward plays, and try the effects.</p>
            </header>
            <div className="stream-box__columns">
              <div className="stream-box__settings">
                <RewardsCard account={account} />
                <ChannelEffects account={account} preview={preview} name={samples.name} message={samples.message} />
              </div>
              <aside className="stream-box__side">
                <PreviewPane savedConfig={savedConfig} handleRef={preview} background={background} onBackground={setBackground} />
              </aside>
            </div>
          </div>
        );
      case 'media':
        return (
          <div className="stream-box__page">
            <header className="stream-box__page-head">
              <h2>Media library</h2>
              <p>Videos, pictures, sounds and fonts for your alerts.</p>
            </header>
            <MediaLibraryCard account={account} />
          </div>
        );
      case 'activity':
        return (
          <div className="stream-box__page">
            <header className="stream-box__page-head">
              <h2>Activity</h2>
              <p>Recent alerts. Replay one in OBS, or approve and block alerts while moderation holds them.</p>
            </header>
            <ActivityList account={account} />
          </div>
        );
      case 'connections':
        return (
          <div className="stream-box__page">
            <header className="stream-box__page-head">
              <h2>Connections</h2>
              <p>Your Twitch channel{isOwner ? ', and the people who can edit your alerts' : ''}.</p>
            </header>
            {/* For editors too: they see how Twitch stands, without the owner's buttons. */}
            <div className="stream-accounts__cards">
              <TwitchCard account={account} arrival={twitchArrival} />
              {isOwner ? <EditorsCard account={account} /> : (
                <p className="stream-accounts__empty">Only {account.owner_username} can change who edits these alerts.</p>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const groups = menuGroups(legacy);
  const current = viewParam(view);
  const draftKind = alertDirty ? alertDraft?.kind : null;

  const menuOptions: { value: string; label: string }[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      const label = group.label ? `${group.label}: ${item.label}` : item.label;
      menuOptions.push({ value: viewParam(item.view), label });
      if (item.view.page === 'alert') {
        for (const variation of alertFor(item.view.kind).variations) {
          menuOptions.push({ value: viewParam({ page: 'alert', kind: item.view.kind, variation: variation.id }), label: `${item.label}: ${variation.name || 'Variation'}` });
        }
      }
    }
  }

  return (
    <div className="stream-box">
      <header className="stream-box__top" aria-label="Alert box">
        <div className="stream-box__top-row">
          {switcher}
          <OverlayLight account={account} />
          <TwitchPill account={account} onOpen={() => go({ page: 'connections' })} />
        </div>
        <div className="stream-box__top-row is-link">
          {isOwner ? <ObsLinkCard account={account} compact /> : (
            <p className="stream-accounts__empty stream-box__obs-note">Only {account.owner_username} can see the OBS link.</p>
          )}
          <TestMenu account={account} savedAlert={savedAlert} samples={samples} />
        </div>
        <LiveControls account={account} preview={preview} />
      </header>

      <div className="stream-box__body">
        <nav className="stream-box__menu" aria-label="Alert box pages">
          <label className="stream-box__menu-select">
            <span>Page</span>
            <select className="form-control" value={current} onChange={(event) => go(parseView(event.target.value, { legacy }))}>
              {menuOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button type="button" className="stream-box__menu-toggle" aria-expanded={menuOpen} aria-controls="stream-box-menu-list" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? 'Hide all pages' : 'All pages'}
          </button>
          <div className={`stream-box__menu-list ${menuOpen ? 'is-open' : ''}`} id="stream-box-menu-list">
            {groups.map((group, index) => (
              <div key={index} className="stream-box__menu-group">
                {group.label && <span className="stream-box__menu-label">{group.label}</span>}
                <ul>
                  {group.items.map((item) => {
                    const value = viewParam(item.view);
                    const kind = item.view.page === 'alert' ? item.view.kind : null;
                    const alert = kind ? alertFor(kind) : null;
                    return (
                      <li key={value}>
                        <button
                          type="button"
                          className={`stream-box__menu-item ${current === value ? 'is-current' : ''}`}
                          aria-current={current === value ? 'page' : undefined}
                          onClick={() => go(item.view)}
                        >
                          <span>{item.label}</span>
                          {kind && alert && !alert.enabled && <small>Off</small>}
                          {kind && draftKind === kind && <small className="is-unsaved">Unsaved</small>}
                        </button>
                        {kind && alert && (
                          <ul className="stream-box__menu-variations">
                            {alert.variations.map((variation) => {
                              const variationValue = viewParam({ page: 'alert', kind, variation: variation.id });
                              return (
                                <li key={variation.id}>
                                  <button
                                    type="button"
                                    className={`stream-box__menu-item is-variation ${current === variationValue ? 'is-current' : ''}`}
                                    aria-current={current === variationValue ? 'page' : undefined}
                                    onClick={() => go({ page: 'alert', kind, variation: variation.id })}
                                  >
                                    <span>{variation.name || 'Variation'}</span>
                                    {!variation.enabled && <small>Off</small>}
                                  </button>
                                </li>
                              );
                            })}
                            <li>
                              <button
                                type="button"
                                className="stream-box__menu-item is-add"
                                disabled={alert.variations.length >= MAX_VARIATIONS || !alerts.data}
                                aria-label={`Add a variation to ${item.label}`}
                                onClick={() => startVariation(kind)}
                              >
                                + Add variation
                              </button>
                            </li>
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <main className="stream-box__content">
          {pending && (
            <div className="stream-accounts__confirm stream-box__pending" role="group" aria-label="Unsaved changes">
              <strong>You have unsaved changes on {dirtyLabel}.</strong>
              <p>Going to {pending.to} throws them away. Keep editing to save them first.</p>
              <div className="stream-accounts__buttons">
                <button type="button" className="is-danger" onClick={pending.run}>Discard changes and go</button>
                <button type="button" autoFocus onClick={() => setPending(null)}>Keep editing</button>
              </div>
            </div>
          )}
          {renderPage()}
        </main>
      </div>
    </div>
  );
};
