import React, { useState, useEffect } from 'react';
import { useAuth } from '../../shared/contexts/AuthContext';
import { firebaseService } from '../../shared/services/firebaseService';
import { ParcelBooking } from '../../shared/types';
import { DriverDeliveryCard } from '../../../components/driver/DriverDeliveryCard';
import { Card } from '../../../components/ui/Card';

/**
 * Driver Jobs View - Shows assigned delivery jobs
 */
export default function DriverJobsView() {
    const { user } = useAuth();
    const [deliveries, setDeliveries] = useState<ParcelBooking[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const loadDeliveries = async () => {
            try {
                const bookings = await firebaseService.getParcelBookings();
                const myDeliveries = bookings.filter(b => b.driverId === user.uid);
                setDeliveries(myDeliveries);
            } catch (error) {
                console.error('Failed to load deliveries:', error);
            } finally {
                setLoading(false);
            }
        };

        loadDeliveries();
    }, [user]);

    const handleAction = async (bookingId: string, itemId: string, action: 'DELIVER' | 'RETURN' | 'TRANSFER') => {
        try {
            await firebaseService.updateParcelItemStatus(bookingId, itemId, action === 'DELIVER' ? 'DELIVERED' : action === 'RETURN' ? 'RETURN_TO_SENDER' : 'IN_TRANSIT');
            // Refresh
            const bookings = await firebaseService.getParcelBookings();
            const myDeliveries = bookings.filter(b => b.driverId === user!.uid);
            setDeliveries(myDeliveries);
        } catch (error) {
            console.error('Action failed', error);
        }
    };

    const handleUpdateCod = async (bookingId: string, itemId: string, amount: number, currency: 'USD' | 'KHR') => {
        try {
            await firebaseService.updateParcelItemCOD(bookingId, itemId, amount, currency);
            // Refresh
            const bookings = await firebaseService.getParcelBookings();
            const myDeliveries = bookings.filter(b => b.driverId === user!.uid);
            setDeliveries(myDeliveries);
        } catch (error) {
            console.error('COD update failed', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading deliveries...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card title="My Deliveries">
                {deliveries.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">🚚</div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            No Active Deliveries
                        </h3>
                        <p className="text-gray-600">
                            You don't have any assigned deliveries at the moment.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {deliveries.map(delivery => (
                            <DriverDeliveryCard
                                key={delivery.id}
                                job={delivery}
                                onZoomImage={(url) => window.open(url, '_blank')}
                                onAction={handleAction}
                                onUpdateCod={handleUpdateCod}
                                onChatClick={(id, item) => console.log('Chat clicked', id, item)}
                                hasBranches={false}
                            />
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
