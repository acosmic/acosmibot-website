import React, { useEffect, useRef, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import {
  Check,
  CircleAlert,
  Pencil,
  Plus,
  Radio,
  RadioTower,
  Trash2,
  Tv,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useStreamPlatformConfig } from './useStreamPlatformConfig';
import {
  ChannelSelect,
  CollapsibleSection,
  FeatureToggle,
  LoadingSpinner,
  RoleMultiSelect,
  SaveBar,
  SocialAlertAvatar,
  SocialAlertRecord,
  SocialAlertsAdd,
  SocialAlertsEmpty,
  SocialAlertsKicker,
  SocialAlertsNotice,
  SocialAlertsPanel,
  SocialAlertsTelemetry,
  type SocialAlertState,
} from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';
import {
  getStreamerProfileImage,
  type Platform,
  streamingApi,
  type StreamerValidationResult,
} from '@/api/streaming';
import type { Streamer } from '@/types/features';

interface StreamPlatformFeatureProps {
  platform: Platform;
}

interface PlatformMeta {
  title: string;
  icon: LucideIcon;
  item: string;
  items: string;
  identifierLabel: string;
  placeholder: string;
  subtitle: string;
  deliveryFilter: string;
  validationHint: string;
}

const PLATFORM_META: Record<Platform, PlatformMeta> = {
  twitch: {
    title: 'Twitch',
    icon: Tv,
    item: 'streamer',
    items: 'streamers',
    identifierLabel: 'Twitch username',
    placeholder: 'creator',
    subtitle: 'Twitch streamer',
    deliveryFilter: 'Live + VOD',
    validationHint: 'Usernames are verified with Twitch before they are added.',
  },
  youtube: {
    title: 'YouTube',
    icon: Video,
    item: 'channel',
    items: 'channels',
    identifierLabel: 'YouTube channel, handle, or URL',
    placeholder: '@creator or channel URL',
    subtitle: 'YouTube channel',
    deliveryFilter: 'Live + uploads',
    validationHint: 'Channels are resolved with YouTube before they are added.',
  },
  kick: {
    title: 'Kick',
    icon: RadioTower,
    item: 'streamer',
    items: 'streamers',
    identifierLabel: 'Kick username',
    placeholder: 'creator',
    subtitle: 'Kick streamer',
    deliveryFilter: 'Live + VOD',
    validationHint: 'Usernames are verified with Kick before they are added.',
  },
};

const TIER_LABELS = {
  free: 'Free',
  plus: 'Plus',
  pro: 'Pro',
  max: 'Max',
} as const;

const streamerProfileQueryKey = (platform: Platform, username: string) => (
  ['streaming-profile', platform, username.trim().toLowerCase()] as const
);

export const StreamPlatformFeature: React.FC<StreamPlatformFeatureProps> = ({ platform }) => {
  const { guildId = '' } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();
  const query = useStreamPlatformConfig(guildId, platform);
  const { form, setForm, isDirty, resetForm } = useDirtyState(query.data);
  const formRef = useRef(form);
  formRef.current = form;
  const [identifier, setIdentifier] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [selectedStreamerIndex, setSelectedStreamerIndex] = useState<number | null>(null);
  const [validatingIndex, setValidatingIndex] = useState<number | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});
  const editorCloseRef = useRef<HTMLButtonElement>(null);
  const validationRunRef = useRef(0);
  const meta = PLATFORM_META[platform];
  const PlatformIcon = meta.icon;
  const profileQueries = useQueries({
    queries: (form?.tracked_streamers ?? []).map((streamer) => ({
      queryKey: streamerProfileQueryKey(platform, streamer.username),
      queryFn: () => streamingApi.validateStreamer(platform, streamer.username),
      enabled: Boolean(streamer.username.trim() && streamer.isValid),
      staleTime: 30 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      retry: 1,
    })),
  });

  useEffect(() => {
    if (selectedStreamerIndex === null) return undefined;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const originalOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => editorCloseRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedStreamerIndex(null);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', closeOnEscape);
      previouslyFocused?.focus();
    };
  }, [selectedStreamerIndex]);

  if (query.isLoading) return <LoadingSpinner />;

  if (query.isError || !query.data || !form) {
    return (
      <div className="feature-page social-alerts-page">
        <div className="social-alerts-state" role="alert">
          <CircleAlert aria-hidden="true" />
          <h1>{meta.title} Alerts could not load</h1>
          <p>{query.error instanceof Error ? query.error.message : 'The configuration service is unavailable right now.'}</p>
          <button type="button" className="btn primary" onClick={() => void query.refetch()}>Try again</button>
        </div>
      </div>
    );
  }

  const streamers = form.tracked_streamers ?? [];
  const maxStreamers = form.max_streamers ?? 1;
  const tier = form.premium_tier ?? 'free';
  const atCapacity = streamers.length >= maxStreamers;

  const replaceStreamers = (tracked_streamers: Streamer[]) => {
    if (formRef.current) {
      formRef.current = { ...formRef.current, tracked_streamers };
    }
    setForm({ tracked_streamers });
  };

  const updateStreamer = (index: number, updates: Partial<Streamer>) => {
    const currentStreamers = formRef.current?.tracked_streamers ?? [];
    if (!currentStreamers[index]) return;
    const next = [...currentStreamers];
    next[index] = { ...next[index], ...updates };
    replaceStreamers(next);
  };

  const removeStreamer = (index: number) => {
    validationRunRef.current += 1;
    setValidatingIndex(null);
    const currentStreamers = formRef.current?.tracked_streamers ?? [];
    replaceStreamers(currentStreamers.filter((_, streamerIndex) => streamerIndex !== index));
    setValidationErrors({});
    if (selectedStreamerIndex === index) {
      setSelectedStreamerIndex(null);
    } else if (selectedStreamerIndex !== null && selectedStreamerIndex > index) {
      setSelectedStreamerIndex(selectedStreamerIndex - 1);
    }
  };

  const addStreamer = async () => {
    const candidate = identifier.trim();
    if (!candidate) {
      setAddError(`Enter a ${meta.item} first.`);
      return;
    }
    if (atCapacity) {
      setAddError(`${TIER_LABELS[tier]} can save up to ${maxStreamers} ${maxStreamers === 1 ? meta.item : meta.items}.`);
      return;
    }
    if (streamers.some((streamer) => streamer.username.toLowerCase() === candidate.toLowerCase())) {
      setAddError(`${candidate} is already in this list.`);
      return;
    }

    setIsAdding(true);
    setAddError(null);
    try {
      const result = await streamingApi.validateStreamer(platform, candidate);
      if (!result.success || !result.valid) {
        setAddError(result.message || `That ${meta.item} could not be found.`);
        return;
      }

      queryClient.setQueryData<StreamerValidationResult>(
        streamerProfileQueryKey(platform, candidate),
        result,
      );

      const latestForm = formRef.current;
      if (!latestForm) return;
      const latestStreamers = latestForm.tracked_streamers ?? [];
      const duplicate = latestStreamers.some((streamer) =>
        streamer.username.toLowerCase() === candidate.toLowerCase()
        || (result.channel_id && streamer.channel_id === result.channel_id));
      if (duplicate) {
        setAddError(`${candidate} is already in this list.`);
        return;
      }
      if (latestStreamers.length >= maxStreamers) {
        setAddError(`${TIER_LABELS[tier]} capacity is full. Remove a saved ${meta.item} before adding another.`);
        return;
      }

      replaceStreamers([
        ...latestStreamers,
        {
          platform,
          username: candidate,
          channel_id: platform === 'youtube' ? result.channel_id ?? null : null,
          isValid: true,
          enabled: true,
          mention_role_ids: [],
          mention_everyone: false,
          mention_here: false,
          custom_message: null,
          skip_vod_check: false,
        },
      ]);
      setIdentifier('');
    } catch (error) {
      setAddError(error instanceof Error ? error.message : `The ${meta.item} could not be checked.`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleUsernameChange = (index: number, username: string) => {
    validationRunRef.current += 1;
    setValidatingIndex(null);
    updateStreamer(index, {
      username,
      isValid: false,
      channel_id: platform === 'youtube' ? null : streamers[index]?.channel_id,
    });
    setValidationErrors((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });
  };

  const validateStreamer = async (index: number) => {
    const streamer = streamers[index];
    const username = streamer?.username?.trim();
    if (!username) return;

    const usernameKey = username.toLowerCase();
    if (streamers.some((other, otherIndex) => (
      otherIndex !== index && other.username.trim().toLowerCase() === usernameKey
    ))) {
      updateStreamer(index, { isValid: false });
      setValidationErrors((current) => ({
        ...current,
        [index]: `${username} is already in this list.`,
      }));
      return;
    }

    const validationRun = validationRunRef.current + 1;
    validationRunRef.current = validationRun;
    setValidatingIndex(index);
    setValidationErrors((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });

    try {
      const result = await streamingApi.validateStreamer(platform, username);
      if (validationRunRef.current !== validationRun) return;

      const currentStreamer = formRef.current?.tracked_streamers?.[index];
      if (!currentStreamer || currentStreamer.username.trim().toLowerCase() !== usernameKey) return;

      if (result.success && result.valid) {
        queryClient.setQueryData<StreamerValidationResult>(
          streamerProfileQueryKey(platform, username),
          result,
        );
        const latestStreamers = formRef.current?.tracked_streamers ?? [];
        const isDuplicate = latestStreamers.some((other, otherIndex) => (
          otherIndex !== index
          && (other.username.trim().toLowerCase() === usernameKey
            || Boolean(result.channel_id && other.channel_id === result.channel_id))
        ));
        if (isDuplicate) {
          updateStreamer(index, { isValid: false });
          setValidationErrors((current) => ({
            ...current,
            [index]: `${username} is already in this list.`,
          }));
          return;
        }
        updateStreamer(index, {
          username,
          isValid: true,
          channel_id: platform === 'youtube' ? result.channel_id ?? streamer.channel_id ?? null : streamer.channel_id,
        });
      } else {
        updateStreamer(index, { isValid: false });
        setValidationErrors((current) => ({
          ...current,
          [index]: result.message || `${meta.item} was not found.`,
        }));
      }
    } catch (error) {
      if (validationRunRef.current !== validationRun) return;
      updateStreamer(index, { isValid: false });
      setValidationErrors((current) => ({
        ...current,
        [index]: error instanceof Error ? error.message : `Failed to validate ${meta.item}.`,
      }));
    } finally {
      if (validationRunRef.current === validationRun) {
        setValidatingIndex((current) => (current === index ? null : current));
      }
    }
  };

  const stateFor = (streamer: Streamer): SocialAlertState => {
    if (!streamer.enabled) return 'paused';
    if (!streamer.isValid) return 'unverified';
    if (form.enabled && form.announcement_channel_id) return 'active';
    return 'ready';
  };

  const selectedStreamer = selectedStreamerIndex !== null ? streamers[selectedStreamerIndex] : null;
  const selectedValidationError = selectedStreamerIndex !== null ? validationErrors[selectedStreamerIndex] : null;
  const invalidStreamer = streamers.find((streamer) => !streamer.username.trim() || !streamer.isValid);
  const validationMessage = isAdding || validatingIndex !== null
    ? `Wait for the ${meta.item} check to finish.`
    : form.enabled && !form.announcement_channel_id
      ? 'Choose a Discord channel before enabling alerts.'
      : invalidStreamer
        ? `Verify every saved ${meta.item} before saving.`
        : undefined;

  const saveForm = () => {
    const { premium_tier, max_streamers, ...payload } = form;
    query.save(payload);
  };

  const discardForm = () => {
    validationRunRef.current += 1;
    setValidatingIndex(null);
    resetForm();
    setSelectedStreamerIndex(null);
    setValidationErrors({});
    setAddError(null);
  };

  return (
    <div className="feature-page social-alerts-page stream-alerts-page">
      <header className="page-header text-start mt-0 mb-4">
        <SocialAlertsKicker icon={PlatformIcon}>Live signal</SocialAlertsKicker>
        <h1>{meta.title} Alerts</h1>
        <p>Route new {meta.title} activity into Discord with per-account delivery controls.</p>
      </header>

      <FeatureToggle
        label={`${meta.title} delivery`}
        enabled={form.enabled}
        onChange={(enabled) => setForm({ enabled })}
        description={`Enable or pause delivery for every saved ${meta.item}. Individual ${meta.items} can be paused below.`}
      />

      <SocialAlertsTelemetry
        ariaLabel={`${meta.title} Alerts plan status`}
        items={[
          { label: 'Current plan', value: TIER_LABELS[tier] },
          { label: 'Saved capacity', value: `${streamers.length} / ${maxStreamers}` },
          { label: 'Delivery filter', value: meta.deliveryFilter },
        ]}
      />

      <div className="social-alerts-grid">
        <SocialAlertsPanel
          titleId={`${platform}-accounts-title`}
          kicker="Alert roster"
          title={`Tracked ${meta.items}`}
          badge={`${streamers.length} saved`}
        >
          <SocialAlertsAdd
            label={meta.identifierLabel}
            labelFor={`${platform}-alert-identifier`}
            isBusy={isAdding}
            hint={atCapacity
              ? `${TIER_LABELS[tier]} capacity is full. Remove a saved ${meta.item} before adding another.`
              : `${meta.validationHint} Your ${TIER_LABELS[tier]} plan can save ${maxStreamers}.`}
            error={addError}
          >
            <div className="social-alerts-add__control">
              <div className="social-alerts-handle-input">
                <PlatformIcon aria-hidden="true" />
                <input
                  id={`${platform}-alert-identifier`}
                  className="form-control"
                  value={identifier}
                  onChange={(event) => { setIdentifier(event.target.value); setAddError(null); }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void addStreamer();
                    }
                  }}
                  placeholder={meta.placeholder}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={Boolean(addError)}
                  aria-describedby={`${platform}-alert-identifier-hint${addError ? ` ${platform}-alert-identifier-error` : ''}`}
                  disabled={isAdding || atCapacity}
                />
              </div>
              <button
                type="button"
                className="btn primary"
                onClick={() => void addStreamer()}
                disabled={isAdding || atCapacity}
              >
                <Plus aria-hidden="true" /> {isAdding ? 'Checking…' : `Add ${meta.item}`}
              </button>
            </div>
          </SocialAlertsAdd>

          {streamers.length === 0 ? (
            <SocialAlertsEmpty
              icon={Radio}
              title={`No ${meta.items} tracked yet`}
              description={`Add a ${meta.item} above. Delivery begins only after you save.`}
            />
          ) : (
            <ol className="social-alerts-record-list">
              {streamers.map((streamer, index) => (
                <SocialAlertRecord
                  key={`${streamer.channel_id || streamer.username}-${index}`}
                  avatar={
                    <SocialAlertAvatar
                      src={streamer.isValid ? getStreamerProfileImage(profileQueries[index]?.data) : null}
                      fallback={<PlatformIcon />}
                    />
                  }
                  title={streamer.username}
                  subtitle={meta.subtitle}
                  state={stateFor(streamer)}
                  enabled={streamer.enabled}
                  toggleLabel={`Deliver ${meta.title} alerts for ${streamer.username}`}
                  onEnabledChange={(enabled) => updateStreamer(index, { enabled })}
                  actionsLabel={`Actions for ${streamer.username}`}
                  actions={<>
                    <button type="button" onClick={() => setSelectedStreamerIndex(index)} aria-label={`Edit ${streamer.username}`}>
                      <Pencil aria-hidden="true" />
                    </button>
                    <button type="button" className="is-danger" onClick={() => removeStreamer(index)} aria-label={`Remove ${streamer.username}`}>
                      <Trash2 aria-hidden="true" />
                    </button>
                  </>}
                />
              ))}
            </ol>
          )}
        </SocialAlertsPanel>

        <div className="social-alerts-side-stack">
          <SocialAlertsPanel titleId={`${platform}-destination-title`} kicker="Discord route" title="Delivery destination">
            <div className="social-alerts-panel__body">
              <ChannelSelect
                guildId={guildId}
                value={form.announcement_channel_id}
                onChange={(announcement_channel_id) => setForm({ announcement_channel_id })}
                label="Announcement channel"
                placeholder="Choose a text channel…"
              />
              <div>
                <label className="form-label mb-2 d-block" htmlFor={`${platform}-default-message`}>Default message</label>
                <textarea
                  id={`${platform}-default-message`}
                  className="form-control"
                  rows={3}
                  value={form.announcement_message || ''}
                  onChange={(event) => setForm({ announcement_message: event.target.value })}
                  placeholder="{username} is live!"
                />
                <p className="social-alerts-panel__hint mx-0 mb-0">Use {'{username}'}, {'{link}'}, and {'{title}'} as placeholders.</p>
              </div>
            </div>
          </SocialAlertsPanel>

          <SocialAlertsPanel titleId={`${platform}-vod-title`} kicker="Follow-up" title="VOD handling">
            <div className="social-alerts-panel__body">
              <label className="form-check form-switch mb-3" htmlFor={`vodEnabled-${platform}`}>
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id={`vodEnabled-${platform}`}
                  checked={form.vod_settings.enabled}
                  onChange={(event) => setForm({
                    vod_settings: { ...form.vod_settings, enabled: event.target.checked },
                  })}
                />
                <span className="form-check-label">Post VOD links when available</span>
              </label>

              <label className="form-check form-switch mb-3" htmlFor={`vodEdit-${platform}`}>
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id={`vodEdit-${platform}`}
                  checked={form.vod_settings.edit_message_when_vod_available}
                  onChange={(event) => setForm({
                    vod_settings: { ...form.vod_settings, edit_message_when_vod_available: event.target.checked },
                  })}
                  disabled={!form.vod_settings.enabled}
                />
                <span className="form-check-label">Edit announcements with VOD links</span>
              </label>

              {platform !== 'twitch' && (
                <div>
                  <label className="form-label mb-2 d-block" htmlFor={`vodSuffix-${platform}`}>VOD link text</label>
                  <input
                    id={`vodSuffix-${platform}`}
                    type="text"
                    className="form-control"
                    value={form.vod_settings.vod_message_suffix || ''}
                    onChange={(event) => setForm({
                      vod_settings: { ...form.vod_settings, vod_message_suffix: event.target.value },
                    })}
                    placeholder="[Watch VOD]({vod_url})"
                    disabled={!form.vod_settings.enabled}
                  />
                  <p className="social-alerts-panel__hint mx-0 mb-0">Use {'{vod_url}'} as the VOD URL placeholder.</p>
                </div>
              )}
            </div>
          </SocialAlertsPanel>

          <SocialAlertsNotice icon={Radio} title="Saved pause controls" titleId={`${platform}-pause-note-title`}>
            Pausing a {meta.item} keeps its routing and custom message saved. Discord delivery resumes after you re-enable it and save.
          </SocialAlertsNotice>
        </div>
      </div>

      {selectedStreamerIndex !== null && selectedStreamer && (
        <div className="stream-editor-backdrop" onClick={() => setSelectedStreamerIndex(null)} role="presentation">
          <aside
            className="stream-editor-panel fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${platform}-stream-editor-title`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="stream-editor-header">
              <div>
                <h3 id={`${platform}-stream-editor-title`}>{selectedStreamer.username}</h3>
                <p>{meta.title} alert overrides</p>
              </div>
              <button
                ref={editorCloseRef}
                type="button"
                onClick={() => setSelectedStreamerIndex(null)}
                aria-label="Close editor"
              >
                <X size={18} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>

            <div className="stream-editor-body">
              <div className="mb-4">
                <label className="form-label mb-2 d-block" htmlFor={`${platform}-edit-identifier`}>{meta.identifierLabel}</label>
                <div className="input-group">
                  <input
                    id={`${platform}-edit-identifier`}
                    type="text"
                    className="form-control"
                    value={selectedStreamer.username}
                    onChange={(event) => handleUsernameChange(selectedStreamerIndex, event.target.value)}
                    onBlur={() => void validateStreamer(selectedStreamerIndex)}
                    placeholder={meta.placeholder}
                    aria-invalid={Boolean(selectedValidationError)}
                  />
                  {validatingIndex === selectedStreamerIndex && (
                    <span className="input-group-text bg-info text-dark small">Checking…</span>
                  )}
                  {validatingIndex !== selectedStreamerIndex && selectedStreamer.isValid && selectedStreamer.username && (
                    <span className="input-group-text bg-success text-light small"><Check size={14} aria-hidden="true" /></span>
                  )}
                  {validatingIndex !== selectedStreamerIndex && !selectedStreamer.isValid && selectedStreamer.username && (
                    <span className="input-group-text bg-warning text-dark small">Unverified</span>
                  )}
                </div>
                {selectedValidationError && <div className="text-danger small mt-2" role="alert">{selectedValidationError}</div>}
              </div>

              <CollapsibleSection title="Pings & Notifications" defaultOpen={true}>
                <div className="mb-3 d-flex gap-4 flex-wrap">
                  <label className="form-check" htmlFor={`pingEveryone-${platform}`}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id={`pingEveryone-${platform}`}
                      checked={selectedStreamer.mention_everyone}
                      onChange={(event) => updateStreamer(selectedStreamerIndex, { mention_everyone: event.target.checked })}
                    />
                    <span className="form-check-label">@everyone</span>
                  </label>
                  <label className="form-check" htmlFor={`pingHere-${platform}`}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id={`pingHere-${platform}`}
                      checked={selectedStreamer.mention_here}
                      onChange={(event) => updateStreamer(selectedStreamerIndex, { mention_here: event.target.checked })}
                    />
                    <span className="form-check-label">@here</span>
                  </label>
                </div>

                <RoleMultiSelect
                  guildId={guildId}
                  value={selectedStreamer.mention_role_ids}
                  onChange={(mention_role_ids) => updateStreamer(selectedStreamerIndex, { mention_role_ids })}
                  label="Role pings"
                  placeholder="Select roles to notify…"
                />
              </CollapsibleSection>

              <CollapsibleSection title="Custom Override">
                <div className="mb-3">
                  <label className="form-label mb-2 d-block" htmlFor={`${platform}-custom-message`}>Custom message (optional)</label>
                  <textarea
                    id={`${platform}-custom-message`}
                    className="form-control"
                    rows={3}
                    value={selectedStreamer.custom_message || ''}
                    onChange={(event) => updateStreamer(selectedStreamerIndex, { custom_message: event.target.value || null })}
                    placeholder="Overrides the global default message…"
                  />
                </div>
                <label className="form-check mb-2" htmlFor={`skipVod-${platform}`}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id={`skipVod-${platform}`}
                    checked={selectedStreamer.skip_vod_check}
                    onChange={(event) => updateStreamer(selectedStreamerIndex, { skip_vod_check: event.target.checked })}
                  />
                  <span className="form-check-label">Skip VOD check / edits</span>
                </label>
              </CollapsibleSection>
            </div>

            <div className="stream-editor-actions">
              <button type="button" className="btn" onClick={() => removeStreamer(selectedStreamerIndex)}>Delete</button>
              <button type="button" className="btn primary" onClick={() => setSelectedStreamerIndex(null)}>Done</button>
            </div>
          </aside>
        </div>
      )}

      <SaveBar
        isDirty={isDirty}
        onSave={saveForm}
        onDiscard={discardForm}
        isSaving={query.isSaving}
        saveError={query.saveError}
        saveDisabled={Boolean(validationMessage)}
        validationMessage={validationMessage}
      />
    </div>
  );
};
