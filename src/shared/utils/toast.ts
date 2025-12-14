// Toast utility to replace browser alerts
// Import this in files where you need to show toast notifications

import { toast as toastFn } from '../hooks/useToast';

// Re-exporting toast function
export const toast = toastFn;

// Helper to show success messages
export function showSuccess(message: string) {
    toast.success(message);
}

// Helper to show error messages
export function showError(message: string) {
    toast.error(message);
}

// Helper to show warning messages
export function showWarning(message: string) {
    toast.warning(message);
}

// Helper to show info messages
export function showInfo(message: string) {
    toast.info(message);
}
