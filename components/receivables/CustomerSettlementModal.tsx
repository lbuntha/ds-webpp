
import React, { useState, useMemo, useEffect } from 'react';
import { Customer, Account, WalletTransaction, AccountType, AccountSubType, Invoice } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ImageUpload } from '../ui/ImageUpload';
import { firebaseService } from '../../services/firebaseService';

interface Props {
  customer: Customer;
  accounts: Account[];
  invoices?: Invoice[]; // Added invoices prop
  currentUserUid: string;
  currentUserName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const CustomerSettlementModal: React.FC<Props> = ({ 
  customer, accounts, invoices = [], currentUserUid, currentUserName, onClose, onSuccess 
}) => {
  const [type, setType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState<'USD' | 'KHR'>('USD');
  const [bankAccountId, setBankAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Selection State
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());

  // Filter Bank Accounts
  const bankAccounts = accounts.filter(a => 
    a.type === AccountType.ASSET && 
    (a.subType === AccountSubType.CURRENT_ASSET || a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('cash')) && 
    !a.isHeader
  );

  // Identify items to settle (Unpaid invoices for this customer)
  const outstandingInvoices = useMemo(() => {
      return invoices.filter(inv => 
          inv.customerId === customer.id && 
          inv.status === 'POSTED' && 
          (inv.totalAmount - inv.amountPaid) > 0.01 &&
          (inv.currency === currency) // Match selected currency
      );
  }, [invoices, customer.id, currency]);

  // When selected invoices change or currency changes, update amount
  useEffect(() => {
      if (type === 'DEPOSIT') {
          // If items are selected, sum them up.
          if (selectedInvoiceIds.size > 0) {
              const total = outstandingInvoices
                  .filter(inv => selectedInvoiceIds.has(inv.id))
                  .reduce((sum, inv) => sum + (inv.totalAmount - inv.amountPaid), 0);
              setAmount(parseFloat(total.toFixed(2)));
          } else {
              // If nothing selected, allow 0 (or manual entry logic if we wanted, but enforcing selection is safer)
              setAmount(0);
          }
      }
  }, [selectedInvoiceIds, outstandingInvoices, type]);

  // Reset selection when currency changes
  useEffect(() => {
      setSelectedInvoiceIds(new Set());
      setAmount(0);
  }, [currency]);

  const toggleInvoice = (id: string) => {
      const next = new Set(selectedInvoiceIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedInvoiceIds(next);
  };

  const selectAll = () => {
      if (selectedInvoiceIds.size === outstandingInvoices.length) setSelectedInvoiceIds(new Set());
      else setSelectedInvoiceIds(new Set(outstandingInvoices.map(i => i.id)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || !bankAccountId) return;

    setLoading(true);
    try {
      let relatedItems = undefined;
      
      if (type === 'DEPOSIT' && selectedInvoiceIds.size > 0) {
          relatedItems = Array.from(selectedInvoiceIds).map(invId => ({ bookingId: invId, itemId: 'invoice' })); 
      }

      const txn: WalletTransaction = {
          id: `wtxn-${Date.now()}`,
          userId: customer.linkedUserId || customer.id, 
          userName: customer.name,
          amount,
          currency,
          type,
          status: 'PENDING',
          date: new Date().toISOString().split('T')[0],
          description: description || (type === 'DEPOSIT' ? 'Customer Payment/Deposit' : 'Customer Withdrawal'),
          bankAccountId,
          attachment,
          relatedItems: relatedItems,
          rejectionReason: `Requested by ${currentUserName}` 
      };

      await firebaseService.walletService.saveDocument('wallet_transactions', txn);

      alert("Settlement request submitted for approval.");
      onSuccess();
    } catch (e) {
      console.error(e);
      alert("Failed to submit request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
            <div>
                <h3 className="text-lg font-bold text-gray-900">Request Settlement</h3>
                <p className="text-xs text-gray-500">Maker: {currentUserName}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>

        <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 mb-6">
            <p className="text-xs font-bold text-indigo-800 uppercase">Customer</p>
            <p className="text-sm font-medium text-gray-900">{customer.name}</p>
            <p className="text-xs text-gray-500">{customer.phone}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
                    <div className="flex rounded-md shadow-sm">
                        <button
                            type="button"
                            onClick={() => setType('DEPOSIT')}
                            className={`flex-1 py-2 text-xs font-bold border rounded-l-lg ${type === 'DEPOSIT' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300'}`}
                        >
                            Receive (In)
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('WITHDRAWAL')}
                            className={`flex-1 py-2 text-xs font-bold border rounded-r-lg ${type === 'WITHDRAWAL' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-300'}`}
                        >
                            Pay (Out)
                        </button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                    <select
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={currency}
                        onChange={e => { setCurrency(e.target.value as any); setAmount(0); }}
                    >
                        <option value="USD">USD</option>
                        <option value="KHR">KHR</option>
                    </select>
                </div>
            </div>

            {/* Outstanding Items List (Deposit Only) */}
            {type === 'DEPOSIT' && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                className="rounded text-indigo-600"
                                checked={outstandingInvoices.length > 0 && selectedInvoiceIds.size === outstandingInvoices.length}
                                onChange={selectAll}
                                disabled={outstandingInvoices.length === 0}
                            />
                            <span className="text-xs font-bold text-gray-600 uppercase">Select Invoices ({outstandingInvoices.length})</span>
                        </div>
                    </div>
                    <div className="max-h-40 overflow-y-auto bg-white">
                        {outstandingInvoices.length > 0 ? (
                            <table className="min-w-full divide-y divide-gray-100">
                                <tbody className="divide-y divide-gray-100">
                                    {outstandingInvoices.map(inv => (
                                        <tr key={inv.id} className={selectedInvoiceIds.has(inv.id) ? 'bg-indigo-50' : ''}>
                                            <td className="px-3 py-2 w-8">
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded text-indigo-600"
                                                    checked={selectedInvoiceIds.has(inv.id)}
                                                    onChange={() => toggleInvoice(inv.id)}
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-xs text-gray-600">{inv.number}</td>
                                            <td className="px-3 py-2 text-xs text-gray-500">{inv.date}</td>
                                            <td className="px-3 py-2 text-xs font-medium text-right text-gray-900">
                                                {(inv.totalAmount - inv.amountPaid).toLocaleString()} {inv.currency}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-4 text-center text-xs text-gray-400 italic">
                                No outstanding invoices in {currency}.
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Settlement Amount</label>
                <input 
                    type="number" 
                    step="0.01"
                    className={`block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-bold text-lg ${type === 'DEPOSIT' && selectedInvoiceIds.size > 0 ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
                    value={amount}
                    onChange={e => setAmount(parseFloat(e.target.value))}
                    readOnly={type === 'DEPOSIT' && selectedInvoiceIds.size > 0}
                    required
                />
                {type === 'DEPOSIT' && selectedInvoiceIds.size > 0 && <p className="text-xs text-gray-500 mt-1">Amount locked to total of selected items.</p>}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {type === 'DEPOSIT' ? 'Deposit Into (Bank/Cash)' : 'Pay From (Bank/Cash)'}
                </label>
                <select
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    value={bankAccountId}
                    onChange={e => setBankAccountId(e.target.value)}
                    required
                >
                    <option value="">-- Select Account --</option>
                    {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proof / Attachment</label>
                <ImageUpload value={attachment} onChange={setAttachment} />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note / Reference</label>
                <input 
                    type="text"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g. Wire Transfer Ref #9988"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" isLoading={loading}>Submit Request</Button>
            </div>
        </form>
      </div>
    </div>
  );
};
