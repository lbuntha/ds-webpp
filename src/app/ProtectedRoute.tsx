import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../shared/contexts/AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
    children: ReactNode;
    requireRoles?: UserRole[];
    redirectTo?: string;
}

/**
 * Protected route component that requires authentication
 * Optionally can require specific roles
 */
export function ProtectedRoute({
    children,
    requireRoles,
    redirectTo = '/landing'
}: ProtectedRouteProps) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-gray-500 font-medium">
                Loading...
            </div>
        );
    }

    if (!user) {
        // Redirect to landing but save the attempted location
        return <Navigate to={redirectTo} state={{ from: location }} replace />;
    }

    // Check if user is pending approval
    if (user.status === 'PENDING') {
        return <Navigate to="/pending" replace />;
    }

    // Check role requirements if specified
    if (requireRoles && requireRoles.length > 0) {
        if (!requireRoles.includes(user.role)) {
            // User doesn't have required role, redirect to appropriate dashboard
            return <Navigate to={getRoleDefaultRoute(user.role)} replace />;
        }
    }

    return <>{children}</>;
}

/**
 * Get default route for a user role
 */
function getRoleDefaultRoute(role: UserRole): string {
    switch (role) {
        case 'customer':
            return '/customer';
        case 'driver':
            return '/driver';
        case 'system-admin':
        case 'accountant':
        case 'finance-manager':
        case 'warehouse':
            return '/app/dashboard';
        default:
            return '/landing';
    }
}
