/**
 * useToast — app-wide toast notification system.
 *
 * Usage:
 *   const { showToast } = useToast();
 *   showToast({ message: 'Saved!', type: 'success' });
 *   showToast({ message: 'No connection', type: 'error', duration: 5000 });
 */
import { createContext, useContext } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  /** Auto-dismiss delay in ms. Default: 3500. */
  duration?: number;
}

export interface ToastContextValue {
  showToast(options: ToastOptions): void;
}

export const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
