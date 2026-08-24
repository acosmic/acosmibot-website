import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  LockKeyhole,
  Send,
  X,
} from 'lucide-react';
import {
  adminApi,
  type SocialDraftJob,
  type SocialPlatformOverride,
  type SocialPlatformSpec,
  type SocialStudioSettings,
} from '@/api/admin';
import './SocialStudioTab.css';

const MEDIA_TYPES = ['image', 'gif', 'video', 'carousel', 'document', 'article', 'audio'];
const ASPECT_RATIOS = ['1:1', '4:5', '16:9', '1.91:1'];

const errorMessage = (value: unknown) => value instanceof Error ? value.message : String(value);

const statusLabel: Record<SocialDraftJob['status'], string> = {
  queued: 'Queued',
  running: 'Generating',
  succeeded: 'Delivered',
  failed: 'Needs attention',
  cancelled: 'Cancelled',
};

const formatTime = (value: string | null) => value
  ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  : '—';

export const SocialStudioTab: React.FC = () => {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ['admin', 'social-studio', 'settings'],
    queryFn: () => adminApi.getSocialStudioSettings(),
  });
  const guildsQuery = useQuery({
    queryKey: ['admin', 'guild-options'],
    queryFn: () => adminApi.getGuildOptions(),
  });
  const jobsQuery = useQuery({
    queryKey: ['admin', 'social-studio', 'jobs'],
    queryFn: () => adminApi.getSocialDraftJobs(),
    refetchInterval: (query) => query.state.data?.jobs.some(job => ['queued', 'running'].includes(job.status)) ? 5000 : false,
  });

  const [form, setForm] = useState<SocialStudioSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [brief, setBrief] = useState('');
  const [draftPlatforms, setDraftPlatforms] = useState<string[]>([]);
  const [generateImage, setGenerateImage] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [openPlatforms, setOpenPlatforms] = useState<Set<string>>(() => new Set(['x']));

  useEffect(() => {
    if (settingsQuery.data?.data && !dirty) {
      setForm(structuredClone(settingsQuery.data.data));
      setDraftPlatforms(current => current.length ? current : settingsQuery.data.data.default_platforms);
    }
  }, [settingsQuery.data, dirty]);

  const channelsQuery = useQuery({
    queryKey: ['admin', 'social-studio', 'channels', form?.destination.guild_id],
    queryFn: () => adminApi.getSocialStudioChannels(form!.destination.guild_id),
    enabled: Boolean(form?.destination.guild_id),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: SocialStudioSettings) => adminApi.updateSocialStudioSettings(payload),
    onSuccess: async ({ data }) => {
      setForm(structuredClone(data));
      setDirty(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3500);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'social-studio', 'settings'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: () => adminApi.createSocialDraftJob({
      campaign_name: campaignName.trim(),
      brief: brief.trim(),
      platforms: draftPlatforms,
      generate_image: generateImage,
      confirm: true,
    }),
    onSuccess: async () => {
      setCampaignName('');
      setBrief('');
      setConfirmed(false);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'social-studio', 'jobs'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => adminApi.cancelSocialDraftJob(jobId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'social-studio', 'jobs'] }),
  });

  const platformSpecs = settingsQuery.data?.platforms ?? [];
  const effectivePlatform = (platform: SocialPlatformSpec) => ({
    ...platform,
    ...(form?.platform_overrides[platform.key] ?? {}),
  });
  const enabledPlatforms = useMemo(
    () => platformSpecs.filter(platform => effectivePlatform(platform).enabled !== false),
    // form is intentionally included: overrides decide which compose choices remain available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [platformSpecs, form],
  );
  const activeJobs = jobsQuery.data?.jobs.filter(job => ['queued', 'running'].includes(job.status)).length ?? 0;
  const imageCompatibilityError = generateImage
    ? draftPlatforms
      .map(key => enabledPlatforms.find(platform => platform.key === key))
      .find(platform => platform && !effectivePlatform(platform).media_types.includes('image'))
    : undefined;
  const canQueue = Boolean(
    form?.enabled && !dirty && campaignName.trim() && brief.trim().length >= 10 && draftPlatforms.length
      && !imageCompatibilityError && confirmed && !createMutation.isPending,
  );

  const patchForm = (patch: Partial<SocialStudioSettings>) => {
    if (!form) return;
    setForm({ ...form, ...patch });
    setDirty(true);
    setSaved(false);
  };

  const patchPlatform = (key: string, patch: Partial<SocialPlatformOverride>) => {
    if (!form) return;
    const next = {
      ...form,
      platform_overrides: {
        ...form.platform_overrides,
        [key]: { ...(form.platform_overrides[key] ?? {}), ...patch },
      },
    };
    if (patch.enabled === false) {
      next.default_platforms = next.default_platforms.filter(item => item !== key);
      setDraftPlatforms(current => current.filter(item => item !== key));
    }
    setForm(next);
    setDirty(true);
    setSaved(false);
  };

  if (settingsQuery.error) {
    return <div className="social-studio__error" role="alert">Could not load Social Studio. {errorMessage(settingsQuery.error)}</div>;
  }
  if (settingsQuery.isLoading || !form) {
    return <div className="social-studio__loading" role="status"><LoaderCircle aria-hidden="true" /> Loading Social Studio…</div>;
  }

  return (
    <div className="social-studio">
      <div className="social-studio__guardrail">
        <span><LockKeyhole aria-hidden="true" /></span>
        <div>
          <strong>Review queue, never autopublish</strong>
          <p>The bot creates a Discord bundle for you. No social account credentials are stored and no network receives a post.</p>
        </div>
        <span className={form.enabled ? 'is-live' : ''}>{form.enabled ? 'Queue enabled' : 'Queue paused'}</span>
      </div>

      <form
        className="social-studio__settings"
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate(form);
        }}
      >
        <header className="social-studio__section-header">
          <div>
            <h3>Draft routing &amp; voice</h3>
            <p>Choose the private Discord destination and the defaults every queued brief snapshots.</p>
          </div>
          <div className="social-studio__save-actions">
            {dirty && <span>Unsaved changes</span>}
            {saved && <span className="is-saved"><Check aria-hidden="true" /> Saved</span>}
            <button type="submit" disabled={!dirty || saveMutation.isPending}>
              {saveMutation.isPending ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <Check aria-hidden="true" />}
              Save studio settings
            </button>
          </div>
        </header>

        {(saveMutation.error || guildsQuery.error || channelsQuery.error) && (
          <div className="social-studio__inline-error" role="alert">
            <AlertTriangle aria-hidden="true" />
            {errorMessage(saveMutation.error ?? guildsQuery.error ?? channelsQuery.error)}
          </div>
        )}

        <div className="social-studio__settings-grid">
          <fieldset className="social-studio__field-group">
            <legend>Discord delivery</legend>
            <label className="social-studio__toggle-row">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={event => patchForm({ enabled: event.target.checked })}
              />
              <span><strong>Enable draft generation</strong><small>Pausing leaves settings and history intact.</small></span>
            </label>
            <label>
              <span>Review server</span>
              <select
                value={form.destination.guild_id}
                onChange={event => patchForm({ destination: { guild_id: event.target.value, channel_id: '' } })}
              >
                <option value="">Choose a server</option>
                {(guildsQuery.data?.guilds ?? []).map(guild => <option key={guild.id} value={guild.id}>{guild.name}</option>)}
              </select>
            </label>
            <label>
              <span>Draft channel</span>
              <select
                value={form.destination.channel_id}
                disabled={!form.destination.guild_id || channelsQuery.isLoading}
                onChange={event => patchForm({ destination: { ...form.destination, channel_id: event.target.value } })}
              >
                <option value="">{channelsQuery.isLoading ? 'Loading channels…' : 'Choose a text channel'}</option>
                {(channelsQuery.data?.channels ?? []).map(channel => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
              </select>
            </label>
          </fieldset>

          <fieldset className="social-studio__field-group">
            <legend>Creative defaults</legend>
            <label>
              <span>Image frame</span>
              <select value={form.image_aspect_ratio} onChange={event => patchForm({ image_aspect_ratio: event.target.value as SocialStudioSettings['image_aspect_ratio'] })}>
                <option value="4:5">Portrait · 4:5</option>
                <option value="1:1">Square · 1:1</option>
                <option value="16:9">Landscape · 16:9</option>
              </select>
            </label>
            <div className="social-studio__paired-fields">
              <label>
                <span>Emoji use</span>
                <select value={form.emoji_policy} onChange={event => patchForm({ emoji_policy: event.target.value as SocialStudioSettings['emoji_policy'] })}>
                  <option value="none">None</option>
                  <option value="light">Light</option>
                  <option value="expressive">Expressive</option>
                </select>
              </label>
              <label>
                <span>Max hashtags</span>
                <input type="number" min={0} max={10} value={form.max_hashtags} onChange={event => patchForm({ max_hashtags: Number(event.target.value) })} />
              </label>
            </div>
            <label>
              <span>Exact call to action <small>Appended after AI screening</small></span>
              <textarea rows={2} maxLength={300} value={form.default_call_to_action} onChange={event => patchForm({ default_call_to_action: event.target.value })} placeholder="Optional owner-written line or trusted URL" />
            </label>
          </fieldset>
        </div>

        <label className="social-studio__voice-field">
          <span>Brand voice <small>{form.brand_voice.length}/1200</small></span>
          <textarea rows={4} maxLength={1200} value={form.brand_voice} onChange={event => patchForm({ brand_voice: event.target.value })} />
        </label>

        <section className="social-studio__platforms" aria-labelledby="social-platform-heading">
          <header className="social-studio__section-header">
            <div>
              <h3 id="social-platform-heading">Platform contracts</h3>
              <p>Dated defaults remain editable. Markdown support, counting behavior, media, and final-check notes travel with each job.</p>
            </div>
            <span>{platformSpecs.length} network profiles</span>
          </header>
          <div className="social-studio__platform-list">
            {platformSpecs.map(platform => {
              const effective = effectivePlatform(platform);
              const available = effective.enabled !== false;
              const isDefault = form.default_platforms.includes(platform.key);
              return (
                <details
                  key={platform.key}
                  className="social-platform"
                  open={openPlatforms.has(platform.key)}
                  onToggle={event => {
                    const isOpen = event.currentTarget.open;
                    setOpenPlatforms(current => {
                      if (current.has(platform.key) === isOpen) return current;
                      const next = new Set(current);
                      if (isOpen) next.add(platform.key);
                      else next.delete(platform.key);
                      return next;
                    });
                  }}
                >
                  <summary>
                    <span className="social-platform__disclosure"><ChevronDown aria-hidden="true" /></span>
                    <span className="social-platform__identity"><strong>{platform.label}</strong><small>Reviewed {platform.reviewed_at}</small></span>
                    <span className="social-platform__metric"><b>{effective.character_limit}</b><small>{effective.counting}</small></span>
                    <span className="social-platform__metric"><b>{effective.max_media} media</b><small>{effective.media_types.join(' · ')}</small></span>
                    <span className="social-platform__markdown"><X aria-hidden="true" /> No Markdown</span>
                  </summary>
                  <div className="social-platform__config">
                    <div className="social-platform__switches">
                      <label>
                        <input
                          type="checkbox"
                          checked={available}
                          disabled={available && isDefault && form.default_platforms.length === 1}
                          onChange={event => patchPlatform(platform.key, { enabled: event.target.checked })}
                        />
                        Available in composer
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={isDefault}
                          disabled={!available || (isDefault && form.default_platforms.length === 1)}
                          onChange={event => patchForm({
                            default_platforms: event.target.checked
                              ? [...form.default_platforms, platform.key]
                              : form.default_platforms.filter(key => key !== platform.key),
                          })}
                        />
                        Selected by default
                      </label>
                    </div>
                    <div className="social-platform__fields">
                      <label><span>Character limit</span><input type="number" min={50} max={5000} value={effective.character_limit} onChange={event => patchPlatform(platform.key, { character_limit: Number(event.target.value) })} /></label>
                      <label><span>Media limit</span><input type="number" min={1} max={20} value={effective.max_media} onChange={event => patchPlatform(platform.key, { max_media: Number(event.target.value) })} /></label>
                      <label><span>Image MB</span><input type="number" min={1} max={100} value={effective.max_image_mb} onChange={event => patchPlatform(platform.key, { max_image_mb: Number(event.target.value) })} /></label>
                      <label>
                        <span>Composer format</span>
                        <select value={effective.formatting} onChange={event => patchPlatform(platform.key, { formatting: event.target.value as SocialPlatformSpec['formatting'] })}>
                          <option value="plain_text">Plain text</option>
                          <option value="facets">Facets / plain copy</option>
                          <option value="rich_text">Rich-text composer</option>
                        </select>
                      </label>
                    </div>
                    <fieldset className="social-platform__media-types">
                      <legend>Accepted media</legend>
                      {MEDIA_TYPES.map(media => (
                        <label key={media}>
                          <input
                            type="checkbox"
                            checked={effective.media_types.includes(media)}
                            disabled={effective.media_types.length === 1 && effective.media_types.includes(media)}
                            onChange={event => patchPlatform(platform.key, {
                              media_types: event.target.checked
                                ? [...effective.media_types, media]
                                : effective.media_types.filter(item => item !== media),
                            })}
                          />
                          {media}
                        </label>
                      ))}
                    </fieldset>
                    <fieldset className="social-platform__aspect-ratios">
                      <legend>Accepted image frames</legend>
                      {ASPECT_RATIOS.map(ratio => (
                        <label key={ratio}>
                          <input
                            type="checkbox"
                            checked={effective.aspect_ratios.includes(ratio)}
                            disabled={effective.aspect_ratios.length === 1 && effective.aspect_ratios.includes(ratio)}
                            onChange={event => patchPlatform(platform.key, {
                              aspect_ratios: event.target.checked
                                ? [...effective.aspect_ratios, ratio]
                                : effective.aspect_ratios.filter(item => item !== ratio),
                            })}
                          />
                          {ratio}
                        </label>
                      ))}
                    </fieldset>
                    <label className="social-platform__note"><span>Final composer check</span><textarea rows={2} maxLength={500} value={effective.notes} onChange={event => patchPlatform(platform.key, { notes: event.target.value })} /></label>
                    <div className="social-platform__sources">
                      {platform.source_urls.map((url, index) => (
                        <a href={url} target="_blank" rel="noreferrer" key={url}>Official source {index + 1}<ExternalLink aria-hidden="true" /></a>
                      ))}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      </form>

      <section className="social-studio__composer" aria-labelledby="social-compose-heading">
        <header className="social-studio__section-header">
          <div>
            <h3 id="social-compose-heading">Queue a review draft</h3>
            <p>One structured copy pass, one optional reference-led image, then a screened Discord delivery.</p>
          </div>
          <span>{activeJobs}/{jobsQuery.data?.limits.active ?? 2} active</span>
        </header>
        {!form.enabled && <div className="social-studio__paused"><Clock3 aria-hidden="true" /> Save a destination and enable the queue before drafting.</div>}
        {createMutation.error && <div className="social-studio__inline-error" role="alert"><AlertTriangle aria-hidden="true" /> {errorMessage(createMutation.error)}</div>}
        <div className="social-studio__compose-grid">
          <div className="social-studio__brief-fields">
            <label><span>Campaign name</span><input maxLength={100} value={campaignName} onChange={event => setCampaignName(event.target.value)} placeholder="August community update" /></label>
            <label><span>Creative brief <small>{brief.length}/4000</small></span><textarea rows={8} maxLength={4000} value={brief} onChange={event => setBrief(event.target.value)} placeholder="What happened, what is confirmed, who this is for, the desired mood, and anything the artwork must show." /></label>
          </div>
          <div className="social-studio__draft-options">
            <fieldset>
              <legend>Generate variants for</legend>
              {enabledPlatforms.map(platform => (
                <label key={platform.key}>
                  <input
                    type="checkbox"
                    checked={draftPlatforms.includes(platform.key)}
                    onChange={event => setDraftPlatforms(current => event.target.checked ? [...current, platform.key] : current.filter(key => key !== platform.key))}
                  />
                  <span>{platform.label}<small>{effectivePlatform(platform).character_limit} max · {effectivePlatform(platform).formatting.replace('_', ' ')}</small></span>
                </label>
              ))}
            </fieldset>
            <label className="social-studio__toggle-row">
              <input type="checkbox" checked={generateImage} onChange={event => setGenerateImage(event.target.checked)} />
              <span><strong><ImageIcon aria-hidden="true" /> Generate branded image</strong><small>Uses only the approved Acosmibot reference set.</small></span>
            </label>
            <label className="social-studio__confirm">
              <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
              <span>I understand this spends AI capacity and sends a review bundle to the configured Discord channel.</span>
            </label>
            {imageCompatibilityError && (
              <div className="social-studio__inline-error" role="alert">
                <AlertTriangle aria-hidden="true" />
                {imageCompatibilityError.label} is configured without image support. Choose copy only or update its media contract.
              </div>
            )}
            <button className="social-studio__queue-button" type="button" disabled={!canQueue} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <Send aria-hidden="true" />}
              Queue Discord draft
            </button>
          </div>
        </div>
      </section>

      <section className="social-studio__history" aria-labelledby="social-history-heading">
        <header className="social-studio__section-header">
          <div><h3 id="social-history-heading">Recent queue</h3><p>Content is scrubbed after 30 days; status and delivery IDs remain operational evidence.</p></div>
          <span>{jobsQuery.data?.jobs.length ?? 0} jobs</span>
        </header>
        {jobsQuery.isLoading ? (
          <div className="social-studio__loading" role="status"><LoaderCircle aria-hidden="true" /> Loading queue…</div>
        ) : jobsQuery.error ? (
          <div className="social-studio__inline-error" role="alert"><AlertTriangle aria-hidden="true" /> {errorMessage(jobsQuery.error)}</div>
        ) : !jobsQuery.data?.jobs.length ? (
          <div className="social-studio__empty"><FileText aria-hidden="true" /><strong>No drafts yet</strong><span>Your first queued review bundle will appear here.</span></div>
        ) : (
          <div className="social-studio__job-list">
            {jobsQuery.data.jobs.map(job => (
              <article key={job.job_id} className="social-job">
                <span className={`social-job__status is-${job.status}`}><i /> {statusLabel[job.status]}</span>
                <div><strong>{job.campaign_name}</strong><span>{job.platforms.join(' · ')}{job.generate_image ? ' · image' : ' · copy only'}</span></div>
                <time dateTime={job.created_at ?? undefined}>{formatTime(job.created_at)}</time>
                {job.status === 'failed' && <span className="social-job__error">{job.error_type?.replaceAll('_', ' ') ?? 'Generation failed'}</span>}
                {job.status === 'queued' && <button type="button" onClick={() => cancelMutation.mutate(job.job_id)} disabled={cancelMutation.isPending}>Cancel</button>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
