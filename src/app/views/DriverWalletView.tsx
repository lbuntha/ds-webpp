import React from 'react';
import { useAuth } from '../../shared/contexts/AuthContext';
import { WalletDashboard } from '../../../components/wallet/WalletDashboard';

/**
 * Driver Wallet View - Manages driver's earnings, cash held, and payouts
 * Wraps the shared WalletDashboard component
 */
export default function DriverWalletView() {
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
            <WalletDashboard user={user} />
        </div>
    );
}
