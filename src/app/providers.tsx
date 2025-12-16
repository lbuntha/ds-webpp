import React, { ReactNode } from 'react';
import { AuthProvider } from '../shared/contexts/AuthContext';
import { DataProvider } from '../shared/contexts/DataContext';
import { LanguageProvider } from '../shared/contexts/LanguageContext';
import { PermissionsProvider } from '../../contexts/PermissionsContext';
import { useAuth } from '../shared/contexts/AuthContext';
import { ToastProvider } from '../shared/hooks/useToast';
import { ToastContainer } from '../shared/components/ToastContainer';

/**
 * Centralized providers wrapper for the application
 * Wraps all context providers in the correct order
 */
export function AppProviders({ children }: { children: ReactNode }) {
    // Re-triggering HMR
    return (
        <ToastProvider>
            <LanguageProvider>
                <AuthProvider>
                    <PermissionsProvider>
                        <DataProviderWrapper>
                            {children}
                            <ToastContainer />
                        </DataProviderWrapper>
                    </PermissionsProvider>
                </AuthProvider>
            </LanguageProvider>
        </ToastProvider>
    );
}

/**
 * Wrapper to pass user role to DataProvider
 * Must be inside AuthProvider to access user
 */
function DataProviderWrapper({ children }: { children: ReactNode }) {
    const { user } = useAuth();

    return (
        <DataProvider userRole={user?.role}>
            {children}
        </DataProvider>
    );
}
