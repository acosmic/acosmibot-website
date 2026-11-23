/**
 * One settings section as a form (§10.6 settings endpoints, §11.5).
 *
 *   const settings = useSectionSettings<LoyaltySettings>(channelId, 'loyalty');
 *   <SectionPage title="Loyalty" query={settings.query}>
 *     {settings.form && <FeatureToggle enabled={settings.form.enabled}
 *        onChange={(enabled) => settings.setForm({ enabled })} />}
 *   </SectionPage>
 *   <SettingsSaveBar settings={settings} />
 *
 * Built on `useDirtyState`, so the app-wide navigation guard warns before a
 * dirty form is left. Saves send the `config_version` the draft was based on;
 * a 409 sets `conflict` (the save bar then offers "Reload"), a 400 with
 * `details.templates` or `details.errors` fills `fieldIssues` (keyed by
 * `<section>.<field>` paths), and the draft is never discarded
 * by a failed save.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDirtyState } from '@/hooks/useDirtyState';
import { showToast } from '@/utils/toast';
import type { SettingsSaveResponse, SettingsSectionResponse } from '../types';
import { channelPath, isTwitchApiError, twitchApi, twitchRetry } from './api';
import { settingsKey } from './queryKeys';
import { hasRole } from './roles';
import { useOptionalChannel } from './useChannel';
import { useProtectFromFeedRefetch } from './useChannelFeed';
import { useSectionWriteRole } from './useMeta';

/** `details.templates` of a 400 `validation_failed` (§10.6) → field path → messages. */
export const parseTemplateIssues = (details: unknown): Record<string, string[]> => {
  const templates = (details as { templates?: unknown } | null | undefined)?.templates;
  if (!Array.isArray(templates)) return {};
  const result: Record<string, string[]> = {};
  for (const entry of templates) {
    const field = (entry as { field?: unknown })?.field;
    const issues = (entry as { issues?: unknown })?.issues;
    if (typeof field !== 'string') continue;
    const messages = Array.isArray(issues)
      ? issues.map((issue) => (typeof issue === 'string'
        ? issue
        : typeof (issue as { message?: unknown })?.message === 'string'
          ? (issue as { message: string }).message
          : 'This template has a problem.'))
      : ['This template has a problem.'];
    result[field] = [...(result[field] ?? []), ...messages];
  }
  return result;
};

/**
 * `details.errors` of a 400 `validation_failed` (pydantic, `[{loc, msg}]`) → field
 * path → messages. Settings PUT `loc` starts with `"value"`; it is replaced by the
 * section name so paths match the template paths (`chat_alerts.follow.template`).
 */
export const parseFieldErrors = (details: unknown, section: string): Record<string, string[]> => {
  const errors = (details as { errors?: unknown } | null | undefined)?.errors;
  if (!Array.isArray(errors)) return {};
  const result: Record<string, string[]> = {};
  for (const entry of errors) {
    const loc = (entry as { loc?: unknown })?.loc;
    const msg = (entry as { msg?: unknown })?.msg;
    const parts = Array.isArray(loc) ? loc.map(String) : typeof loc === 'string' ? [loc] : [];
    if (parts[0] === 'value') parts.shift();
    const field = [section, ...parts].join('.');
    result[field] = [...(result[field] ?? []), typeof msg === 'string' && msg ? msg : 'This value is not accepted.'];
  }
  return result;
};

const mergeIssues = (...maps: Array<Record<string, string[]>>): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  for (const map of maps) {
    for (const [field, messages] of Object.entries(map)) result[field] = [...(result[field] ?? []), ...messages];
  }
  return result;
};

export function useSectionSettings<T extends object>(channelId: string, section: string) {
  const queryClient = useQueryClient();
  const channel = useOptionalChannel();
  const writeRole = useSectionWriteRole(section);
  const key = settingsKey(channelId, section);
  const path = channelPath(channelId, `/settings/${encodeURIComponent(section)}`);

  const query = useQuery({
    queryKey: key,
    queryFn: () => twitchApi.get<SettingsSectionResponse<T>>(path),
    enabled: Boolean(channelId && section),
    retry: twitchRetry,
  });

  const { form, setForm, isDirty, resetForm } = useDirtyState<T>(query.data?.value);
  useProtectFromFeedRefetch(key, isDirty);

  // The version the current draft is based on. It only moves while the form
  // is clean, so a background refetch can never hide someone else's save.
  const baseVersion = useRef<number | null>(null);
  if (!isDirty && query.data) baseVersion.current = query.data.config_version;

  const [conflict, setConflict] = useState(false);
  const [fieldIssues, setFieldIssues] = useState<Record<string, string[]>>({});
  const [pendingVersion, setPendingVersion] = useState<number | null>(null);

  // After a save or reload, replace the draft with the server's copy once the
  // cache holds that exact version (the server may normalise values).
  useEffect(() => {
    if (pendingVersion === null || query.data?.config_version !== pendingVersion) return;
    resetForm();
    setPendingVersion(null);
  }, [pendingVersion, query.data, resetForm]);

  const applySaved = (response: SettingsSaveResponse<T>) => {
    queryClient.setQueryData<SettingsSectionResponse<T>>(key, {
      success: true,
      section,
      value: response.value,
      config_version: response.config_version,
    });
    setPendingVersion(response.config_version);
    if (response.live_applied === false) {
      showToast('Saved. Acosmibot will apply this within a minute.', 'info');
    }
  };

  const handleError = (error: unknown) => {
    if (isTwitchApiError(error, 'version_conflict')) setConflict(true);
    if (isTwitchApiError(error, 'validation_failed')) {
      setFieldIssues(mergeIssues(parseTemplateIssues(error.details), parseFieldErrors(error.details, section)));
    }
  };

  const saveMutation = useMutation({
    mutationFn: (value: T) => twitchApi.put<SettingsSaveResponse<T>>(path, { value, config_version: baseVersion.current }),
    onMutate: () => { setConflict(false); setFieldIssues({}); },
    onSuccess: applySaved,
    onError: handleError,
  });

  const resetMutation = useMutation({
    mutationFn: () => twitchApi.post<SettingsSaveResponse<T>>(`${path}/reset`, { config_version: baseVersion.current }),
    onMutate: () => { setConflict(false); setFieldIssues({}); },
    onSuccess: (response) => {
      applySaved(response);
      showToast('Restored the default settings.', 'success');
    },
    onError: (error) => {
      handleError(error);
      if (!isTwitchApiError(error, 'version_conflict')) {
        showToast(error instanceof Error ? error.message : 'Could not restore the defaults.', 'error');
      }
    },
  });

  const save = useCallback(() => {
    if (form && isDirty && !saveMutation.isPending) saveMutation.mutate(form);
  }, [form, isDirty, saveMutation]);

  const discard = useCallback(() => {
    resetForm();
    setConflict(false);
    setFieldIssues({});
    saveMutation.reset();
  }, [resetForm, saveMutation]);

  /** Drop the draft and load the latest saved copy (the answer to a conflict). */
  const reload = useCallback(async () => {
    const result = await query.refetch();
    setConflict(false);
    setFieldIssues({});
    saveMutation.reset();
    if (result.data) setPendingVersion(result.data.config_version);
  }, [query, saveMutation]);

  /** Replace the whole draft from the current one, for nested edits. */
  const updateForm = useCallback((update: (current: T) => T) => {
    if (form) setForm(update(form));
  }, [form, setForm]);

  return {
    query,
    /** Last saved value. */
    value: query.data?.value,
    configVersion: query.data?.config_version ?? null,
    /** Draft (undefined until loaded). */
    form,
    /** Merge top-level fields into the draft. */
    setForm,
    updateForm,
    isDirty,
    save,
    discard,
    reload,
    resetToDefaults: () => resetMutation.mutate(),
    saving: saveMutation.isPending,
    resetting: resetMutation.isPending,
    error: conflict ? null : (saveMutation.error as Error | null),
    conflict,
    fieldIssues,
    /** Messages for one template field, by its full path (`chat_alerts.follow.template`). */
    issuesFor: (fieldPath: string): string[] => fieldIssues[fieldPath] ?? [],
    writeRole,
    /** Presentation only; the API enforces `SECTION_WRITE_ROLE`. */
    canWrite: channel ? hasRole(channel.role, writeRole) : false,
  };
}

export type SectionSettings<T extends object> = ReturnType<typeof useSectionSettings<T>>;
