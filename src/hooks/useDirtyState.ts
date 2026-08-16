import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

export function useDirtyState<T>(initialState: T | undefined) {
  const [form, setFormState] = useState<T | undefined>(initialState);

  const isDirty = useMemo(() => {
    if (!initialState || !form) return false;
    return JSON.stringify(initialState) !== JSON.stringify(form);
  }, [initialState, form]);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    // Queries may revalidate when the browser regains focus or after another
    // cache event. Hydrate clean forms with that fresh data, but never replace
    // a local draft the user has not saved yet.
    setFormState((current) => isDirtyRef.current ? current : initialState);
  }, [initialState]);

  const setForm = useCallback((updates: Partial<T>) => {
    setFormState(prev => prev ? { ...prev, ...updates } : prev);
  }, []);

  // Warn before the tab is closed/reloaded while there are unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const resetForm = useCallback(() => {
    setFormState(initialState);
  }, [initialState]);

  return { form, setForm, isDirty, resetForm };
}
