import { useCallback } from 'react';
import type { DocumentData, DocumentReference } from 'firebase/firestore';
import { updateRecord, type RecordInput } from '../firestore';
import { errorMessage } from '../errors';
import { useToast } from '../components/ui/toastContext';

/**
 * Writes a patch and offers Undo. Firestore shows local writes at once
 * (latency compensation), so the change is optimistic; Undo writes the
 * previous values back (a field that was absent is deleted again).
 */
export function useUndoableUpdate() {
  const toast = useToast();
  return useCallback(
    async <M extends object>(
      ref: DocumentReference<M, DocumentData>,
      current: Partial<M>,
      patch: Partial<RecordInput<M>>,
      message: string,
    ) => {
      const before: Record<string, unknown> = {};
      for (const key of Object.keys(patch)) before[key] = (current as Record<string, unknown>)[key];
      try {
        await updateRecord(ref, patch);
        toast({ message, undo: () => updateRecord(ref, before as Partial<RecordInput<M>>) });
      } catch (err) {
        toast({ message: `Couldn’t save: ${errorMessage(err)}`, tone: 'danger' });
      }
    },
    [toast],
  );
}

/** Runs a write and reports failure as a toast. */
export function useSafeWrite() {
  const toast = useToast();
  return useCallback(
    async (action: () => Promise<unknown>, success?: string, undo?: () => unknown) => {
      try {
        await action();
        if (success) toast({ message: success, undo });
        return true;
      } catch (err) {
        toast({ message: `Couldn’t save: ${errorMessage(err)}`, tone: 'danger' });
        return false;
      }
    },
    [toast],
  );
}
