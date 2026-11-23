/**
 * Stream tools (§11.4, §12.8): edit the stream title and category, give another
 * channel a shoutout, and set how the chat commands !so, !clip and !marker answer.
 * Changing the title or category needs the editor role; a shoutout needs moderator.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, Save, Search } from 'lucide-react';
import { FeatureToggle } from '@/components/ui';
import { showToast } from '@/utils/toast';
import type { SectionProps } from '../types';
import {
  Field,
  ReadOnlyNotice,
  RoleGate,
  SectionPage,
  SettingsSaveBar,
  TemplateField,
  UserLookupInput,
  hasRole,
  isTwitchApiError,
  isValidLogin,
  normalizeLogin,
  tk,
  twitchErrorMessage,
  twitchRetry,
  useChannelMutation,
  useSectionSettings,
} from '../shared/ui';
import { streamApi } from './api';
import {
  COMMERCIAL_LENGTHS,
  STREAM_LIMITS,
  TEMPLATE_MAX,
  describeShoutout,
  oneLine,
  streamInfoChanges,
  titleProblem,
  type Category,
  type StreamToolsSettings,
} from './model';
import './stream-tools.css';

export const StreamToolsPage: React.FC<SectionProps> = ({ channelId, role }) => {
  const canEdit = hasRole(role, 'editor');
  const info = useQuery({
    queryKey: tk(channelId, 'stream-info'),
    queryFn: () => streamApi.info(channelId),
    retry: twitchRetry,
  });
  const settings = useSectionSettings<StreamToolsSettings>(channelId, 'stream_tools');
  const saved = info.data?.info;

  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const title = titleDraft ?? saved?.title ?? '';
  const [categoryText, setCategoryText] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [picked, setPicked] = useState<Category | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const categories = useQuery({
    queryKey: tk(channelId, 'categories', categoryQuery),
    queryFn: () => streamApi.searchCategories(channelId, categoryQuery),
    enabled: canEdit && categoryQuery.length > 0,
    retry: twitchRetry,
    staleTime: 60_000,
  });

  const changes = saved ? streamInfoChanges(saved, title, picked) : {};
  const dirty = Object.keys(changes).length > 0;

  const save = useChannelMutation({
    mutationFn: () => streamApi.save(channelId, changes),
    invalidate: [tk(channelId, 'stream-info')],
    successMessage: 'Stream info updated',
    errorMessage: false,
    onSuccess: () => { setTitleDraft(null); setPicked(null); setCategoryText(''); setCategoryQuery(''); setFormError(null); },
    onError: (error) => setFormError(isTwitchApiError(error, 'missing_grant')
      ? 'Reconnect Acosmibot on the Overview page to allow this.'
      : twitchErrorMessage(error)),
  });

  const [shoutoutLogin, setShoutoutLogin] = useState('');
  const [shoutoutResult, setShoutoutResult] = useState<string | null>(null);
  const shoutout = useChannelMutation({
    mutationFn: (login: string) => streamApi.shoutout(channelId, login),
    errorMessage: false,
    onSuccess: (result) => { setShoutoutResult(describeShoutout(result)); showToast('Shoutout sent', 'success'); },
    onError: (error) => setShoutoutResult(isTwitchApiError(error, 'user_not_found')
      ? 'That Twitch user was not found.'
      : isTwitchApiError(error, 'bot_offline') || isTwitchApiError(error, 'redis_unavailable')
        ? 'The Acosmibot chat service is offline right now. Try again once it is back.'
        : twitchErrorMessage(error)),
  });

  const submit = () => {
    const problem = titleProblem(title);
    setFormError(problem);
    if (!problem && dirty) save.mutate();
  };
  const sendShoutout = () => {
    if (!isValidLogin(shoutoutLogin) || shoutout.isPending) return;
    setShoutoutResult(null);
    shoutout.mutate(normalizeLogin(shoutoutLogin));
  };

  const form = settings.form;

  return (
    <SectionPage
      title="Stream tools"
      description="Change the title and category, give another channel a shoutout, and control how Acosmibot answers !so, !clip, !marker and !commercial."
      query={info}
    >
      <div className="tw-st-stack">
        <section className="tw-st-card" aria-labelledby="tw-st-info">
          <h2 id="tw-st-info" className="tw-st-card__title">Title and category</h2>
          <p className="tw-st-card__lead">
            Applies to the live stream and to the channel when it is offline.
            {saved?.category_name ? ` Current category: ${saved.category_name}.` : ''}
          </p>
          {!canEdit && <ReadOnlyNotice required="editor" role={role} what="Changing the title or category" />}
          <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
            <Field label="Stream title" help={`${oneLine(title).length} of ${STREAM_LIMITS.titleMax} characters`}>
              {(control) => (
                <input {...control} className="form-control" type="text" maxLength={STREAM_LIMITS.titleMax + 40} value={title}
                  disabled={!canEdit} onChange={(event) => setTitleDraft(event.target.value)} />
              )}
            </Field>
            {canEdit && (
              <>
                <div className="tw-st-inline">
                  <Field label="Find a category" help="Search Twitch categories, then choose one below.">
                    {(control) => (
                      <input {...control} className="form-control" type="search" maxLength={STREAM_LIMITS.categoryQueryMax} value={categoryText}
                        onChange={(event) => setCategoryText(event.target.value)}
                        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); setCategoryQuery(oneLine(categoryText)); } }} />
                    )}
                  </Field>
                  <button type="button" className="btn" disabled={!oneLine(categoryText)} onClick={() => setCategoryQuery(oneLine(categoryText))}>
                    <Search size={16} aria-hidden="true" /> Search
                  </button>
                </div>
                {categories.isFetching && <p className="tw-muted" role="status">Searching…</p>}
                {categories.isError && <p className="tw-muted" role="alert">{twitchErrorMessage(categories.error, 'The search did not work.')}</p>}
                {categories.data && categories.data.items.length === 0 && <p className="tw-muted">No categories found.</p>}
                {categories.data && categories.data.items.length > 0 && (
                  <ul className="tw-st-results" aria-label="Categories">
                    {categories.data.items.map((category) => (
                      <li key={category.id}>
                        <button type="button" aria-pressed={picked?.id === category.id} onClick={() => setPicked(category)}>
                          {category.box_art_url && (
                            <img alt="" loading="lazy" src={category.box_art_url.replace('{width}', '56').replace('{height}', '76')} />
                          )}
                          <span>{category.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {picked && <p className="tw-muted">New category: <strong>{picked.name}</strong></p>}
              </>
            )}
            {formError && <p className="tw-field__error" role="alert">{formError}</p>}
            <div className="tw-st-card__footer">
              <button type="submit" className="btn primary" disabled={!canEdit || !dirty || save.isPending} aria-busy={save.isPending}>
                <Save size={16} aria-hidden="true" /> {save.isPending ? 'Saving…' : 'Update stream info'}
              </button>
              {dirty && canEdit && (
                <button type="button" className="btn" onClick={() => { setTitleDraft(null); setPicked(null); setFormError(null); }}>Discard changes</button>
              )}
            </div>
          </form>
        </section>

        <section className="tw-st-card" aria-labelledby="tw-st-shoutout">
          <h2 id="tw-st-shoutout" className="tw-st-card__title">Shoutout</h2>
          <p className="tw-st-card__lead">Posts your shoutout message in chat, and sends a Twitch shoutout while you are live.</p>
          <form className="tw-st-inline" onSubmit={(event) => { event.preventDefault(); sendShoutout(); }}>
            <UserLookupInput label="Channel to shout out" value={shoutoutLogin} onChange={setShoutoutLogin} onSubmit={sendShoutout} />
            <button type="submit" className="btn primary" disabled={!isValidLogin(shoutoutLogin) || shoutout.isPending} aria-busy={shoutout.isPending}>
              <Megaphone size={16} aria-hidden="true" /> {shoutout.isPending ? 'Sending…' : 'Send shoutout'}
            </button>
          </form>
          {shoutoutResult && <p className="tw-muted" role="status">{shoutoutResult}</p>}
        </section>

        {form && (
          <section className="tw-st-card" aria-labelledby="tw-st-settings">
            <h2 id="tw-st-settings" className="tw-st-card__title">Chat commands</h2>
            <p className="tw-st-card__lead">
              !title and !game show the current value to everyone; moderators can change them. !clip, !marker and !commercial only work while you are live.
            </p>
            {!settings.canWrite && <ReadOnlyNotice required={settings.writeRole} role={role} />}
            <FeatureToggle
              label="Twitch shoutout with !so" description="Also sends Twitch's own shoutout while live. Twitch limits these to one every two minutes."
              enabled={form.shoutout_native} onChange={(shoutout_native) => settings.canWrite && settings.setForm({ shoutout_native })}
            />
            <TemplateField
              label="Shoutout message" value={form.shoutout_template} maxLength={TEMPLATE_MAX} context="other"
              contextVars={['touser', 'touserlogin', 'togame']} field="stream_tools.shoutout_template"
              issues={settings.issuesFor('stream_tools.shoutout_template')} disabled={!settings.canWrite} rows={2}
              onChange={(shoutout_template) => settings.setForm({ shoutout_template })}
            />
            <TemplateField
              label="Clip reply" value={form.clip_template} maxLength={TEMPLATE_MAX} context="other"
              contextVars={['clipid']} field="stream_tools.clip_template"
              issues={settings.issuesFor('stream_tools.clip_template')} disabled={!settings.canWrite} rows={2}
              onChange={(clip_template) => settings.setForm({ clip_template })}
            />
            <TemplateField
              label="Marker reply" value={form.marker_template} maxLength={TEMPLATE_MAX} context="other"
              field="stream_tools.marker_template"
              issues={settings.issuesFor('stream_tools.marker_template')} disabled={!settings.canWrite} rows={2}
              onChange={(marker_template) => settings.setForm({ marker_template })}
            />
            <Field label="Default !commercial length" help="Used when nobody types a length. Only partners and affiliates can run commercials, and only while live.">
              {(control) => (
                <select {...control} className="form-select" value={form.default_commercial_length_s} disabled={!settings.canWrite}
                  onChange={(event) => settings.setForm({ default_commercial_length_s: Number(event.target.value) })}>
                  {COMMERCIAL_LENGTHS.map((length) => <option key={length} value={length}>{length} seconds</option>)}
                </select>
              )}
            </Field>
          </section>
        )}
      </div>
      <RoleGate min="editor" role={role}>
        <SettingsSaveBar settings={settings} />
      </RoleGate>
    </SectionPage>
  );
};
