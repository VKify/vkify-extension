import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export interface Toast {
  message: string;
  type: string;
  id: number;
}

interface ToastContextValue {
  toast: Toast | null;
  showToast: (message: string, type?: string) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 2500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type = 'success'): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    setToast({ message, type, id: Date.now() });

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setToast(null);
    }, TOAST_DURATION_MS);
  }, []);

  const hideToast = useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ toast, showToast, hideToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}