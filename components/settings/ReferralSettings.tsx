import React, { useState, useEffect } from 'react';
import { ReferralRule } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';

export const ReferralSettings: React.FC = () => {
    const [rules, setRules] = useState<ReferralRule[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form
    const [name, setName] = useState('');
    const [trigger, setTrigger] = useState<'FIRST_ORDER' | 'ORDER_MILESTONE'>('FIRST_ORDER');
    const [milestoneCount, setMilestoneCount] = useState(1);
    const [expiryDays, setExpiryDays] = useState(0);

    const [referrerAmount, setReferrerAmount] = useState(0);
    const [referrerCurrency, setReferrerCurrency] = useState<'USD' | 'KHR'>('USD');

    const [refereeAmount, setRefereeAmount] = useState(0);
    const [refereeCurrency, setRefereeCurrency] = useState<'USD' | 'KHR'>('USD');

    const [isActive, setIsActive] = useState(true);

    // Deletion confirm state
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const loadRules = async () => {
        setLoading(true);
        try {
            const data = await firebaseService.getReferralRules();
            setRules(data);
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
        setName('');
        setTrigger('FIRST_ORDER');
        setMilestoneCount(1);
        setExpiryDays(0);
        setReferrerAmount(0);
        setRefereeAmount(0);
        setIsActive(true);
    };

    const handleEdit = (rule: ReferralRule) => {
        setEditingId(rule.id);
        setName(rule.name);
        setTrigger(rule.trigger);
        setMilestoneCount(rule.milestoneCount || 1);
        setExpiryDays(rule.expiryDays || 0);
        setReferrerAmount(rule.referrerAmount);
        setReferrerCurrency(rule.referrerCurrency);
        setRefereeAmount(rule.refereeAmount);
        setRefereeCurrency(rule.refereeCurrency);
        setIsActive(rule.isActive);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;

        setLoading(true);
        try {
            const rule: ReferralRule = {
                id: editingId || `rule-${Date.now()}`,
                name,
                isActive,
                trigger,
                milestoneCount: trigger === 'ORDER_MILESTONE' ? milestoneCount : 1,
                expiryDays,
                referrerAmount,
                referrerCurrency,
                refereeAmount,
                refereeCurrency
            };
            await firebaseService.saveReferralRule(rule);
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
            await firebaseService.deleteReferralRule(id);
            await loadRules();
            toast.success("Rule deleted.");
        } catch (e) {
            toast.error("Failed to delete rule.");
        } finally {
            setConfirmDeleteId(null);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
                <Card title={editingId ? "Edit Rule" : "Create Referral Rule"}>
                    <form onSubmit={handleSave} className="space-y-4">
                        <Input label="Rule Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. First Order Bonus" required />

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Event</label>
                            <select
                                className="block w-full px-3 py-2 border rounded-lg text-sm"
                                value={trigger}
                                onChange={e => setTrigger(e.target.value as any)}
                            >
                                <option value="FIRST_ORDER">Referee's First Order</option>
                                <option value="ORDER_MILESTONE">Order Milestone (e.g. 5th)</option>
                            </select>
                        </div>

                        {trigger === 'ORDER_MILESTONE' && (
                            <Input label="Milestone Count" type="number" value={milestoneCount} onChange={e => setMilestoneCount(Number(e.target.value))} />
                        )}

                        <Input
                            label="Expiry (Days from Signup)"
                            type="number"
                            value={expiryDays}
                            onChange={e => setExpiryDays(Number(e.target.value))}
                            placeholder="0 = No Expiry"
                        />
                        <p className="text-xs text-gray-500 -mt-2">Order must be completed within this many days of user registration.</p>

                        <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 space-y-3">
                            <p className="text-xs font-bold text-indigo-800 uppercase">Referrer Reward (Existing User)</p>
                            <div className="flex gap-2">
                                <input className="flex-1 border rounded-lg px-2 py-1 text-sm" type="number" value={referrerAmount} onChange={e => setReferrerAmount(parseFloat(e.target.value))} />
                                <select className="border rounded-lg px-2 py-1 text-sm" value={referrerCurrency} onChange={e => setReferrerCurrency(e.target.value as any)}>
                                    <option value="USD">USD</option>
                                    <option value="KHR">KHR</option>
                                </select>
                            </div>
                        </div>

                        <div className="bg-green-50 p-3 rounded-lg border border-green-100 space-y-3">
                            <p className="text-xs font-bold text-green-800 uppercase">Referee Reward (New User)</p>
                            <div className="flex gap-2">
                                <input className="flex-1 border rounded-lg px-2 py-1 text-sm" type="number" value={refereeAmount} onChange={e => setRefereeAmount(parseFloat(e.target.value))} />
                                <select className="border rounded-lg px-2 py-1 text-sm" value={refereeCurrency} onChange={e => setRefereeCurrency(e.target.value as any)}>
                                    <option value="USD">USD</option>
                                    <option value="KHR">KHR</option>
                                </select>
                            </div>
                        </div>

                        <label className="flex items-center space-x-2 pt-2">
                            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded text-indigo-600" />
                            <span className="text-sm font-medium">Rule Active</span>
                        </label>

                        <div className="flex justify-end space-x-2 pt-2">
                            {editingId && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}
                            <Button type="submit" isLoading={loading}>{editingId ? 'Update' : 'Create'}</Button>
                        </div>
                    </form>
                </Card>
            </div>

            <div className="lg:col-span-2">
                <Card title="Active Referral Rules">
                    <div className="space-y-3">
                        {rules.map(rule => (
                            <div key={rule.id} className={`flex justify-between items-center p-4 border rounded-xl bg-white ${rule.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-gray-900">{rule.name}</h4>
                                        {!rule.isActive && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">Inactive</span>}
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">
                                        When: <span className="font-medium">{rule.trigger === 'FIRST_ORDER' ? '1st Order' : `${rule.milestoneCount}th Order`}</span>
                                        {rule.expiryDays ? ` within ${rule.expiryDays} days` : ''}
                                    </p>
                                    <div className="flex gap-4 mt-2 text-xs">
                                        <span className="text-indigo-600 font-bold">Referrer: {rule.referrerAmount} {rule.referrerCurrency}</span>
                                        <span className="text-green-600 font-bold">Referee: {rule.refereeAmount} {rule.refereeCurrency}</span>
                                    </div>
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
                        {rules.length === 0 && <p className="text-center py-8 text-gray-500">No rules configured.</p>}
                    </div>
                </Card>
            </div>
        </div>
    );
};
