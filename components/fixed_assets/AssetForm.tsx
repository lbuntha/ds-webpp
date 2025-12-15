
import React, { useState, useEffect } from 'react';
import { Account, Branch, FixedAsset, AccountType, AccountSubType, FixedAssetCategory, DepreciationMethod } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { toast } from '../../src/shared/utils/toast';

interface Props {
    initialData?: FixedAsset;
    accounts: Account[];
    branches: Branch[];
    categories: FixedAssetCategory[];
    onSave: (asset: FixedAsset, purchaseDetails?: { paymentAccountId: string, reference: string }) => Promise<void>;
    onCancel: () => void;
}

export const AssetForm: React.FC<Props> = ({ initialData, accounts, branches, categories, onSave, onCancel }) => {
    const [name, setName] = useState(initialData?.assetName || '');
    const [code, setCode] = useState(initialData?.assetCode || '');
    const [serial, setSerial] = useState(initialData?.serialNumber || '');
    const [branchId, setBranchId] = useState(initialData?.branchId || branches[0]?.id || '');

    // Category State
    const [categoryId, setCategoryId] = useState(initialData?.categoryId || '');

    const [purchaseDate, setPurchaseDate] = useState(initialData?.purchaseDate || new Date().toISOString().split('T')[0]);
    const [cost, setCost] = useState(initialData?.cost || 0);
    const [salvageValue, setSalvageValue] = useState(initialData?.salvageValue || 0);
    const [lifeYears, setLifeYears] = useState(initialData?.usefulLifeYears || 5);
    const [depreciationMethod, setDepreciationMethod] = useState<DepreciationMethod>(initialData?.depreciationMethod || 'STRAIGHT_LINE');

    // GL Accounts
    const defaultAssetAcc = accounts.find(a => a.code === '1500')?.id || '';
    const defaultAccumDepAcc = accounts.find(a => a.code === '1590')?.id || '';
    const defaultExpAcc = accounts.find(a => a.code === '6060')?.id || '';

    const [assetAccountId, setAssetAccountId] = useState(initialData?.assetAccountId || defaultAssetAcc);
    const [accumDepAccountId, setAccumDepAccountId] = useState(initialData?.accumDepAccountId || defaultAccumDepAcc);
    const [depExpenseAccountId, setDepExpenseAccountId] = useState(initialData?.depExpenseAccountId || defaultExpAcc);

    // Purchase Transaction State (New Assets Only)
    const [createPurchaseEntry, setCreatePurchaseEntry] = useState(false);
    const [paymentAccountId, setPaymentAccountId] = useState('');
    const [txnReference, setTxnReference] = useState('');

    const [loading, setLoading] = useState(false);

    // Filter lists
    const assetAccounts = accounts.filter(a => a.type === AccountType.ASSET && !a.isHeader);
    const expenseAccounts = accounts.filter(a => a.type === AccountType.EXPENSE && !a.isHeader);

    // Payment Accounts (Cash/Bank)
    const paymentAccounts = accounts.filter(a =>
        a.type === AccountType.ASSET &&
        (a.subType === AccountSubType.CURRENT_ASSET || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')) &&
        !a.isHeader
    );

    // Auto-fill when category changes
    const handleCategoryChange = (newCatId: string) => {
        setCategoryId(newCatId);
        const cat = categories.find(c => c.id === newCatId);
        if (cat) {
            setLifeYears(cat.usefulLifeYears);
            setDepreciationMethod(cat.method);
            if (cat.assetAccountId) setAssetAccountId(cat.assetAccountId);
            if (cat.accumDepAccountId) setAccumDepAccountId(cat.accumDepAccountId);
            if (cat.depExpenseAccountId) setDepExpenseAccountId(cat.depExpenseAccountId);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!name || !code || !assetAccountId || !accumDepAccountId || !depExpenseAccountId) {
            toast.warning("Please fill all required fields.");
            return;
        }

        if (createPurchaseEntry && !paymentAccountId) {
            toast.warning("Please select a Payment Account for the purchase transaction.");
            return;
        }

        setLoading(true);
        try {
            const asset: FixedAsset = {
                id: initialData?.id || `fa-${Date.now()}`,
                assetName: name,
                assetCode: code,
                serialNumber: serial,
                categoryId: categoryId || undefined,
                branchId,
                purchaseDate,
                cost,
                salvageValue,
                usefulLifeYears: lifeYears,
                depreciationMethod,
                assetAccountId,
                accumDepAccountId,
                depExpenseAccountId,
                status: initialData?.status || 'ACTIVE',
                accumulatedDepreciation: initialData?.accumulatedDepreciation || 0,
                bookValue: initialData ? initialData.bookValue : cost,
                lastDepreciationDate: initialData?.lastDepreciationDate,
                createdAt: initialData?.createdAt || Date.now()
            };

            const purchaseDetails = createPurchaseEntry ? {
                paymentAccountId,
                reference: txnReference
            } : undefined;

            await onSave(asset, purchaseDetails);
        } catch (e) {
            console.error(e);
            toast.error("Failed to save asset.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card title={initialData ? 'Edit Asset' : 'Register New Asset'}>
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Category Selection */}
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-4">
                    <label className="block text-sm font-medium text-indigo-900 mb-1">Asset Category (Optional Template)</label>
                    <select
                        className="block w-full px-3 py-2 border border-indigo-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                        value={categoryId}
                        onChange={e => handleCategoryChange(e.target.value)}
                    >
                        <option value="">-- Custom / No Category --</option>
                        {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name} (Life: {c.usefulLifeYears}y)</option>
                        ))}
                    </select>
                    <p className="text-xs text-indigo-700 mt-1">Selecting a category auto-fills Useful Life and Accounting Codes.</p>
                </div>

                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Asset Name" value={name} onChange={e => setName(e.target.value)} required />
                    <Input label="Asset Code" value={code} onChange={e => setCode(e.target.value)} required />
                    <Input label="Serial Number" value={serial} onChange={e => setSerial(e.target.value)} />
                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                        <select
                            className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            value={branchId}
                            onChange={e => setBranchId(e.target.value)}
                        >
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Financials */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Financial & Depreciation</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Input
                            label="Purchase Date"
                            type="date"
                            value={purchaseDate}
                            onChange={e => setPurchaseDate(e.target.value)}
                            required
                        />
                        <Input
                            label="Cost"
                            type="number"
                            step="0.01"
                            value={cost}
                            onChange={e => setCost(parseFloat(e.target.value))}
                            required
                        />
                        <Input
                            label="Salvage Value"
                            type="number"
                            step="0.01"
                            value={salvageValue}
                            onChange={e => setSalvageValue(parseFloat(e.target.value))}
                        />
                        <Input
                            label="Useful Life (Years)"
                            type="number"
                            value={lifeYears}
                            onChange={e => setLifeYears(parseFloat(e.target.value))}
                            required
                        />
                    </div>
                    <div className="mt-4 w-full md:w-1/2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Depreciation Method</label>
                        <select
                            className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            value={depreciationMethod}
                            onChange={e => setDepreciationMethod(e.target.value as DepreciationMethod)}
                        >
                            <option value="STRAIGHT_LINE">Straight Line (Cost - Salvage) / Life</option>
                            <option value="DECLINING_BALANCE">Declining Balance (Book Value * Rate)</option>
                        </select>
                    </div>
                </div>

                {/* Accounting */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fixed Asset Account</label>
                        <select
                            className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            value={assetAccountId}
                            onChange={e => setAssetAccountId(e.target.value)}
                            required
                        >
                            <option value="">Select Asset Account</option>
                            {assetAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                    </div>
                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Accum. Dep. Account</label>
                        <select
                            className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            value={accumDepAccountId}
                            onChange={e => setAccumDepAccountId(e.target.value)}
                            required
                        >
                            <option value="">Select Contra Asset</option>
                            {assetAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                    </div>
                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dep. Expense Account</label>
                        <select
                            className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            value={depExpenseAccountId}
                            onChange={e => setDepExpenseAccountId(e.target.value)}
                            required
                        >
                            <option value="">Select Expense</option>
                            {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Purchase Entry Option - Only for New Assets */}
                {!initialData && (
                    <div className="bg-green-50 p-4 rounded-xl border border-green-200 mt-6">
                        <div className="flex items-center mb-4">
                            <input
                                id="createPurchase"
                                type="checkbox"
                                className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded cursor-pointer"
                                checked={createPurchaseEntry}
                                onChange={e => setCreatePurchaseEntry(e.target.checked)}
                            />
                            <label htmlFor="createPurchase" className="ml-3 text-sm font-bold text-green-800 cursor-pointer">
                                Record Purchase Transaction (Journal Entry)
                            </label>
                        </div>

                        {createPurchaseEntry && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-8 animate-fade-in-up">
                                <div className="w-full">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Paid From (Credit Account)</label>
                                    <select
                                        className="block w-full px-3 py-2 border border-green-300 rounded-xl shadow-sm focus:outline-none focus:ring-green-500 sm:text-sm bg-white"
                                        value={paymentAccountId}
                                        onChange={e => setPaymentAccountId(e.target.value)}
                                        required={createPurchaseEntry}
                                    >
                                        <option value="">Select Bank / Cash</option>
                                        {paymentAccounts.map(a => (
                                            <option key={a.id} value={a.id}>{a.name} ({a.currency || 'USD'})</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">Money will be deducted from this account.</p>
                                </div>
                                <div className="w-full">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Reference / Invoice #</label>
                                    <input
                                        className="block w-full px-3 py-2 border border-green-300 rounded-xl shadow-sm focus:outline-none focus:ring-green-500 sm:text-sm"
                                        value={txnReference}
                                        onChange={e => setTxnReference(e.target.value)}
                                        placeholder="Optional"
                                    />
                                </div>
                                <div className="col-span-2 text-xs text-green-700 bg-green-100 p-2 rounded border border-green-200">
                                    <strong>Note:</strong> This will create a Journal Entry crediting the selected bank account and debiting the Fixed Asset account ({cost.toLocaleString()} USD).
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-end space-x-2 pt-4 border-t border-gray-100">
                    <Button variant="outline" type="button" onClick={onCancel}>Cancel</Button>
                    <Button type="submit" isLoading={loading}>{initialData ? 'Update Asset' : createPurchaseEntry ? 'Register & Pay' : 'Register Asset'}</Button>
                </div>
            </form>
        </Card>
    );
};
