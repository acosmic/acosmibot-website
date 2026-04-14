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

  const resetForm = useCallback(() => {
    setFormState(initialState);
  }, [initialState]);

  return { form, setForm, isDirty, resetForm };
}
