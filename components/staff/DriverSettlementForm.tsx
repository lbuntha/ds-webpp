
import React, { useState, useEffect, useMemo } from 'react';
import { Account, Branch, Employee, JournalEntry, CurrencyConfig, AccountType } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';

interface Props {
  accounts: Account[];
  branches: Branch[];
  employees: Employee[];
  currencies: CurrencyConfig[];
  onSave: (entry: JournalEntry) => Promise<void>;
  onCancel: () => void;
}

interface ExpenseLine {
  accountId: string;
  description: string;
  amount: number; // In Transaction Currency
}

export const DriverSettlementForm: React.FC<Props> = ({ 
  accounts, branches, employees, currencies, onSave, onCancel 
}) => {
  // Default currencies fallback
  const activeCurrencies = currencies.length > 0 ? currencies : [
      { id: 'curr-usd', code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1, isBase: true }
  ];

  // Header State
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  
  // Currency State
  const [currencyCode, setCurrencyCode] = useState<string>(() => {
      const base = activeCurrencies.find(c => c.isBase);
      return base ? base.code : activeCurrencies[0].code;
  });
  const [exchangeRate, setExchangeRate] = useState<number>(1);

  // Determine Official System Rate
  const systemRate = useMemo(() => {
      const c = activeCurrencies.find(cur => cur.code === currencyCode);
      return c ? c.exchangeRate : 1;
  }, [currencyCode, activeCurrencies]);

  // Data State
  const [lines, setLines] = useState<ExpenseLine[]>([
    { accountId: '', description: '', amount: 0 }
  ]);
  const [settlementType, setSettlementType] = useState<'OFFSET_ADVANCE' | 'CASH_REIMBURSEMENT'>('OFFSET_ADVANCE');
  const [creditAccountId, setCreditAccountId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter Accounts - Exclude Header Accounts
  const expenseAccounts = accounts.filter(a => a.type === AccountType.EXPENSE && !a.isHeader);
  const assetAccounts = accounts.filter(a => a.type === AccountType.ASSET && !a.isHeader); 
  const bankAccounts = accounts.filter(a => a.type === AccountType.ASSET && (a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')) && !a.isHeader);

  // Set default Credit Account based on settlement type
  useEffect(() => {
      if (settlementType === 'OFFSET_ADVANCE') {
          // Try to find "Staff Advances" or similar
          const advAcc = assetAccounts.find(a => a.code === '1050') || assetAccounts.find(a => a.name.includes('Advance'));
          setCreditAccountId(advAcc?.id || '');
      } else {
          setCreditAccountId(bankAccounts[0]?.id || '');
      }
  }, [settlementType, accounts]);

  // Update Exchange Rate when currency changes
  useEffect(() => {
    setExchangeRate(systemRate);
  }, [currencyCode, systemRate]);

  const handleLineChange = (index: number, field: keyof ExpenseLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const addLine = () => {
    setLines([...lines, { accountId: '', description: '', amount: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const totalAmount = lines.reduce((sum, line) => sum + (line.amount || 0), 0);
  const isBaseCurrency = activeCurrencies.find(c => c.code === currencyCode)?.isBase;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Fallback to 1 if exchangeRate is undefined, null or NaN or 0
    const safeExchangeRate = (exchangeRate && !isNaN(exchangeRate) && exchangeRate !== 0) ? exchangeRate : 1;

    if (!employeeId || !creditAccountId || totalAmount <= 0 || lines.some(l => !l.accountId)) {
        setError("Please fill in all fields and ensure at least one expense line is added.");
        return;
    }

    setLoading(true);

    try {
        const selectedEmployee = employees.find(e => e.id === employeeId);
        const jeId = `je-settle-${Date.now()}`;
        
        // Construct Journal Entry Lines
        // 1. Debits (The Expenses) converted to Base Currency with full precision AND original metadata
        const jeLines = lines.map(line => ({
            accountId: line.accountId,
            debit: line.amount / safeExchangeRate,
            credit: 0,
            originalCurrency: currencyCode,
            originalExchangeRate: safeExchangeRate,
            originalDebit: line.amount,
            originalCredit: 0,
            description: line.description
        }));

        // 2. Credit (The Settlement) converted to Base Currency
        // Total Debit in Base - Sum first to ensure Balance equality
        const totalDebitBase = jeLines.reduce((sum, l) => sum + l.debit, 0);
        
        jeLines.push({
            accountId: creditAccountId,
            debit: 0,
            credit: totalDebitBase,
            originalCurrency: currencyCode,
            originalExchangeRate: safeExchangeRate,
            originalDebit: 0,
            originalCredit: totalAmount,
            description: 'Settlement Total'
        });

        const entry: JournalEntry = {
            id: jeId,
            date,
            description: `Settlement: ${selectedEmployee?.name} (${settlementType === 'OFFSET_ADVANCE' ? 'Advance Clearance' : 'Reimbursement'})`,
            reference: `SETTLE-${Date.now().toString().slice(-6)}`,
            branchId,
            currency: currencyCode,
            exchangeRate: safeExchangeRate,
            originalTotal: totalAmount,
            lines: jeLines,
            createdAt: Date.now()
        };

        await onSave(entry);
    } catch (err) {
        console.error(err);
        setError("Failed to post settlement.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <Card title="Driver / Employee Settlement Form">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Top Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
             <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee (Driver)</label>
                <select 
                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    value={employeeId}
                    onChange={e => setEmployeeId(e.target.value)}
                    required
                >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                </select>
            </div>
            <Input 
                label="Date" 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                required 
            />
            <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Currency</label>
                <select 
                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    value={currencyCode}
                    onChange={e => setCurrencyCode(e.target.value)}
                >
                    {activeCurrencies.map(c => (
                        <option key={c.id} value={c.code}>{c.code} - {c.name}</option>
                    ))}
                </select>
            </div>
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
        </div>

        {/* Expense Lines */}
        <div>
            <div className="flex justify-between items-end mb-2">
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Expense Details</h4>
                <span className="text-xs text-gray-500">Enter amounts in {currencyCode}</span>
            </div>
            
            <div className="space-y-2">
                {lines.map((line, index) => (
                    <div key={index} className="flex flex-col md:flex-row gap-2 items-start md:items-center bg-white p-2 border border-gray-100 rounded-lg shadow-sm">
                        <div className="flex-1 w-full">
                             <input 
                                className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="Description (e.g. Fuel, Toll, Repair)"
                                value={line.description}
                                onChange={e => handleLineChange(index, 'description', e.target.value)}
                                required
                             />
                        </div>
                        <div className="w-full md:w-64">
                            <select 
                                className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                value={line.accountId}
                                onChange={e => handleLineChange(index, 'accountId', e.target.value)}
                                required
                            >
                                <option value="">Select Expense Category</option>
                                {expenseAccounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-full md:w-40">
                            <input 
                                type="number"
                                step="0.01"
                                className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-right"
                                placeholder="Amount"
                                value={line.amount || ''}
                                onChange={e => handleLineChange(index, 'amount', parseFloat(e.target.value))}
                                required
                             />
                        </div>
                        <button 
                            type="button"
                            onClick={() => removeLine(index)}
                            className="text-red-400 hover:text-red-600 p-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                ))}
            </div>
            <div className="mt-3">
                <Button type="button" variant="secondary" onClick={addLine} className="text-xs">+ Add Expense Line</Button>
            </div>
        </div>

        {/* Totals & Settlement Logic */}
        <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                
                {/* Left: Settlement Config */}
                <div className="w-full md:w-2/3 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Settlement Method</label>
                        <div className="flex space-x-4">
                            <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors w-full ${settlementType === 'OFFSET_ADVANCE' ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                                <input 
                                    type="radio" 
                                    name="settleType" 
                                    className="text-indigo-600 focus:ring-indigo-500"
                                    checked={settlementType === 'OFFSET_ADVANCE'}
                                    onChange={() => setSettlementType('OFFSET_ADVANCE')}
                                />
                                <div className="ml-3">
                                    <span className="block text-sm font-medium text-gray-900">Offset Advance</span>
                                    <span className="block text-xs text-gray-500">Deduct from driver's debt</span>
                                </div>
                            </label>

                            <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors w-full ${settlementType === 'CASH_REIMBURSEMENT' ? 'bg-green-50 border-green-500 ring-1 ring-green-500' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                                <input 
                                    type="radio" 
                                    name="settleType" 
                                    className="text-green-600 focus:ring-green-500"
                                    checked={settlementType === 'CASH_REIMBURSEMENT'}
                                    onChange={() => setSettlementType('CASH_REIMBURSEMENT')}
                                />
                                <div className="ml-3">
                                    <span className="block text-sm font-medium text-gray-900">Cash Reimbursement</span>
                                    <span className="block text-xs text-gray-500">Pay driver immediately</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">
                            {settlementType === 'OFFSET_ADVANCE' ? 'Advance Account (Asset to Credit)' : 'Payment Account (Asset to Credit)'}
                         </label>
                         <select 
                            className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            value={creditAccountId}
                            onChange={e => setCreditAccountId(e.target.value)}
                            required
                        >
                            <option value="">Select Account</option>
                            {(settlementType === 'OFFSET_ADVANCE' ? assetAccounts : bankAccounts).map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                        <select
                            className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            value={branchId}
                            onChange={e => setBranchId(e.target.value)}
                            required
                        >
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Right: Totals */}
                <div className="w-full md:w-1/3 bg-gray-50 p-4 rounded-xl flex flex-col gap-2">
                     <div className="flex justify-between items-center">
                         <span className="text-sm text-gray-500">Total Expenses ({currencyCode})</span>
                         <span className="text-xl font-bold text-gray-900">
                             {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                         </span>
                     </div>
                     {currencyCode !== 'USD' && (
                         <div className="flex justify-between items-center border-t border-gray-200 pt-2">
                            <span className="text-sm text-indigo-600">Equivalent (USD)</span>
                            <span className="text-lg font-bold text-indigo-700">
                                ${(totalAmount / (exchangeRate || 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                         </div>
                     )}
                </div>
            </div>
        </div>

        {error && (
             <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
            </div>
        )}

        <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" isLoading={loading}>Post Settlement</Button>
        </div>

      </form>
    </Card>
  );
};
