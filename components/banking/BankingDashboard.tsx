import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Account, Branch, JournalEntry, AccountType, AccountSubType, CurrencyConfig } from '../../src/shared/types';
import { AccountingService } from '../../src/shared/services/accountingService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { TransferForm } from './TransferForm';
import { AccountForm } from '../AccountForm';
import { WalletRequests } from './WalletRequests';
import { WalletDirectory } from './WalletDirectory';
import { firebaseService } from '../../src/shared/services/firebaseService';

interface Props {
    accounts: Account[];
    transactions: JournalEntry[];
    branches: Branch[];
    currencies?: CurrencyConfig[];
    onTransfer: (entry: JournalEntry) => Promise<void>;
    onAddAccount: (account: Account) => Promise<void>;
}

export const BankingDashboard: React.FC<Props> = ({ accounts: propAccounts, transactions: propTransactions, branches, currencies = [], onTransfer, onAddAccount }) => {
    const [view, setView] = useState<'LIST' | 'TRANSFER' | 'ADD_BANK' | 'REQUESTS' | 'WALLETS'>('LIST');
    const [pendingCount, setPendingCount] = useState(0);
    const [collapsedCurrencies, setCollapsedCurrencies] = useState<Record<string, boolean>>({});

    // Real-time data state
    const [liveAccounts, setLiveAccounts] = useState<Account[]>(propAccounts);
    const [liveTransactions, setLiveTransactions] = useState<JournalEntry[]>(propTransactions);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Use live data if available, fallback to props
    const accounts = liveAccounts.length > 0 ? liveAccounts : propAccounts;
    const transactions = liveTransactions.length > 0 ? liveTransactions : propTransactions;

    // Refresh function
    const refreshData = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const [accs, txns, pending] = await Promise.all([
                firebaseService.getAccounts(),
                firebaseService.financeService.getTransactions(),
                firebaseService.getPendingWalletTransactions()
            ]);
            setLiveAccounts(accs);
            setLiveTransactions(txns);
            setPendingCount(pending.length);
            setLastUpdated(new Date());
        } catch (e) {
            console.error('Failed to refresh banking data', e);
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    // Fetch data when page loads
    useEffect(() => {
        refreshData();
    }, [refreshData]);



    const bankingAccounts = useMemo(() => {
        return accounts
            .filter(a => a.type === AccountType.ASSET && (
                a.subType === AccountSubType.CURRENT_ASSET || a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('cash')
            ))
            .map(acc => {
                let nativeBalance = 0;
                let baseBalanceUSD = 0;

                transactions.forEach(txn => {
                    const lines = txn.lines.filter(l => l.accountId === acc.id);
                    lines.forEach(line => {
                        baseBalanceUSD += (line.debit - line.credit);
                        if (acc.currency === 'KHR') {
                            if (line.originalCurrency === 'KHR') {
                                nativeBalance += ((line.originalDebit || 0) - (line.originalCredit || 0));
                            } else {
                                const rate = line.originalExchangeRate || txn.exchangeRate || 4100;
                                nativeBalance += ((line.debit - line.credit) * rate);
                            }
                        } else {
                            nativeBalance += (line.debit - line.credit);
                        }
                    });
                });

                let symbol = '$';
                let code = 'USD';
                if (acc.currency === 'KHR') {
                    symbol = '៛';
                    code = 'KHR';
                } else if (acc.currency && acc.currency !== 'USD') {
                    const conf = currencies.find(c => c.code === acc.currency);
                    if (conf) { symbol = conf.symbol; code = conf.code; }
                }

                return { ...acc, nativeBalance, baseBalanceUSD, currencySymbol: symbol, currencyCode: code };
            })
            .sort((a, b) => b.baseBalanceUSD - a.baseBalanceUSD);
    }, [accounts, transactions, currencies]);

    const totalCashPosition = bankingAccounts.reduce((sum, acc) => sum + acc.baseBalanceUSD, 0);

    if (view === 'TRANSFER') {
        return (
            <div>
                <div className="mb-4">
                    <button onClick={() => setView('LIST')} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        Back to Banking
                    </button>
                </div>
                <TransferForm accounts={accounts} branches={branches} currencies={currencies} onSave={async (entry) => { await onTransfer(entry); setView('LIST'); }} onCancel={() => setView('LIST')} />
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
                <div className="max-w-xl mx-auto">
                    <Card title="Configure Nostro Account">
                        <div className="mb-4 bg-blue-50 text-blue-700 p-3 rounded-lg text-sm">
                            <p className="font-bold mb-1">Creating Company Bank Account</p>
                            <p>This creates a General Ledger Asset account. <strong>Upload a QR Code</strong> to allow Drivers and Customers to select this account.</p>
                        </div>
                        <AccountForm initialData={{ id: '', code: '', name: '', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, description: '', currency: 'USD' }} accounts={accounts} onSubmit={async (acc) => { await onAddAccount(acc); setView('LIST'); }} onCancel={() => setView('LIST')} />
                    </Card>
                </div>
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
            </div>

            <Card title="Company Bank Accounts (Nostro) & Cash">
                {['USD', 'KHR'].map(currency => {
                    const currencyAccounts = bankingAccounts.filter(a => currency === 'USD' ? (!a.currency || a.currency === 'USD') : a.currency === 'KHR');
                    if (currencyAccounts.length === 0) return null;
                    const totalBalance = currencyAccounts.reduce((sum, a) => sum + a.nativeBalance, 0);
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
                                            {currencyAccounts.sort((a, b) => Math.abs(b.nativeBalance) - Math.abs(a.nativeBalance)).map(acc => (
                                                <tr key={acc.id} className={`hover:bg-gray-50 ${Math.abs(acc.nativeBalance) < 0.01 ? 'opacity-50' : ''}`}>
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
                                                        <span className={`text-base font-bold ${acc.nativeBalance < 0 ? 'text-red-600' : currency === 'USD' ? 'text-green-700' : 'text-blue-700'}`}>{currency === 'USD' ? '$' : '៛'} {acc.nativeBalance.toLocaleString(undefined, { minimumFractionDigits: currency === 'USD' ? 2 : 0 })}</span>
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
        </div>
    );
};
