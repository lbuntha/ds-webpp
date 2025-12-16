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

    console.log('🔐 PERMISSION ROUTE CHECK:', {
        requiredPermission,
        user: user?.email,
        role: user?.role,
        hasPermission,
        fallbackRoute
    });

    if (!user) {
        return <Navigate to="/landing" replace />;
    }

    // System admin always has full access
    if (user.role === 'system-admin') {
        console.log('✅ System admin - access granted');
        return <>{children}</>;
    }

    // Check if user has the required permission
    if (!hasPermission) {
        console.warn(`❌ User ${user.email} (${user.role}) attempted to access route requiring ${requiredPermission} but lacks permission - redirecting to ${fallbackRoute}`);
        return <Navigate to={fallbackRoute} replace />;
    }

    console.log('✅ Permission granted');
    return <>{children}</>;
}
