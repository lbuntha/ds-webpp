import React, { useState, useEffect } from 'react';
import { Account, Branch, Employee, JournalEntry, CurrencyConfig, AccountType, AccountSubType } from '../../src/shared/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { getFriendlyErrorMessage } from '../../src/shared/utils/errorUtils';

interface Props {
  accounts: Account[];
  branches: Branch[];
  employees: Employee[];
  currencies: CurrencyConfig[];
  onSave: (entry: JournalEntry) => Promise<void>;
  onCancel: () => void;
}

export const StaffDepositForm: React.FC<Props> = ({ 
  accounts, branches, employees, currencies, onSave, onCancel 
}) => {
  const activeCurrencies = currencies.length > 0 ? currencies : [
      { id: 'curr-usd', code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1, isBase: true }
  ];

  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');
  
  const [currencyCode, setCurrencyCode] = useState<string>(() => {
      const base = activeCurrencies.find(c => c.isBase);
      return base ? base.code : activeCurrencies[0].code;
  });
  const [exchangeRate, setExchangeRate] = useState<number>(() => {
      const selected = activeCurrencies.find(c => c.code === currencyCode) || activeCurrencies.find(c => c.isBase) || activeCurrencies[0];
      return selected.exchangeRate;
  });

  const [depositToAccountId, setDepositToAccountId] = useState(''); 
  const [liabilityAccountId, setLiabilityAccountId] = useState(''); 

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assetAccounts = accounts.filter(a => 
      a.type === AccountType.ASSET && 
      (a.subType === AccountSubType.CURRENT_ASSET || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')) &&
      !a.isHeader
  );

  const liabilityAccounts = accounts.filter(a => a.type === AccountType.LIABILITY && !a.isHeader);

  useEffect(() => {
    const selectedCurr = activeCurrencies.find(c => c.code === currencyCode);
    if (selectedCurr) {
        setExchangeRate(selectedCurr.exchangeRate);
    }
  }, [currencyCode, activeCurrencies]);

  useEffect(() => {
      if (employeeId && !description) {
          const emp = employees.find(e => e.id === employeeId);
          if (emp) setDescription(`Security Deposit - ${emp.name}`);
      }
  }, [employeeId, employees, description]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const safeExchangeRate = (exchangeRate && !isNaN(exchangeRate) && exchangeRate !== 0) ? exchangeRate : 1;

    if (!employeeId || !depositToAccountId || !liabilityAccountId || amount <= 0) {
        setError("Please fill in all required fields.");
        return;
    }

    setLoading(true);

    try {
        const selectedEmployee = employees.find(e => e.id === employeeId);
        const jeId = `je-dep-${Date.now()}`;
        
        const baseAmount = amount / safeExchangeRate;

        const entry: JournalEntry = {
            id: jeId,
            date,
            description: description || `Staff Deposit - ${selectedEmployee?.name}`,
            reference: `DEP-${Date.now().toString().slice(-6)}`,
            branchId,
            currency: currencyCode,
            exchangeRate: safeExchangeRate,
            originalTotal: amount,
            lines: [
                {
                    accountId: depositToAccountId,
                    debit: baseAmount,
                    credit: 0
                },
                {
                    accountId: liabilityAccountId,
                    debit: 0,
                    credit: baseAmount
                }
            ],
            createdAt: Date.now()
        };

        await onSave(entry);
    } catch (err) {
        console.error(err);
        setError(getFriendlyErrorMessage(err));
    } finally {
        setLoading(false);
    }
  };

  return (
    <Card title="Receive Staff Deposit">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
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
        </div>

        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input 
                    type="number"
                    step="0.01"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm font-semibold"
                    value={amount}
                    onChange={e => setAmount(parseFloat(e.target.value))}
                    required
                />
            </div>
            <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
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
            <Input 
                label="Exchange Rate" 
                type="number" 
                step="any"
                value={exchangeRate} 
                onChange={e => setExchangeRate(parseFloat(e.target.value))} 
                disabled={activeCurrencies.find(c => c.code === currencyCode)?.isBase}
                required 
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-medium text-green-700 mb-1">Deposit To (Debit Asset)</label>
                <select 
                    className="block w-full px-3 py-2 border border-green-300 rounded-xl shadow-sm focus:outline-none focus:ring-green-500 sm:text-sm bg-green-50"
                    value={depositToAccountId}
                    onChange={e => setDepositToAccountId(e.target.value)}
                    required
                >
                    <option value="">Select Cash/Bank Account</option>
                    {assetAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Where is the money being kept?</p>
            </div>

            <div>
                <label className="block text-sm font-medium text-red-700 mb-1">Deposit Type (Credit Liability)</label>
                <select 
                    className="block w-full px-3 py-2 border border-red-300 rounded-xl shadow-sm focus:outline-none focus:ring-red-500 sm:text-sm bg-red-50"
                    value={liabilityAccountId}
                    onChange={e => setLiabilityAccountId(e.target.value)}
                    required
                >
                    <option value="">Select Liability Account</option>
                    {liabilityAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">e.g. Staff Security Deposits</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <Input 
                label="Description / Notes" 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                required 
            />
        </div>

        {error && (
             <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
            </div>
        )}

        <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" isLoading={loading}>Record Deposit</Button>
        </div>

      </form>
    </Card>
  );
};
