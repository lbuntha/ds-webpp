import React, { useState, useEffect } from 'react';
import { ParcelPromotion } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';

export const ParcelPromotionSetup: React.FC = () => {
    const [promotions, setPromotions] = useState<ParcelPromotion[]>([]);
    const [loading, setLoading] = useState(false);

    // Form
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [type, setType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
    const [value, setValue] = useState(0);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState('');

    // Deletion confirm state
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const loadPromotions = async () => {
        const data = await firebaseService.getParcelPromotions();
        setPromotions(data);
    };

    useEffect(() => {
        loadPromotions();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code || !name || !startDate || !endDate) return;

        setLoading(true);
        try {
            const promo: ParcelPromotion = {
                id: `promo-${Date.now()}`,
                code: code.toUpperCase(),
                name,
                type,
                value,
                startDate,
                endDate,
                isActive: true
            };
            await firebaseService.saveParcelPromotion(promo);
            setCode('');
            setName('');
            setValue(0);
            setEndDate('');
            await loadPromotions();
            toast.success("Promotion created.");
        } catch (e) {
            console.error(e);
            toast.error("Failed to save promotion.");
        } finally {
            setLoading(false);
        }
    };

    const executeDelete = async (id: string) => {
        try {
            await firebaseService.deleteParcelPromotion(id);
            await loadPromotions();
            toast.success("Promotion deleted.");
        } catch (e) {
            toast.error("Failed to delete promotion.");
        } finally {
            setConfirmDeleteId(null);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Create Promotion">
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Promo Code" value={code} onChange={e => setCode(e.target.value)} placeholder="SUMMER25" required />
                        <Input label="Campaign Name" value={name} onChange={e => setName(e.target.value)} placeholder="Summer Sale" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <select
                                className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                value={type}
                                onChange={e => setType(e.target.value as any)}
                            >
                                <option value="PERCENTAGE">Percentage (%)</option>
                                <option value="FIXED_AMOUNT">Fixed Amount ($)</option>
                            </select>
                        </div>
                        <Input
                            label="Discount Value"
                            type="number"
                            value={value}
                            onChange={e => setValue(parseFloat(e.target.value))}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Start Date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                        <Input label="End Date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
                    </div>
                    <div className="pt-2">
                        <Button type="submit" isLoading={loading}>Create Promotion</Button>
                    </div>
                </form>
            </Card>

            <Card title="Active Promotions">
                <div className="space-y-3">
                    {promotions.map(p => (
                        <div key={p.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold bg-gray-100 px-2 py-0.5 rounded text-indigo-600">{p.code}</span>
                                    <span className="text-sm font-medium text-gray-900">{p.name}</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {p.type === 'PERCENTAGE' ? `${p.value}% Off` : `$${p.value} Off`} | Valid: {p.startDate} to {p.endDate}
                                </p>
                            </div>
                            {confirmDeleteId === p.id ? (
                                <div className="flex gap-2">
                                    <button onClick={() => executeDelete(p.id)} className="text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs font-bold">Confirm</button>
                                    <button onClick={() => setConfirmDeleteId(null)} className="text-gray-500 text-xs">Cancel</button>
                                </div>
                            ) : (
                                <button onClick={() => setConfirmDeleteId(p.id)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                            )}
                        </div>
                    ))}
                    {promotions.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No promotions active.</p>}
                </div>
            </Card>
        </div>
    );
};
