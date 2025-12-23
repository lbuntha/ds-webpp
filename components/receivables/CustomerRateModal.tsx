
import React, { useState, useEffect } from 'react';
import { Customer, ParcelServiceType, CustomerSpecialRate } from '../../src/shared/types';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from '../../src/shared/utils/toast';

interface Props {
    customer: Customer;
    onClose: () => void;
}

export const CustomerRateModal: React.FC<Props> = ({ customer, onClose }) => {
    const [rates, setRates] = useState<CustomerSpecialRate[]>([]);
    const [services, setServices] = useState<ParcelServiceType[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [serviceTypeId, setServiceTypeId] = useState('');
    const [price, setPrice] = useState(0);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState('');

    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [ratesData, servicesData] = await Promise.all([
                firebaseService.getCustomerSpecialRates(customer.id),
                firebaseService.getParcelServices()
            ]);
            setRates(ratesData);
            setServices(servicesData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [customer.id]);

    const handleAddRate = async () => {
        if (!serviceTypeId || price <= 0 || !startDate || !endDate) {
            toast.warning("Please fill in all fields.");
            return;
        }

        if (endDate < startDate) {
            toast.warning("End date cannot be before start date.");
            return;
        }

        setSaving(true);
        try {
            const service = services.find(s => s.id === serviceTypeId);
            const rate: CustomerSpecialRate = {
                id: `rate-${Date.now()}`,
                customerId: customer.id,
                serviceTypeId,
                serviceName: service?.name || 'Unknown Service',
                price,
                startDate,
                endDate,
                createdAt: Date.now()
            };
            await firebaseService.saveCustomerSpecialRate(rate);
            await loadData();

            // Reset form
            setServiceTypeId('');
            setPrice(0);
            setEndDate('');
            toast.success("Special rate added.");
        } catch (e) {
            toast.error("Failed to save rate.");
        } finally {
            setSaving(false);
        }
    };

    const executeDelete = async (id: string) => {
        try {
            await firebaseService.deleteCustomerSpecialRate(id);
            await loadData();
            toast.success("Rate deleted.");
        } catch (e) {
            toast.error("Failed to delete rate.");
        } finally {
            setConfirmDeleteId(null);
        }
    };

    const handleDelete = (id: string) => {
        setConfirmDeleteId(id);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Special Delivery Rates</h3>
                        <p className="text-xs text-gray-500">For {customer.name}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {/* Form */}
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
                        <h4 className="text-sm font-bold text-blue-800 mb-3">Add Special Rate</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Service Type</label>
                                <select
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    value={serviceTypeId}
                                    onChange={e => setServiceTypeId(e.target.value)}
                                >
                                    <option value="">Select Service...</option>
                                    {services.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} (Std: ${s.defaultPrice})</option>
                                    ))}
                                </select>
                            </div>
                            <Input
                                label="Special Price ($)"
                                type="number"
                                step="0.01"
                                value={price}
                                onChange={e => setPrice(parseFloat(e.target.value))}
                            />
                            <Input
                                label="Start Date"
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                            />
                            <Input
                                label="End Date"
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                            />
                        </div>
                        <div className="mt-4 flex justify-end">
                            <Button onClick={handleAddRate} isLoading={saving} className="text-xs">Add Rule</Button>
                        </div>
                    </div>

                    {/* List */}
                    <h4 className="text-sm font-bold text-gray-800 mb-3">Active Rules</h4>
                    {loading ? <p className="text-center text-gray-500 py-4">Loading...</p> : (
                        <div className="space-y-3">
                            {rates.length === 0 && <p className="text-gray-500 text-xs italic text-center py-4">No special rates configured.</p>}
                            {rates.map(rate => (
                                <div key={rate.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                                    <div>
                                        <p className="font-bold text-sm text-gray-900">{rate.serviceName}</p>
                                        <p className="text-xs text-gray-500">
                                            Valid: <span className="font-mono">{rate.startDate}</span> to <span className="font-mono">{rate.endDate}</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-bold text-green-600 bg-green-50 px-2 py-1 rounded text-sm">
                                            ${rate.price.toFixed(2)}
                                        </span>
                                        {confirmDeleteId === rate.id ? (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => executeDelete(rate.id)}
                                                    className="text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs font-bold"
                                                >
                                                    Confirm
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDeleteId(null)}
                                                    className="text-gray-500 hover:text-gray-700 px-2 py-1 text-xs"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmDeleteId(rate.id)}
                                                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                                                title="Delete Rate"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
