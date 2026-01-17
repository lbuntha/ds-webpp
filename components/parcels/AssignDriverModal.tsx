import React, { useState } from 'react';
import { ParcelBooking, Employee } from '../../src/shared/types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';

interface AssignDriverModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking: ParcelBooking;
    drivers: Employee[];
    onSuccess: () => void;
}

export const AssignDriverModal: React.FC<AssignDriverModalProps> = ({
    isOpen,
    onClose,
    booking,
    drivers,
    onSuccess
}) => {
    const [selectedDriverId, setSelectedDriverId] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAssignDriver = async () => {
        if (!booking || !selectedDriverId) return;
        const driver = drivers.find(d => d.id === selectedDriverId);

        if (!driver) return;
        if (!driver.linkedUserId) {
            toast.error("This driver does not have a linked user account (UID). Cannot assign jobs to them.");
            return;
        }

        setLoading(true);
        try {
            await firebaseService.logisticsService.assignBookingDriver(booking.id, driver.linkedUserId, driver.name);
            toast.success("Driver assigned successfully");
            onSuccess();
            onClose();
        } catch (e) {
            console.error(e);
            toast.error("Failed to assign driver");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Assign Driver"
            maxWidth="max-w-lg"
        >
            <div className="space-y-4 min-h-[400px]">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Booking Info</div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="font-mono">{booking.id.slice(-6).toUpperCase()}</span>
                        <span className="text-gray-600">
                            {new Date(booking.createdAt || booking.bookingDate).toLocaleString()}
                        </span>
                    </div>
                    <div className="text-sm mt-1">
                        <span className="text-gray-500">Sender:</span> <span className="font-medium">{booking.senderName}</span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Driver</label>
                    <SearchableSelect
                        options={drivers.map(d => ({
                            value: d.id,
                            label: `${d.name} ${d.vehiclePlateNumber ? `(${d.vehiclePlateNumber})` : ''}`
                        }))}
                        value={selectedDriverId}
                        onChange={(val) => setSelectedDriverId(val)}
                        placeholder="-- Select Driver --"
                    />
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleAssignDriver}
                        disabled={!selectedDriverId || loading}
                        isLoading={loading}
                    >
                        Confirm Assignment
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
