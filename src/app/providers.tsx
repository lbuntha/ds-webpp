import React, { ReactNode } from 'react';
import { AuthProvider } from '../shared/contexts/AuthContext';
import { DataProvider } from '../shared/contexts/DataContext';
import { LanguageProvider } from '../shared/contexts/LanguageContext';
import { PermissionsProvider } from '../shared/contexts/PermissionsContext';
import { useAuth } from '../shared/contexts/AuthContext';
import { ToastProvider } from '../shared/hooks/useToast';
import { ToastContainer } from '../shared/components/ToastContainer';

/**
 * Centralized providers wrapper for the application
 * Wraps all context providers in the correct order
 */
export function AppProviders({ children }: { children: ReactNode }) {
    return (
        <ToastProvider>
            <LanguageProvider>
                <AuthProvider>
                    <AuthLoadingGate>
                        <PermissionsProvider>
                            <DataProviderWrapper>
                                {children}
                                <ToastContainer />
                            </DataProviderWrapper>
                        </PermissionsProvider>
                    </AuthLoadingGate>
                </AuthProvider>
            </LanguageProvider>
        </ToastProvider>
    );
}

/**
 * Gate that shows loading screen until auth is initialized
 * Prevents rendering children until auth state is known
 */
function AuthLoadingGate({ children }: { children: ReactNode }) {
    const { loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-gray-500 font-medium">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-4"></div>
                    Loading...
                </div>
            </div>
        );
    }

    return <>{children}</>;
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

