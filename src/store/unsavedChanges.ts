import { useEffect, useId } from 'react';
import { create } from 'zustand';

/**
 * Registry of forms that currently hold unsaved edits. `NavigationGuard`
 * reads it to block in-app navigation (sidebar, server switch, links, back)
 * and closing the tab while any registered form is dirty.
 */
interface UnsavedChangesState {
  sources: Record<string, true>;
  /** Navigation is allowed without a prompt until this time (ms epoch). */
  bypassUntil: number;
  setDirty: (id: string, dirty: boolean) => void;
}

export const useUnsavedChangesStore = create<UnsavedChangesState>((set) => ({
  sources: {},
  bypassUntil: 0,
  setDirty: (id, dirty) => set((state) => {
    if (dirty === Boolean(state.sources[id])) return state;
    const sources = { ...state.sources };
    if (dirty) sources[id] = true;
    else delete sources[id];
    return { sources };
  }),
}));

export const hasUnsavedChanges = (): boolean =>
  Object.keys(useUnsavedChangesStore.getState().sources).length > 0;

/**
 * Let the next programmatic navigation through without a prompt. Call it right
 * before navigating away after a successful save, when the form's own dirty
 * flag has not re-rendered yet.
 */
export const allowNextNavigation = (): void => {
  useUnsavedChangesStore.setState({ bypassUntil: Date.now() + 1500 });
};

/** Register a component's unsaved state with the navigation guard. */
export function useUnsavedChanges(isDirty: boolean): void {
  const id = useId();
  const setDirty = useUnsavedChangesStore((state) => state.setDirty);

  useEffect(() => {
    setDirty(id, isDirty);
  }, [id, isDirty, setDirty]);

  useEffect(() => () => setDirty(id, false), [id, setDirty]);
}
