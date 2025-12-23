
import React, { useState, useEffect, useMemo } from 'react';
import { Account, Branch, Customer, Invoice, InvoiceLine, AccountType, TaxRate, CurrencyConfig } from '../../src/shared/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { ImageUpload } from '../ui/ImageUpload';
import { getFriendlyErrorMessage } from '../../src/shared/utils/errorUtils';

interface Props {
  customers: Customer[];
  accounts: Account[];
  branches: Branch[];
  currencies?: CurrencyConfig[];
  taxRates?: TaxRate[];
  onSave: (invoice: Invoice) => Promise<void>;
  onCancel: () => void;
}

export const InvoiceForm: React.FC<Props> = ({ 
    customers, accounts, branches, currencies = [], taxRates = [], onSave, onCancel 
}) => {
  // Default currencies fallback
  const activeCurrencies = currencies.length > 0 ? currencies : [
      { id: 'curr-usd', code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1, isBase: true }
  ];

  // --- Form State ---
  const [customerId, setCustomerId] = useState('');
  const [number, setNumber] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [attachment, setAttachment] = useState('');

  // Currency State
  const [currencyCode, setCurrencyCode] = useState<string>(() => {
      const base = activeCurrencies.find(c => c.isBase);
      return base ? base.code : activeCurrencies[0].code;
  });
  const [exchangeRate, setExchangeRate] = useState<number>(1);

  // Tax State
  const [selectedTaxRateId, setSelectedTaxRateId] = useState('');

  // Lines State
  const [lines, setLines] = useState<InvoiceLine[]>([
    { description: '', quantity: 1, unitPrice: 0, amount: 0, revenueAccountId: '' }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const revenueAccounts = accounts.filter(a => a.type === AccountType.REVENUE && !a.isHeader);
  
  // Only show active customers for new invoices
  const activeCustomers = customers.filter(c => c.status !== 'INACTIVE');

  useEffect(() => {
      const selectedCurr = activeCurrencies.find(c => c.code === currencyCode);
      if (selectedCurr) {
          setExchangeRate(selectedCurr.exchangeRate || 1);
      }
  }, [currencyCode, activeCurrencies]);

  const updateLine = (index: number, field: keyof InvoiceLine, value: any) => {
    const newLines = [...lines];
    const line = { ...newLines[index], [field]: value };
    
    // Auto calc amount
    if (field === 'quantity' || field === 'unitPrice') {
        line.amount = Number(line.quantity) * Number(line.unitPrice);
    }
    
    newLines[index] = line;
    setLines(newLines);
  };

  const addLine = () => {
    setLines([...lines, { description: '', quantity: 1, unitPrice: 0, amount: 0, revenueAccountId: revenueAccounts[0]?.id || '' }]);
  };

  const removeLine = (index: number) => {
    if(lines.length > 1) {
        setLines(lines.filter((_, i) => i !== index));
    }
  };

  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  
  let taxAmount = 0;
  let taxName = '';
  
  if (selectedTaxRateId) {
      const taxRate = taxRates.find(tr => tr.id === selectedTaxRateId);
      if (taxRate) {
          taxAmount = subtotal * (taxRate.rate / 100);
          taxName = taxRate.name;
      }
  }
  
  const totalAmount = subtotal + taxAmount;
  const isBaseCurrency = activeCurrencies.find(c => c.code === currencyCode)?.isBase;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerId || lines.some(l => !l.revenueAccountId)) {
        setError("Please select a customer and ensure all lines have a revenue account.");
        return;
    }

    if (!exchangeRate || exchangeRate <= 0) {
        setError("Exchange rate must be greater than 0.");
        return;
    }

    setLoading(true);
    const selectedCustomer = customers.find(c => c.id === customerId);

    const invoice: Invoice = {
        id: `inv-${Date.now()}`,
        number,
        customerId,
        customerName: selectedCustomer?.name || 'Unknown',
        date,
        dueDate: dueDate || date,
        status: 'DRAFT',
        lines,
        
        // Currency info
        currency: currencyCode,
        exchangeRate: exchangeRate,

        subtotal,
        taxRateId: selectedTaxRateId || undefined,
        taxName: taxName || undefined,
        taxAmount,
        totalAmount,

        amountPaid: 0, 
        branchId,
        notes,
        createdAt: Date.now(),
        attachment: attachment || undefined
    };

    try {
        await onSave(invoice);
    } catch (e: any) {
        console.error(e);
        setError(getFriendlyErrorMessage(e));
    } finally {
        setLoading(false);
    }
  };

  return (
    <Card title="Create New Invoice">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Header Section */}
        <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Row 1 */}
            <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                <select 
                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                    required
                >
                    <option value="">Select Customer</option>
                    {activeCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {activeCustomers.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">No active customers found.</p>
                )}
            </div>
            <Input label="Invoice Number" value={number} onChange={e => setNumber(e.target.value)} required />
            <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
            <Input label="Due Date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />

            {/* Row 2 */}
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
                <div className="relative rounded-md shadow-sm">
                    <input
                        type="number"
                        step="any"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                        disabled={isBaseCurrency}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-xs">
                             {currencyCode}/USD
                        </span>
                    </div>
                </div>
            </div>
        </div>

        {/* Line Items Section */}
        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                    <div className="grid grid-cols-12 gap-2 p-3 bg-gray-100 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        <div className="col-span-4">Description</div>
                        <div className="col-span-3">Revenue Account</div>
                        <div className="col-span-1 text-right">Qty</div>
                        <div className="col-span-2 text-right">Unit Price ({currencyCode})</div>
                        <div className="col-span-2 text-right">Amount ({currencyCode})</div>
                    </div>
                    <div className="bg-white">
                        {lines.map((line, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 p-2 border-b border-gray-50 items-center hover:bg-gray-50">
                                <div className="col-span-4">
                                    <input className="w-full border border-gray-300 rounded-lg text-sm px-3 py-1.5 focus:ring-indigo-500 focus:border-indigo-500" 
                                        placeholder="Item description"
                                        value={line.description}
                                        onChange={e => updateLine(idx, 'description', e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="col-span-3">
                                    <select className="w-full border border-gray-300 rounded-lg text-sm px-3 py-1.5 focus:ring-indigo-500 focus:border-indigo-500"
                                        value={line.revenueAccountId}
                                        onChange={e => updateLine(idx, 'revenueAccountId', e.target.value)}
                                        required
                                    >
                                        <option value="">Select Account</option>
                                        {revenueAccounts.map(a => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-1">
                                    <input type="number" min="1" className="w-full border border-gray-300 rounded-lg text-sm text-right px-3 py-1.5 focus:ring-indigo-500 focus:border-indigo-500"
                                        value={line.quantity}
                                        onChange={e => updateLine(idx, 'quantity', Number(e.target.value))}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <input type="number" min="0" step="0.01" className="w-full border border-gray-300 rounded-lg text-sm text-right px-3 py-1.5 focus:ring-indigo-500 focus:border-indigo-500"
                                        value={line.unitPrice}
                                        onChange={e => updateLine(idx, 'unitPrice', Number(e.target.value))}
                                    />
                                </div>
                                <div className="col-span-2 flex items-center justify-end gap-2">
                                    <span className="font-medium text-gray-900 text-sm">
                                        {line.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </span>
                                    <button type="button" onClick={() => removeLine(idx)} className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-200">
                <Button type="button" variant="secondary" onClick={addLine} className="text-xs py-1 h-8">
                    + Add Item
                </Button>
            </div>
        </div>

        {/* Footer Section: Notes & Totals */}
        <div className="flex flex-col md:flex-row justify-between gap-8">
            <div className="flex-1 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Payment Instructions</label>
                    <textarea 
                        className="w-full h-24 border border-gray-300 rounded-xl p-3 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Thank you for your business..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                    ></textarea>
                </div>
                <div>
                    <ImageUpload 
                        label="Attachment (Optional)"
                        value={attachment}
                        onChange={setAttachment}
                    />
                </div>
            </div>

            <div className="w-full md:w-80 space-y-4 bg-gray-50 p-6 rounded-xl border border-gray-200">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal ({currencyCode})</span>
                    <span className="text-gray-900 font-medium">{subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>

                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Tax</span>
                    <div className="flex items-center justify-end space-x-2">
                            <select
                            className="border border-gray-300 rounded text-xs py-1 px-1 w-24"
                            value={selectedTaxRateId}
                            onChange={e => setSelectedTaxRateId(e.target.value)}
                            >
                            <option value="">No Tax</option>
                            {taxRates.map(tr => (
                                <option key={tr.id} value={tr.id}>{tr.name}</option>
                            ))}
                            </select>
                            <span className="text-gray-900 font-medium">{taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                </div>

                <div className="border-t border-gray-300 pt-4 mt-2">
                    <div className="flex justify-between items-end">
                        <span className="text-gray-900 font-bold text-lg">Total</span>
                        <span className="text-indigo-600 font-bold text-xl">
                            {totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-xs font-normal text-gray-500">{currencyCode}</span>
                        </span>
                    </div>
                    {!isBaseCurrency && (
                        <div className="text-right mt-1">
                            <span className="text-xs text-gray-500">
                                ≈ ${(totalAmount / exchangeRate).toLocaleString(undefined, {minimumFractionDigits: 2})} USD
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            {error}
            </div>
        )}

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" isLoading={loading}>Create & Post Invoice</Button>
        </div>
      </form>
    </Card>
  );
};
