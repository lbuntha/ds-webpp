import React, { useMemo, useState } from 'react';
import { Account, AccountType, Branch, JournalEntry, ReportType, TrialBalanceRow } from '../src/shared/types';
import { AccountingService } from '../src/shared/services/accountingService';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { useLanguage } from '../src/shared/contexts/LanguageContext';
import { WalletBalanceReport } from './reports/WalletBalanceReport';
import { InTransitAgingReport } from './reports/InTransitAgingReport';

interface Props {
  transactions: JournalEntry[];
  accounts: Account[];
  branches: Branch[];
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
};

const IndentedRow: React.FC<{ row: TrialBalanceRow, val: string }> = ({ row, val }) => (
  <div className="flex justify-between text-sm py-1 border-b border-gray-50 hover:bg-gray-50">
    <div className="flex items-center" style={{ paddingLeft: `${row.depth * 1.5}rem` }}>
         {row.depth > 0 && <span className="text-gray-300 mr-2">↳</span>}
         <span className={row.isHeader ? "font-bold text-gray-800" : "text-gray-600"}>
             {row.accountCode} - {row.accountName}
         </span>
    </div>
    <span className={row.isHeader ? "font-bold text-gray-800" : "text-gray-600"}>{val}</span>
  </div>
);

export const Reports: React.FC<Props> = ({ transactions, accounts, branches }) => {
  const { t } = useLanguage();
  const [activeReport, setActiveReport] = useState<ReportType | 'WALLET' | 'TRANSIT'>('TB');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [glAccountId, setGlAccountId] = useState<string>('');
  
  // Date Filtering
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Filter Transactions based on Report Type and Date Range
  const reportTransactions = useMemo(() => {
    let txns = selectedBranch
      ? transactions.filter(t => t.branchId === selectedBranch)
      : transactions;

    if (activeReport === 'IS') {
        // Income Statement is a Period Report (Start to End)
        txns = txns.filter(t => t.date >= startDate && t.date <= endDate);
    } else if (activeReport === 'TB' || activeReport === 'BS') {
        // TB and BS are "As Of" Reports (Beginning of time to End)
        txns = txns.filter(t => t.date <= endDate);
    }
    // GL handles its own filtering to calculate opening balances correctly

    return txns;
  }, [transactions, selectedBranch, startDate, endDate, activeReport]);

  // --- TB Calculation ---
  const tbData = useMemo(() => {
    return AccountingService.generateTrialBalance(accounts, reportTransactions);
  }, [accounts, reportTransactions]);

  // FIX: Sum only Depth 0 to avoid double counting rolled-up values
  const totalDebits = tbData.filter(r => r.depth === 0).reduce((acc, row) => acc + row.debit, 0);
  const totalCredits = tbData.filter(r => r.depth === 0).reduce((acc, row) => acc + row.credit, 0);

  // --- Income Statement Calculation ---
  const incomeStatement = useMemo(() => {
    const revenue = tbData.filter(row => row.type === AccountType.REVENUE);
    const expenses = tbData.filter(row => row.type === AccountType.EXPENSE);

    // Sum only Depth 0
    const totalRevenue = revenue.filter(r => r.depth === 0).reduce((acc, row) => acc + (row.credit - row.debit), 0);
    const totalExpenses = expenses.filter(r => r.depth === 0).reduce((acc, row) => acc + (row.debit - row.credit), 0);

    return { revenue, expenses, totalRevenue, totalExpenses, netIncome: totalRevenue - totalExpenses };
  }, [tbData]);

  // --- Balance Sheet Calculation ---
  const balanceSheet = useMemo(() => {
      const assets = tbData.filter(row => row.type === AccountType.ASSET);
      const liabilities = tbData.filter(row => row.type === AccountType.LIABILITY);
      const equity = tbData.filter(row => row.type === AccountType.EQUITY);

      // Sum only Depth 0
      const totalAssets = assets.filter(r => r.depth === 0).reduce((acc, row) => acc + (row.debit - row.credit), 0);
      const totalLiabilities = liabilities.filter(r => r.depth === 0).reduce((acc, row) => acc + (row.credit - row.debit), 0);
      let totalEquity = equity.filter(r => r.depth === 0).reduce((acc, row) => acc + (row.credit - row.debit), 0);

      // Add Net Income to Equity (Lifetime)
      totalEquity += incomeStatement.netIncome;

      return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, netIncome: incomeStatement.netIncome };
  }, [tbData, incomeStatement]);

  // --- General Ledger Calculation ---
  const glData = useMemo(() => {
      if (activeReport !== 'GL' || !glAccountId) return null;
      
      const account = accounts.find(a => a.id === glAccountId);
      if (!account) return null;

      const isCreditNormal = [AccountType.LIABILITY, AccountType.EQUITY, AccountType.REVENUE].includes(account.type);

      let baseTxns = selectedBranch 
          ? transactions.filter(t => t.branchId === selectedBranch)
          : transactions;

      const fullLedger = AccountingService.generateGeneralLedger(glAccountId, baseTxns);
      
      const previousEntries = fullLedger.filter(l => l.date < startDate);
      
      let rawOpeningBal = previousEntries.length > 0 
          ? previousEntries[previousEntries.length - 1].balance 
          : 0;
      
      const openingBalance = isCreditNormal ? -rawOpeningBal : rawOpeningBal;

      const rangeEntries = fullLedger.filter(l => l.date >= startDate && l.date <= endDate).map(l => ({
          ...l,
          displayedBalance: isCreditNormal ? -l.balance : l.balance
      }));
      
      const closingBalance = rangeEntries.length > 0 
          ? rangeEntries[rangeEntries.length - 1].displayedBalance 
          : openingBalance;

      return { account, openingBalance, closingBalance, lines: rangeEntries, isCreditNormal };
  }, [activeReport, glAccountId, transactions, selectedBranch, startDate, endDate, accounts]);


  const handlePrint = () => {
    window.print();
  };

  if (activeReport === 'WALLET') {
      return (
          <div className="space-y-6">
              <div className="flex justify-between items-center bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex space-x-2 overflow-x-auto">
                        <button
                            onClick={() => setActiveReport('TB')}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            &larr; Standard Reports
                        </button>
                        <div className="h-8 w-px bg-gray-300 mx-2 self-center"></div>
                        <span className="px-4 py-2 rounded-lg text-sm font-bold text-indigo-800 bg-indigo-50">Wallet Report</span>
                  </div>
              </div>
              <WalletBalanceReport />
          </div>
      );
  }

  if (activeReport === 'TRANSIT') {
      return (
          <div className="space-y-6">
              <div className="flex justify-between items-center bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex space-x-2 overflow-x-auto">
                        <button
                            onClick={() => setActiveReport('TB')}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            &larr; Standard Reports
                        </button>
                        <div className="h-8 w-px bg-gray-300 mx-2 self-center"></div>
                        <span className="px-4 py-2 rounded-lg text-sm font-bold text-orange-800 bg-orange-50">In-Transit Aging</span>
                  </div>
              </div>
              <InTransitAgingReport />
          </div>
      );
  }

  return (
    <div className="space-y-6 print:space-y-2">
      {/* Controls (Hidden on Print) */}
      <Card className="print:hidden">
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {(['TB', 'BS', 'IS', 'GL'] as ReportType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setActiveReport(type)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activeReport === type
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {type === 'TB' ? t('trial_balance') : type === 'BS' ? t('balance_sheet') : type === 'IS' ? t('profit_loss') : t('general_ledger')}
                  </button>
              ))}
              <div className="h-8 w-px bg-gray-300 mx-2 self-center"></div>
              <button
                    onClick={() => setActiveReport('WALLET')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap text-gray-600 hover:bg-gray-50`}
                >
                    Wallet Balances
              </button>
              <button
                    onClick={() => setActiveReport('TRANSIT')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap text-gray-600 hover:bg-gray-50`}
                >
                    In-Transit Aging
              </button>
            </div>
            <div className="flex space-x-2">
                <Button variant="outline" onClick={handlePrint}>
                     {t('print')} / PDF
                </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
              <div>
                 <label className="block text-xs font-medium text-gray-700 mb-1">Branch</label>
                 <select
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-indigo-500"
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                  >
                    <option value="">All Branches</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
              </div>
              
              {(activeReport === 'IS' || activeReport === 'GL') && (
                  <div>
                     <label className="block text-xs font-medium text-gray-700 mb-1">{t('from_date')}</label>
                     <input 
                        type="date" 
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-indigo-500"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                     />
                  </div>
              )}

              <div>
                 <label className="block text-xs font-medium text-gray-700 mb-1">
                    {activeReport === 'IS' || activeReport === 'GL' ? t('to_date') : t('as_of')}
                 </label>
                 <input 
                    type="date" 
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-indigo-500"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                 />
              </div>
          </div>
          
          {activeReport === 'GL' && (
              <div className="pt-2">
                 <label className="block text-xs font-medium text-gray-700 mb-1">Select Account</label>
                 <select
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-indigo-500"
                    value={glAccountId}
                    onChange={(e) => setGlAccountId(e.target.value)}
                 >
                    <option value="">-- Select an Account --</option>
                    {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.code} - {acc.name} ({acc.type})</option>
                    ))}
                 </select>
              </div>
          )}
        </div>
      </Card>

      {/* Report Content */}
      <div className="print:block">
        <Card>
            <div className="mb-6 pb-4 border-b border-gray-100 flex flex-col items-center text-center">
                <h2 className="text-2xl font-bold text-gray-900">
                    {activeReport === 'TB' ? t('trial_balance') : activeReport === 'IS' ? t('profit_loss') : activeReport === 'BS' ? t('balance_sheet') : t('general_ledger')}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                    {selectedBranch ? branches.find(b => b.id === selectedBranch)?.name : 'All Branches'}
                </p>
                <p className="text-sm text-gray-500">
                    {(activeReport === 'IS' || activeReport === 'GL')
                        ? `${t('from_date')} ${new Date(startDate).toLocaleDateString()} ${t('to_date')} ${new Date(endDate).toLocaleDateString()}`
                        : `${t('as_of')} ${new Date(endDate).toLocaleDateString()}`
                    }
                </p>
                {activeReport === 'GL' && glData && (
                    <div className="mt-2 text-center">
                        <p className="text-lg font-semibold text-indigo-700">
                            {glData.account.code} - {glData.account.name}
                        </p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 uppercase tracking-wide">
                            {glData.account.type}
                        </span>
                    </div>
                )}
            </div>

            {activeReport === 'TB' && (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('code')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('account')}</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('debit')}</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('credit')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 text-sm">
                            {tbData.map((row) => (
                                <tr key={row.accountId} className={row.isHeader ? "bg-gray-50 font-bold" : ""}>
                                    <td className="px-6 py-2 text-gray-900">{row.accountCode}</td>
                                    <td className="px-6 py-2 text-gray-900">
                                         <div style={{ paddingLeft: `${row.depth * 1.5}rem` }} className="flex items-center">
                                            {row.depth > 0 && <span className="text-gray-300 mr-2">↳</span>}
                                            {row.accountName}
                                        </div>
                                    </td>
                                    <td className="px-6 py-2 text-right text-gray-600">{row.debit > 0 ? formatCurrency(row.debit) : '-'}</td>
                                    <td className="px-6 py-2 text-right text-gray-600">{row.credit > 0 ? formatCurrency(row.credit) : '-'}</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-100 font-bold">
                                <td colSpan={2} className="px-6 py-3 text-gray-900 text-right">{t('grand_total')}</td>
                                <td className="px-6 py-3 text-right text-indigo-700">{formatCurrency(totalDebits)}</td>
                                <td className="px-6 py-3 text-right text-indigo-700">{formatCurrency(totalCredits)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {activeReport === 'IS' && (
                <div className="space-y-6 max-w-3xl mx-auto">
                    {/* Revenue Section */}
                    <div>
                        <h4 className="text-md font-bold text-gray-700 uppercase border-b border-gray-200 pb-2 mb-3">{t('revenue')}</h4>
                        {incomeStatement.revenue.length === 0 && <p className="text-gray-400 italic text-sm">No revenue recorded.</p>}
                        {incomeStatement.revenue.map(r => (
                             <IndentedRow key={r.accountId} row={r} val={formatCurrency(r.credit - r.debit)} />
                        ))}
                        <div className="flex justify-between font-bold text-sm py-2 border-t border-gray-200 mt-2">
                            <span>Total Revenue</span>
                            <span>{formatCurrency(incomeStatement.totalRevenue)}</span>
                        </div>
                    </div>

                    {/* Expense Section */}
                    <div>
                        <h4 className="text-md font-bold text-gray-700 uppercase border-b border-gray-200 pb-2 mb-3">{t('expenses')}</h4>
                        {incomeStatement.expenses.length === 0 && <p className="text-gray-400 italic text-sm">No expenses recorded.</p>}
                        {incomeStatement.expenses.map(r => (
                            <IndentedRow key={r.accountId} row={r} val={formatCurrency(r.debit - r.credit)} />
                        ))}
                        <div className="flex justify-between font-bold text-sm py-2 border-t border-gray-200 mt-2">
                            <span>Total Expenses</span>
                            <span>{formatCurrency(incomeStatement.totalExpenses)}</span>
                        </div>
                    </div>

                    {/* Net Income */}
                    <div className="bg-indigo-50 p-4 rounded-lg flex justify-between items-center print:bg-gray-50 print:border print:border-gray-300">
                        <span className="font-bold text-indigo-900 print:text-black">{t('net_income')}</span>
                        <span className={`font-bold text-lg ${incomeStatement.netIncome >= 0 ? 'text-green-600' : 'text-red-600'} print:text-black`}>
                            {formatCurrency(incomeStatement.netIncome)}
                        </span>
                    </div>
                </div>
            )}

            {activeReport === 'BS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h4 className="text-md font-bold text-gray-700 uppercase border-b border-gray-200 pb-2 mb-3">{t('assets')}</h4>
                        {balanceSheet.assets.map(r => (
                            <IndentedRow key={r.accountId} row={r} val={formatCurrency(r.debit - r.credit)} />
                        ))}
                        <div className="flex justify-between font-bold text-sm py-3 mt-2 bg-gray-50 px-2 rounded print:bg-transparent print:border-t print:border-black">
                            <span>Total Assets</span>
                            <span>{formatCurrency(balanceSheet.totalAssets)}</span>
                        </div>
                    </div>
                    <div>
                        <div className="mb-8">
                            <h4 className="text-md font-bold text-gray-700 uppercase border-b border-gray-200 pb-2 mb-3">{t('liabilities')}</h4>
                            {balanceSheet.liabilities.map(r => (
                                <IndentedRow key={r.accountId} row={r} val={formatCurrency(r.credit - r.debit)} />
                            ))}
                            <div className="flex justify-between font-bold text-sm py-3 mt-2 bg-gray-50 px-2 rounded print:bg-transparent print:border-t print:border-black">
                                <span>Total Liabilities</span>
                                <span>{formatCurrency(balanceSheet.totalLiabilities)}</span>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-md font-bold text-gray-700 uppercase border-b border-gray-200 pb-2 mb-3">{t('equity')}</h4>
                            {balanceSheet.equity.map(r => (
                                <IndentedRow key={r.accountId} row={r} val={formatCurrency(r.credit - r.debit)} />
                            ))}
                            <div className="flex justify-between text-sm py-1 border-b border-gray-50 text-indigo-600 italic print:text-black">
                                <div className="pl-6"><span>Calculated Earnings (Lifetime)</span></div>
                                <span>{formatCurrency(balanceSheet.netIncome)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-sm py-3 mt-2 bg-gray-50 px-2 rounded print:bg-transparent print:border-t print:border-black">
                                <span>Total Equity</span>
                                <span>{formatCurrency(balanceSheet.totalEquity)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-sm py-3 mt-4 border-t-2 border-gray-300">
                                <span>Total Liab. & Equity</span>
                                <span>{formatCurrency(balanceSheet.totalLiabilities + balanceSheet.totalEquity)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeReport === 'GL' && (
                <div className="space-y-4">
                    {!glAccountId ? (
                        <div className="text-center py-12 text-gray-500">
                            <p>Please select an account above to view its General Ledger.</p>
                        </div>
                    ) : glData ? (
                        <div className="overflow-x-auto">
                            <div className="mb-4 bg-gray-50 p-3 rounded-lg flex justify-between items-center">
                                <span className="font-medium text-gray-700">Opening Balance ({new Date(startDate).toLocaleDateString()})</span>
                                <span className="font-bold text-gray-900">{formatCurrency(glData.openingBalance)}</span>
                            </div>
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('date')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('reference')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('description')}</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('debit')}</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('credit')}</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('balance')}</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200 text-sm">
                                    {glData.lines.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No transactions in this period.</td>
                                        </tr>
                                    )}
                                    {glData.lines.map((line, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-900">{line.date}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">{line.reference || '-'}</td>
                                            <td className="px-6 py-4 text-gray-900 max-w-xs truncate" title={line.description}>{line.description}</td>
                                            <td className="px-6 py-4 text-right text-gray-500">{line.debit > 0 ? formatCurrency(line.debit) : '-'}</td>
                                            <td className="px-6 py-4 text-right text-gray-500">{line.credit > 0 ? formatCurrency(line.credit) : '-'}</td>
                                            <td className={`px-6 py-4 text-right font-medium ${line.displayedBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                                {formatCurrency(line.displayedBalance)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                             <div className="mt-4 bg-gray-50 p-3 rounded-lg flex justify-between items-center border-t border-gray-200">
                                <span className="font-medium text-gray-700">Closing Balance ({new Date(endDate).toLocaleDateString()})</span>
                                <span className="font-bold text-gray-900">
                                    {formatCurrency(glData.closingBalance)}
                                </span>
                            </div>
                        </div>
                    ) : null}
                </div>
            )}
        </Card>
      </div>
    </div>
  );
};
