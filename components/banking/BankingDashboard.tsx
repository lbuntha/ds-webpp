import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Account, Branch, JournalEntry, AccountType, AccountSubType, CurrencyConfig, UserProfile, WalletTransaction } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { TransferForm } from './TransferForm';
import { AccountForm } from '../AccountForm';
import { WalletRequests } from './WalletRequests';
import { WalletDirectory } from './WalletDirectory';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { Modal } from '../ui/Modal';

interface Props {
    accounts: Account[];
    transactions: JournalEntry[];
    branches: Branch[];
    currencies?: CurrencyConfig[];
    currentUser: UserProfile | null;
    onTransactionAction: (entry: JournalEntry, action: 'SUBMIT' | 'APPROVE' | 'REJECT') => Promise<void>;
    onAddAccount: (account: Account) => Promise<void>;
    pendingWalletRequests: WalletTransaction[];
}


// Extend Account type for local usage if nativeBalance is injected
interface BankingAccount extends Account {
    nativeBalance?: number;
}

export const BankingDashboard: React.FC<Props> = ({ accounts: propAccounts, transactions: propTransactions, branches, currencies = [], currentUser, onTransactionAction, onAddAccount, pendingWalletRequests = [] }) => {
    const [view, setView] = useState<'LIST' | 'TRANSFER' | 'ADD_BANK' | 'REQUESTS' | 'WALLETS' | 'APPROVALS'>('LIST');
    const [pendingCount, setPendingCount] = useState(0);
    const [approvalCount, setApprovalCount] = useState(0);
    const [collapsedCurrencies, setCollapsedCurrencies] = useState<Record<string, boolean>>({});

    // Rejection Modal State
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [selectedEntryForRejection, setSelectedEntryForRejection] = useState<JournalEntry | null>(null);

    // Approve Warning Modal State
    const [isApproveWarningOpen, setIsApproveWarningOpen] = useState(false);
    const [selectedEntryForApproval, setSelectedEntryForApproval] = useState<JournalEntry | null>(null);

    const handleRejectClick = (entry: JournalEntry) => {
        setSelectedEntryForRejection(entry);
        setRejectionReason('');
        setIsRejectModalOpen(true);
    };

    const confirmRejection = async () => {
        if (selectedEntryForRejection && rejectionReason.trim()) {
            await onTransactionAction({ ...selectedEntryForRejection, rejectionReason }, 'REJECT');
            setIsRejectModalOpen(false);
            setSelectedEntryForRejection(null);
            setRejectionReason('');
            refreshData(); // Refresh to remove Record
        }
    };

    const handleApproveClick = (entry: JournalEntry) => {
        const isOwnEntry = entry.createdBy === currentUser?.uid;
        if (isOwnEntry) {
            setSelectedEntryForApproval(entry);
            setIsApproveWarningOpen(true);
        } else {
            handleApprove(entry);
        }
    };

    const handleApprove = async (entry: JournalEntry) => {
        await onTransactionAction(entry, 'APPROVE');
        if (isApproveWarningOpen) {
            setIsApproveWarningOpen(false);
            setSelectedEntryForApproval(null);
        }
        refreshData();
    };

    const refreshData = useCallback(async () => {
        setIsRefreshing(true);
        // Simulate refresh or trigger parent reload if available
        await new Promise(resolve => setTimeout(resolve, 500));
        setLastUpdated(new Date());
        setIsRefreshing(false);
    }, []);

    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);

    const bankingAccounts = useMemo<BankingAccount[]>(() => {
        // 1. Calculate running balances per account from POSTED transactions
        const balances: Record<string, number> = {};

        propTransactions.forEach(txn => {
            if (txn.status === 'POSTED') {
                (txn.lines || []).forEach(line => {
                    const accId = line.accountId;
                    if (!balances[accId]) balances[accId] = 0;

                    // Use original currency values if available (fallback to converted if not) to always show native balance
                    const debit = line.originalDebit !== undefined ? Number(line.originalDebit) : (Number(line.debit) || 0);
                    const credit = line.originalCredit !== undefined ? Number(line.originalCredit) : (Number(line.credit) || 0);
                    // For ASSET accounts, balance increases with debit and decreases with credit
                    balances[accId] += (debit - credit);
                });
            }
        });

        // 2. Filter for Asset accounts that look like Banks or Cash, and map nativeBalance
        return propAccounts.filter(a => {
            const isAsset = a.type === AccountType.ASSET;
            const isBankOrCash = a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('settlement') || !!a.bankAccountNumber;
            return isAsset && isBankOrCash;
        }).map(a => ({
            ...a,
            nativeBalance: balances[a.id] || 0
        })) as BankingAccount[];
    }, [propAccounts, propTransactions]);

    const totalCashPosition = useMemo(() => {
        const khrRate = currencies?.find(c => c.code === 'KHR')?.exchangeRate || 4000;
        return bankingAccounts.reduce((sum, acc) => {
            const balance = acc.nativeBalance || 0;
            if (acc.currency === 'KHR') {
                return sum + (balance / khrRate);
            }
            return sum + balance; // USD or implicitly USD
        }, 0);
    }, [bankingAccounts, currencies]);

    const pendingApprovals = useMemo(() => {
        return propTransactions.filter(t => t.status === 'PENDING_APPROVAL');
    }, [propTransactions]);

    // Update counts
    useEffect(() => {
        setPendingCount(pendingWalletRequests.length);
        setApprovalCount(propTransactions.filter(t => t.status === 'PENDING_APPROVAL').length);
    }, [propTransactions, pendingWalletRequests]);

    if (view === 'APPROVALS') {
        return (
            <div>
                <div className="mb-4">
                    <button onClick={() => setView('LIST')} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        Back to Banking
                    </button>
                </div>
                <Card title="Pending Approvals">
                    {pendingApprovals.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
                            No pending approvals found.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pendingApprovals.map(entry => {
                                const isOwnEntry = entry.createdBy === currentUser?.uid;
                                return (
                                    <div key={entry.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-yellow-100 text-yellow-800">PENDING APPROVAL</span>
                                                    <span className="text-xs text-gray-500">{entry.reference}</span>
                                                </div>
                                                <h3 className="text-lg font-medium text-gray-900">{entry.description}</h3>
                                                <div className="text-sm text-gray-600 mt-1">
                                                    Created by <span className="font-semibold">{entry.createdByName || 'Unknown'}</span> on {new Date(entry.createdAt).toLocaleDateString()}
                                                </div>
                                                <div className="mt-2 text-sm text-gray-700">
                                                    Amount: <span className="font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: entry.currency }).format(entry.originalTotal || 0)}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => handleRejectClick(entry)}
                                                    >
                                                        Reject
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleApproveClick(entry)}
                                                    >
                                                        Approve
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>

                {/* Rejection Modal */}
                <Modal
                    isOpen={isRejectModalOpen}
                    onClose={() => setIsRejectModalOpen(false)}
                    title="Reject Transaction"
                >
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Please provide a reason for rejecting this transaction. This will be visible to the creator.
                        </p>
                        <textarea
                            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                            rows={4}
                            placeholder="Enter rejection reason..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                        />
                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="outline" onClick={() => setIsRejectModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                className="bg-red-600 hover:bg-red-700 text-white"
                                onClick={confirmRejection}
                                disabled={!rejectionReason.trim()}
                            >
                                Confirm Reject
                            </Button>
                        </div>
                    </div>
                </Modal>

                {/* Approve Warning Modal */}
                <Modal
                    isOpen={isApproveWarningOpen}
                    onClose={() => setIsApproveWarningOpen(false)}
                    title="Self-Approval Warning"
                >
                    <div className="space-y-4">
                        <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-amber-700">
                                        You are about to approve your own transaction.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600">
                            This is generally discouraged except for corrections or specific administrative overrides. Are you sure you want to proceed?
                        </p>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="outline" onClick={() => setIsApproveWarningOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                className="bg-amber-600 hover:bg-amber-700 text-white"
                                onClick={() => selectedEntryForApproval && handleApprove(selectedEntryForApproval)}
                            >
                                Proceed & Approve
                            </Button>
                        </div>
                    </div>
                </Modal>
            </div>
        );
    }

    if (view === 'REQUESTS') {
        return (
            <div>
                <div className="mb-4">
                    <button onClick={() => setView('LIST')} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        Back to Banking
                    </button>
                </div>
                <WalletRequests />
            </div>
        );
    }

    if (view === 'WALLETS') {
        return (
            <div>
                <div className="mb-4">
                    <button onClick={() => setView('LIST')} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        Back to Banking
                    </button>
                </div>
                <WalletDirectory />
            </div>
        );
    }

    if (view === 'TRANSFER') {
        return (
            <div>
                <div className="mb-4">
                    <button onClick={() => setView('LIST')} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        Back to Banking
                    </button>
                </div>
                <TransferForm
                    accounts={propAccounts}
                    branches={branches}
                    currencies={currencies}
                    onSave={async (entry) => {
                        await onTransactionAction(entry, 'SUBMIT');
                        setView('LIST');
                    }}
                    onCancel={() => setView('LIST')}
                />
            </div>
        );
    }

    if (view === 'ADD_BANK') {
        return (
            <div>
                <div className="mb-4">
                    <button onClick={() => setView('LIST')} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        Back to Banking
                    </button>
                </div>
                <AccountForm
                    accounts={propAccounts}
                    onSubmit={async (acc) => {
                        await onAddAccount(acc);
                        setView('LIST');
                    }}
                    onCancel={() => setView('LIST')}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-none">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-indigo-100 text-sm font-medium">Total Cash Position (USD Eq.)</div>
                            <div className="text-3xl font-bold mt-1">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalCashPosition)}</div>
                        </div>
                        <button
                            onClick={refreshData}
                            disabled={isRefreshing}
                            className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-colors disabled:opacity-50"
                            title="Refresh data"
                        >
                            <svg className={`w-5 h-5 text-white ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                        <div className="text-xs text-indigo-200 bg-white/10 inline-block px-2 py-1 rounded">
                            Updated: {lastUpdated.toLocaleTimeString()}
                        </div>
                        {isRefreshing && <span className="text-xs text-indigo-200 animate-pulse">Refreshing...</span>}
                    </div>
                </Card>
                <div className="md:col-span-2 flex items-center justify-end space-x-4">
                    <button onClick={() => setView('APPROVALS')} className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-amber-300 transition-all w-28 h-28 shadow-sm group relative">
                        {approvalCount > 0 && <span className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">{approvalCount}</span>}
                        <div className="bg-amber-50 p-2 rounded-full mb-2 group-hover:bg-amber-100"><svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
                        <span className="text-xs font-medium text-gray-700 group-hover:text-amber-700 text-center">Approvals</span>
                    </button>
                    <button onClick={() => setView('REQUESTS')} className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-blue-300 transition-all w-28 h-28 shadow-sm group relative">
                        {pendingCount > 0 && <span className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">{pendingCount}</span>}
                        <div className="bg-blue-50 p-2 rounded-full mb-2 group-hover:bg-blue-100"><svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg></div>
                        <span className="text-xs font-medium text-gray-700 group-hover:text-blue-700 text-center">Requests</span>
                    </button>
                    <button onClick={() => setView('WALLETS')} className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-purple-300 transition-all w-28 h-28 shadow-sm group">
                        <div className="bg-purple-50 p-2 rounded-full mb-2 group-hover:bg-purple-100"><svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg></div>
                        <span className="text-xs font-medium text-gray-700 group-hover:text-purple-700 text-center">User Wallets</span>
                    </button>
                    <button onClick={() => setView('TRANSFER')} className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-indigo-300 transition-all w-28 h-28 shadow-sm group">
                        <div className="bg-indigo-50 p-2 rounded-full mb-2 group-hover:bg-indigo-100"><svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg></div>
                        <span className="text-xs font-medium text-gray-700 group-hover:text-indigo-700">Transfer</span>
                    </button>
                    <button onClick={() => setView('ADD_BANK')} className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-green-300 transition-all w-28 h-28 shadow-sm group">
                        <div className="bg-green-50 p-2 rounded-full mb-2 group-hover:bg-green-100"><svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg></div>
                        <span className="text-xs font-medium text-gray-700 group-hover:text-green-700 text-center">Add Nostro</span>
                    </button>
                </div>
            </div >

            <Card title="Company Bank, Cash & Settlement Accounts">
                {['USD', 'KHR'].map(currency => {
                    const currencyAccounts = bankingAccounts.filter(a => currency === 'USD' ? (!a.currency || a.currency === 'USD') : a.currency === 'KHR');
                    if (currencyAccounts.length === 0) return null;
                    const totalBalance = currencyAccounts.reduce((sum, a) => sum + (a.nativeBalance || 0), 0);
                    const isCollapsed = collapsedCurrencies[currency];

                    return (
                        <div key={currency} className="mb-4 last:mb-0">
                            <button onClick={() => setCollapsedCurrencies(prev => ({ ...prev, [currency]: !prev[currency] }))} className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${currency === 'USD' ? 'bg-green-50 hover:bg-green-100' : 'bg-blue-50 hover:bg-blue-100'}`}>
                                <div className="flex items-center gap-3">
                                    <svg className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'} ${currency === 'USD' ? 'text-green-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                    <h3 className={`text-sm font-bold uppercase tracking-wide ${currency === 'USD' ? 'text-green-700' : 'text-blue-700'}`}>{currency === 'USD' ? '$ USD Accounts' : '៛ KHR Accounts'}</h3>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${currency === 'USD' ? 'bg-green-200 text-green-800' : 'bg-blue-200 text-blue-800'}`}>{currencyAccounts.length}</span>
                                </div>
                                <span className={`text-base font-bold ${totalBalance < 0 ? 'text-red-600' : currency === 'USD' ? 'text-green-700' : 'text-blue-700'}`}>{currency === 'USD' ? '$' : '៛'} {totalBalance.toLocaleString(undefined, { minimumFractionDigits: currency === 'USD' ? 2 : 0 })}</span>
                            </button>
                            {!isCollapsed && (
                                <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {currencyAccounts.sort((a, b) => Math.abs(b.nativeBalance || 0) - Math.abs(a.nativeBalance || 0)).map(acc => (
                                                <tr key={acc.id} className={`hover:bg-gray-50 ${Math.abs(acc.nativeBalance || 0) < 0.01 ? 'opacity-50' : ''}`}>
                                                    <td className="px-4 py-3 w-16">
                                                        <div className={`h-9 w-9 rounded-full flex items-center justify-center ${acc.name.toLowerCase().includes('cash') ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                            {acc.name.toLowerCase().includes('cash') ? (
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                                            ) : (
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="font-medium text-gray-900">{acc.name}</div>
                                                        <div className="text-xs text-gray-500 font-mono">{acc.code}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className={`text-base font-bold ${(acc.nativeBalance || 0) < 0 ? 'text-red-600' : currency === 'USD' ? 'text-green-700' : 'text-blue-700'}`}>{currency === 'USD' ? '$' : '៛'} {(acc.nativeBalance || 0).toLocaleString(undefined, { minimumFractionDigits: currency === 'USD' ? 2 : 0 })}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}
                {bankingAccounts.length === 0 && (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">No Nostro / Company Bank accounts found. Add one to get started.</div>
                )}
            </Card>
        </div >
    );
};
