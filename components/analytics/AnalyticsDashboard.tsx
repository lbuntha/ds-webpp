
import React, { useMemo } from 'react';
import { Account, JournalEntry, AccountType, Invoice, Bill } from '../../types';
import { Card } from '../ui/Card';
import { AccountingService } from '../../services/accountingService';

interface Props {
  accounts: Account[];
  transactions: JournalEntry[];
  invoices: Invoice[];
  bills: Bill[];
}

export const AnalyticsDashboard: React.FC<Props> = ({ accounts, transactions, invoices, bills }) => {
  
  // --- 1. Financial Performance Calculation (KPIs) ---
  const performance = useMemo(() => {
    const currentYear = new Date().getFullYear();
    // Get TB for full history to calculate lifetime equity/cash, 
    // but filter for current year for P&L
    const tb = AccountingService.generateTrialBalance(accounts, transactions);
    
    // Filter transactions for P&L (Current Year Only)
    const yearTxns = transactions.filter(t => new Date(t.date).getFullYear() === currentYear);
    const yearTB = AccountingService.generateTrialBalance(accounts, yearTxns);

    let revenue = 0;
    let expense = 0;

    yearTB.forEach(row => {
        if (row.isHeader) return;
        if (row.type === AccountType.REVENUE) revenue += (row.credit - row.debit);
        if (row.type === AccountType.EXPENSE) expense += (row.debit - row.credit);
    });

    const netIncome = revenue - expense;
    const margin = revenue > 0 ? (netIncome / revenue) * 100 : 0;

    return { revenue, expense, netIncome, margin };
  }, [accounts, transactions]);

  // --- 2. Trend Analysis (Last 6 Months) ---
  const trendData = useMemo(() => {
    const today = new Date();
    const data = [];
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = d.toLocaleString('default', { month: 'short' });
        
        // Filter transactions for this month
        // Optimization: In a real app with 10k+ txns, this loop inside loop is slow. 
        // For SME scale (under 2k txns), it's fine.
        const monthTxns = transactions.filter(t => t.date.startsWith(monthKey));
        
        let mRev = 0;
        let mExp = 0;

        monthTxns.forEach(t => {
            t.lines.forEach(line => {
                const acc = accounts.find(a => a.id === line.accountId);
                if (!acc) return;
                if (acc.type === AccountType.REVENUE) mRev += (line.credit - line.debit);
                if (acc.type === AccountType.EXPENSE) mExp += (line.debit - line.credit);
            });
        });

        data.push({ label: monthLabel, revenue: mRev, expense: mExp });
    }
    
    // Find max value for scaling chart
    const maxVal = Math.max(...data.map(d => Math.max(d.revenue, d.expense)), 100);
    return { data, maxVal };
  }, [accounts, transactions]);

  // --- 3. Expense Breakdown ---
  const expenseBreakdown = useMemo(() => {
      const categoryTotals: Record<string, number> = {};
      let totalExp = 0;

      const yearTxns = transactions.filter(t => new Date(t.date).getFullYear() === new Date().getFullYear());

      yearTxns.forEach(t => {
          t.lines.forEach(line => {
              const acc = accounts.find(a => a.id === line.accountId);
              if (acc && acc.type === AccountType.EXPENSE && !acc.isHeader) {
                  const val = line.debit - line.credit;
                  if (val > 0) {
                      categoryTotals[acc.name] = (categoryTotals[acc.name] || 0) + val;
                      totalExp += val;
                  }
              }
          });
      });

      const sorted = Object.entries(categoryTotals)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);
      
      const other = Object.entries(categoryTotals)
        .sort(([, a], [, b]) => b - a)
        .slice(5)
        .reduce((sum, [, val]) => sum + val, 0);

      if (other > 0) sorted.push(['Other Expenses', other]);

      return { topExpenses: sorted, totalExp };
  }, [accounts, transactions]);

  // --- 4. Cash & Liquidity ---
  const liquidity = useMemo(() => {
      const tb = AccountingService.generateTrialBalance(accounts, transactions);
      
      // Cash
      const cash = tb
        .filter(row => row.type === AccountType.ASSET && (row.accountName.toLowerCase().includes('cash') || row.accountName.toLowerCase().includes('bank')))
        .reduce((sum, row) => sum + (row.debit - row.credit), 0);

      // Receivables (Unpaid Invoices)
      const ar = invoices
        .filter(i => i.status === 'POSTED')
        .reduce((sum, i) => sum + ((i.totalAmount - i.amountPaid) / (i.exchangeRate || 1)), 0);

      // Payables (Unpaid Bills)
      const ap = bills
        .filter(b => b.status === 'POSTED')
        .reduce((sum, b) => sum + (b.totalAmount - b.amountPaid), 0);

      return { cash, ar, ap };
  }, [accounts, transactions, invoices, bills]);

  const formatMoney = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6 animate-fade-in-up">
        
        {/* --- KPI CARDS --- */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-indigo-500">
                <div className="text-sm text-gray-500 font-medium">Revenue (YTD)</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{formatMoney(performance.revenue)}</div>
            </Card>
            <Card className="border-l-4 border-l-red-500">
                <div className="text-sm text-gray-500 font-medium">Expenses (YTD)</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{formatMoney(performance.expense)}</div>
            </Card>
            <Card className={`border-l-4 ${performance.netIncome >= 0 ? 'border-l-green-500' : 'border-l-red-600'}`}>
                <div className="text-sm text-gray-500 font-medium">Net Income</div>
                <div className={`text-2xl font-bold mt-1 ${performance.netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatMoney(performance.netIncome)}
                </div>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
                <div className="text-sm text-gray-500 font-medium">Profit Margin</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{performance.margin.toFixed(1)}%</div>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* --- TREND CHART --- */}
            <Card title="Revenue & Expense Trend (6 Months)">
                <div className="h-64 w-full flex items-end justify-between space-x-2 px-2 mt-4">
                    {trendData.data.map((item, idx) => {
                        const revHeight = (item.revenue / trendData.maxVal) * 100;
                        const expHeight = (item.expense / trendData.maxVal) * 100;
                        return (
                            <div key={idx} className="flex flex-col items-center justify-end h-full w-full group relative">
                                <div className="w-full flex justify-center items-end space-x-1 h-full pb-6">
                                    {/* Revenue Bar */}
                                    <div 
                                        style={{ height: `${Math.max(revHeight, 1)}%` }} 
                                        className="w-3 md:w-6 bg-indigo-500 rounded-t transition-all hover:bg-indigo-600 relative group-hover:opacity-100 opacity-90"
                                    >
                                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                            Rev: {formatMoney(item.revenue)}
                                        </div>
                                    </div>
                                    {/* Expense Bar */}
                                    <div 
                                        style={{ height: `${Math.max(expHeight, 1)}%` }} 
                                        className="w-3 md:w-6 bg-red-400 rounded-t transition-all hover:bg-red-500 relative group-hover:opacity-100 opacity-90"
                                    >
                                        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                            Exp: {formatMoney(item.expense)}
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute bottom-0 text-xs text-gray-500 font-medium">{item.label}</div>
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-center space-x-6 mt-4 text-xs text-gray-600">
                    <div className="flex items-center"><div className="w-3 h-3 bg-indigo-500 rounded mr-2"></div>Revenue</div>
                    <div className="flex items-center"><div className="w-3 h-3 bg-red-400 rounded mr-2"></div>Expenses</div>
                </div>
            </Card>

            {/* --- EXPENSE BREAKDOWN --- */}
            <Card title="Where is the money going?">
                <div className="flex flex-col h-full justify-center">
                    {expenseBreakdown.totalExp === 0 ? (
                        <div className="text-center text-gray-400 py-10">No expenses recorded this year.</div>
                    ) : (
                        <div className="space-y-4 mt-2">
                            {expenseBreakdown.topExpenses.map(([name, val], idx) => {
                                const pct = (val / expenseBreakdown.totalExp) * 100;
                                const colors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-gray-400', 'bg-gray-300'];
                                return (
                                    <div key={name} className="relative">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-700 font-medium truncate w-2/3">{name}</span>
                                            <span className="text-gray-900 font-bold">{formatMoney(val)} ({pct.toFixed(0)}%)</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                                            <div className={`h-2.5 rounded-full ${colors[idx % colors.length]}`} style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className="mt-6 pt-4 border-t border-gray-100 text-center">
                        <p className="text-xs text-gray-500">Top expense categories by volume (YTD)</p>
                    </div>
                </div>
            </Card>
        </div>

        {/* --- LIQUIDITY & CASH FLOW --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card title="Cash & Liquidity" className="lg:col-span-2">
                <div className="grid grid-cols-3 gap-4 text-center divide-x divide-gray-100">
                    <div className="p-2">
                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Cash On Hand</div>
                        <div className="text-xl font-bold text-green-600">{formatMoney(liquidity.cash)}</div>
                        <p className="text-[10px] text-gray-400 mt-1">Bank & Cash Accts</p>
                    </div>
                    <div className="p-2">
                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Coming In</div>
                        <div className="text-xl font-bold text-blue-600">{formatMoney(liquidity.ar)}</div>
                        <p className="text-[10px] text-gray-400 mt-1">Unpaid Invoices</p>
                    </div>
                    <div className="p-2">
                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Going Out</div>
                        <div className="text-xl font-bold text-red-600">{formatMoney(liquidity.ap)}</div>
                        <p className="text-[10px] text-gray-400 mt-1">Unpaid Bills</p>
                    </div>
                </div>
                <div className="mt-6">
                    <h4 className="text-sm font-bold text-gray-700 mb-3">Net Cash Position Estimate</h4>
                    {/* Visual Bar for Net Cash */}
                    <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden flex">
                        <div 
                            className="h-full bg-green-500 flex items-center justify-center text-white text-xs font-bold"
                            style={{ width: '50%' }} // Placeholder base
                        >
                            Cash
                        </div>
                        <div className="absolute top-0 bottom-0 w-1 bg-white z-10" style={{ left: '50%' }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <span>Real Liquidity: {formatMoney(liquidity.cash + liquidity.ar - liquidity.ap)}</span>
                        <span>(Cash + Receivables - Payables)</span>
                    </div>
                </div>
            </Card>

            <Card title="Quick Actions">
                <div className="space-y-3">
                    <button 
                        className="w-full flex items-center justify-between p-3 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors text-sm font-medium"
                        onClick={() => window.location.href = '#'} // Just visual, routing handled by parent
                    >
                        <span>View Detailed P&L</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                    <button className="w-full flex items-center justify-between p-3 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors text-sm font-medium">
                        <span>Analyze Receivables</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                    <button className="w-full flex items-center justify-between p-3 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors text-sm font-medium">
                        <span>Review Expenses</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                </div>
            </Card>
        </div>
    </div>
  );
};
