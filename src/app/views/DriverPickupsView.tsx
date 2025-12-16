import React, { useState, useEffect } from 'react';
import { useAuth } from '../../shared/contexts/AuthContext';
import { firebaseService } from '../../shared/services/firebaseService';
import { ParcelBooking } from '../../../types';
import { DriverPickupProcessor } from '../../../components/driver/DriverPickupProcessor';
import { Card } from '../../../components/ui/Card';

/**
 * Driver Pickups View - Shows available pickup jobs
 */
export default function DriverPickupsView() {
    const { user } = useAuth();
    const [pickups, setPickups] = useState<ParcelBooking[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const loadPickups = async () => {
            try {
                const bookings = await firebaseService.getParcelBookings();
                // Show pending pickups without assigned driver
                const availablePickups = bookings.filter(b =>
                    b.status === 'PENDING' && !b.driverId
                );
                setPickups(availablePickups);
            } catch (error) {
                console.error('Failed to load pickups:', error);
            } finally {
                setLoading(false);
            }
        };

        loadPickups();
    }, [user]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading pickup jobs...</div>
            </div>
        );
    }

    if (pickups.length === 0) {
        return (
            <div className="space-y-6">
                <Card title="Available Pickups">
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">📦</div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            No Available Pickups
                        </h3>
                        <p className="text-gray-600">
                            There are no pending pickup jobs at the moment.
                        </p>
                    </div>
                </Card>
            </div>
        );
    }

    // Show first available pickup with DriverPickupProcessor
    return (
        <div className="space-y-6">
            <Card title="Available Pickups">
                <DriverPickupProcessor
                    job={pickups[0]}
                    user={user!}
                    onSave={async () => {
                        // Reload pickups after save
                        const bookings = await firebaseService.getParcelBookings();
                        const availablePickups = bookings.filter(b =>
                            b.status === 'PENDING' && !b.driverId
                        );
                        setPickups(availablePickups);
                    }}
                    onFinish={async () => {
                        // Reload pickups after finish
                        const bookings = await firebaseService.getParcelBookings();
                        const availablePickups = bookings.filter(b =>
                            b.status === 'PENDING' && !b.driverId
                        );
                        setPickups(availablePickups);
                    }}
                    onCancel={async () => {
                        // Reload pickups after cancel
                        const bookings = await firebaseService.getParcelBookings();
                        const availablePickups = bookings.filter(b =>
                            b.status === 'PENDING' && !b.driverId
                        );
                        setPickups(availablePickups);
                    }}
                />
                {pickups.length > 1 && (
                    <div className="mt-4 text-sm text-gray-600 text-center">
                        {pickups.length - 1} more pickup{pickups.length > 2 ? 's' : ''} available
                    </div>
                )}
            </Card>
        </div>
    );
}
