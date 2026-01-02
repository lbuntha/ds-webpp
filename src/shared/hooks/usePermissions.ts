import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Permission } from '../types';

/**
 * Hook to check if user has specific permission
 */
export function usePermission(permission: Permission): boolean {
    const { user } = useAuth();
    const { rolePermissions } = useData();

    if (!user) return false;

    // System admin bypass - always has all permissions
    if (user.role === 'system-admin') return true;

    const userPermissions = rolePermissions[user.role] || [];
    const hasPermission = userPermissions.includes(permission);

    return hasPermission;
}

/**
 * Hook to check if user has any of the specified permissions
 */
export function useHasAnyPermission(permissions: Permission[]): boolean {
    const { user } = useAuth();
    const { rolePermissions } = useData();

    if (!user) return false;

    const userPermissions = rolePermissions[user.role] || [];
    return permissions.some(p => userPermissions.includes(p));
}

/**
 * Hook to check if user has all of the specified permissions
 */
export function useHasAllPermissions(permissions: Permission[]): boolean {
    const { user } = useAuth();
    const { rolePermissions } = useData();

    if (!user) return false;

    const userPermissions = rolePermissions[user.role] || [];
    return permissions.every(p => userPermissions.includes(p));
}

/**
 * Hook to get all permissions for current user
 */
export function useUserPermissions(): Permission[] {
    const { user } = useAuth();
    const { rolePermissions } = useData();

    if (!user) return [];

    return rolePermissions[user.role] || [];
}
