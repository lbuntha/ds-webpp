import React, { useState, useEffect } from 'react';
import { DriverCommissionRule } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';

export const DriverCommissionSetup: React.FC = () => {
    const [rules, setRules] = useState<DriverCommissionRule[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [zoneName, setZoneName] = useState('');
    const [commissionFor, setCommissionFor] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
    const [driverSalaryType, setDriverSalaryType] = useState<'WITH_BASE_SALARY' | 'WITHOUT_BASE_SALARY' | 'ALL'>('ALL');
    const [type, setType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
    const [value, setValue] = useState<number>(70);
    const [currency, setCurrency] = useState<'USD' | 'KHR'>('USD');
    const [isDefault, setIsDefault] = useState(false);

    // Deletion confirm state
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const loadRules = async () => {
        setLoading(true);
        try {
            const data = await firebaseService.logisticsService.getDriverCommissionRules();
            setRules(data.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0))); // Default at top
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRules();
    }, []);

    const resetForm = () => {
        setEditingId(null);
        setZoneName('');
        setCommissionFor('DELIVERY');
        setDriverSalaryType('ALL');
        setType('PERCENTAGE');
        setValue(70);
        setCurrency('USD');
        setIsDefault(false);
    };

    const handleEdit = (rule: DriverCommissionRule) => {
        setEditingId(rule.id);
        setZoneName(rule.zoneName);
        setCommissionFor(rule.commissionFor || 'DELIVERY');
        setDriverSalaryType(rule.driverSalaryType || 'ALL');
        setType(rule.type);
        setValue(rule.value);
        setCurrency(rule.currency || 'USD');
        setIsDefault(rule.isDefault);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!zoneName) return;

        setLoading(true);
        try {
            // If setting default, unset others locally for logic (backend doesn't enforce, but good practice)
            if (isDefault) {
                const currentDefault = rules.find(r => r.isDefault && r.id !== editingId);
                if (currentDefault) {
                    await firebaseService.logisticsService.saveDriverCommissionRule({ ...currentDefault, isDefault: false });
                }
            }

            const rule: DriverCommissionRule = {
                id: editingId || `comm-${Date.now()}`,
                zoneName,
                commissionFor,
                driverSalaryType,
                type,
                value,
                isDefault,
                currency: type === 'FIXED_AMOUNT' ? currency : undefined
            };

            await firebaseService.logisticsService.saveDriverCommissionRule(rule);
            resetForm();
            await loadRules();
            toast.success(editingId ? "Rule updated." : "Rule created.");
        } catch (e) {
            toast.error("Failed to save rule");
        } finally {
            setLoading(false);
        }
    };

    const executeDelete = async (id: string) => {
        try {
            await firebaseService.logisticsService.deleteDriverCommissionRule(id);
            await loadRules();
            toast.success("Rule deleted.");
        } catch (e) {
            toast.error("Failed to delete rule.");
        } finally {
            setConfirmDeleteId(null);
        }
    };

    const handleDelete = (id: string) => {
        setConfirmDeleteId(id);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
                <Card title={editingId ? "Edit Rule" : "Add Commission Rule"}>
                    <form onSubmit={handleSave} className="space-y-4">
                        <Input
                            label="Zone / Rule Name"
                            value={zoneName}
                            onChange={e => setZoneName(e.target.value)}
                            placeholder="e.g. Phnom Penh Standard"
                            required
                        />

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Commission For</label>
                            <div className="flex rounded-md shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => setCommissionFor('DELIVERY')}
                                    className={`flex-1 py-2 text-xs font-bold border rounded-l-lg ${commissionFor === 'DELIVERY' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                                >
                                    Delivery
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCommissionFor('PICKUP')}
                                    className={`flex-1 py-2 text-xs font-bold border rounded-r-lg ${commissionFor === 'PICKUP' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                                >
                                    Pickup
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Driver Salary Type</label>
                            <div className="flex rounded-md shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => setDriverSalaryType('ALL')}
                                    className={`flex-1 py-2 text-xs font-bold border rounded-l-lg ${driverSalaryType === 'ALL' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                                >
                                    All Drivers
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDriverSalaryType('WITH_BASE_SALARY')}
                                    className={`flex-1 py-2 text-xs font-bold border ${driverSalaryType === 'WITH_BASE_SALARY' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                                >
                                    With Salary
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDriverSalaryType('WITHOUT_BASE_SALARY')}
                                    className={`flex-1 py-2 text-xs font-bold border rounded-r-lg ${driverSalaryType === 'WITHOUT_BASE_SALARY' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                                >
                                    No Salary
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Amount Type</label>
                            <div className="flex rounded-md shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => setType('PERCENTAGE')}
                                    className={`flex-1 py-2 text-xs font-bold border rounded-l-lg ${type === 'PERCENTAGE' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                                >
                                    Percentage (%)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setType('FIXED_AMOUNT')}
                                    className={`flex-1 py-2 text-xs font-bold border rounded-r-lg ${type === 'FIXED_AMOUNT' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                                >
                                    Fixed Amount ($)
                                </button>
                            </div>
                        </div>

                        <Input
                            label={type === 'PERCENTAGE' ? "Percentage Value (e.g. 70 for 70%)" : "Fixed Amount ($)"}
                            type="number"
                            step={type === 'PERCENTAGE' ? "1" : "0.01"}
                            value={value}
                            onChange={e => setValue(parseFloat(e.target.value))}
                            required
                        />

                        {type === 'FIXED_AMOUNT' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                                <div className="flex rounded-md shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => setCurrency('USD')}
                                        className={`flex-1 py-2 text-xs font-bold border rounded-l-lg ${currency === 'USD' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                                    >
                                        USD ($)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCurrency('KHR')}
                                        className={`flex-1 py-2 text-xs font-bold border rounded-r-lg ${currency === 'KHR' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                                    >
                                        KHR (៛)
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center space-x-2 pt-2">
                            <input
                                type="checkbox"
                                id="isDefault"
                                checked={isDefault}
                                onChange={e => setIsDefault(e.target.checked)}
                                className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                            />
                            <label htmlFor="isDefault" className="text-sm font-medium text-gray-700 cursor-pointer">
                                Set as Default Rule
                            </label>
                        </div>
                        <p className="text-xs text-gray-500">Default rule applies to all bookings unless a specific zone is matched.</p>

                        <div className="flex justify-end space-x-2 pt-4">
                            {editingId && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}
                            <Button type="submit" isLoading={loading}>{editingId ? 'Update Rule' : 'Save Rule'}</Button>
                        </div>
                    </form>
                </Card>
            </div>

            <div className="lg:col-span-2">
                <Card title="Commission Configuration">
                    {rules.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">No rules configured. System will default to 70%.</div>
                    ) : (
                        <div className="space-y-3">
                            {rules.map(rule => (
                                <div key={rule.id} className={`flex justify-between items-center p-4 border rounded-xl hover:shadow-sm transition-shadow bg-white ${rule.isDefault ? 'border-l-4 border-l-indigo-500' : 'border-gray-200'}`}>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="font-bold text-gray-900">{rule.zoneName}</h4>
                                            {rule.isDefault && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase">Default</span>}
                                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${(rule.commissionFor || 'DELIVERY') === 'DELIVERY' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {rule.commissionFor || 'DELIVERY'}
                                            </span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${(rule.driverSalaryType || 'ALL') === 'ALL' ? 'bg-gray-100 text-gray-700' : (rule.driverSalaryType || 'ALL') === 'WITH_BASE_SALARY' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {(rule.driverSalaryType || 'ALL') === 'ALL' ? 'All Drivers' : (rule.driverSalaryType || 'ALL') === 'WITH_BASE_SALARY' ? 'With Salary' : 'No Salary'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Driver gets: <span className="font-bold text-green-600">
                                                {rule.type === 'PERCENTAGE'
                                                    ? `${rule.value}%`
                                                    : `${rule.currency === 'KHR' ? '៛' : '$'}${rule.value.toFixed(2)} ${rule.currency}`
                                                }
                                            </span> per {(rule.commissionFor || 'delivery').toLowerCase()}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <button onClick={() => handleEdit(rule)} className="text-indigo-600 hover:text-indigo-900 text-sm font-medium px-2">Edit</button>

                                        {confirmDeleteId === rule.id ? (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => executeDelete(rule.id)}
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
                                                onClick={() => setConfirmDeleteId(rule.id)}
                                                className="text-red-600 hover:text-red-900 text-sm font-medium px-2"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};
