
import React, { useState, useEffect } from 'react';
import { Account, Branch, JournalEntry, CurrencyConfig, AccountType, AccountSubType } from '../../src/shared/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { ImageUpload } from '../ui/ImageUpload';
import { getFriendlyErrorMessage } from '../../src/shared/utils/errorUtils';

interface Props {
  accounts: Account[];
  branches: Branch[];
  currencies: CurrencyConfig[];
  onSave: (entry: JournalEntry) => Promise<void>;
  onCancel: () => void;
}

interface PurchaseLine {
  description: string;
  accountId: string;
  amount: number;
}

export const DirectPurchaseForm: React.FC<Props> = ({ 
  accounts, branches, currencies, onSave, onCancel 
}) => {
  const activeCurrencies = currencies.length > 0 ? currencies : [
      { id: 'curr-usd', code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1, isBase: true }
  ];

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [payee, setPayee] = useState('');
  const [reference, setReference] = useState('');
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [attachment, setAttachment] = useState('');
  
  const [currencyCode, setCurrencyCode] = useState<string>(() => {
      const base = activeCurrencies.find(c => c.isBase);
      return base ? base.code : activeCurrencies[0].code;
  });
  const [exchangeRate, setExchangeRate] = useState<number>(1);

  const [lines, setLines] = useState<PurchaseLine[]>([
    { description: '', accountId: '', amount: 0 }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paymentAccounts = accounts.filter(a => 
      a.type === AccountType.ASSET && 
      (a.subType === AccountSubType.CURRENT_ASSET || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')) &&
      !a.isHeader
  );

  const purchaseAccounts = accounts.filter(a => 
      (a.type === AccountType.EXPENSE || a.type === AccountType.ASSET) && 
      !a.isHeader
  );

  useEffect(() => {
    const selectedCurr = activeCurrencies.find(c => c.code === currencyCode);
    if (selectedCurr) {
        setExchangeRate(selectedCurr.exchangeRate || 1);
    }
  }, [currencyCode, activeCurrencies]);

  const updateLine = (index: number, field: keyof PurchaseLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const addLine = () => {
    setLines([...lines, { description: '', accountId: '', amount: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
        setLines(lines.filter((_, i) => i !== index));
    }
  };

  const totalAmount = lines.reduce((sum, l) => sum + (l.amount || 0), 0);
  const isBaseCurrency = activeCurrencies.find(c => c.code === currencyCode)?.isBase;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!paymentAccountId || totalAmount <= 0 || lines.some(l => !l.accountId || !l.description)) {
        setError("Please fill in all required fields and ensure total is greater than 0.");
        return;
    }

    const safeRate = exchangeRate || 1;
    if (safeRate <= 0) {
        setError("Exchange rate must be valid.");
        return;
    }

    setLoading(true);

    try {
        const jeId = `je-pur-${Date.now()}`;
        const jeLines = [];

        // 1. Debits (Items)
        for (const line of lines) {
            jeLines.push({
                accountId: line.accountId,
                debit: line.amount / safeRate,
                credit: 0,
                originalCurrency: currencyCode,
                originalExchangeRate: safeRate,
                originalDebit: line.amount,
                originalCredit: 0,
                description: line.description
            });
        }

        // 2. Credit (Payment)
        jeLines.push({
            accountId: paymentAccountId,
            debit: 0,
            credit: totalAmount / safeRate,
            originalCurrency: currencyCode,
            originalExchangeRate: safeRate,
            originalDebit: 0,
            originalCredit: totalAmount
        });

        const entry: JournalEntry = {
            id: jeId,
            date,
            description: `Cash Purchase${payee ? ' - ' + payee : ''}`,
            reference: reference || `PUR-${Date.now().toString().slice(-6)}`,
            branchId,
            currency: currencyCode,
            exchangeRate: safeRate,
            originalTotal: totalAmount,
            lines: jeLines,
            createdAt: Date.now(),
            attachment: attachment || undefined
        };

        await onSave(entry);
    } catch (err: any) {
        console.error(err);
        setError(getFriendlyErrorMessage(err));
    } finally {
        setLoading(false);
    }
  };

  return (
    <Card title="Record Cash Purchase (Asset / Expense)">
        <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Header */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Input 
                    label="Date" 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)} 
                    required 
                />
                <Input 
                    label="Payee (Optional)" 
                    value={payee} 
                    onChange={e => setPayee(e.target.value)} 
                    placeholder="Store Name / Vendor"
                />
                
                <div className="w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paid From (Credit)</label>
                    <select
                        className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                        value={paymentAccountId}
                        onChange={e => setPaymentAccountId(e.target.value)}
                        required
                    >
                        <option value="">Select Account</option>
                        {paymentAccounts.map(a => (
                            <option key={a.id} value={a.id}>{a.name} ({a.currency || 'USD'})</option>
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

            {/* Currency Config */}
            <div className="flex gap-4">
                 <div className="w-1/2 md:w-1/4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                    <select
                        className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                        value={currencyCode}
                        onChange={e => setCurrencyCode(e.target.value)}
                    >
                        {activeCurrencies.map(c => (
                            <option key={c.id} value={c.code}>{c.code}</option>
                        ))}
                    </select>
                </div>
                <div className="w-1/2 md:w-1/4">
                     <Input 
                        label="Exchange Rate" 
                        type="number" 
                        step="any"
                        value={exchangeRate} 
                        onChange={e => setExchangeRate(parseFloat(e.target.value))}
                        disabled={isBaseCurrency}
                    />
                </div>
                <div className="w-full md:w-1/2">
                    <Input 
                        label="Reference #" 
                        value={reference} 
                        onChange={e => setReference(e.target.value)} 
                        placeholder="Receipt No."
                    />
                </div>
            </div>

            {/* Line Items */}
            <div>
                <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Purchase Items</h4>
                </div>
                
                <div className="space-y-2">
                    {lines.map((line, idx) => (
                        <div key={idx} className="flex flex-col md:flex-row gap-2 items-start md:items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="flex-1 w-full">
                                <input 
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Item Description (e.g. Office Stationery, Laptop)"
                                    value={line.description}
                                    onChange={e => updateLine(idx, 'description', e.target.value)}
                                    required
                                />
                            </div>
                            <div className="w-full md:w-1/3">
                                <select 
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    value={line.accountId}
                                    onChange={e => updateLine(idx, 'accountId', e.target.value)}
                                    required
                                >
                                    <option value="">Select Account (Expense/Asset)</option>
                                    {purchaseAccounts.map(a => (
                                        <option key={a.id} value={a.id} className={a.type === AccountType.ASSET ? 'font-bold text-blue-700' : ''}>
                                            {a.code} - {a.name} {a.type === AccountType.ASSET ? '(Asset)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-full md:w-32">
                                <input 
                                    type="number"
                                    step="0.01"
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-right font-semibold"
                                    placeholder="0.00"
                                    value={line.amount || ''}
                                    onChange={e => updateLine(idx, 'amount', parseFloat(e.target.value))}
                                    required
                                />
                            </div>
                            <button 
                                type="button"
                                onClick={() => removeLine(idx)}
                                className="text-gray-400 hover:text-red-500 p-1"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                    ))}
                </div>
                
                <div className="mt-3 flex justify-between items-center">
                    <Button type="button" variant="secondary" onClick={addLine} className="text-xs">+ Add Line</Button>
                    <div className="text-right">
                        <span className="text-gray-500 text-sm mr-2">Total Paid:</span>
                        <span className="text-lg font-bold text-indigo-700">
                            {totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})} {currencyCode}
                        </span>
                    </div>
                </div>
            </div>
            
            <div className="mt-4">
                <ImageUpload 
                    label="Receipt Attachment (Optional)"
                    value={attachment}
                    onChange={setAttachment}
                />
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="submit" isLoading={loading}>Record Purchase</Button>
            </div>
        </form>
    </Card>
  );
};
