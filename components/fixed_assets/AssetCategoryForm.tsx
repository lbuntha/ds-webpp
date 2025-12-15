

import React, { useState } from 'react';
import { FixedAssetCategory, Account, AccountType, AccountSubType } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { toast } from '../../src/shared/utils/toast';

interface Props {
    initialData?: FixedAssetCategory;
    accounts: Account[];
    onSave: (category: FixedAssetCategory) => Promise<void>;
    onCancel: () => void;
}

export const AssetCategoryForm: React.FC<Props> = ({ initialData, accounts, onSave, onCancel }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [usefulLife, setUsefulLife] = useState(initialData?.usefulLifeYears || 5);
    const [method, setMethod] = useState<'STRAIGHT_LINE' | 'DECLINING_BALANCE'>(initialData?.method || 'STRAIGHT_LINE');

    // GL Accounts
    const [assetAccountId, setAssetAccountId] = useState(initialData?.assetAccountId || '');
    const [accumDepAccountId, setAccumDepAccountId] = useState(initialData?.accumDepAccountId || '');
    const [depExpenseAccountId, setDepExpenseAccountId] = useState(initialData?.depExpenseAccountId || '');
    const [gainLossAccountId, setGainLossAccountId] = useState(initialData?.gainLossAccountId || '');
    const [writeOffAccountId, setWriteOffAccountId] = useState(initialData?.writeOffAccountId || '');

    const [loading, setLoading] = useState(false);

    // Filters
    const assetAccounts = accounts.filter(a => a.type === AccountType.ASSET && !a.isHeader);
    const expenseAccounts = accounts.filter(a => a.type === AccountType.EXPENSE && !a.isHeader);
    // For Gain/Loss, typically Other Revenue (8xxx) or Other Expense (8xxx)
    const otherAccounts = accounts.filter(a => (a.type === AccountType.REVENUE || a.type === AccountType.EXPENSE) && !a.isHeader);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !assetAccountId || !accumDepAccountId || !depExpenseAccountId) {
            toast.warning("Please complete all required fields.");
            return;
        }

        setLoading(true);
        try {
            await onSave({
                id: initialData?.id || `fac-${Date.now()}`,
                name,
                usefulLifeYears: usefulLife,
                method,
                assetAccountId,
                accumDepAccountId,
                depExpenseAccountId,
                gainLossAccountId,
                writeOffAccountId
            });
        } catch (e) {
            console.error(e);
            toast.error("Failed to save category.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card title={initialData ? 'Edit Category' : 'New Asset Category'}>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <Input label="Category Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Computer Equipment" required />
                    </div>
                    <Input
                        label="Default Useful Life (Years)"
                        type="number"
                        value={usefulLife}
                        onChange={e => setUsefulLife(parseFloat(e.target.value))}
                        required
                    />
                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Depreciation Method</label>
                        <select
                            className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            value={method}
                            onChange={e => setMethod(e.target.value as any)}
                        >
                            <option value="STRAIGHT_LINE">Straight Line</option>
                            <option value="DECLINING_BALANCE">Declining Balance (Not yet auto-calculated)</option>
                        </select>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Default GL Mapping</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Asset Account (Cost)</label>
                            <select className="w-full border rounded-lg p-2 text-sm" value={assetAccountId} onChange={e => setAssetAccountId(e.target.value)} required>
                                <option value="">Select Account</option>
                                {assetAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                            </select>
                        </div>
                        <div className="w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Accum. Depreciation Account</label>
                            <select className="w-full border rounded-lg p-2 text-sm" value={accumDepAccountId} onChange={e => setAccumDepAccountId(e.target.value)} required>
                                <option value="">Select Account</option>
                                {assetAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                            </select>
                        </div>
                        <div className="w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Depreciation Expense Account</label>
                            <select className="w-full border rounded-lg p-2 text-sm" value={depExpenseAccountId} onChange={e => setDepExpenseAccountId(e.target.value)} required>
                                <option value="">Select Account</option>
                                {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                            </select>
                        </div>
                        <div className="w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Gain/Loss on Sale</label>
                            <select className="w-full border rounded-lg p-2 text-sm" value={gainLossAccountId} onChange={e => setGainLossAccountId(e.target.value)}>
                                <option value="">Select Account</option>
                                {otherAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Used when selling asset.</p>
                        </div>
                        <div className="w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Asset Write-Off (Loss)</label>
                            <select className="w-full border rounded-lg p-2 text-sm" value={writeOffAccountId} onChange={e => setWriteOffAccountId(e.target.value)}>
                                <option value="">Select Account</option>
                                {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Used when scrapping asset.</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-2">
                    <Button variant="outline" type="button" onClick={onCancel}>Cancel</Button>
                    <Button type="submit" isLoading={loading}>{initialData ? 'Update Category' : 'Create Category'}</Button>
                </div>
            </form>
        </Card>
    );
};