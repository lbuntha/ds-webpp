import { ParcelBookingForm } from '../../../components/parcels/ParcelBookingForm';
import { useData } from '../../shared/contexts/DataContext';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { firebaseService } from '../../shared/services/firebaseService';
import { ParcelServiceType } from '../../shared/types';

export default function ParcelsNewView() {
    const { accounts, branches, customers, taxRates } = useData();
    const navigate = useNavigate();
    const [services, setServices] = useState<ParcelServiceType[]>([]);

    useEffect(() => {
        loadServices();
    }, []);

    const loadServices = async () => {
        const data = await firebaseService.getParcelServices();
        setServices(data);
    };

    const handleComplete = () => {
        navigate('/app/parcels/overview');
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">New Booking</h2>
                <p className="text-sm text-gray-500">Create a new parcel delivery booking</p>
            </div>
            <ParcelBookingForm
                services={services}
                branches={branches}
                accounts={accounts}
                customers={customers}
                taxRates={taxRates}
                initialServiceTypeId=""
                onComplete={handleComplete}
            />
        </div>
    );
}
