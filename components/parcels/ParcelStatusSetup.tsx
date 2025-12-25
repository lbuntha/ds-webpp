import React, { useState, useEffect } from 'react';
import { ParcelStatusConfig } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';

export const ParcelStatusSetup: React.FC = () => {
    const [statuses, setStatuses] = useState<ParcelStatusConfig[]>([]);
    const [loading, setLoading] = useState(false);

    const [label, setLabel] = useState('');
    const [color, setColor] = useState('bg-gray-100 text-gray-800');
    const [order, setOrder] = useState(1);
    const [isDefault, setIsDefault] = useState(false);
    const [triggersRevenue, setTriggersRevenue] = useState(false);
    const [isTerminal, setIsTerminal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Confirmation States
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [showSeedConfirm, setShowSeedConfirm] = useState(false);

    const loadStatuses = async () => {
        setLoading(true);
        const data = await firebaseService.getParcelStatuses();
        setStatuses(data);
        if (!editingId) setOrder(data.length + 1);
        setLoading(false);
    };

    useEffect(() => {
        loadStatuses();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const config: ParcelStatusConfig = {
                id: editingId || `ps-stat-${Date.now()}`,
                label,
                color,
                order,
                isDefault,
                triggersRevenue,
                isTerminal
            };
            await firebaseService.saveParcelStatus(config);
            resetForm();
            await loadStatuses();
            toast.success(editingId ? "Status updated." : "Status created.");
        } catch (e) {
            toast.error("Failed to save status");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setLabel('');
        setColor('bg-gray-100 text-gray-800');
        setOrder(statuses.length + 1);
        setIsDefault(false);
        setTriggersRevenue(false);
        setIsTerminal(false);
    };

    const handleEdit = (s: ParcelStatusConfig) => {
        setEditingId(s.id);
        setLabel(s.label);
        setColor(s.color);
        setOrder(s.order);
        setIsDefault(s.isDefault);
        setTriggersRevenue(s.triggersRevenue);
        setIsTerminal(s.isTerminal);
    };

    const handleDelete = (id: string) => {
        setConfirmDeleteId(id);
    };

    const executeDelete = async (id: string) => {
        try {
            await firebaseService.deleteParcelStatus(id);
            await loadStatuses();
            toast.success("Status deleted.");
        } catch (e) {
            toast.error("Failed to delete status.");
        } finally {
            setConfirmDeleteId(null);
        }
    };

    const handleSeed = () => {
        setShowSeedConfirm(true);
    };

    const executeSeed = async () => {
        try {
            await firebaseService.seedDefaultParcelStatuses();
            await loadStatuses();
            toast.success("Default statuses restored.");
        } catch (e) {
            toast.error("Failed to restore defaults.");
        } finally {
            setShowSeedConfirm(false);
        }
    };

    const colors = [
        { label: 'Neutral Gray', val: 'bg-gray-100 text-gray-800' },
        { label: 'Active Blue', val: 'bg-blue-100 text-blue-800' },
        { label: 'Success Green', val: 'bg-green-100 text-green-800' },
        { label: 'Warning Yellow', val: 'bg-yellow-100 text-yellow-800' },
        { label: 'Danger Red', val: 'bg-red-100 text-red-800' },
        { label: 'Orange', val: 'bg-orange-100 text-orange-800' },
        { label: 'Purple', val: 'bg-purple-100 text-purple-800' },
        { label: 'Teal', val: 'bg-teal-100 text-teal-800' },
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
                <Card title={editingId ? "Edit Status" : "Create Custom Status"}>
                    <form onSubmit={handleSave} className="space-y-4">
                        <Input label="Status Label" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Returned to Hub" required />
                        <Input label="Order Sequence" type="number" value={order} onChange={e => setOrder(parseInt(e.target.value))} required />

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Badge Color</label>
                            <div className="grid grid-cols-4 gap-2">
                                {colors.map(c => (
                                    <button
                                        key={c.label}
                                        type="button"
                                        onClick={() => setColor(c.val)}
                                        className={`h-8 rounded-lg border transition-all ${c.val.split(' ')[0]} ${color === c.val ? 'ring-2 ring-offset-2 ring-indigo-500 border-indigo-500 scale-105' : 'border-transparent hover:scale-105'}`}
                                        title={c.label}
                                    />
                                ))}
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                                <span className="text-xs text-gray-500">Preview:</span>
                                <span className={`text-xs px-2 py-1 rounded font-bold ${color}`}>{label || 'Status Label'}</span>
                            </div>
                        </div>

                        <div className="space-y-3 pt-3 border-t border-gray-100">
                            <label className="flex items-start space-x-2 cursor-pointer">
                                <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="mt-1 rounded text-indigo-600 focus:ring-indigo-500" />
                                <div>
                                    <span className="text-sm font-medium text-gray-900">Is Default</span>
                                    <p className="text-xs text-gray-500">New bookings start with this status.</p>
                                </div>
                            </label>

                            <label className="flex items-start space-x-2 cursor-pointer">
                                <input type="checkbox" checked={triggersRevenue} onChange={e => setTriggersRevenue(e.target.checked)} className="mt-1 rounded text-indigo-600 focus:ring-indigo-500" />
                                <div>
                                    <span className="text-sm font-medium text-green-700">Triggers Revenue</span>
                                    <p className="text-xs text-gray-500">Creates a journal entry when assigned.</p>
                                </div>
                            </label>

                            <label className="flex items-start space-x-2 cursor-pointer">
                                <input type="checkbox" checked={isTerminal} onChange={e => setIsTerminal(e.target.checked)} className="mt-1 rounded text-indigo-600 focus:ring-indigo-500" />
                                <div>
                                    <span className="text-sm font-medium text-gray-900">Is Terminal</span>
                                    <p className="text-xs text-gray-500">Marks the workflow as complete.</p>
                                </div>
                            </label>
                        </div>

                        <div className="flex justify-end space-x-2 pt-4">
                            {editingId && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}
                            <Button type="submit" isLoading={loading}>{editingId ? 'Update Status' : 'Add Status'}</Button>
                        </div>
                    </form>
                </Card>

                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-500 mb-2">Need to restore standard workflow?</p>
                    <button
                        onClick={() => setShowSeedConfirm(true)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
                    >
                        Reset to System Defaults
                    </button>
                </div>
            </div>

            <div className="lg:col-span-2">
                <Card title="Workflow Configuration">
                    {statuses.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="text-gray-500 mb-4">No statuses defined yet.</p>
                            <Button onClick={() => setShowSeedConfirm(true)}>Seed Default Statuses</Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12">Seq</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status Badge</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Automation Rules</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {statuses.map(s => (
                                        <tr key={s.id} className="hover:bg-gray-50 group">
                                            <td className="px-4 py-3 text-sm text-gray-500 font-mono">{s.order}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${s.color}`}>
                                                    {s.label}
                                                </span>
                                                {s.isDefault && <span className="ml-2 text-[10px] text-gray-400 font-medium uppercase tracking-wide border border-gray-200 px-1 rounded bg-gray-50">Default</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-2">
                                                    {s.triggersRevenue && <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] rounded border border-green-100 font-medium">Revenue</span>}
                                                    {s.isTerminal && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded border border-gray-200 font-medium">End State</span>}
                                                    {!s.triggersRevenue && !s.isTerminal && <span className="text-gray-300 text-[10px]">-</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm font-medium space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEdit(s)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                                {confirmDeleteId === s.id ? (
                                                    <div className="inline-flex gap-2 ml-2">
                                                        <button onClick={() => executeDelete(s.id)} className="text-red-900 bg-red-100 px-2 py-0.5 rounded text-xs font-bold">Confirm</button>
                                                        <button onClick={() => setConfirmDeleteId(null)} className="text-gray-500 text-xs">Cancel</button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setConfirmDeleteId(s.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>

                {/* Seed Confirmation Modal */}
                {showSeedConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 p-4">
                        <div className="bg-white rounded-xl p-6 w-full max-w-sm">
                            <h3 className="font-bold text-lg mb-2 text-indigo-900">Restore Defaults?</h3>
                            <p className="text-gray-600 mb-6 text-sm">
                                This will reset/create the default parcel statuses. Any custom status logic might be affected.
                            </p>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => setShowSeedConfirm(false)} className="flex-1 justify-center">Cancel</Button>
                                <Button onClick={executeSeed} className="flex-1 justify-center bg-indigo-600 hover:bg-indigo-700 text-white">Restore</Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
