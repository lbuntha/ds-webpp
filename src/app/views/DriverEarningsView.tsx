import React from 'react';
import { useAuth } from '../../shared/contexts/AuthContext';
import { Card } from '../../../components/ui/Card';

/**
 * Driver Earnings View - Shows driver's earnings and commissions
 * TODO: Implement full earnings dashboard with wallet integration
 */
export default function DriverEarningsView() {
    const { user } = useAuth();

    return (
        <div className="space-y-6">
            <Card title="My Earnings">
                <div className="text-center py-12">
                    <div className="text-6xl mb-4">💰</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Earnings Dashboard
                    </h3>
                    <p className="text-gray-600 mb-6">
                        View your commissions, completed deliveries, and wallet balance
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                        <p className="text-sm text-blue-800">
                            <strong>Coming Soon:</strong> Detailed earnings breakdown,
                            commission history, and payout tracking.
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
