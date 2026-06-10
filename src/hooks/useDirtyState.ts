import { useState, useEffect, useCallback, useMemo } from 'react';

export function useDirtyState<T>(initialState: T | undefined) {
  const [form, setFormState] = useState<T | undefined>(initialState);

  useEffect(() => {
    setFormState(initialState);
  }, [initialState]);

  const setForm = useCallback((updates: Partial<T>) => {
    setFormState(prev => prev ? { ...prev, ...updates } : prev);
  }, []);

  const isDirty = useMemo(() => {
    if (!initialState || !form) return false;
    return JSON.stringify(initialState) !== JSON.stringify(form);
  }, [initialState, form]);

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
