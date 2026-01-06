import React, { useState, useEffect } from 'react';
import { TelegramGroup } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';
import { TelegramMessageLog } from './TelegramMessageLog';
import { TelegramBroadcast } from './TelegramBroadcast';

export const TelegramGroupSettings: React.FC = () => {
    const [activeSubTab, setActiveSubTab] = useState<'GROUPS' | 'LOGS' | 'BROADCAST'>('GROUPS');
    const [groups, setGroups] = useState<TelegramGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form
    const [name, setName] = useState('');
    const [chatTitle, setChatTitle] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [monitorPayWay, setMonitorPayWay] = useState(true);

    // Deletion confirm state
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const loadGroups = async () => {
        setLoading(true);
        try {
            const data = await firebaseService.getTelegramGroups();
            setGroups(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadGroups();
    }, []);

    const resetForm = () => {
        setEditingId(null);
        setName('');
        setChatTitle('');
        setIsActive(true);
        setMonitorPayWay(true);
    };

    const handleEdit = (group: TelegramGroup) => {
        setEditingId(group.id);
        setName(group.name);
        setChatTitle(group.chatTitle);
        setIsActive(group.isActive);
        setMonitorPayWay(group.monitorPayWay);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !chatTitle) {
            toast.error("Name and Chat Title are required");
            return;
        }

        setLoading(true);
        try {
            const group: TelegramGroup = {
                id: editingId || `tg-${Date.now()}`,
                name,
                chatTitle,
                isActive,
                monitorPayWay,
                createdAt: editingId ? (groups.find(g => g.id === editingId)?.createdAt || Date.now()) : Date.now(),
                updatedAt: Date.now()
            };
            await firebaseService.saveTelegramGroup(group);
            resetForm();
            await loadGroups();
            toast.success(editingId ? "Group updated." : "Group added.");
        } catch (e) {
            toast.error("Failed to save group");
        } finally {
            setLoading(false);
        }
    };

    const executeDelete = async (id: string) => {
        try {
            await firebaseService.deleteTelegramGroup(id);
            await loadGroups();
            toast.success("Group deleted.");
        } catch (e) {
            toast.error("Failed to delete group.");
        } finally {
            setConfirmDeleteId(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Sub-tabs */}
            <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-gray-100 max-w-fit">
                <button
                    onClick={() => setActiveSubTab('GROUPS')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeSubTab === 'GROUPS' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    Groups
                </button>
                <button
                    onClick={() => setActiveSubTab('LOGS')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeSubTab === 'LOGS' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                    Message Log
                </button>
                <button
                    onClick={() => setActiveSubTab('BROADCAST')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeSubTab === 'BROADCAST' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                    Broadcast
                </button>
            </div>

            {/* Groups Tab */}
            {activeSubTab === 'GROUPS' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1">
                        <Card title={editingId ? "Edit Telegram Group" : "Add Telegram Group"}>
                            <form onSubmit={handleSave} className="space-y-4">
                                <Input
                                    label="Display Name"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. PayWay Notifications"
                                    required
                                />

                                <Input
                                    label="Telegram Chat Title"
                                    value={chatTitle}
                                    onChange={e => setChatTitle(e.target.value)}
                                    placeholder="Exact group name in Telegram"
                                    required
                                />
                                <p className="text-xs text-gray-500 -mt-2">
                                    This must match the exact group name as it appears in Telegram.
                                </p>

                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 space-y-3">
                                    <p className="text-xs font-bold text-blue-800 uppercase">Monitoring Options</p>

                                    <label className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            checked={monitorPayWay}
                                            onChange={e => setMonitorPayWay(e.target.checked)}
                                            className="rounded text-blue-600"
                                        />
                                        <span className="text-sm">Monitor for PayWay messages</span>
                                    </label>
                                </div>

                                <label className="flex items-center space-x-2 pt-2">
                                    <input
                                        type="checkbox"
                                        checked={isActive}
                                        onChange={e => setIsActive(e.target.checked)}
                                        className="rounded text-indigo-600"
                                    />
                                    <span className="text-sm font-medium">Group Active</span>
                                </label>

                                <div className="flex justify-end space-x-2 pt-2">
                                    {editingId && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}
                                    <Button type="submit" isLoading={loading}>{editingId ? 'Update' : 'Add Group'}</Button>
                                </div>
                            </form>
                        </Card>
                    </div>

                    <div className="lg:col-span-2">
                        <Card title="Configured Telegram Groups">
                            <div className="space-y-3">
                                {groups.map(group => (
                                    <div
                                        key={group.id}
                                        className={`flex justify-between items-center p-4 border rounded-xl bg-white ${group.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-gray-900">{group.name}</h4>
                                                {!group.isActive && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">Inactive</span>}
                                            </div>
                                            <p className="text-sm text-gray-600 mt-1">
                                                Chat: <span className="font-medium text-blue-600">{group.chatTitle}</span>
                                            </p>
                                            <div className="flex gap-4 mt-2 text-xs">
                                                {group.monitorPayWay && (
                                                    <span className="text-green-600 font-bold flex items-center gap-1">
                                                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                                        PayWay Monitoring
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <button
                                                onClick={() => handleEdit(group)}
                                                className="text-indigo-600 hover:text-indigo-900 text-sm font-medium px-2"
                                            >
                                                Edit
                                            </button>

                                            {confirmDeleteId === group.id ? (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => executeDelete(group.id)}
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
                                                    onClick={() => setConfirmDeleteId(group.id)}
                                                    className="text-red-600 hover:text-red-900 text-sm font-medium px-2"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {groups.length === 0 && (
                                    <p className="text-center py-8 text-gray-500">
                                        No telegram groups configured. Add a group to start monitoring.
                                    </p>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* Message Log Tab */}
            {activeSubTab === 'LOGS' && <TelegramMessageLog />}

            {/* Broadcast Tab */}
            {activeSubTab === 'BROADCAST' && <TelegramBroadcast />}
        </div>
    );
};

