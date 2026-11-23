/**
 * Quotes (§11.4, §12.8): a searchable list of the channel's quotes with an editor,
 * plus the quote settings (on/off, the chat format, the public page). Quotes are
 * numbered per channel; `!quote`, `!addquote`, `!editquote` and `!delquote` work in chat.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Plus, Search } from 'lucide-react';
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
  TabPanel,
  Tabs,
  TemplateField,
  formatDateTime,
  isTwitchApiError,
  tk,
  twitchErrorMessage,
  twitchRetry,
  useChannelMutation,
  useSectionSettings,
  type Column,
} from '../shared/ui';
import { quotesApi } from './api';
import {
  EMPTY_QUOTE_DRAFT,
  QUOTE_LIMITS,
  TEMPLATE_MAX,
  describePage,
  draftFromQuote,
  quoteInputFromDraft,
  quoteProblem,
  quoteQuery,
  type Quote,
  type QuoteDraft,
  type QuotesSettings,
} from './model';
import './stream-tools.css';

type Editing = { kind: 'new' } | { kind: 'edit'; quote: Quote } | null;
const sameDraft = (a: QuoteDraft, b: QuoteDraft) => a.text === b.text && a.quoted_name === b.quoted_name && a.category_name === b.category_name;

export const QuotesPage: React.FC<SectionProps> = ({ channelId, channel, role }) => {
  const settings = useSectionSettings<QuotesSettings>(channelId, 'quotes');
  const [tab, setTab] = useState<'quotes' | 'settings'>('quotes');
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState<QuoteDraft>(EMPTY_QUOTE_DRAFT);
  const [base, setBase] = useState<QuoteDraft>(EMPTY_QUOTE_DRAFT);
  const [clientError, setClientError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Quote | null>(null);

  const query = quoteQuery(search, page);
  const list = useQuery({
    queryKey: tk(channelId, 'quotes', search, page),
    queryFn: () => quotesApi.list(channelId, query),
    retry: twitchRetry,
    placeholderData: (previous) => previous,
  });
  const quotes = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const limit = list.data?.limit ?? 5000;
  const lastPage = Math.max(0, Math.ceil(total / QUOTE_LIMITS.pageSize) - 1);

  const open = (quote: Quote | null) => {
    const next = quote ? draftFromQuote(quote) : EMPTY_QUOTE_DRAFT;
    setDraft(next);
    setBase(next);
    setClientError(null);
    save.reset();
    setEditing(quote ? { kind: 'edit', quote } : { kind: 'new' });
  };

  const save = useChannelMutation({
    mutationFn: (value: QuoteDraft) => {
      const input = quoteInputFromDraft(value);
      return editing?.kind === 'edit' ? quotesApi.update(channelId, editing.quote.number, input) : quotesApi.create(channelId, input);
    },
    invalidate: [tk(channelId, 'quotes')],
    successMessage: 'Quote saved',
    errorMessage: false,
    onSuccess: () => setEditing(null),
  });
  const remove = useChannelMutation({
    mutationFn: (quote: Quote) => quotesApi.remove(channelId, quote.number),
    invalidate: [tk(channelId, 'quotes')],
    successMessage: (_data, quote) => `Quote #${quote.number} deleted`,
    errorMessage: 'Could not delete the quote.',
    onSuccess: () => { setConfirmDelete(null); setEditing(null); },
    onError: () => setConfirmDelete(null),
  });

  const submit = () => {
    const problem = quoteProblem(draft);
    setClientError(problem);
    if (!problem) save.mutate(draft);
  };

  const serverError = save.error
    ? (isTwitchApiError(save.error, 'limit_reached') ? 'This channel has reached its quote limit.' : twitchErrorMessage(save.error))
    : null;

  const columns: Column<Quote>[] = [
    { key: 'number', header: '#', width: '72px', render: (quote) => quote.number },
    { key: 'text', header: 'Quote', primary: true, render: (quote) => <span className="tw-st-text" title={quote.text}>{quote.text}</span> },
    { key: 'quoted', header: 'Said by', hideOnMobile: true, render: (quote) => quote.quoted_name ?? channel.display_name },
    { key: 'category', header: 'Category', hideOnMobile: true, render: (quote) => quote.category_name ?? 'Unknown' },
    { key: 'added', header: 'Added', hideOnMobile: true, render: (quote) => (quote.created_at ? formatDateTime(quote.created_at) : '') },
  ];

  const publicOn = Boolean(settings.value?.enabled && settings.value?.public_page);

  return (
    <SectionPage
      title="Quotes"
      description="Memorable things said on stream. Viewers use !quote in chat; moderators add and change quotes with !addquote, !editquote and !delquote."
      query={list}
      actions={(
        <button type="button" className="btn primary" onClick={() => open(null)} disabled={total >= limit}>
          <Plus size={16} aria-hidden="true" /> Add quote
        </button>
      )}
    >
      <div className="tw-st-stack">
        <Tabs
          label="Quotes sections" idPrefix="tw-quotes"
          tabs={[{ id: 'quotes', label: 'Quotes', count: total }, { id: 'settings', label: 'Settings' }]}
          active={tab} onChange={(id) => setTab(id as 'quotes' | 'settings')}
        />
        <TabPanel idPrefix="tw-quotes" id="quotes" active={tab}>
          <RecordTable
            rows={quotes} columns={columns} rowKey={(quote) => quote.number} caption="Quotes"
            onRowClick={open} rowLabel={(quote) => `Edit quote ${quote.number}`}
            activeKey={editing?.kind === 'edit' ? editing.quote.number : null}
            toolbar={(
              <form
                className="tw-st-inline"
                role="search"
                onSubmit={(event) => { event.preventDefault(); setSearch(searchText.trim()); setPage(0); }}
              >
                <Field label="Search quotes" hideLabel>
                  {(control) => (
                    <input {...control} className="form-control" type="search" placeholder="Search the quote text" maxLength={QUOTE_LIMITS.searchMax}
                      value={searchText} onChange={(event) => setSearchText(event.target.value)} />
                  )}
                </Field>
                <button type="submit" className="btn"><Search size={16} aria-hidden="true" /> Search</button>
                {search && (
                  <button type="button" className="btn" onClick={() => { setSearchText(''); setSearch(''); setPage(0); }}>Clear search</button>
                )}
              </form>
            )}
            footer={total > QUOTE_LIMITS.pageSize ? (
              <div className="tw-st-pager">
                <span className="tw-muted">{describePage(page, QUOTE_LIMITS.pageSize, quotes.length, total)}</span>
                <span className="tw-st-row-actions">
                  <button type="button" className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                  <button type="button" className="btn" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>Next</button>
                </span>
              </div>
            ) : undefined}
            empty={search ? (
              <EmptyState title="No quotes match" description="Try fewer or different words." />
            ) : (
              <EmptyState
                title="No quotes yet"
                description="Add a quote here, or have a moderator type !addquote in chat."
                action={<button type="button" className="btn primary" onClick={() => open(null)}>Add quote</button>}
              />
            )}
          />
        </TabPanel>
        <TabPanel idPrefix="tw-quotes" id="settings" active={tab}>
          {settings.form && (
            <section className="tw-st-card" aria-labelledby="tw-quote-settings">
              <h2 id="tw-quote-settings" className="tw-st-card__title">Quote settings</h2>
              {!settings.canWrite && <ReadOnlyNotice required={settings.writeRole} role={role} />}
              <FeatureToggle
                label="Quotes" description="Turns the quote commands and the $(quote) variable on or off in chat."
                enabled={settings.form.enabled}
                onChange={(enabled) => settings.canWrite && settings.setForm({ enabled })}
              />
              <FeatureToggle
                label="Public quotes page" description="Shows every quote on a page anyone can open."
                enabled={settings.form.public_page}
                onChange={(public_page) => settings.canWrite && settings.setForm({ public_page })}
              />
              <TemplateField
                label="How a quote appears in chat" value={settings.form.template} maxLength={TEMPLATE_MAX} context="other"
                contextVars={['number', 'text', 'quoted', 'category', 'date']} field="quotes.template"
                issues={settings.issuesFor('quotes.template')} disabled={!settings.canWrite} rows={2}
                help="The date uses the channel time zone from the channel settings."
                onChange={(template) => settings.setForm({ template })}
              />
              {publicOn && (
                <p className="tw-muted">
                  <a href={`/t/${encodeURIComponent(channel.login)}/quotes`} target="_blank" rel="noopener noreferrer">
                    Open the public page <ExternalLink size={14} aria-hidden="true" /><span className="visually-hidden"> (opens in a new tab)</span>
                  </a>
                </p>
              )}
            </section>
          )}
          <SettingsSaveBar settings={settings} />
        </TabPanel>
      </div>

      <EditorDrawer
        open={editing !== null}
        title={editing?.kind === 'edit' ? `Edit quote #${editing.quote.number}` : 'Add quote'}
        description="Quotes are plain text. They are shown in chat exactly as written."
        onClose={() => setEditing(null)}
        onSubmit={submit}
        submitting={save.isPending}
        error={clientError ?? serverError}
        dirty={!sameDraft(draft, base)}
        submitLabel={editing?.kind === 'edit' ? 'Save quote' : 'Add quote'}
        secondaryAction={editing?.kind === 'edit' ? (
          <button type="button" className="btn" onClick={() => setConfirmDelete(editing.quote)}>Delete</button>
        ) : undefined}
      >
        <Field label="Quote" help={`${draft.text.length} of ${QUOTE_LIMITS.textMax} characters`}>
          {(control) => (
            <textarea {...control} className="form-control" rows={4} maxLength={QUOTE_LIMITS.textMax} value={draft.text}
              onChange={(event) => setDraft({ ...draft, text: event.target.value })} />
          )}
        </Field>
        <Field label="Said by" optional help="Leave empty to credit the streamer.">
          {(control) => (
            <input {...control} className="form-control" type="text" maxLength={QUOTE_LIMITS.nameMax} value={draft.quoted_name}
              onChange={(event) => setDraft({ ...draft, quoted_name: event.target.value })} />
          )}
        </Field>
        <Field label="Category" optional help="The game or category being played.">
          {(control) => (
            <input {...control} className="form-control" type="text" maxLength={QUOTE_LIMITS.categoryMax} value={draft.category_name}
              onChange={(event) => setDraft({ ...draft, category_name: event.target.value })} />
          )}
        </Field>
      </EditorDrawer>

      {confirmDelete && (
        <ConfirmDialog
          kicker="Delete quote" title={`Delete quote #${confirmDelete.number}?`} confirmLabel="Delete quote"
          pending={remove.isPending}
          onConfirm={() => remove.mutate(confirmDelete)} onClose={() => setConfirmDelete(null)}
        >
          <p>The quote is removed for good. Other quotes keep their numbers.</p>
        </ConfirmDialog>
      )}
    </SectionPage>
  );
};
