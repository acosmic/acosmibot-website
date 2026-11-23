/**
 * Twitch dashboard building blocks (TWITCH_BOT_SPEC.md §11.5).
 *
 * Feature slices build their pages from these exports plus the existing
 * `@/components/ui` primitives (FeatureToggle, SaveBar, NumberInput,
 * ConfirmDialog, LoadFailed, LoadingSpinner, CollapsibleSection), which are
 * reused, never copied. Import everything from
 * `@/features/twitch/shared/ui`.
 *
 * ── Page frame and states ────────────────────────────────────────────────
 * SectionPage      Page header + exactly one of loading / failed (LoadFailed
 *                  with Retry, or the role panel on 403) / content.
 *                  {title, description?, actions?, query?: QueryState,
 *                   failedTitle?, children}
 * combineQueries   One QueryState for several queries: combineQueries(a, b).
 * EmptyState       A real empty state (never a failed load).
 *                  {title, description, action?, icon?}
 * ReadOnlyNotice   "You can view … Changing needs the X role".
 *                  {required: Role, role, what?}
 * RoleGate         Render children only for role >= min (presentation only).
 *                  {min: Role, role, children, fallback?}
 * RoleRequired     Full "You need the X role" panel (also used by the shell).
 *                  {required: Role, current?, sectionLabel?}
 * StatusChip       Uppercase literal-status chip.
 *                  {tone: 'active'|'neutral'|'warning'|'error', children, icon?, title?}
 *
 * ── Lists ────────────────────────────────────────────────────────────────
 * RecordTable<T>   Semantic table; labelled card rows at <= 768px.
 *                  {rows, columns: Column<T>[], rowKey, caption, empty,
 *                   onRowClick?, rowLabel?, rowActions?, activeKey?, toolbar?,
 *                   footer?, selection?: {selected, onChange, label}}
 *                  Column<T> = {key, header, render(row), primary?, align?,
 *                   width?, hideOnMobile?, hideHeader?}
 * EditorDrawer     Side drawer form for one record: modal, focus trapped and
 *                  restored, Escape/backdrop close (asks first when dirty),
 *                  registered with the navigation guard, 44px buttons.
 *                  {open, title, description?, onClose, onSubmit, submitting,
 *                   error?, dirty, submitLabel?, submitDisabled?,
 *                   secondaryAction?, children}
 * Tabs / TabPanel  ARIA tab list with arrow keys.
 *                  Tabs {tabs: {id,label,count?}[], active, onChange, label, idPrefix}
 *                  TabPanel {idPrefix, id, active, children}
 *
 * ── Fields ───────────────────────────────────────────────────────────────
 * Field            Label + control + help + error with ids wired.
 *                  {label, help?, error?, optional?, id?, hideLabel?,
 *                   children: node | (control) => node}
 * Switch           role="switch" checkbox with a 44px target (per-row toggles).
 *                  {checked, onChange, label, description?, disabled?, hideLabel?, id?}
 * TemplateField    Response template textarea with character count and
 *                  VariablePicker inserting $(name) at the cursor.
 *                  {label, value, onChange, maxLength, context:
 *                   'command'|'timer'|'alert'|'other', contextVars?, field?,
 *                   issues?, help?, placeholder?, rows?, disabled?, required?, id?}
 * VariablePicker   Popover of meta.variables for a context (+ contextVars and
 *                  meta.context_variables[field]). {context, contextVars?, field?, onInsert, disabled?}
 * LevelSelect      Chat user level select from meta.levels.
 *                  {value, onChange, min?, label?, hideLabel?, help?, disabled?, id?}
 * DurationInput    Number + unit, reported in seconds, range-checked.
 *                  {seconds, onChange, min, max, units?: ('s'|'m'|'h')[], label, help?, disabled?, id?}
 * UserLookupInput  Twitch login field (normalises @Name, validates ^[a-z0-9_]{1,25}$).
 *                  {value, onChange, label?, help?, placeholder?, disabled?, required?, id?, onSubmit?}
 *                  normalizeLogin(value), isValidLogin(value)
 *
 * ── Dialogs and saving ───────────────────────────────────────────────────
 * ConfirmTypeDialog  ConfirmDialog that requires typing a word (login, RESET).
 *                  {kicker, title, word, confirmLabel, pending?, onConfirm,
 *                   onClose, children, caseSensitive?}
 * SettingsSaveBar  SaveBar wired to useSectionSettings, with the 409
 *                  "Changed elsewhere — reload" state. {settings, validationMessage?}
 * SavedTick        Short "Saved" status next to a per-row action. {show, label?}
 * useChannelMutation  useMutation + error toast + query invalidation.
 *                  {mutationFn, invalidate?, successMessage?, errorMessage?, onSuccess?, onError?}
 *
 * ── Data hooks (re-exported from ../) ────────────────────────────────────
 * useChannel()               {channelId, channel: ChannelSummary, role, refetch}
 * useSectionSettings<T>(channelId, section)
 *                            {query, value, form, setForm, updateForm, isDirty,
 *                             save, discard, reload, resetToDefaults, saving,
 *                             resetting, error, conflict, fieldIssues,
 *                             issuesFor(path), writeRole, canWrite}
 * useMeta() / useLevels() / useLevelLabel()   GET /api/twitch-bot/meta (10 min)
 * useFeedEvents(types, handler)  Live feed via the shell's single poller;
 *                            types match exactly or by prefix ('activity.').
 * twitchApi.{fetch,get,post,put,patch,del}, channelPath(channelId, rest),
 * twitchErrorMessage(error), twitchRetry, TwitchApiError, tk(channelId, ...parts)
 *
 * ── Identity and formatting ──────────────────────────────────────────────
 * ChannelAvatar {src, name, size?}; TwitchMark {size?};
 * TwitchSignInButton {onClick, label?}; channelStatusView(status),
 * channelHealthView(summary), liveView(summary); describeActivityRow(row),
 * describeActivityEvent(event); formatDuration, describeDuration,
 * formatDateTime, formatRelative, formatNumber.
 *
 * ── Example: list page with table and editor drawer ──────────────────────
 *
 *   export function QuotesPage({ channelId, role }: SectionProps) {
 *     const list = useQuery({
 *       queryKey: tk(channelId, 'quotes'),
 *       queryFn: () => twitchApi.get<OffsetPage<Quote>>(channelPath(channelId, '/quotes')),
 *       retry: twitchRetry,
 *     });
 *     const [editing, setEditing] = useState<Quote | 'new' | null>(null);
 *     const [draft, setDraft] = useState(EMPTY);
 *     const save = useChannelMutation({
 *       mutationFn: (input: QuoteInput) => editing === 'new'
 *         ? twitchApi.post(channelPath(channelId, '/quotes'), input)
 *         : twitchApi.put(channelPath(channelId, `/quotes/${(editing as Quote).number}`), input),
 *       invalidate: [tk(channelId, 'quotes')],
 *       successMessage: 'Quote saved',
 *       errorMessage: false,                        // shown inside the drawer instead
 *       onSuccess: () => setEditing(null),
 *     });
 *     return (
 *       <SectionPage title="Quotes" query={list}
 *         actions={<button className="btn primary" onClick={() => setEditing('new')}>Add quote</button>}>
 *         <RecordTable rows={list.data?.items ?? []} rowKey={(q) => q.number} caption="Quotes"
 *           columns={[{ key: 'n', header: '#', render: (q) => q.number, width: '72px' },
 *                     { key: 'text', header: 'Quote', render: (q) => q.text, primary: true }]}
 *           onRowClick={(q) => { setDraft(toDraft(q)); setEditing(q); }}
 *           rowLabel={(q) => `Edit quote ${q.number}`}
 *           empty={<EmptyState title="No quotes yet" description="Add one here or with !quote add in chat." />} />
 *         <EditorDrawer open={editing !== null} title={editing === 'new' ? 'New quote' : 'Edit quote'}
 *           onClose={() => setEditing(null)} onSubmit={() => save.mutate(fromDraft(draft))}
 *           submitting={save.isPending} error={save.error ? twitchErrorMessage(save.error) : null}
 *           dirty={isDraftDirty}>
 *           <Field label="Quote">{(c) => <textarea className="form-control" {...c} value={draft.text}
 *             onChange={(e) => setDraft({ ...draft, text: e.target.value })} />}</Field>
 *         </EditorDrawer>
 *       </SectionPage>
 *     );
 *   }
 *
 * ── Example: settings page ───────────────────────────────────────────────
 *
 *   export function LoyaltySettingsPage({ channelId, role }: SectionProps) {
 *     const settings = useSectionSettings<LoyaltySettings>(channelId, 'loyalty');
 *     const form = settings.form;
 *     return (
 *       <SectionPage title="Loyalty" query={settings.query}>
 *         {!settings.canWrite && <ReadOnlyNotice required={settings.writeRole} role={role} />}
 *         {form && (
 *           <>
 *             <FeatureToggle label="Loyalty points" enabled={form.enabled}
 *               onChange={(enabled) => settings.setForm({ enabled })} />
 *             <DurationInput label="Award every" seconds={form.interval_s} min={60} max={3600}
 *               onChange={(interval_s) => settings.setForm({ interval_s })} disabled={!settings.canWrite} />
 *           </>
 *         )}
 *         <SettingsSaveBar settings={settings} />
 *       </SectionPage>
 *     );
 *   }
 */
export { SectionPage, type SectionPageProps } from './SectionPage';
export { combineQueries, type QueryState } from './queries';
export { RecordTable, type Column, type RecordTableProps, type RowKey } from './RecordTable';
export { EditorDrawer, type EditorDrawerProps } from './EditorDrawer';
export { Tabs, TabPanel, type TabItem, type TabsProps } from './Tabs';
export { TemplateField, type TemplateFieldProps } from './TemplateField';
export { VariablePicker, type VariablePickerProps, type TemplateContext } from './VariablePicker';
export {
  LevelSelect,
  DurationInput,
  UserLookupInput,
  normalizeLogin,
  isValidLogin,
  LOGIN_PATTERN,
  pickDurationUnit,
  type LevelSelectProps,
  type DurationInputProps,
  type UserLookupInputProps,
} from './inputs';
export {
  StatusChip,
  EmptyState,
  RoleGate,
  ReadOnlyNotice,
  ChannelAvatar,
  TwitchMark,
  TwitchSignInButton,
  Field,
  Switch,
  type StatusChipProps,
  type EmptyStateProps,
  type RoleGateProps,
  type FieldProps,
  type FieldControlProps,
  type SwitchProps,
} from './basics';
export { ConfirmTypeDialog, SettingsSaveBar, SavedTick, type ConfirmTypeDialogProps } from './dialogs';
export { useChannelMutation, type ChannelMutationOptions } from './useChannelMutation';
export {
  REAUTH_GRACE_DAYS, channelStatusView, channelHealthView, liveView, reauthDetail, reauthReasonText, type StatusTone, type StatusView,
} from './channelStatus';
export { describeActivityRow, describeActivityEvent, type ActivityRow, type ActivityLine } from './activity';
export { formatDuration, describeDuration, formatDateTime, formatRelative, formatNumber } from './format';
export { RoleRequired } from '../../shell/RoleRequired';

// Data hooks and client, so slices need one import path.
export { useChannel, useOptionalChannel, type ChannelContextValue } from '../useChannel';
export { useSectionSettings, parseTemplateIssues, parseFieldErrors, type SectionSettings } from '../useSectionSettings';
export { useMeta, useLevels, useLevelLabel, useSectionWriteRole, levelLabel, FALLBACK_LEVELS } from '../useMeta';
export { useFeedEvents, matchesFeedType } from '../useChannelFeed';
export {
  twitchApi,
  channelPath,
  TwitchApiError,
  isTwitchApiError,
  twitchErrorMessage,
  twitchRetry,
} from '../api';
export { tk, settingsKey, summaryKey, publicKey, TWITCH_META_KEY, TWITCH_CHANNELS_KEY } from '../queryKeys';
export { hasRole, roleRank, roleLabel, ROLE_LABELS } from '../roles';
