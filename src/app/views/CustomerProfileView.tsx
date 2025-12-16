import React from 'react';
import { useAuth } from '../../shared/contexts/AuthContext';
import { CustomerProfile } from '../../../components/customer/CustomerProfile';

/**
 * Customer Profile View - Manage customer profile, bank accounts, locations, and settings
 * Uses the comprehensive CustomerProfile component from components/customer
 */
export default function CustomerProfileView() {
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
