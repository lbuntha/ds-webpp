import React, { useState } from 'react';
import { useAuth } from '../../shared/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { CustomerBooking } from '../../../components/customer/CustomerBooking';

/**
 * Customer Booking View - New parcel booking form
 */
export default function CustomerBookingView() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Determine initial mode based on URL
    const initialMode = location.pathname.includes('stock-booking') ? 'STOCK' : 'PHOTO';

    const handleComplete = () => {
        // Navigate to parcels view after successful booking
        navigate('/app/customer/parcels');
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
            <CustomerBooking user={user} onComplete={handleComplete} initialMode={initialMode} />
        </div>
    );
}
