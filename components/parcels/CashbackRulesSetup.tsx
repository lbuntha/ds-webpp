import React, { useState, useEffect } from 'react';
import { CustomerCashbackRule, Customer } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';

const DURATION_OPTIONS = [
    { label: '3 Months', months: 3 },
    { label: '6 Months', months: 6 },
    { label: '1 Year', months: 12 },
    { label: 'Custom', months: 0 },
];

export const CashbackRulesSetup: React.FC = () => {
    const [rules, setRules] = useState<CustomerCashbackRule[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [customerId, setCustomerId] = useState('');
    const [minParcels, setMinParcels] = useState(100);
    const [cashbackPercent, setCashbackPercent] = useState(5);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState('');
    const [durationPreset, setDurationPreset] = useState<number>(3);
    const [customerSearch, setCustomerSearch] = useState('');

    // Edit mode
    const [editingId, setEditingId] = useState<string | null>(null);

    // Deletion confirm state
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const loadRules = async () => {
        const data = await firebaseService.getCustomerCashbackRules();
        setRules(data);
    };

    useEffect(() => {
        loadRules();
        firebaseService.getCustomers().then(setCustomers);
    }, []);

    // Auto-calculate end date when start date or duration changes
    useEffect(() => {
        if (durationPreset > 0 && startDate) {
            const start = new Date(startDate);
            start.setMonth(start.getMonth() + durationPreset);
            setEndDate(start.toISOString().split('T')[0]);
        }
    }, [startDate, durationPreset]);

    const resetForm = () => {
        setCustomerId('');
        setMinParcels(100);
        setCashbackPercent(5);
        setStartDate(new Date().toISOString().split('T')[0]);
        setEndDate('');
        setDurationPreset(3);
        setCustomerSearch('');
        setEditingId(null);
    };

    const handleEdit = (rule: CustomerCashbackRule) => {
        setEditingId(rule.id);
        setCustomerId(rule.customerId);
        setMinParcels(rule.minParcelsPerMonth);
        setCashbackPercent(rule.cashbackPercent);
        setStartDate(rule.startDate);
        setEndDate(rule.endDate);
        setDurationPreset(0); // Custom when editing
        setCustomerSearch(rule.customerName);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerId || !startDate || !endDate) {
            toast.warning("Please select a customer and set date range.");
            return;
        }

        if (minParcels < 1 || cashbackPercent <= 0 || cashbackPercent > 100) {
            toast.warning("Please enter valid threshold and percentage.");
            return;
        }

        setLoading(true);
        try {
            const customer = customers.find(c => c.id === customerId);
            const rule: CustomerCashbackRule = {
                id: editingId || `cbr-${Date.now()}`,
                customerId,
                customerName: customer?.name || 'Unknown',
                minParcelsPerMonth: minParcels,
                cashbackPercent,
                startDate,
                endDate,
                isActive: true,
                createdAt: editingId ? (rules.find(r => r.id === editingId)?.createdAt || Date.now()) : Date.now(),
                updatedAt: Date.now(),
            };
            await firebaseService.saveCustomerCashbackRule(rule);
            resetForm();
            await loadRules();
            toast.success(editingId ? "Cashback rule updated." : "Cashback rule created.");
        } catch (e) {
            console.error(e);
            toast.error("Failed to save cashback rule.");
        } finally {
            setLoading(false);
        }
    };

    const executeDelete = async (id: string) => {
        try {
            await firebaseService.deleteCustomerCashbackRule(id);
            await loadRules();
            toast.success("Cashback rule deleted.");
        } catch (e) {
            toast.error("Failed to delete rule.");
        } finally {
            setConfirmDeleteId(null);
        }
    };

    const toggleActive = async (rule: CustomerCashbackRule) => {
        await firebaseService.saveCustomerCashbackRule({ ...rule, isActive: !rule.isActive, updatedAt: Date.now() });
        await loadRules();
        toast.success(rule.isActive ? "Rule deactivated." : "Rule activated.");
    };

    const getCustomerName = (cid: string) => {
        const customer = customers.find(c => c.id === cid);
        return customer?.name || cid;
    };

    const isRuleActive = (rule: CustomerCashbackRule) => {
        const today = new Date().toISOString().split('T')[0];
        return rule.isActive && rule.startDate <= today && rule.endDate >= today;
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title={editingId ? "Edit Cashback Rule" : "Create Cashback Rule"}>
                <form onSubmit={handleSave} className="space-y-4">
                    {/* Customer Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-emerald-500 sm:text-sm"
                                placeholder="🔍 Search customer by name or phone..."
                                value={customerSearch}
                                onChange={e => {
                                    setCustomerSearch(e.target.value);
                                    if (!e.target.value) setCustomerId('');
                                }}
                            />
                            {customerSearch.length >= 2 && !customerId && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                    {customers
                                        .filter(c =>
                                            c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                                            c.phone?.includes(customerSearch)
                                        )
                                        .slice(0, 6)
                                        .map(c => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                className="w-full px-3 py-2 text-left text-sm hover:bg-emerald-50 flex justify-between items-center border-b border-gray-100 last:border-0"
                                                onClick={() => {
                                                    setCustomerId(c.id);
                                                    setCustomerSearch(c.name);
                                                }}
                                            >
                                                <span className="font-medium text-gray-900">{c.name}</span>
                                                <span className="text-xs text-gray-500">{c.phone}</span>
                                            </button>
                                        ))
                                    }
                                    {customers.filter(c =>
                                        c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                                        c.phone?.includes(customerSearch)
                                    ).length === 0 && (
                                            <div className="px-3 py-2 text-xs text-gray-500 text-center">
                                                No customers found
                                            </div>
                                        )}
                                </div>
                            )}
                        </div>
                        {customerId && (
                            <p className="text-xs text-emerald-600 mt-1">✓ Selected: {getCustomerName(customerId)}</p>
                        )}
                    </div>

                    {/* Threshold & Percentage */}
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Min Parcels/Month"
                            type="number"
                            value={minParcels}
                            onChange={e => setMinParcels(parseInt(e.target.value) || 0)}
                            min={1}
                            required
                        />
                        <Input
                            label="Cashback %"
                            type="number"
                            value={cashbackPercent}
                            onChange={e => setCashbackPercent(parseFloat(e.target.value) || 0)}
                            min={0.1}
                            max={100}
                            step={0.1}
                            required
                        />
                    </div>

                    {/* Duration Quick Select */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                        <div className="flex flex-wrap gap-2">
                            {DURATION_OPTIONS.map(opt => (
                                <button
                                    key={opt.months}
                                    type="button"
                                    onClick={() => setDurationPreset(opt.months)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${durationPreset === opt.months
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-emerald-50'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Start Date"
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            required
                        />
                        <Input
                            label="End Date"
                            type="date"
                            value={endDate}
                            onChange={e => {
                                setEndDate(e.target.value);
                                setDurationPreset(0); // Switch to custom when manually editing
                            }}
                            required
                        />
                    </div>

                    {/* Preview */}
                    <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                        <p className="text-sm text-emerald-800">
                            <strong>Preview:</strong> If <span className="font-mono">{getCustomerName(customerId) || '(customer)'}</span> delivers{' '}
                            <strong>≥{minParcels}</strong> parcels in a month, they get{' '}
                            <strong>{cashbackPercent}%</strong> of delivery fees as cashback.
                        </p>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button type="submit" isLoading={loading}>
                            {editingId ? 'Update Rule' : 'Create Rule'}
                        </Button>
                        {editingId && (
                            <Button type="button" variant="outline" onClick={resetForm}>
                                Cancel
                            </Button>
                        )}
                    </div>
                </form>
            </Card>

            <Card title="Cashback Rules">
                <div className="space-y-3">
                    {rules.map(r => {
                        const active = isRuleActive(r);
                        return (
                            <div
                                key={r.id}
                                className={`p-3 border rounded-lg transition-all ${active
                                    ? 'border-emerald-200 bg-emerald-50/50'
                                    : 'border-gray-200 bg-gray-50/50'
                                    }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-gray-900">{r.customerName}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${active
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-gray-200 text-gray-600'
                                                }`}>
                                                {active ? '● Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 mt-1">
                                            ≥<strong>{r.minParcelsPerMonth}</strong> parcels → <strong>{r.cashbackPercent}%</strong> cashback
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {r.startDate} to {r.endDate}
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => toggleActive(r)}
                                            className={`text-xs px-2 py-1 rounded ${r.isActive
                                                ? 'text-amber-600 hover:bg-amber-50'
                                                : 'text-emerald-600 hover:bg-emerald-50'
                                                }`}
                                        >
                                            {r.isActive ? 'Pause' : 'Activate'}
                                        </button>
                                        <button
                                            onClick={() => handleEdit(r)}
                                            className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
                                        >
                                            Edit
                                        </button>
                                        {confirmDeleteId === r.id ? (
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => executeDelete(r.id)}
                                                    className="text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs font-bold"
                                                >
                                                    Confirm
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDeleteId(null)}
                                                    className="text-gray-500 text-xs px-1"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmDeleteId(r.id)}
                                                className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {rules.length === 0 && (
                        <p className="text-gray-500 text-sm text-center py-4">
                            No cashback rules configured.
                        </p>
                    )}
                </div>
            </Card>
        </div>
    );
};
