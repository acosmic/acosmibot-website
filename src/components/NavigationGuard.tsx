import React, { useCallback, useEffect } from 'react';
import { useBlocker, type BlockerFunction } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useUnsavedChangesStore } from '@/store/unsavedChanges';

/**
 * One app-wide guard for unsaved form edits. While any form registered through
 * `useDirtyState` / `useUnsavedChanges` is dirty, in-app navigation to another
 * page (sidebar, server switcher, links, browser back) asks for confirmation,
 * and closing or reloading the tab triggers the browser's own warning.
 */
export const NavigationGuard: React.FC = () => {
  const anyDirty = useUnsavedChangesStore((state) => Object.keys(state.sources).length > 0);

  const shouldBlock = useCallback<BlockerFunction>(({ currentLocation, nextLocation }) => {
    const state = useUnsavedChangesStore.getState();
    if (Date.now() < state.bypassUntil) return false;
    if (Object.keys(state.sources).length === 0) return false;
    return currentLocation.pathname !== nextLocation.pathname;
  }, []);

  const blocker = useBlocker(shouldBlock);

  // If the form became clean while the prompt was open, let navigation go.
  useEffect(() => {
    if (blocker.state === 'blocked' && !anyDirty) blocker.proceed();
  }, [blocker, anyDirty]);

  useEffect(() => {
    if (!anyDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [anyDirty]);

  if (blocker.state !== 'blocked') return null;

  return (
    <ConfirmDialog
      kicker="Unsaved changes"
      title="Leave without saving?"
      confirmLabel="Leave without saving"
      onConfirm={() => blocker.proceed()}
      onClose={() => blocker.reset()}
    >
      <p>You have changes on this page that haven't been saved. If you leave now, they'll be lost.</p>
    </ConfirmDialog>
  );
};
