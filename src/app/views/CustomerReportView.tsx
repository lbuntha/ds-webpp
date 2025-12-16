import React from 'react';
import { useAuth } from '../../shared/contexts/AuthContext';
import { CustomerSummaryReport } from '../../../components/customer/CustomerSummaryReport';

/**
 * Customer Report View - Shows financial delivery reports
 * Wraps the CustomerSummaryReport component
 */
export default function CustomerReportView() {
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
            <CustomerSummaryReport user={user} />
        </div>
    );
}
