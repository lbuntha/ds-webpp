import React, { useState, useMemo } from 'react';
import { Account, JournalEntry, SystemSettings, AccountType, Branch, CurrencyConfig, Invoice, Bill } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { AccountingService, HealthIssue } from '../../src/shared/services/accountingService';
import { JournalEntryForm } from '../JournalEntryForm';
import { toast } from '../../src/shared/utils/toast';
import { firebaseService } from '../../src/shared/services/firebaseService';

interface Props {
    settings: SystemSettings;
    accounts: Account[];
    transactions: JournalEntry[];
    branches: Branch[];
    currencies: CurrencyConfig[];
    invoices?: Invoice[];
    bills?: Bill[];
    onUpdateSettings: (settings: SystemSettings) => Promise<void>;
    onPostClosingEntry: (entry: JournalEntry) => Promise<void>;
    onDeleteAccount?: (id: string) => Promise<void>;
}

export const ClosingDashboard: React.FC<Props> = ({
    settings, accounts, transactions, branches, currencies, invoices = [], bills = [], onUpdateSettings, onPostClosingEntry, onDeleteAccount
}) => {
    const [activeTab, setActiveTab] = useState<'MONTH_END' | 'YEAR_END' | 'ADJUSTMENTS'>('MONTH_END');

    // Month End State
    const [lockDate, setLockDate] = useState(settings.lockDate || '');
    const [generateMonthEndEntry, setGenerateMonthEndEntry] = useState(false);
    const [runDepreciation, setRunDepreciation] = useState(false);
    const [monthLoading, setMonthLoading] = useState(false);

    // Checklist State
    const [checklist, setChecklist] = useState({
        bankRec: false,
        inventory: false,
        depreciationReview: false,
        draftReview: false
    });

    // Year End State
    const [closingYear, setClosingYear] = useState(new Date().getFullYear() - 1);
    const [yearLoading, setYearLoading] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    // Adjustment State
    const [adjLoading, setAdjLoading] = useState(false);

    // Deletion State
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteConfirmData, setDeleteConfirmData] = useState<{ id: string, usageCount: number } | null>(null);

    // Adjustment Confirmation State
    const [pendingAdjustmentEntry, setPendingAdjustmentEntry] = useState<JournalEntry | null>(null);

    // --- HEALTH CHECK ---
    const healthIssues = useMemo(() => {
        // Pass invoices and bills to included advanced checks (duplicates, unposted items)
        return AccountingService.validateLedgerHealth(transactions, accounts, invoices, bills);
    }, [transactions, accounts, invoices, bills]);

    const criticalHealthErrors = healthIssues.filter(i => i.severity === 'CRITICAL');
    const warningHealthIssues = healthIssues.filter(i => i.severity === 'WARNING');

    const isHealthOk = criticalHealthErrors.length === 0;
    const isChecklistComplete = Object.values(checklist).every(v => v === true);
    const isReadyToClose = isHealthOk && isChecklistComplete && lockDate !== '';

    // --- RESOLUTION HANDLERS ---
    const handleDeleteDuplicate = (accId: string) => {
        if (!onDeleteAccount) return;
        const usageCount = (transactions || []).filter(t => t.lines.some(l => l.accountId === accId)).length;
        setDeleteConfirmData({ id: accId, usageCount });
    };

    const executeDeleteDuplicate = async () => {
        if (!deleteConfirmData || !onDeleteAccount) return;

        setDeletingId(deleteConfirmData.id);
        try {
            await onDeleteAccount(deleteConfirmData.id);
            setDeleteConfirmData(null);
        } catch (e: any) {
            toast.error(`Failed to delete account: ${e.message}`);
        } finally {
            setDeletingId(null);
        }
    };

    // Check if an account is used in any transaction lines
    const isAccountUsed = (accId: string) => {
        return (transactions || []).some(t => t.lines.some(l => l.accountId === accId));
    };

    // --- MONTH END LOGIC ---
    const handleLockDateSave = async () => {
        if (!isReadyToClose) return;

        setMonthLoading(true);
        try {
            // 1. Run Depreciation if selected
            if (runDepreciation && lockDate && firebaseService.runBatchDepreciation) {
                try {
                    const result = await firebaseService.runBatchDepreciation(lockDate);
                    if (result.processed > 0) {
                        toast.success(`Successfully depreciated ${result.processed} assets. Total: $${result.totalAmount.toFixed(2)}.`);
                    } else {
                        // console.log("No assets required depreciation for this month.");
                    }
                } catch (depError: any) {
                    // console.error("Depreciation failed during closing:", depError);
                    toast.warning(`Warning: Depreciation failed (${depError.message}). The period has NOT been locked. Please fix the error and try again.`);
                    setMonthLoading(false);
                    return; // Stop closing if depreciation fails
                }
            }

            // 2. Generate Closing Entry if selected
            if (generateMonthEndEntry && lockDate) {
                // Calculate start of month based on selected lock date
                // Assuming lock date is end of month, we take yyyy-mm-01
                const startOfMonth = lockDate.substring(0, 8) + '01';

                // Find RE account
                const retainedEarningsAccount = accounts.find(a =>
                    a.type === AccountType.EQUITY &&
                    (a.code === '3020' || a.name.toLowerCase().includes('retained earnings'))
                );

                if (!retainedEarningsAccount) {
                    toast.error("Error: Could not find Retained Earnings account (Code 3020) to post closing entry.");
                } else {
                    const closingEntry = AccountingService.generatePeriodClosingEntry(
                        startOfMonth,
                        lockDate,
                        accounts,
                        transactions,
                        retainedEarningsAccount.id
                    );

                    if (closingEntry) {
                        await onPostClosingEntry(closingEntry);
                    }
                }
            }

            // 3. Lock Period
            await onUpdateSettings({ ...settings, lockDate: lockDate });
            toast.success("Period lock date updated successfully.");
        } catch (e: any) {
            // console.error(e);
            toast.error(`Failed to update lock date: ${e.message}`);
        } finally {
            setMonthLoading(false);
        }
    };

    // --- YEAR END LOGIC ---
    // Find Retained Earnings Account
    const retainedEarningsAccount = accounts.find(a =>
        a.type === AccountType.EQUITY &&
        (a.code === '3020' || a.name.toLowerCase().includes('retained earnings'))
    );

    const previewClosing = useMemo(() => {
        if (!retainedEarningsAccount) return null;
        return AccountingService.generatePeriodClosingEntry(
            `${closingYear}-01-01`,
            `${closingYear}-12-31`,
            accounts,
            transactions,
            retainedEarningsAccount.id
        );
    }, [closingYear, accounts, transactions, retainedEarningsAccount]);

    const handleYearEndClose = async () => {
        if (!previewClosing) return;

        setYearLoading(true);
        try {
            // 1. Post the Closing Entry
            await onPostClosingEntry(previewClosing);

            // 2. Lock the Period to the end of that year
            const yearEndDate = `${closingYear}-12-31`;
            await onUpdateSettings({ ...settings, lockDate: yearEndDate });

            toast.success(`Fiscal Year ${closingYear} closed successfully. Period locked through ${yearEndDate}.`);
            setShowConfirmation(false);
            setLockDate(yearEndDate); // Update local state to reflect change
        } catch (e) {
            // console.error(e);
            toast.error("Failed to close fiscal year.");
        } finally {
            setYearLoading(false);
        }
    };

    // --- POST CLOSING ADJUSTMENT LOGIC ---
    const executeAdjustmentTheHardWay = async () => {
        if (!pendingAdjustmentEntry) return;
        const currentLockDate = settings.lockDate;

        setAdjLoading(true);
        try {
            // 1. Temporarily Unlock
            await onUpdateSettings({ ...settings, lockDate: undefined });

            // 2. Post Transaction
            await onPostClosingEntry(pendingAdjustmentEntry);

            // 3. Re-Lock
            await onUpdateSettings({ ...settings, lockDate: currentLockDate });

            toast.success("Adjustment posted successfully. Period has been re-locked.");
            setActiveTab('MONTH_END'); // Go back to main screen
        } catch (e: any) {
            // console.error(e);
            toast.error(`Error during adjustment process: ${e.message}. Check if period is locked.`);
            // Attempt to restore lock if it failed halfway
            try { await onUpdateSettings({ ...settings, lockDate: currentLockDate }); } catch (e2) { }
        } finally {
            setAdjLoading(false);
            setPendingAdjustmentEntry(null);
        }
    };

    const handleAdjustmentSubmit = async (entry: JournalEntry) => {
        const currentLockDate = settings.lockDate;

        // Check if the entry falls into a locked period
        if (currentLockDate && entry.date <= currentLockDate) {
            setPendingAdjustmentEntry(entry);
            return;
        } else {
            // Standard Post
            await onPostClosingEntry(entry);
            toast.success("Transaction posted successfully.");
            setActiveTab('MONTH_END');
        }
    };

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-gray-100 max-w-fit">
                <button
                    onClick={() => setActiveTab('MONTH_END')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'MONTH_END' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    Month-End Closing
                </button>
                <button
                    onClick={() => setActiveTab('YEAR_END')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'YEAR_END' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    Year-End Closing
                </button>
                <button
                    onClick={() => setActiveTab('ADJUSTMENTS')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'ADJUSTMENTS' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    Adjustments
                </button>
            </div>

            {activeTab === 'MONTH_END' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column: Configuration */}
                    <Card title="1. Closing Configuration">
                        <div className="mb-6">
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-yellow-700">
                                            Current Lock Date: <strong>{settings.lockDate || 'None'}</strong>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <label className="block text-sm font-medium text-gray-700 mb-2">Close Books Through</label>
                            <input
                                type="date"
                                className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                value={lockDate}
                                onChange={(e) => setLockDate(e.target.value)}
                            />
                            <p className="text-xs text-gray-400 mt-2">
                                All transactions on or before this date will become read-only.
                            </p>
                        </div>

                        <div className="space-y-4 border-t border-gray-100 pt-4">
                            <label className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    checked={runDepreciation}
                                    onChange={(e) => setRunDepreciation(e.target.checked)}
                                />
                                <div>
                                    <span className="text-sm text-gray-700 font-medium block">Run Monthly Depreciation</span>
                                    <span className="text-xs text-gray-500">Calculates and posts depreciation for all active assets.</span>
                                </div>
                            </label>

                            <label className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    checked={generateMonthEndEntry}
                                    onChange={(e) => setGenerateMonthEndEntry(e.target.checked)}
                                />
                                <div>
                                    <span className="text-sm text-gray-700 font-medium block">Generate P&L Closing Entry</span>
                                    <span className="text-xs text-gray-500">Zeros out Revenue/Expenses to Retained Earnings.</span>
                                </div>
                            </label>
                        </div>
                    </Card>

                    {/* Right Column: Health Check & Checklist */}
                    <div className="space-y-6">
                        <Card title="2. System Health & Validation">
                            <div className="space-y-4">
                                {/* System Health Check */}
                                <div className={`p-4 rounded-lg border ${isHealthOk ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                    <div className="flex items-start">
                                        <div className="flex-shrink-0 mt-0.5">
                                            {isHealthOk ? (
                                                <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                            ) : (
                                                <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                            )}
                                        </div>
                                        <div className="ml-3 w-full">
                                            <h3 className={`text-sm font-bold ${isHealthOk ? 'text-green-800' : 'text-red-800'}`}>
                                                {isHealthOk ? 'Ledger Integrity: Passed' : 'Ledger Integrity: Errors Found'}
                                            </h3>
                                            {!isHealthOk && (
                                                <ul className="mt-2 list-disc list-inside text-xs text-red-700 space-y-1">
                                                    {criticalHealthErrors.slice(0, 5).map((err, i) => (
                                                        <li key={i}>{err.message}</li>
                                                    ))}
                                                    {criticalHealthErrors.length > 5 && <li>...and {criticalHealthErrors.length - 5} more errors.</li>}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Warnings (Duplicate Codes, Unposted, etc) */}
                                {warningHealthIssues.length > 0 ? (
                                    <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                                        <h4 className="text-sm font-bold text-orange-800 flex items-center">
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                            Data Quality Warnings
                                        </h4>
                                        <ul className="mt-2 space-y-3 text-xs text-orange-700">
                                            {warningHealthIssues.map((w, i) => (
                                                <li key={i} className="pb-4 border-b border-orange-200 last:border-0">
                                                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                                        <div className="flex-1">
                                                            <p className="font-semibold">{w.message}</p>
                                                            {w.type === 'DUPLICATE_COA' && (
                                                                <div className="mt-1">
                                                                    <p className="text-orange-600/80 mb-2">Review the accounts below. Keep the one that is correct/used.</p>
                                                                    {w.meta?.accounts && onDeleteAccount && (
                                                                        <div className="w-full flex flex-col space-y-2">
                                                                            {w.meta.accounts.map((dupAcc: Account) => {
                                                                                const isUsed = isAccountUsed(dupAcc.id);
                                                                                return (
                                                                                    <div key={dupAcc.id} className="flex items-center justify-between p-2 bg-white/60 rounded border border-orange-200/50">
                                                                                        <div className="flex items-center space-x-2">
                                                                                            <span className="text-xs font-bold text-gray-800">{dupAcc.name}</span>
                                                                                            <span className="text-[10px] font-mono text-gray-500">...{dupAcc.id.slice(-6)}</span>
                                                                                        </div>
                                                                                        <div className="flex items-center space-x-2">
                                                                                            {isUsed ? (
                                                                                                <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">Used</span>
                                                                                            ) : (
                                                                                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">Unused</span>
                                                                                            )}
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={(e) => { e.stopPropagation(); handleDeleteDuplicate(dupAcc.id); }}
                                                                                                disabled={!!deletingId}
                                                                                                className={`text-xs px-2 py-1 rounded border transition-colors ${isUsed ? 'bg-white border-red-200 text-red-600 hover:bg-red-50' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-red-600'}`}
                                                                                            >
                                                                                                {deletingId === dupAcc.id ? '...' : 'Delete'}
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                        <p className="text-xs text-orange-600 mt-4 font-medium">Review these items before closing the period.</p>
                                    </div>
                                ) : (
                                    <div className="text-xs text-gray-500 flex items-center pl-1">
                                        <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                        No unposted documents or duplicate accounts found.
                                    </div>
                                )}
                            </div>
                        </Card>

                        <Card title="3. Pre-Closing Checklist">
                            <div className="space-y-3">
                                <label className="flex items-start space-x-3 text-sm text-gray-700 cursor-pointer">
                                    <input type="checkbox" className="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300" checked={checklist.bankRec} onChange={e => setChecklist({ ...checklist, bankRec: e.target.checked })} />
                                    <span>Bank accounts reconciled with actual statements.</span>
                                </label>
                                <label className="flex items-start space-x-3 text-sm text-gray-700 cursor-pointer">
                                    <input type="checkbox" className="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300" checked={checklist.inventory} onChange={e => setChecklist({ ...checklist, inventory: e.target.checked })} />
                                    <span>Physical inventory count matched with system (if applicable).</span>
                                </label>
                                <label className="flex items-start space-x-3 text-sm text-gray-700 cursor-pointer">
                                    <input type="checkbox" className="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300" checked={checklist.depreciationReview} onChange={e => setChecklist({ ...checklist, depreciationReview: e.target.checked })} />
                                    <span>Fixed assets reviewed for additions/disposals.</span>
                                </label>
                                <label className="flex items-start space-x-3 text-sm text-gray-700 cursor-pointer">
                                    <input type="checkbox" className="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300" checked={checklist.draftReview} onChange={e => setChecklist({ ...checklist, draftReview: e.target.checked })} />
                                    <span>Draft invoices/bills reviewed or deleted.</span>
                                </label>
                            </div>

                            <div className="mt-6 pt-4 border-t border-gray-100">
                                <Button
                                    onClick={handleLockDateSave}
                                    isLoading={monthLoading}
                                    disabled={!isReadyToClose}
                                    className="w-full"
                                >
                                    {!isHealthOk ? 'Fix Ledger Errors to Proceed' :
                                        !isChecklistComplete ? 'Complete Checklist to Proceed' :
                                            !lockDate ? 'Select Date to Proceed' :
                                                'Run Processes & Lock Period'}
                                </Button>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {activeTab === 'YEAR_END' && (
                <div className="space-y-6">
                    <Card title="Fiscal Year Closing">
                        <p className="text-sm text-gray-500 mb-6">
                            This process will generate a closing journal entry to zero out all Revenue and Expense accounts for the selected year and transfer the Net Income/Loss to Retained Earnings.
                            Finally, it will lock the period through the end of the year.
                        </p>

                        {!retainedEarningsAccount && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
                                <strong>Error:</strong> Could not find a "Retained Earnings" account (Type: Equity, Code: 3020). Please add this account in Settings before closing the year.
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Select Fiscal Year</label>
                                <select
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={closingYear}
                                    onChange={(e) => { setClosingYear(parseInt(e.target.value)); setShowConfirmation(false); }}
                                >
                                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Preview Closing Entry ({closingYear})</h3>
                            {previewClosing ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Date:</span>
                                        <span className="font-medium">{previewClosing.date}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Description:</span>
                                        <span className="font-medium">{previewClosing.description}</span>
                                    </div>

                                    <div className="border rounded-lg bg-white overflow-hidden mt-4">
                                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="px-4 py-2 text-left">Account</th>
                                                    <th className="px-4 py-2 text-right">Debit</th>
                                                    <th className="px-4 py-2 text-right">Credit</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {previewClosing.lines.map((line, idx) => {
                                                    const acc = accounts.find(a => a.id === line.accountId);
                                                    return (
                                                        <tr key={idx}>
                                                            <td className="px-4 py-2 text-gray-700">
                                                                {acc ? `${acc.code} - ${acc.name}` : line.accountId}
                                                                {acc?.id === retainedEarningsAccount?.id && <span className="ml-2 text-xs bg-green-100 text-green-800 px-1.5 rounded">Retained Earnings</span>}
                                                            </td>
                                                            <td className="px-4 py-2 text-right text-gray-600">
                                                                {line.debit > 0 ? line.debit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                                                            </td>
                                                            <td className="px-4 py-2 text-right text-gray-600">
                                                                {line.credit > 0 ? line.credit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                <tr className="bg-gray-50 font-bold">
                                                    <td className="px-4 py-2">Total</td>
                                                    <td className="px-4 py-2 text-right">
                                                        {previewClosing.lines.reduce((s, l) => s + l.debit, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        {previewClosing.lines.reduce((s, l) => s + l.credit, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {showConfirmation ? (
                                        <div className="mt-6 bg-red-50 p-4 rounded-xl border border-red-200">
                                            <h4 className="text-red-800 font-bold mb-2">Confirm Year-End Closing</h4>
                                            <p className="text-sm text-red-700 mb-4">
                                                This action will post the journal entry above and <strong>LOCK</strong> the system through {closingYear}-12-31.
                                                This cannot be easily undone.
                                            </p>
                                            <div className="flex space-x-3">
                                                <Button variant="danger" onClick={handleYearEndClose} isLoading={yearLoading}>
                                                    Confirm & Close Books
                                                </Button>
                                                <Button variant="outline" onClick={() => setShowConfirmation(false)}>
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-6 flex justify-end">
                                            <Button onClick={() => setShowConfirmation(true)} disabled={!retainedEarningsAccount}>
                                                Close Fiscal Year {closingYear}
                                            </Button>
                                        </div>
                                    )}

                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    No income statement activity found for {closingYear}.
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            )}

            {activeTab === 'ADJUSTMENTS' && (
                <div className="space-y-6">
                    <div className="bg-orange-50 border-l-4 border-orange-400 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-orange-700 font-bold">
                                    Post-Closing Adjustment Mode
                                </p>
                                <p className="text-sm text-orange-700 mt-1">
                                    This tool allows you to fix forgotten transactions from a closed period.
                                    Submitting this form will <strong>automatically unlock</strong> the period, post the entry, and <strong>re-lock</strong> the period immediately.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="border border-gray-200 rounded-2xl bg-white p-1">
                        {adjLoading ? (
                            <div className="p-12 text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                                <p className="text-gray-600">Processing Adjustment (Unlock → Post → Relock)...</p>
                            </div>
                        ) : (
                            <JournalEntryForm
                                accounts={accounts}
                                branches={branches}
                                currencies={currencies}
                                onSubmit={handleAdjustmentSubmit}
                                onCancel={() => setActiveTab('MONTH_END')}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Delete Duplicate Confirmation Modal */}
            {deleteConfirmData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-fade-in-up">
                        <div className="flex justify-center mb-4">
                            <div className="bg-red-100 p-3 rounded-full">
                                <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Delete Duplicate Account?</h3>

                        {deleteConfirmData.usageCount > 0 ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-left">
                                <p className="text-xs font-bold text-red-800 mb-1">CRITICAL WARNING:</p>
                                <p className="text-xs text-red-700">
                                    This account is used in <strong>{deleteConfirmData.usageCount} transactions</strong>.
                                    Deleting it will create orphaned records and cause Health Check failures.
                                </p>
                            </div>
                        ) : (
                            <p className="text-center text-gray-600 mb-6 text-sm">
                                Are you sure you want to delete this unused duplicate account? This cannot be undone.
                            </p>
                        )}

                        <div className="flex space-x-3">
                            <Button variant="outline" onClick={() => setDeleteConfirmData(null)} className="w-full justify-center">
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                onClick={executeDeleteDuplicate}
                                className="w-full justify-center bg-red-600 hover:bg-red-700 text-white"
                                isLoading={!!deletingId}
                            >
                                {deleteConfirmData.usageCount > 0 ? 'Force Delete' : 'Confirm Delete'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Adjustment Confirmation Modal */}
            {pendingAdjustmentEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 animate-fade-in-up">
                        <div className="flex justify-center mb-4">
                            <div className="bg-yellow-100 p-3 rounded-full">
                                <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Post to Closed Period?</h3>

                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                            <p className="text-sm text-yellow-800 mb-2">
                                <strong>WARNING:</strong> The transaction date ({pendingAdjustmentEntry.date}) is within a <strong>LOCKED</strong> period (Locked until {settings.lockDate}).
                            </p>
                            <p className="text-xs text-yellow-700">
                                Proceeding will temporarily unlock the period, post this adjustment, and immediately re-lock it.
                            </p>
                        </div>

                        <div className="flex space-x-3">
                            <Button variant="outline" onClick={() => setPendingAdjustmentEntry(null)} className="w-full justify-center">
                                Cancel
                            </Button>
                            <Button
                                onClick={executeAdjustmentTheHardWay}
                                className="w-full justify-center bg-yellow-600 hover:bg-yellow-700 text-white"
                                isLoading={adjLoading}
                            >
                                Unlock & Post
                            </Button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
