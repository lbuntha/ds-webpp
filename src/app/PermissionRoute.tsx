import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../shared/contexts/AuthContext';
import { usePermission } from '../shared/hooks/usePermissions';
import { Permission } from '../shared/types';

interface PermissionRouteProps {
    children: ReactNode;
    requiredPermission: Permission;
    fallbackRoute?: string;
}

/**
 * Route component that checks if user has a specific permission
 * Provides granular access control at the route level
 * System admins automatically bypass permission checks
 */
export function PermissionRoute({
    children,
    requiredPermission,
    fallbackRoute = '/app/dashboard'
}: PermissionRouteProps) {
    const { user } = useAuth();
    const hasPermission = usePermission(requiredPermission);

    if (!user) {
        return <Navigate to="/landing" replace />;
    }

    // System admin always has full access
    if (user.role === 'system-admin') {
        return <>{children}</>;
    }

    // Check if user has the required permission
    if (!hasPermission) {
        return <Navigate to={fallbackRoute} replace />;
    }

    return <>{children}</>;
}
