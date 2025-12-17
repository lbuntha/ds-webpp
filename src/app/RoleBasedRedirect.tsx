import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../shared/contexts/AuthContext';

export const RoleBasedRedirect: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/landing" replace />;
    }

    // Default Routes based on Role
    if (user.role === 'customer') {
        return <Navigate to="/app/customer/parcels" replace />;
    }

    if (user.role === 'driver') {
        return <Navigate to="/app/driver/jobs" replace />;
    }

    // Default for Admin, Finance, Warehouse, etc.
    return <Navigate to="/app/dashboard" replace />;
};
