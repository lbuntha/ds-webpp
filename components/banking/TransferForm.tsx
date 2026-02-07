import React, { useState, useEffect, useMemo } from 'react';
import { Account, Branch, JournalEntry, AccountType, AccountSubType, CurrencyConfig } from '../../src/shared/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { getFriendlyErrorMessage } from '../../src/shared/utils/errorUtils';

interface Props {
    accounts: Account[];
    branches: Branch[];
    currencies?: CurrencyConfig[];
    onSave: (entry: JournalEntry) => Promise<void>;
    onCancel: () => void;
}

export const TransferForm: React.FC<Props> = ({ accounts, branches, currencies = [], onSave, onCancel }) => {
    // Default currencies fallback
    const activeCurrencies = currencies.length > 0 ? currencies : [
        { id: 'curr-usd', code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1, isBase: true },
        { id: 'curr-khr', code: 'KHR', name: 'Khmer Riel', symbol: '៛', exchangeRate: 4100, isBase: false }
    ];

    const [fromAccountId, setFromAccountId] = useState('');
    const [toAccountId, setToAccountId] = useState('');

    // Transaction Fields
    const [amount, setAmount] = useState<number>(0);
    const [currencyCode, setCurrencyCode] = useState<string>('USD');
    const [exchangeRate, setExchangeRate] = useState<number>(1);

    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [reference, setReference] = useState('');
    const [description, setDescription] = useState('');
    const [branchId, setBranchId] = useState(branches[0]?.id || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const assetAccounts = accounts.filter(a =>
        a.type === AccountType.ASSET &&
        (a.subType === AccountSubType.CURRENT_ASSET || a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('cash')) &&
        !a.isHeader
    );

    // Auto-detect currency and rate when account changes
    useEffect(() => {
        // If both accounts share a currency (e.g. KHR), default to that
        if (fromAccountId && toAccountId) {
            const fromAcc = accounts.find(a => a.id === fromAccountId);
            const toAcc = accounts.find(a => a.id === toAccountId);

            if (fromAcc?.currency && toAcc?.currency && fromAcc.currency === toAcc.currency) {
                setCurrencyCode(fromAcc.currency);
            }
        }
    }, [fromAccountId, toAccountId]);

    // Determine Official System Rate
    const systemRate = useMemo(() => {
        const c = activeCurrencies.find(cur => cur.code === currencyCode);
        return c ? c.exchangeRate : 1;
    }, [currencyCode, activeCurrencies]);

    // Update Exchange Rate when currency changes
    useEffect(() => {
        setExchangeRate(systemRate);
    }, [currencyCode, systemRate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!fromAccountId || !toAccountId || amount <= 0) {
            setError("Please fill in all required fields.");
            return;
        }
        if (fromAccountId === toAccountId) {
            setError("Source and Destination accounts cannot be the same.");
            return;
        }

        const safeRate = exchangeRate || 1;
        if (safeRate <= 0) {
            setError("Exchange rate must be valid.");
            return;
        }

        setLoading(true);

        const fromAccName = accounts.find(a => a.id === fromAccountId)?.name;
        const toAccName = accounts.find(a => a.id === toAccountId)?.name;
        const autoDesc = description || `Transfer from ${fromAccName} to ${toAccName}`;

        // Base Amount calculation (for the ledger)
        const baseAmount = amount / safeRate;

        const entry: JournalEntry = {
            id: `je-trans-${Date.now()}`,
            date,
            description: autoDesc,
            reference: reference || `TRF-${Date.now().toString().slice(-6)}`,
            branchId,
            currency: currencyCode,
            exchangeRate: safeRate,
            originalTotal: amount,
            createdAt: Date.now(),
            lines: [
                {
                    accountId: toAccountId,
                    debit: baseAmount,
                    credit: 0,
                    // Track original amounts for proper Native Balance display in BankingDashboard
                    originalCurrency: currencyCode,
                    originalExchangeRate: safeRate,
                    originalDebit: amount,
                    originalCredit: 0
                },
                {
                    accountId: fromAccountId,
                    debit: 0,
                    credit: baseAmount,
                    originalCurrency: currencyCode,
                    originalExchangeRate: safeRate,
                    originalDebit: 0,
                    originalCredit: amount
                }
            ]
        };

        try {
            await onSave(entry);
        } catch (e) {
            console.error(e);
            setError(getFriendlyErrorMessage(e));
        } finally {
            setLoading(false);
        }
    };

    const isBaseCurrency = activeCurrencies.find(c => c.code === currencyCode)?.isBase;

    return (
        <Card title="Transfer Funds">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                        <label className="block text-sm font-bold text-red-800 mb-2">From (Source Account)</label>
                        <select
                            className="block w-full px-3 py-2 border border-red-200 rounded-lg shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm bg-white"
                            value={fromAccountId}
                            onChange={e => setFromAccountId(e.target.value)}
                            required
                        >
                            <option value="">Select Account</option>
                            {assetAccounts.map(a => (
                                <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.currency || 'USD'})</option>
                            ))}
                        </select>
                        <p className="text-xs text-red-600 mt-1">Account will be Credited</p>
                    </div>

                    <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                        <label className="block text-sm font-bold text-green-800 mb-2">To (Destination Account)</label>
                        <select
                            className="block w-full px-3 py-2 border border-green-200 rounded-lg shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm bg-white"
                            value={toAccountId}
                            onChange={e => setToAccountId(e.target.value)}
                            required
                        >
                            <option value="">Select Account</option>
                            {assetAccounts.map(a => (
                                <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.currency || 'USD'})</option>
                            ))}
                        </select>
                        <p className="text-xs text-green-600 mt-1">Account will be Debited</p>
                    </div>
                </div>

                {/* Currency & Amount */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Currency</label>
                        <select
                            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            value={currencyCode}
                            onChange={e => setCurrencyCode(e.target.value)}
                        >
                            {activeCurrencies.map(c => (
                                <option key={c.id} value={c.code}>{c.code} - {c.name}</option>
                            ))}
                        </select>
                    </div>
                    <Input
                        label="Amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={amount}
                        onChange={e => setAmount(parseFloat(e.target.value))}
                        required
                        className="font-bold text-gray-900"
                    />

                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Exchange Rate (to USD)</label>
                        <Input
                            type="number"
                            step="any"
                            value={exchangeRate}
                            onChange={e => setExchangeRate(parseFloat(e.target.value))}
                            disabled={isBaseCurrency}
                            required
                        />
                        {!isBaseCurrency && (
                            <div className="mt-1 flex justify-between items-center">
                                <span className="text-[10px] text-gray-500">System: {systemRate}</span>
                                {exchangeRate !== systemRate && (
                                    <button
                                        type="button"
                                        onClick={() => setExchangeRate(systemRate)}
                                        className="text-[10px] text-indigo-600 hover:text-indigo-800 underline"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {!isBaseCurrency && (
                        <p className="text-xs text-gray-500 col-span-3">
                            Approx Base Value: ${(amount / exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                        label="Date"
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        required
                    />
                    <Input
                        label="Reference #"
                        value={reference}
                        onChange={e => setReference(e.target.value)}
                        placeholder="Optional"
                    />
                    <div className="md:col-span-3">
                        <Input
                            label="Description"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="e.g. Monthly operating cash transfer"
                        />
                    </div>

                    <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                        <select
                            className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={branchId}
                            onChange={e => setBranchId(e.target.value)}
                        >
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                    <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button type="submit" isLoading={loading}>Submit for Approval</Button>
                </div>
            </form>
        </Card>
    );
};
