
import React, { useState, useMemo } from 'react';
import { Account, Branch, Customer, Invoice, AccountType, TaxRate, CurrencyConfig } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { InvoiceForm } from './InvoiceForm';
import { CustomerList } from './CustomerList';
import { getFriendlyErrorMessage } from '../../utils/errorUtils';
import { useLanguage } from '../../contexts/LanguageContext';
import { WalletRequests } from '../banking/WalletRequests'; 

interface Props {
  invoices: Invoice[];
  customers: Customer[];
  accounts: Account[];
  branches: Branch[];
  currencies?: CurrencyConfig[];
  taxRates?: TaxRate[];
  onCreateInvoice: (inv: Invoice) => Promise<void>;
  onAddCustomer: (cust: Customer) => Promise<void>;
  onUpdateCustomer: (cust: Customer) => Promise<void>;
  onReceivePayment: (invoiceId: string, amount: number, depositAccountId: string) => Promise<void>;
}

export const ReceivablesDashboard: React.FC<Props> = ({ 
    invoices, customers, accounts, branches, currencies = [], taxRates = [],
    onCreateInvoice, onAddCustomer, onUpdateCustomer, onReceivePayment 
}) => {
  const { t } = useLanguage();
  const [view, setView] = useState<'LIST' | 'NEW_INVOICE' | 'CUSTOMERS' | 'AGING' | 'SETTLEMENTS'>('LIST');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  
  // Payment Form State
  const [payAmount, setPayAmount] = useState<number>(0);
  const [depositAccount, setDepositAccount] = useState<string>('');
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Filter asset accounts (Cash/Bank) for deposit
  const assetAccounts = accounts.filter(a => a.type === AccountType.ASSET);

  const openPaymentModal = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setPayAmount(inv.totalAmount - inv.amountPaid);
    const cashAcc = assetAccounts.find(a => a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank'));
    setDepositAccount(cashAcc?.id || '');
    setPaymentError(null);
    setPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async () => {
    if(!selectedInvoice || !depositAccount || payAmount <= 0) return;
    setPaying(true);
    setPaymentError(null);
    try {
        await onReceivePayment(selectedInvoice.id, payAmount, depositAccount);
        setPaymentModalOpen(false);
        setSelectedInvoice(null);
    } catch(e) {
        setPaymentError(getFriendlyErrorMessage(e));
    } finally {
        setPaying(false);
    }
  };

  const formatCurrency = (num: number, currency: string = 'USD') => {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(num);
  };

  // --- Aging Report Calculation ---
  const agingReport = useMemo(() => {
    const report: Record<string, { name: string, current: number, d1_30: number, d31_60: number, d61_90: number, d90plus: number, total: number }> = {};
    
    customers.forEach(c => {
        report[c.id] = {
            name: c.name,
            current: 0,
            d1_30: 0,
            d31_60: 0,
            d61_90: 0,
            d90plus: 0,
            total: 0
        };
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    invoices.forEach(inv => {
      if (inv.status === 'PAID' || inv.status === 'VOID') return;
      
      const rate = inv.exchangeRate || 1;
      const balanceOrig = inv.totalAmount - inv.amountPaid;
      const balanceBase = balanceOrig / rate;

      if (balanceBase <= 0.01) return;

      if (!report[inv.customerId]) {
        report[inv.customerId] = {
          name: inv.customerName,
          current: 0,
          d1_30: 0,
          d31_60: 0,
          d61_90: 0,
          d90plus: 0,
          total: 0
        };
      }

      const entry = report[inv.customerId];
      entry.total += balanceBase;

      const dueDate = new Date(inv.dueDate);
      dueDate.setHours(0,0,0,0);
      
      const diffTime = today.getTime() - dueDate.getTime();
      const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) {
        entry.current += balanceBase;
      } else if (daysOverdue <= 30) {
        entry.d1_30 += balanceBase;
      } else if (daysOverdue <= 60) {
        entry.d31_60 += balanceBase;
      } else if (daysOverdue <= 90) {
        entry.d61_90 += balanceBase;
      } else {
        entry.d90plus += balanceBase;
      }
    });

    return Object.values(report)
        .filter(r => r.total > 0.01)
        .sort((a, b) => b.total - a.total);
  }, [invoices, customers]);

  const agingTotals = useMemo(() => {
      return agingReport.reduce((acc, row) => ({
          current: acc.current + row.current,
          d1_30: acc.d1_30 + row.d1_30,
          d31_60: acc.d31_60 + row.d31_60,
          d61_90: acc.d61_90 + row.d61_90,
          d90plus: acc.d90plus + row.d90plus,
          total: acc.total + row.total
      }), { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 });
  }, [agingReport]);

  if (view === 'NEW_INVOICE') {
      return <InvoiceForm 
        customers={customers} 
        accounts={accounts} 
        branches={branches}
        currencies={currencies}
        taxRates={taxRates}
        onSave={async (inv) => {
            await onCreateInvoice(inv);
            setView('LIST');
        }}
        onCancel={() => setView('LIST')}
      />;
  }

  if (view === 'CUSTOMERS') {
      return (
        <div>
            <div className="mb-4">
                <button onClick={() => setView('LIST')} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    Back to Dashboard
                </button>
            </div>
            <CustomerList 
              customers={customers} 
              accounts={accounts}
              invoices={invoices} // Passing invoices
              onAddCustomer={onAddCustomer} 
              onUpdateCustomer={onUpdateCustomer} 
            />
        </div>
      );
  }

  if (view === 'SETTLEMENTS') {
      return (
        <div>
            <div className="mb-4">
                <button onClick={() => setView('LIST')} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    Back to Dashboard
                </button>
            </div>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-yellow-700">
                            View pending settlement requests below. To initiate a new settlement for a specific customer, please go to <strong>Manage Customers</strong> and click "Settle".
                        </p>
                    </div>
                </div>
            </div>
            {/* Reusing WalletRequests logic for approval workflow */}
            <WalletRequests />
        </div>
      );
  }

  if (view === 'AGING') {
      return (
        <div className="space-y-6">
            <div className="mb-4 flex justify-between items-center">
                <button onClick={() => setView('LIST')} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    Back to Dashboard
                </button>
                <Button onClick={() => window.print()} variant="outline" className="text-xs hidden md:flex">
                    Print Report
                </Button>
            </div>

            <Card title="Receivables Aging Summary (USD Equivalent)">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('customer')}</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Current</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">1-30 Days</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">31-60 Days</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">61-90 Days</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">&gt; 90 Days</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-900 uppercase tracking-wider font-bold">Total Due</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {agingReport.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.name}</td>
                                    <td className="px-6 py-4 text-sm text-right text-gray-500">{row.current > 0 ? formatCurrency(row.current) : '-'}</td>
                                    <td className="px-6 py-4 text-sm text-right text-yellow-600">{row.d1_30 > 0 ? formatCurrency(row.d1_30) : '-'}</td>
                                    <td className="px-6 py-4 text-sm text-right text-orange-500">{row.d31_60 > 0 ? formatCurrency(row.d31_60) : '-'}</td>
                                    <td className="px-6 py-4 text-sm text-right text-red-500">{row.d61_90 > 0 ? formatCurrency(row.d61_90) : '-'}</td>
                                    <td className="px-6 py-4 text-sm text-right text-red-700 font-bold">{row.d90plus > 0 ? formatCurrency(row.d90plus) : '-'}</td>
                                    <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">{formatCurrency(row.total)}</td>
                                </tr>
                            ))}
                            {agingReport.length === 0 && (
                                <tr><td colSpan={7} className="text-center py-8 text-gray-500">No outstanding receivables.</td></tr>
                            )}
                            {agingReport.length > 0 && (
                                <tr className="bg-gray-100 font-bold">
                                    <td className="px-6 py-4 text-sm text-gray-900">Totals</td>
                                    <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(agingTotals.current)}</td>
                                    <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(agingTotals.d1_30)}</td>
                                    <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(agingTotals.d31_60)}</td>
                                    <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(agingTotals.d61_90)}</td>
                                    <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(agingTotals.d90plus)}</td>
                                    <td className="px-6 py-4 text-sm text-right text-indigo-700">{formatCurrency(agingTotals.total)}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
      );
  }

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-indigo-50 border-indigo-100">
                <div className="text-indigo-800 text-sm font-medium">{t('total_receivables')} (Base)</div>
                <div className="text-2xl font-bold text-indigo-900 mt-1">
                    {formatCurrency(invoices.reduce((acc, i) => acc + ((i.totalAmount - i.amountPaid) / (i.exchangeRate || 1)), 0))}
                </div>
            </Card>
            <Card>
                <div className="text-gray-500 text-sm font-medium">{t('overdue_invoices')}</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                    {invoices.filter(i => i.status === 'POSTED' && new Date(i.dueDate) < new Date()).length}
                </div>
            </Card>
            <div className="flex flex-col space-y-2 justify-center">
                <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => setView('NEW_INVOICE')} className="text-sm">{t('create_invoice')}</Button>
                    <Button variant="secondary" onClick={() => setView('SETTLEMENTS')} className="text-sm border-blue-200 bg-blue-50 text-blue-700">Settlements</Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => setView('AGING')} className="text-sm">{t('aging_report')}</Button>
                    <Button variant="outline" onClick={() => setView('CUSTOMERS')} className="text-sm">{t('manage_customers')}</Button>
                </div>
            </div>
        </div>

        <Card title="Recent Invoices">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('date')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('customer')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('status')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('total')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('balance')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {invoices.map(inv => (
                            <tr key={inv.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm text-gray-500">{inv.date}</td>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.number}</td>
                                <td className="px-6 py-4 text-sm text-gray-900">{inv.customerName}</td>
                                <td className="px-6 py-4 text-sm">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        inv.status === 'PAID' ? 'bg-green-100 text-green-800' : 
                                        inv.status === 'POSTED' ? 'bg-blue-100 text-blue-800' : 
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {inv.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-right text-gray-900">
                                    {formatCurrency(inv.totalAmount, inv.currency || 'USD')}
                                </td>
                                <td className="px-6 py-4 text-sm text-right font-bold text-gray-700">
                                    {formatCurrency(inv.totalAmount - inv.amountPaid, inv.currency || 'USD')}
                                </td>
                                <td className="px-6 py-4 text-sm text-right">
                                    {inv.status === 'POSTED' && (
                                        <button 
                                            onClick={() => openPaymentModal(inv)}
                                            className="text-indigo-600 hover:text-indigo-900 font-medium"
                                        >
                                            {t('receive_payment')}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
        
        {paymentModalOpen && selectedInvoice && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-900">{t('receive_payment')}</h3>
                        <button onClick={() => setPaymentModalOpen(false)} className="text-gray-400 hover:text-gray-500">&times;</button>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-gray-500">
                            Receiving payment for <strong>{selectedInvoice.number}</strong> from {selectedInvoice.customerName}.
                        </p>
                        
                        {paymentError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                                {paymentError}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Amount Received ({selectedInvoice.currency || 'USD'})</label>
                            <input 
                                type="number" 
                                className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                value={payAmount}
                                onChange={e => setPayAmount(parseFloat(e.target.value))}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Deposit To</label>
                            <select
                                className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                value={depositAccount}
                                onChange={e => setDepositAccount(e.target.value)}
                            >
                                <option value="">Select Account</option>
                                {assetAccounts.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Funds will be debited to this asset account.</p>
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end space-x-3">
                        <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>{t('cancel')}</Button>
                        <Button onClick={handlePaymentSubmit} isLoading={paying}>{t('save')}</Button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
