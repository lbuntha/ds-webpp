import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../shared/contexts/AuthContext';
import { UserRole } from '../shared/types';

interface RoleBasedRouteProps {
    children: ReactNode;
    allowedRoles: UserRole[];
    fallbackRoute?: string;
}

/**
 * Route component that checks if user has one of the allowed roles
 * Used within already protected routes for additional role checking
 */
export function RoleBasedRoute({
    children,
    allowedRoles,
    fallbackRoute = '/app/dashboard'
}: RoleBasedRouteProps) {
    const { user } = useAuth();

    if (!user) {
        return <Navigate to="/landing" replace />;
    }

    if (!allowedRoles.includes(user.role)) {
        // User doesn't have permission, redirect to fallback
        return <Navigate to={fallbackRoute} replace />;
    }

    return <>{children}</>;
}
