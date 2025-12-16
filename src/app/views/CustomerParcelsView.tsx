import React from 'react';
import { useAuth } from '../../shared/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { CustomerDashboard } from '../../../components/customer/CustomerDashboard';

/**
 * Customer Parcels View - Shows customer's parcel history
 */
export default function CustomerParcelsView() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const handleNewBooking = () => {
        navigate('/app/customer/booking');
    };

    if (!user) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <CustomerDashboard user={user} onNewBooking={handleNewBooking} />
        </div>
    );
}
