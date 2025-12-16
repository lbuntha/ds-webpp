import React from 'react';
import { useAuth } from '../../shared/contexts/AuthContext';
import { DriverDashboard } from '../../../components/driver/DriverDashboard';
import { Card } from '../../../components/ui/Card';

/**
 * Driver Jobs View
 * Wraps the unified DriverDashboard component which includes tabs for Pickups, Deliveries, and more.
 */
export default function DriverJobsView() {
    const { user } = useAuth();

    if (!user) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    // DriverDashboard is the comprehensive view requested
    return (
        <div className="space-y-6">
            <DriverDashboard user={user} />
        </div>
    );
}
