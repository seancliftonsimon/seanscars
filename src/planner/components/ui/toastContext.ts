import { createContext, useContext } from 'react';

export interface ToastInput {
  message: string;
  /** Shows an Undo button (and Ctrl/Cmd+Z) that calls this. */
  undo?: () => unknown;
  tone?: 'neutral' | 'danger';
}

export const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

export function useToast(): (t: ToastInput) => void {
  const fn = useContext(ToastContext);
  return fn ?? (() => undefined);
}
