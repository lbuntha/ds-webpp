import React, { useState } from 'react';
import { ParcelBooking, ParcelStatusConfig } from '../../src/shared/types';
import { Button } from '../ui/Button';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';
import { useLanguage } from '../../src/shared/contexts/LanguageContext';

interface StatusUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking: ParcelBooking;
    statuses: ParcelStatusConfig[];
    onSuccess: () => void;
}

export const StatusUpdateModal: React.FC<StatusUpdateModalProps> = ({
    isOpen,
    onClose,
    booking,
    statuses,
    onSuccess
}) => {
    const { t } = useLanguage();
    const [selectedStatusId, setSelectedStatusId] = useState(booking.statusId || '');
    const [loading, setLoading] = useState(false);

    const handleUpdateStatus = async () => {
        if (!booking || !selectedStatusId) return;

        setLoading(true);
        const user = await firebaseService.getCurrentUser();
        const userName = user?.name || 'Unknown Staff';
        const userId = user?.uid || 'uid-unknown';

        try {
            await firebaseService.updateParcelStatus(booking.id, selectedStatusId, userId, userName);
            toast.success("Status updated successfully");
            onSuccess();
            onClose();
        } catch (e) {
            console.error(e);
            toast.error("Failed to update status.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Update Delivery Status</h3>
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Move <strong>{booking.senderName}'s</strong> parcel to:
                    </p>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {statuses.map(s => (
                            <label key={s.id} className={`flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${selectedStatusId === s.id ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
                                <input
                                    type="radio"
                                    name="status"
                                    value={s.id}
                                    checked={selectedStatusId === s.id}
                                    onChange={() => setSelectedStatusId(s.id)}
                                    className="text-indigo-600 focus:ring-indigo-500"
                                />
                                <div className="ml-3 flex-1">
                                    <span className="block text-sm font-medium text-gray-900">{s.label}</span>
                                    {s.triggersRevenue && (
                                        <span className="text-[10px] text-green-600 font-medium bg-green-50 px-1.5 rounded">Records Revenue</span>
                                    )}
                                </div>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                    <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
                    <Button onClick={handleUpdateStatus} isLoading={loading} disabled={loading}>{t('save')}</Button>
                </div>
            </div>
        </div>
    );
};
