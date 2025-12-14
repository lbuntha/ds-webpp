import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastContextValue {
    toasts: Toast[];
    addToast: (message: string, type?: ToastType, duration?: number) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts((prev) => [...prev, { id, message, type, duration }]);

        if (duration > 0) {
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value= {{ toasts, addToast, removeToast }
}>
    { children }
    </ToastContext.Provider>
  );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}

// Convenience object for easy usage
export const toast = {
    success: (message: string, duration?: number) => {
        if (typeof window !== 'undefined' && (window as any).__toast) {
            (window as any).__toast.addToast(message, 'success', duration);
        }
    },
    error: (message: string, duration?: number) => {
        if (typeof window !== 'undefined' && (window as any).__toast) {
            (window as any).__toast.addToast(message, 'error', duration);
        }
    },
    warning: (message: string, duration?: number) => {
        if (typeof window !== 'undefined' && (window as any).__toast) {
            (window as any).__toast.addToast(message, 'warning', duration);
        }
    },
    info: (message: string, duration?: number) => {
        if (typeof window !== 'undefined' && (window as any).__toast) {
            (window as any).__toast.addToast(message, 'info', duration);
        }
    },
};
