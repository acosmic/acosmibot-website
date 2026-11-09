import { useEffect, useState } from 'react';
import { useUnsavedChanges } from '@/store/unsavedChanges';

/**
 * Unsaved-change tracking for forms built from many separate `useState`
 * fields (the embed and reaction role builders). Pass a serialisable snapshot
 * of the editable values and `ready` once any existing record has been loaded
 * into the form. The first ready snapshot becomes the clean baseline.
 *
 * Registers with the app-wide NavigationGuard, so leaving the page or closing
 * the tab with unsaved edits asks for confirmation.
 */
export function useSnapshotDirty(snapshot: string, ready: boolean): boolean {
  const [baseline, setBaseline] = useState<string | null>(null);

  useEffect(() => {
    if (ready && baseline === null) setBaseline(snapshot);
  }, [ready, baseline, snapshot]);

  const isDirty = baseline !== null && snapshot !== baseline;
  useUnsavedChanges(isDirty);
  return isDirty;
}
