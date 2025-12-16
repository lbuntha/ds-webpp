import React from 'react';
import { useAuth } from '../../shared/contexts/AuthContext';
import { CustomerProfile } from '../../../components/customer/CustomerProfile';

/**
 * Driver Profile View
 * Reuses the comprehensive Profile component (includes bank accounts, standard profile fields)
 */
export default function DriverProfileView() {
    const { user } = useAuth();

    if (!user) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <CustomerProfile user={user} />
        </div>
    );
}
