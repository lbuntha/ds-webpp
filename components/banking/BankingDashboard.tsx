
import React, { useState, useMemo, useEffect } from 'react';
import { Account, Branch, JournalEntry, AccountType, AccountSubType, CurrencyConfig } from '../../types';
import { AccountingService } from '../../services/accountingService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { TransferForm } from './TransferForm';
import { AccountForm } from '../AccountForm';
import { WalletRequests } from './WalletRequests';
import { WalletDirectory } from './WalletDirectory';
import { firebaseService } from '../../services/firebaseService';

interface Props {
  accounts: Account[];
  transactions: JournalEntry[];
  branches: Branch[];
  currencies?: CurrencyConfig[];
  onTransfer: (entry: JournalEntry) => Promise<void>;
  onAddAccount: (account: Account) => Promise<void>;
}

export const BankingDashboard: React.FC<Props> = ({ accounts, transactions, branches, currencies = [], onTransfer, onAddAccount }) => {
  const [view, setView] = useState<'LIST' | 'TRANSFER' | 'ADD_BANK' | 'REQUESTS' | 'WALLETS'>('LIST');
  const [pendingCount, setPendingCount] = useState(0);
  
  // Fetch pending count periodically
  useEffect(() => {
      const checkPending = async () => {
          try {
            const pending = await firebaseService.getPendingWalletTransactions();
            setPendingCount(pending.length);
          } catch(e) {}
      };
      checkPending();
      const interval = setInterval(checkPending, 30000); // Poll every 30s
      return () => clearInterval(interval);
  }, []);

  // Filter for Bank/Cash Accounts
  const bankingAccounts = useMemo(() => {
    return accounts
        .filter(a => a.type === AccountType.ASSET && (
            a.subType === AccountSubType.CURRENT_ASSET || a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('cash')
        ))
        .map(acc => {
            // --- NATIVE BALANCE CALCULATION ---
            let nativeBalance = 0;
            let baseBalanceUSD = 0;

            transactions.forEach(txn => {
                const lines = txn.lines.filter(l => l.accountId === acc.id);
                lines.forEach(line => {
                    // 1. Calculate Base Balance (USD) - Always accurate for BS
                    baseBalanceUSD += (line.debit - line.credit);

                    // 2. Calculate Native Balance (Displayed on Card)
                    if (acc.currency === 'KHR') {
                        // If the line recorded a specific KHR amount, use it
                        if (line.originalCurrency === 'KHR') {
                            nativeBalance += ((line.originalDebit || 0) - (line.originalCredit || 0));
                        } 
                        // If it was a USD txn hitting a KHR account, convert using the txn rate or fallback
                        else {
                            // Convert Base USD to KHR
                            const rate = line.originalExchangeRate || txn.exchangeRate || 4100;
                            nativeBalance += ((line.debit - line.credit) * rate);
                        }
                    } else {
                        // For USD or unspecified accounts, use Base USD
                        nativeBalance += (line.debit - line.credit);
                    }
                });
            });

            // Currency Symbol Logic
            let symbol = '$';
            let code = 'USD';
            if (acc.currency === 'KHR') {
                symbol = '៛';
                code = 'KHR';
            } else if (acc.currency && acc.currency !== 'USD') {
                const conf = currencies.find(c => c.code === acc.currency);
                if (conf) {
                    symbol = conf.symbol;
                    code = conf.code;
                }
            }

            return { 
                ...acc, 
                nativeBalance, 
                baseBalanceUSD,
                currencySymbol: symbol,
                currencyCode: code
            };
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
            <TransferForm 
                accounts={accounts}
                branches={branches}
                currencies={currencies}
                onSave={async (entry) => {
                    await onTransfer(entry);
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
            <div className="max-w-xl mx-auto">
                 <Card title="Configure Nostro Account">
                    <div className="mb-4 bg-blue-50 text-blue-700 p-3 rounded-lg text-sm">
                        <p className="font-bold mb-1">Creating Company Bank Account</p>
                        <p>
                            This creates a General Ledger Asset account representing your company's bank account. 
                            <strong>Upload a QR Code</strong> in the form below to allow Drivers and Customers to select this account for settlements.
                        </p>
                    </div>
                    <AccountForm 
                        initialData={{
                            id: '',
                            code: '',
                            name: '',
                            type: AccountType.ASSET,
                            subType: AccountSubType.CURRENT_ASSET,
                            description: '',
                            currency: 'USD'
                        }}
                        accounts={accounts}
                        onSubmit={async (acc) => {
                            await onAddAccount(acc);
                            setView('LIST');
                        }}
                        onCancel={() => setView('LIST')}
                    />
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
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-none">
                <div className="text-indigo-100 text-sm font-medium">Total Cash Position (USD Eq.)</div>
                <div className="text-3xl font-bold mt-1">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalCashPosition)}
                </div>
                <div className="mt-4 text-xs text-indigo-200 bg-white/10 inline-block px-2 py-1 rounded">
                    Real-time Balance (Aggregated)
                </div>
            </Card>

            <div className="md:col-span-2 flex items-center justify-end space-x-4">
                 <button 
                    onClick={() => setView('REQUESTS')}
                    className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-blue-300 transition-all w-28 h-28 shadow-sm group relative"
                 >
                     {pendingCount > 0 && (
                         <span className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                             {pendingCount}
                         </span>
                     )}
                     <div className="bg-blue-50 p-2 rounded-full mb-2 group-hover:bg-blue-100 transition-colors">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                     </div>
                     <span className="text-xs font-medium text-gray-700 group-hover:text-blue-700 text-center">Requests</span>
                 </button>

                 <button 
                    onClick={() => setView('WALLETS')}
                    className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-purple-300 transition-all w-28 h-28 shadow-sm group"
                 >
                     <div className="bg-purple-50 p-2 rounded-full mb-2 group-hover:bg-purple-100 transition-colors">
                        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                     </div>
                     <span className="text-xs font-medium text-gray-700 group-hover:text-purple-700 text-center">User Wallets</span>
                 </button>

                 <button 
                    onClick={() => setView('TRANSFER')}
                    className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-indigo-300 transition-all w-28 h-28 shadow-sm group"
                 >
                     <div className="bg-indigo-50 p-2 rounded-full mb-2 group-hover:bg-indigo-100 transition-colors">
                        <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                     </div>
                     <span className="text-xs font-medium text-gray-700 group-hover:text-indigo-700">Transfer</span>
                 </button>

                 <button 
                    onClick={() => setView('ADD_BANK')}
                    className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-green-300 transition-all w-28 h-28 shadow-sm group"
                 >
                     <div className="bg-green-50 p-2 rounded-full mb-2 group-hover:bg-green-100 transition-colors">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                     </div>
                     <span className="text-xs font-medium text-gray-700 group-hover:text-green-700 text-center">Add Nostro</span>
                 </button>
            </div>
        </div>

        <Card title="Company Bank Accounts (Nostro) & Cash">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bankingAccounts.map(acc => (
                    <div key={acc.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:shadow-md transition-all bg-white group">
                        <div className="flex items-center space-x-4">
                             <div className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 
                                ${acc.name.toLowerCase().includes('cash') ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                 {acc.name.toLowerCase().includes('cash') ? (
                                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                 ) : (
                                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                                 )}
                             </div>
                             <div className="overflow-hidden">
                                 <h3 className="font-medium text-gray-900 truncate">{acc.name}</h3>
                                 <div className="flex items-center space-x-2">
                                    <p className="text-xs text-gray-500 font-mono">{acc.code}</p>
                                    {acc.currency && acc.currency !== 'USD' && (
                                        <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-bold">
                                            {acc.currency}
                                        </span>
                                    )}
                                    {acc.qrCode && (
                                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200" title="QR Code Configured">
                                            QR Active
                                        </span>
                                    )}
                                 </div>
                             </div>
                        </div>
                        <div className="text-right">
                             {/* Display Native Balance First */}
                             <p className={`text-lg font-bold ${acc.nativeBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                 {acc.currencySymbol} {acc.nativeBalance.toLocaleString(undefined, { minimumFractionDigits: acc.currencyCode === 'KHR' ? 0 : 2 })}
                             </p>
                             
                             {/* Show Base USD Equivalent if native is not USD */}
                             {acc.currencyCode !== 'USD' && (
                                 <p className="text-xs text-indigo-600 font-medium mt-0.5">
                                     ≈ ${acc.baseBalanceUSD.toLocaleString(undefined, {minimumFractionDigits: 2})} USD
                                 </p>
                             )}
                        </div>
                    </div>
                ))}
                {bankingAccounts.length === 0 && (
                    <div className="col-span-2 text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        No Nostro / Company Bank accounts found. Add one to get started.
                    </div>
                )}
            </div>
        </Card>
    </div>
  );
};
