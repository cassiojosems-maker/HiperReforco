import { useState, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

type Listener = (toasts: ToastOptions[]) => void;
let toasts: ToastOptions[] = [];
let listeners: Listener[] = [];

const emit = () => {
  for (const listener of listeners) {
    listener(toasts);
  }
};

export const showToast = (message: string, type: ToastType, duration = 4000) => {
  const id = Math.random().toString(36).substring(2, 9);
  toasts = [...toasts, { id, message, type, duration }];
  emit();

  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, duration);
};

export const removeToast = (id: string) => {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
};

export function useToast() {
  const [currentToasts, setCurrentToasts] = useState<ToastOptions[]>(toasts);

  useEffect(() => {
    const listener = (newToasts: ToastOptions[]) => setCurrentToasts(newToasts);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return { toasts: currentToasts, showToast, removeToast };
}
