
import React, { useState, useEffect } from 'react';
import { Account, Branch, Vendor, Bill, BillLine, AccountType, CurrencyConfig } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { ImageUpload } from '../ui/ImageUpload';
import { getFriendlyErrorMessage } from '../../utils/errorUtils';

interface Props {
  vendors: Vendor[];
  accounts: Account[];
  branches: Branch[];
  currencies?: CurrencyConfig[];
  onSave: (bill: Bill) => Promise<void>;
  onCancel: () => void;
}

export const BillForm: React.FC<Props> = ({ vendors, accounts, branches, currencies = [], onSave, onCancel }) => {
  // Default currencies fallback
  const activeCurrencies = currencies.length > 0 ? currencies : [
      { id: 'curr-usd', code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1, isBase: true }
  ];

  const [vendorId, setVendorId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [attachment, setAttachment] = useState('');
  
  // Currency State
  const [currencyCode, setCurrencyCode] = useState<string>(() => {
      const base = activeCurrencies.find(c => c.isBase);
      return base ? base.code : activeCurrencies[0].code;
  });
  const [exchangeRate, setExchangeRate] = useState<number>(1);

  const [lines, setLines] = useState<BillLine[]>([
    { description: '', quantity: 1, amount: 0, expenseAccountId: '' }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const expenseAccounts = accounts.filter(a => 
      (a.type === AccountType.EXPENSE || a.type === AccountType.ASSET) && !a.isHeader
  );

  useEffect(() => {
      const selectedCurr = activeCurrencies.find(c => c.code === currencyCode);
      if (selectedCurr) {
          setExchangeRate(selectedCurr.exchangeRate || 1);
      }
  }, [currencyCode, activeCurrencies]);

  const updateLine = (index: number, field: keyof BillLine, value: any) => {
    const newLines = [...lines];
    const line = { ...newLines[index], [field]: value };
    newLines[index] = line;
    setLines(newLines);
  };

  const addLine = () => {
    setLines([...lines, { description: '', quantity: 1, amount: 0, expenseAccountId: '' }]);
  };

  const removeLine = (index: number) => {
    if(lines.length > 1) {
        setLines(lines.filter((_, i) => i !== index));
    }
  };

  const totalAmount = lines.reduce((sum, l) => sum + l.amount, 0);
  const isBaseCurrency = activeCurrencies.find(c => c.code === currencyCode)?.isBase;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!vendorId || !billNumber || lines.some(l => !l.expenseAccountId)) {
        setError("Please complete all required fields.");
        return;
    }

    if (!exchangeRate || exchangeRate <= 0) {
        setError("Exchange rate must be valid and greater than 0.");
        return;
    }

    setLoading(true);
    const selectedVendor = vendors.find(v => v.id === vendorId);

    const bill: Bill = {
        id: `bill-${Date.now()}`,
        vendorId,
        vendorName: selectedVendor?.name || 'Unknown',
        billNumber, // Vendor's invoice #
        date,
        dueDate: dueDate || date,
        status: 'DRAFT',
        lines,
        totalAmount,
        amountPaid: 0, // Force un-paid
        branchId,
        createdAt: Date.now(),
        attachment: attachment || undefined,
        currency: currencyCode,
        exchangeRate: exchangeRate
    };

    try {
        await onSave(bill);
    } catch (e: any) {
        console.error(e);
        setError(getFriendlyErrorMessage(e));
    } finally {
        setLoading(false);
    }
  };

  return (
    <Card title="Enter New Bill">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                <select 
                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    value={vendorId}
                    onChange={e => setVendorId(e.target.value)}
                    required
                >
                    <option value="">Select Vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
            </div>
            <Input label="Bill Number" value={billNumber} onChange={e => setBillNumber(e.target.value)} placeholder="Vendor Invoice #" required />
            <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
            <Input label="Due Date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            
            <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                <select
                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    value={branchId}
                    onChange={e => setBranchId(e.target.value)}
                >
                    {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
            </div>

            {/* Currency Fields */}
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
            <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Exchange Rate (to USD)</label>
                <input
                    type="number"
                    step="any"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                    disabled={isBaseCurrency}
                />
            </div>
        </div>

        {/* Lines */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="grid grid-cols-12 gap-2 mb-2 text-xs font-semibold text-gray-500 uppercase">
                <div className="col-span-4">Description</div>
                <div className="col-span-4">Expense/Asset Account</div>
                <div className="col-span-1 text-right">Qty</div>
                <div className="col-span-2 text-right">Amount ({currencyCode})</div>
                <div className="col-span-1"></div>
            </div>
            {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-center">
                    <div className="col-span-4">
                        <input className="w-full border border-gray-300 rounded-lg text-sm px-2 py-1.5 focus:ring-indigo-500 focus:border-indigo-500" 
                            placeholder="Description"
                            value={line.description}
                            onChange={e => updateLine(idx, 'description', e.target.value)}
                            required
                        />
                    </div>
                    <div className="col-span-4">
                        <select className="w-full border border-gray-300 rounded-lg text-sm px-2 py-1.5 focus:ring-indigo-500 focus:border-indigo-500"
                            value={line.expenseAccountId}
                            onChange={e => updateLine(idx, 'expenseAccountId', e.target.value)}
                            required
                        >
                            <option value="">Select Account</option>
                            {expenseAccounts.map(a => (
                                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-span-1">
                         <input type="number" min="1" className="w-full border border-gray-300 rounded-lg text-sm text-right px-2 py-1.5 focus:ring-indigo-500 focus:border-indigo-500"
                            value={line.quantity}
                            onChange={e => updateLine(idx, 'quantity', Number(e.target.value))}
                         />
                    </div>
                    <div className="col-span-2">
                         <input type="number" min="0" step="0.01" className="w-full border border-gray-300 rounded-lg text-sm text-right px-2 py-1.5 focus:ring-indigo-500 focus:border-indigo-500"
                            value={line.amount}
                            onChange={e => updateLine(idx, 'amount', Number(e.target.value))}
                            required
                         />
                    </div>
                    <div className="col-span-1 text-center">
                        <button type="button" onClick={() => removeLine(idx)} className="text-gray-400 hover:text-red-600">&times;</button>
                    </div>
                </div>
            ))}
            <Button type="button" variant="secondary" onClick={addLine} className="text-xs mt-2">+ Add Line</Button>
            
            <div className="flex justify-end mt-4 pt-4 border-t border-gray-200">
                <div className="text-right">
                    <span className="text-gray-500 text-sm mr-4">Total Payable</span>
                    <span className="text-xl font-bold text-indigo-600">
                        {totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})} {currencyCode}
                    </span>
                    {!isBaseCurrency && (
                        <div className="text-xs text-gray-400 mt-1">
                            ≈ ${(totalAmount / (exchangeRate || 1)).toLocaleString(undefined, {minimumFractionDigits: 2})} USD
                        </div>
                    )}
                </div>
            </div>
        </div>
        
        <div>
            <ImageUpload 
                label="Bill Attachment (e.g. Scanned Invoice)"
                value={attachment}
                onChange={setAttachment}
            />
        </div>

        {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
            </div>
        )}

        <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" isLoading={loading}>Post Bill</Button>
        </div>
      </form>
    </Card>
  );
};
