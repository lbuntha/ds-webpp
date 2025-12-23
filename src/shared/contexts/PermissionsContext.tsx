import React, { createContext, useContext, useState } from 'react';
import { Permission, UserRole, UserProfile } from '../types';
import { ROLE_PERMISSIONS } from '../constants';
import { firebaseService } from '../services/firebaseService';

interface PermissionsContextType {
    permissions: Record<UserRole, Permission[]>;
    setPermissions: (perms: Record<UserRole, Permission[]>) => void;
    hasPermission: (user: UserProfile | null, permission: Permission) => boolean;
    refreshPermissions: () => Promise<void>;
    isLoading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [permissions, setPermissions] = useState<Record<UserRole, Permission[]>>(ROLE_PERMISSIONS);
    const [isLoading, setIsLoading] = useState(true);

    const refreshPermissions = async () => {
        setIsLoading(true);
        try {
            const perms = await firebaseService.getRolePermissions();
            if (perms && Object.keys(perms).length > 0) {
                setPermissions(perms);
            }
        } catch (error) {
            console.error("Failed to fetch permissions:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Allow manual setting (e.g., from App initial load) without triggering a refetch
    const setPermissionsManual = (perms: Record<UserRole, Permission[]>) => {
        setPermissions(perms);
        setIsLoading(false);
    }

    const hasPermission = (user: UserProfile | null, permission: Permission): boolean => {
        if (!user) return false;
        // System Admin has all permissions implicitly (failsafe)
        if (user.role === 'system-admin') return true;

        const userPerms = permissions[user.role] || [];
        return userPerms.includes(permission);
    };

    return (
        <PermissionsContext.Provider value={{
            permissions,
            setPermissions: setPermissionsManual,
            hasPermission,
            refreshPermissions,
            isLoading
        }}>
            {children}
        </PermissionsContext.Provider>
    );
};

export const usePermissions = () => {
    const context = useContext(PermissionsContext);
    if (!context) {
        throw new Error('usePermissions must be used within a PermissionsProvider');
    }
    return context;
};
