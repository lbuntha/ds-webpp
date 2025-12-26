import React, { useState, useEffect, useMemo } from 'react';
import { Account, Branch, JournalEntry, JournalEntryLine, CurrencyConfig } from '../src/shared/types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { AccountingService } from '../src/shared/services/accountingService';
import { ImageUpload } from './ui/ImageUpload';
import { getFriendlyErrorMessage } from '../src/shared/utils/errorUtils';

interface Props {
    accounts: Account[];
    branches: Branch[];
    currencies?: CurrencyConfig[];
    onSubmit: (entry: JournalEntry) => Promise<void>;
    onSaveDraft?: (entry: JournalEntry) => Promise<void>;
    onCancel: () => void;
    initialData?: JournalEntry;
}

// Simplified FormLine - we only track Original amounts in state
// Base amounts are calculated derived from Header Exchange Rate
interface FormLine {
    accountId: string;
    description: string;
    debitOrig: number;
    creditOrig: number;
}

export const JournalEntryForm: React.FC<Props> = ({ accounts, branches, currencies = [], onSubmit, onSaveDraft, onCancel, initialData }) => {
    // Filter out Header accounts - they cannot be posted to
    const postableAccounts = accounts.filter(a => !a.isHeader);

    // Default currencies fallback
    const activeCurrencies = currencies.length > 0 ? currencies : [
        { id: 'curr-usd', code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1, isBase: true }
    ];

    const baseCurrency = activeCurrencies.find(c => c.isBase) || activeCurrencies[0];

    const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState(initialData?.description || '');
    const [reference, setReference] = useState(initialData?.reference || '');
    const [relatedDocumentId, setRelatedDocumentId] = useState(initialData?.relatedDocumentId || '');
    const [branchId, setBranchId] = useState(initialData?.branchId || branches[0]?.id || '');
    const [attachment, setAttachment] = useState(initialData?.attachment || '');

    // Transaction Currency State
    const [currency, setCurrency] = useState<string>(initialData?.currency || baseCurrency.code);
    const [exchangeRate, setExchangeRate] = useState<number>(initialData?.exchangeRate || 1);

    // Determine the Official System Rate from Collection
    const systemRate = useMemo(() => {
        const c = activeCurrencies.find(cur => cur.code === currency);
        return c ? c.exchangeRate : 1;
    }, [currency, activeCurrencies]);

    // Initialize Lines
    const [lines, setLines] = useState<FormLine[]>(() => {
        if (initialData) {
            return initialData.lines.map(l => ({
                accountId: l.accountId,
                description: l.description || '',
                // If editing, load original values. If legacy data without orig, fallback to base.
                debitOrig: l.originalDebit !== undefined ? l.originalDebit : l.debit,
                creditOrig: l.originalCredit !== undefined ? l.originalCredit : l.credit,
            }));
        }
        return [
            { accountId: '', description: '', debitOrig: 0, creditOrig: 0 },
            { accountId: '', description: '', debitOrig: 0, creditOrig: 0 }
        ];
    });

    const [loading, setLoading] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isBaseCurrency = activeCurrencies.find(c => c.code === currency)?.isBase;

    const handleCurrencyChange = (newCurrency: string) => {
        setCurrency(newCurrency);
        // When currency changes, default to the system rate from collection
        const newSystemRate = activeCurrencies.find(c => c.code === newCurrency)?.exchangeRate || 1;
        setExchangeRate(newSystemRate);
    };

    const handleLineChange = (index: number, field: keyof FormLine, value: any) => {
        const newLines = [...lines];
        newLines[index] = { ...newLines[index], [field]: value };
        setLines(newLines);
    };

    const addLine = () => {
        setLines([...lines, {
            accountId: '',
            description: '',
            debitOrig: 0,
            creditOrig: 0,
        }]);
    };

    const removeLine = (index: number) => {
        if (lines.length > 1) {
            setLines(lines.filter((_, i) => i !== index));
        }
    };

    // Derived Totals
    const totals = useMemo(() => {
        const safeRate = exchangeRate || 1;

        // Totals in Original Currency (FCY)
        const totalDebitOrig = lines.reduce((sum, line) => sum + (line.debitOrig || 0), 0);
        const totalCreditOrig = lines.reduce((sum, line) => sum + (line.creditOrig || 0), 0);

        // Totals in Base Currency (LCY - USD)
        const totalDebitBase = totalDebitOrig / safeRate;
        const totalCreditBase = totalCreditOrig / safeRate;

        // Check balance in Original Currency (cleaner numbers usually)
        const isBalanced = Math.abs(totalDebitOrig - totalCreditOrig) < 0.01;
        const diff = Math.abs(totalDebitOrig - totalCreditOrig);

        return { totalDebitOrig, totalCreditOrig, totalDebitBase, totalCreditBase, isBalanced, diff };
    }, [lines, exchangeRate]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!totals.isBalanced) {
            setError(`Journal is not balanced. Difference: ${totals.diff.toLocaleString()} ${currency}`);
            return;
        }

        if (lines.some(l => !l.accountId)) {
            setError('All lines must have an account selected.');
            return;
        }

        if (exchangeRate <= 0) {
            setError('Exchange rate must be greater than 0.');
            return;
        }

        const finalLines: JournalEntryLine[] = lines.map(l => ({
            accountId: l.accountId,
            description: l.description || undefined,
            // Base Amounts (The Ledger Value / LCY) - Recorded permanently based on rate at time of saving
            debit: l.debitOrig / exchangeRate,
            credit: l.creditOrig / exchangeRate,
            // Original Amounts (The Input Value / FCY)
            originalCurrency: currency,
            originalExchangeRate: exchangeRate,
            originalDebit: l.debitOrig,
            originalCredit: l.creditOrig
        }));

        const entry: JournalEntry = {
            id: initialData?.id || `je-${Date.now()}`,
            date,
            description,
            reference,
            relatedDocumentId: relatedDocumentId.trim() || undefined,
            branchId,
            currency: currency,
            exchangeRate: exchangeRate,
            originalTotal: totals.totalDebitOrig,
            lines: finalLines,
            createdAt: initialData?.createdAt || Date.now(),
            attachment: attachment || undefined
        };

        if (!AccountingService.validateEntry(entry)) {
            setError('Journal Entry is unbalanced in base currency (Debits != Credits). Please adjust amounts.');
            return;
        }

        try {
            setLoading(true);
            await onSubmit(entry);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setError(getFriendlyErrorMessage(err));
            setLoading(false);
        }
    };

    const handleSaveDraft = async () => {
        if (!onSaveDraft) return;
        setError(null);

        // Draft allows unbalanced entries but still needs accounts
        if (lines.some(l => !l.accountId)) {
            setError('All lines must have an account selected.');
            return;
        }

        if (exchangeRate <= 0) {
            setError('Exchange rate must be greater than 0.');
            return;
        }

        const finalLines: JournalEntryLine[] = lines.map(l => ({
            accountId: l.accountId,
            description: l.description || undefined,
            debit: l.debitOrig / exchangeRate,
            credit: l.creditOrig / exchangeRate,
            originalCurrency: currency,
            originalExchangeRate: exchangeRate,
            originalDebit: l.debitOrig,
            originalCredit: l.creditOrig
        }));

        const entry: JournalEntry = {
            id: initialData?.id || `je-${Date.now()}`,
            date,
            description,
            reference,
            relatedDocumentId: relatedDocumentId.trim() || undefined,
            branchId,
            currency: currency,
            exchangeRate: exchangeRate,
            originalTotal: totals.totalDebitOrig,
            lines: finalLines,
            createdAt: initialData?.createdAt || Date.now(),
            attachment: attachment || undefined
        };

        try {
            setSavingDraft(true);
            await onSaveDraft(entry);
            setSavingDraft(false);
        } catch (err) {
            console.error(err);
            setError(getFriendlyErrorMessage(err));
            setSavingDraft(false);
        }
    };

    return (
        <Card title={initialData ? "Edit Journal Entry" : "New Journal Entry"}>
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Header Configuration */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Transaction Header</h3>
                        {!isBaseCurrency && (
                            <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded border border-blue-200">
                                Recording Foreign Currency Transaction
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Input
                            label="Date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                        />
                        <div className="w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Currency (FCY)</label>
                            <select
                                className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                value={currency}
                                onChange={(e) => handleCurrencyChange(e.target.value)}
                            >
                                {activeCurrencies.map(c => (
                                    <option key={c.id} value={c.code}>{c.code} - {c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Exchange Rate</label>
                            <div className="relative rounded-md shadow-sm">
                                <input
                                    type="number"
                                    step="any"
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={exchangeRate}
                                    onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                                    disabled={isBaseCurrency}
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 sm:text-xs">
                                        {currency}/{baseCurrency.code}
                                    </span>
                                </div>
                            </div>
                            {!isBaseCurrency && (
                                <div className="mt-1 flex justify-between items-center">
                                    <span className="text-[10px] text-gray-500">System Rate: {systemRate}</span>
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

                        <div className="w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                            <select
                                className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                value={branchId}
                                onChange={(e) => setBranchId(e.target.value)}
                            >
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                        <div className="md:col-span-1">
                            <Input
                                label="Reference #"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="e.g. INV-2024-001"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <Input
                                label="Description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Transaction details..."
                                required
                            />
                        </div>
                        <div className="md:col-span-1">
                            <Input
                                label="Linked Doc ID"
                                value={relatedDocumentId}
                                onChange={(e) => setRelatedDocumentId(e.target.value)}
                                placeholder="Optional system ID"
                            />
                        </div>
                    </div>

                    <div className="mt-4">
                        <ImageUpload
                            label="Attachment (Supporting Document)"
                            value={attachment}
                            onChange={setAttachment}
                        />
                    </div>
                </div>

                {/* Lines */}
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <div className="min-w-[1000px] bg-white">
                            <div className={`grid gap-2 p-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider ${!isBaseCurrency ? 'grid-cols-12' : 'grid-cols-10'}`}>
                                <div className="col-span-3">Account</div>
                                <div className="col-span-3">Description</div>

                                {/* FCY Columns */}
                                <div className="col-span-2 text-right">Debit ({currency})</div>
                                <div className="col-span-2 text-right">Credit ({currency})</div>

                                {/* LCY Preview Columns (Only if foreign currency) */}
                                {!isBaseCurrency && (
                                    <>
                                        <div className="col-span-1 text-right text-indigo-300">Base Dr</div>
                                        <div className="col-span-1 text-right text-indigo-300">Base Cr</div>
                                    </>
                                )}
                            </div>

                            {lines.map((line, index) => {
                                const debitBasePreview = (line.debitOrig || 0) / (exchangeRate || 1);
                                const creditBasePreview = (line.creditOrig || 0) / (exchangeRate || 1);

                                return (
                                    <div key={index} className={`grid gap-2 p-2 border-b border-gray-100 items-start hover:bg-gray-50 transition-colors ${!isBaseCurrency ? 'grid-cols-12' : 'grid-cols-10'}`}>
                                        <div className="col-span-3">
                                            <select
                                                className="block w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                                value={line.accountId}
                                                onChange={(e) => handleLineChange(index, 'accountId', e.target.value)}
                                            >
                                                <option value="">Select Account</option>
                                                {postableAccounts.map(acc => (
                                                    <option key={acc.id} value={acc.id}>
                                                        {acc.code} - {acc.name} ({acc.currency || 'USD'})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="col-span-3">
                                            <input
                                                type="text"
                                                className="block w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                                value={line.description}
                                                onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                                                placeholder="Line details..."
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                min="0"
                                                step="any"
                                                className="block w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:ring-indigo-500 focus:border-indigo-500 font-medium text-gray-900"
                                                value={line.debitOrig || ''}
                                                onChange={(e) => handleLineChange(index, 'debitOrig', parseFloat(e.target.value) || 0)}
                                                placeholder="0.00"
                                            />
                                        </div>

                                        <div className="col-span-2 relative">
                                            <input
                                                type="number"
                                                min="0"
                                                step="any"
                                                className="block w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:ring-indigo-500 focus:border-indigo-500 font-medium text-gray-900"
                                                value={line.creditOrig || ''}
                                                onChange={(e) => handleLineChange(index, 'creditOrig', parseFloat(e.target.value) || 0)}
                                                placeholder="0.00"
                                            />
                                            {/* Remove button absolutely positioned at end of row if base currency */}
                                            {isBaseCurrency && lines.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeLine(index)}
                                                    className="absolute -right-8 top-2 text-gray-400 hover:text-red-600"
                                                >
                                                    &times;
                                                </button>
                                            )}
                                        </div>

                                        {!isBaseCurrency && (
                                            <>
                                                <div className="col-span-1 text-right py-1.5 text-xs text-gray-400 font-mono">
                                                    {debitBasePreview > 0 ? debitBasePreview.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'}
                                                </div>
                                                <div className="col-span-1 text-right py-1.5 text-xs text-gray-400 font-mono relative">
                                                    {creditBasePreview > 0 ? creditBasePreview.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'}
                                                    {lines.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeLine(index)}
                                                            className="absolute -right-6 top-1 text-gray-400 hover:text-red-600 font-bold text-lg"
                                                            title="Remove Line"
                                                        >
                                                            &times;
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 flex justify-between items-center border-t border-gray-200">
                        <Button type="button" variant="secondary" onClick={addLine} className="text-xs flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                            Add Line
                        </Button>

                        <div className="flex space-x-8 text-right">
                            <div>
                                <span className="block text-xs text-gray-500 uppercase tracking-wide">Total FCY ({currency})</span>
                                <span className={`block text-lg font-bold ${totals.isBalanced ? 'text-gray-800' : 'text-red-600'}`}>
                                    {totals.totalDebitOrig.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            {!isBaseCurrency && (
                                <div>
                                    <span className="block text-xs text-indigo-500 uppercase tracking-wide">Total LCY ({baseCurrency.code})</span>
                                    <span className={`block text-lg font-bold ${totals.isBalanced ? 'text-indigo-700' : 'text-red-400'}`}>
                                        {totals.totalDebitBase.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center">
                        <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        {error}
                    </div>
                )}

                <div className="flex justify-end space-x-3">
                    <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                    {onSaveDraft && !initialData?.status && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleSaveDraft}
                            disabled={savingDraft || loading}
                            isLoading={savingDraft}
                        >
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Save as Draft
                        </Button>
                    )}
                    <Button type="submit" disabled={!totals.isBalanced || loading || savingDraft} isLoading={loading}>
                        {initialData ? (
                            <>
                                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Update & Submit
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Submit for Approval
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </Card>
    );
};
