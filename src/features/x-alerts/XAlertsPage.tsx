import React, { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  AtSign,
  BellRing,
  CircleAlert,
  LockKeyhole,
  Pause,
  Plus,
  Radio,
  Trash2,
} from 'lucide-react';
import { xAlertsApi, type XAlertAccount, type XAlertSettings } from '@/api/xAlerts';
import { ChannelSelect, FeatureToggle, LoadingSpinner, RoleSelect, SaveBar } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';
import { useXAlertsConfig } from './useXAlertsConfig';
import './XAlertsPage.css';

const TIER_LABELS = {
  free: 'Free',
  plus: 'Plus',
  pro: 'Pro',
  max: 'Max',
} as const;

const normalizePriorities = (settings: XAlertSettings): XAlertSettings => ({
  ...settings,
  accounts: settings.accounts.map((account, index) => ({ ...account, priority: index })),
});

export const XAlertsPage: React.FC = () => {
  const { guildId = '' } = useParams<{ guildId: string }>();
  const query = useXAlertsConfig(guildId);
  const { form, setForm, isDirty, resetForm } = useDirtyState(query.data?.settings);
  const formRef = useRef(form);
  formRef.current = form;
  const [username, setUsername] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const tier = query.data?.tier ?? 'free';
  const limit = query.data?.limit ?? 0;
  const enabledAccounts = form?.accounts.filter((account) => account.enabled) ?? [];
  const atCapacity = (form?.accounts.length ?? 0) >= limit;
  const overLimit = enabledAccounts.length > limit;
  const enabledPositionById = useMemo(() => {
    const positions = new Map<string, number>();
    let position = 0;
    form?.accounts.forEach((account) => {
      if (!account.enabled) return;
      positions.set(account.user_id, position);
      position += 1;
    });
    return positions;
  }, [form?.accounts]);

  if (query.isLoading) return <LoadingSpinner />;

  if (query.isError || !query.data || !form) {
    return (
      <div className="feature-page">
        <div className="x-alerts-state" role="alert">
          <CircleAlert aria-hidden="true" />
          <h1>X Alerts could not load</h1>
          <p>{query.error instanceof Error ? query.error.message : 'The configuration service is unavailable right now.'}</p>
          <button type="button" className="btn primary" onClick={() => void query.refetch()}>Try again</button>
        </div>
      </div>
    );
  }

  if (tier === 'free') {
    return (
      <div className="feature-page x-alerts-page">
        <header className="page-header text-start mt-0 mb-4">
          <span className="x-alerts-kicker"><AtSign aria-hidden="true" /> Social signal</span>
          <h1>X Post Alerts</h1>
          <p>Send new posts from selected X accounts to one Discord channel.</p>
        </header>

        <section className="x-alerts-lock" aria-labelledby="x-alerts-lock-title">
          <div className="x-alerts-lock__signal" aria-hidden="true"><LockKeyhole /></div>
          <div>
            <span className="x-alerts-kicker">Plus feature</span>
            <h2 id="x-alerts-lock-title">Track one X account with Plus.</h2>
            <p>
              X Alerts starts on Plus. Pro and Max can track up to three accounts.
              If a paid plan ends, saved settings stay here and delivery pauses.
            </p>
            <ul>
              <li>Original posts and quote posts</li>
              <li>Replies and reposts skipped</li>
              <li>One shared Discord destination</li>
            </ul>
            {form.accounts.length > 0 && (
              <p className="x-alerts-lock__retained" role="status">
                <Pause aria-hidden="true" />
                {form.accounts.length} saved account{form.accounts.length === 1 ? '' : 's'} retained for this server.
              </p>
            )}
            <Link to={`/pricing?guild=${guildId}`} className="btn primary">
              Compare plans <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const replaceAccounts = (accounts: XAlertAccount[]) => {
    setForm({ accounts: accounts.map((account, index) => ({ ...account, priority: index })) });
  };

  const moveAccount = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= form.accounts.length) return;
    const next = [...form.accounts];
    [next[index], next[destination]] = [next[destination], next[index]];
    replaceAccounts(next);
  };

  const updateAccount = (index: number, updates: Partial<XAlertAccount>) => {
    const next = [...form.accounts];
    next[index] = { ...next[index], ...updates };
    replaceAccounts(next);
  };

  const removeAccount = (index: number) => {
    replaceAccounts(form.accounts.filter((_, accountIndex) => accountIndex !== index));
  };

  const addAccount = async () => {
    const candidate = username.trim().replace(/^@/, '');
    if (!candidate) {
      setValidationError('Enter an X username first.');
      return;
    }
    if (!/^[A-Za-z0-9_]{1,15}$/.test(candidate)) {
      setValidationError('Use 1–15 letters, numbers, or underscores.');
      return;
    }
    if (form.accounts.length >= limit) {
      setValidationError(`${TIER_LABELS[tier]} can add up to ${limit} X account${limit === 1 ? '' : 's'}.`);
      return;
    }
    if (form.accounts.some((account) => account.username.toLowerCase() === candidate.toLowerCase())) {
      setValidationError(`@${candidate} is already in this list.`);
      return;
    }

    setIsValidating(true);
    setValidationError(null);
    try {
      const result = await xAlertsApi.validateUsername(guildId, candidate);
      if (!result.success || !result.valid || !result.user) {
        setValidationError(result.message || 'That X account could not be found.');
        return;
      }
      const latestForm = formRef.current;
      if (!latestForm) return;
      if (latestForm.accounts.some((account) => account.user_id === result.user?.user_id)) {
        setValidationError(`@${result.user.username} is already in this list.`);
        return;
      }
      if (latestForm.accounts.length >= limit) {
        setValidationError(`${TIER_LABELS[tier]} can add up to ${limit} X account${limit === 1 ? '' : 's'}.`);
        return;
      }
      replaceAccounts([
        ...latestForm.accounts,
        {
          user_id: result.user.user_id,
          username: result.user.username,
          display_name: result.user.display_name,
          profile_image_url: result.user.profile_image_url,
          enabled: true,
          priority: latestForm.accounts.length,
        },
      ]);
      setUsername('');
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'The account could not be checked.');
    } finally {
      setIsValidating(false);
    }
  };

  const validationMessage = isValidating
    ? 'Wait for the X account check to finish.'
    : form.enabled && !form.channel_id
      ? 'Choose a Discord channel before enabling alerts.'
      : undefined;

  return (
    <div className="feature-page x-alerts-page">
      <header className="page-header text-start mt-0 mb-4">
        <span className="x-alerts-kicker"><AtSign aria-hidden="true" /> Social signal</span>
        <h1>X Post Alerts</h1>
        <p>Route original posts and quote posts from X (formerly Twitter) into Discord.</p>
      </header>

      <FeatureToggle
        label="X post delivery"
        enabled={form.enabled}
        onChange={(enabled) => setForm({ enabled })}
        description="Enable or pause delivery for every configured account. Saved accounts remain in place while paused."
      />

      <section className="x-alerts-telemetry" aria-label="X Alerts plan status">
        <div>
          <span>Current plan</span>
          <strong>{TIER_LABELS[tier]}</strong>
        </div>
        <div>
              <span>Saved capacity</span>
              <strong>{form.accounts.length} / {limit}</strong>
        </div>
        <div>
          <span>Delivery filter</span>
          <strong>Posts + quotes</strong>
        </div>
      </section>

      {overLimit && (
        <div className="x-alerts-notice is-warning" role="alert">
          <CircleAlert aria-hidden="true" />
          <div>
            <strong>Choose the accounts that stay active.</strong>
            <span>Your plan covers {limit}. Move the accounts that should keep delivering to the top; the rest stay saved but suspended.</span>
          </div>
        </div>
      )}

      <div className="x-alerts-grid">
        <section className="x-alerts-panel" aria-labelledby="x-accounts-title">
          <div className="x-alerts-panel__header">
            <div>
              <span className="x-alerts-kicker">Priority queue</span>
              <h2 id="x-accounts-title">Tracked accounts</h2>
            </div>
            <span className="x-alerts-capacity">{form.accounts.length} saved</span>
          </div>

          <div className="x-alerts-add" aria-busy={isValidating}>
            <label htmlFor="x-alert-username">X username</label>
            <div className="x-alerts-add__control">
              <div className="x-alerts-handle-input">
                <AtSign aria-hidden="true" />
                <input
                  id="x-alert-username"
                  className="form-control"
                  value={username}
                  onChange={(event) => { setUsername(event.target.value); setValidationError(null); }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void addAccount();
                    }
                  }}
                  placeholder="creator"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={16}
                  aria-invalid={Boolean(validationError)}
                  aria-describedby={`x-alert-username-hint${validationError ? ' x-alert-username-error' : ''}`}
                  disabled={isValidating || atCapacity}
                />
              </div>
              <button
                type="button"
                className="btn primary"
                onClick={() => void addAccount()}
                disabled={isValidating || atCapacity}
              >
                <Plus aria-hidden="true" /> {isValidating ? 'Checking…' : 'Add account'}
              </button>
            </div>
            <p id="x-alert-username-hint">
              {atCapacity
                ? `${TIER_LABELS[tier]} capacity is full. Remove a saved account before adding another.`
                : `Accounts are verified with X before they are added. Your ${TIER_LABELS[tier]} plan can add ${limit}.`}
            </p>
            {validationError && <div id="x-alert-username-error" className="x-alerts-field-error" role="alert">{validationError}</div>}
          </div>

          {form.accounts.length === 0 ? (
            <div className="x-alerts-empty">
              <Radio aria-hidden="true" />
              <h3>No X accounts tracked yet</h3>
              <p>Add a username above. Tracking begins only after you save.</p>
            </div>
          ) : (
            <ol className="x-alerts-account-list">
              {form.accounts.map((account, index) => {
                const enabledPosition = enabledPositionById.get(account.user_id) ?? Number.POSITIVE_INFINITY;
                const state = !account.enabled
                  ? 'paused'
                  : enabledPosition >= limit
                    ? 'suspended'
                    : form.enabled && form.channel_id
                      ? 'active'
                      : 'ready';
                return (
                  <li key={account.user_id} className={`x-alerts-account is-${state}`}>
                    <span className="x-alerts-account__priority" aria-label={`Priority ${index + 1}`}>{index + 1}</span>
                    <div className="x-alerts-account__avatar" aria-hidden="true">
                      {account.profile_image_url
                        ? <img src={account.profile_image_url} alt="" />
                        : <span>{account.display_name.charAt(0).toUpperCase() || 'X'}</span>}
                    </div>
                    <div className="x-alerts-account__identity">
                      <strong>{account.display_name}</strong>
                      <span>@{account.username}</span>
                    </div>
                    <span className={`x-alerts-account__state is-${state}`}>
                      {state === 'active'
                        ? <BellRing aria-hidden="true" />
                        : state === 'ready'
                          ? <Radio aria-hidden="true" />
                          : <Pause aria-hidden="true" />}
                      {state}
                    </span>
                    <label className="x-alerts-account__toggle">
                      <span className="visually-hidden">Deliver posts from @{account.username}</span>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={account.enabled}
                        onChange={(event) => updateAccount(index, { enabled: event.target.checked })}
                      />
                    </label>
                    <div className="x-alerts-account__actions" role="group" aria-label={`Priority controls for @${account.username}`}>
                      <button type="button" onClick={() => moveAccount(index, -1)} disabled={index === 0} aria-label={`Move @${account.username} up`}>
                        <ArrowUp aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => moveAccount(index, 1)} disabled={index === form.accounts.length - 1} aria-label={`Move @${account.username} down`}>
                        <ArrowDown aria-hidden="true" />
                      </button>
                      <button type="button" className="is-danger" onClick={() => removeAccount(index)} aria-label={`Remove @${account.username}`}>
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div className="x-alerts-side-stack">
          <section className="x-alerts-panel" aria-labelledby="x-destination-title">
            <div className="x-alerts-panel__header">
              <div>
                <span className="x-alerts-kicker">Discord route</span>
                <h2 id="x-destination-title">Delivery destination</h2>
              </div>
            </div>
            <ChannelSelect
              guildId={guildId}
              value={form.channel_id}
              onChange={(channel_id) => setForm({ channel_id })}
              label="Announcement channel"
              placeholder="Choose a text channel…"
            />
            <RoleSelect
              guildId={guildId}
              value={form.mention_role_id}
              onChange={(mention_role_id) => setForm({ mention_role_id })}
              label="Role mention (optional)"
              placeholder="Do not mention a role"
            />
            <p className="x-alerts-panel__hint">Acosmibot needs permission to view the channel, send messages, and embed links.</p>
          </section>

          <aside className="x-alerts-notice" aria-labelledby="x-data-note-title">
            <Radio aria-hidden="true" />
            <div>
              <strong id="x-data-note-title">Measured X data use</strong>
              <span>
                Acosmibot checks only the accounts you save. Replies and reposts are skipped;
                original and quote posts may arrive shortly after publishing.
              </span>
            </div>
          </aside>
        </div>
      </div>

      <SaveBar
        isDirty={isDirty}
        onSave={() => query.save(normalizePriorities(form))}
        onDiscard={resetForm}
        isSaving={query.isSaving}
        saveError={query.saveError}
        saveDisabled={Boolean(validationMessage)}
        validationMessage={validationMessage}
      />
    </div>
  );
};
