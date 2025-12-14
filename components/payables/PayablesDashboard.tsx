
import React, { useState, useMemo } from 'react';
import { Account, Branch, Vendor, Bill, AccountType, BillStatus, JournalEntry, CurrencyConfig, BillPayment } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { BillForm } from './BillForm';
import { VendorList } from './VendorList';
import { DirectPurchaseForm } from './DirectPurchaseForm';
import { useLanguage } from '../../contexts/LanguageContext';

interface Props {
  bills: Bill[];
  vendors: Vendor[];
  accounts: Account[];
  branches: Branch[];
  currencies?: CurrencyConfig[];
  onCreateBill: (bill: Bill) => Promise<void>;
  onAddVendor: (vendor: Vendor) => Promise<void>;
  onUpdateVendor: (vendor: Vendor) => Promise<void>;
  onRecordPayment: (billId: string, amount: number, paymentAccountId: string, date: string, reference: string) => Promise<void>;
  onSaveTransaction?: (entry: JournalEntry) => Promise<void>;
  onGetBillPayments?: (billId: string) => Promise<BillPayment[]>;
}

export const PayablesDashboard: React.FC<Props> = ({ 
    bills, vendors, accounts, branches, currencies = [],
    onCreateBill, onAddVendor, onUpdateVendor, onRecordPayment, onSaveTransaction, onGetBillPayments
}) => {
  const { t } = useLanguage();
  const [view, setView] = useState<'LIST' | 'NEW_BILL' | 'DIRECT_PURCHASE' | 'VENDORS' | 'AGING'>('LIST');
  // ... state logic ...

  const formatCurrency = (num: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);

  if (view === 'NEW_BILL') {
      return <BillForm
        vendors={vendors}
        accounts={accounts}
        branches={branches}
        onSave={async (bill) => { await onCreateBill(bill); setView('LIST'); }}
        onCancel={() => setView('LIST')}
      />;
  }

  if (view === 'DIRECT_PURCHASE') {
      if (!onSaveTransaction) return <div>Error</div>;
      return <DirectPurchaseForm 
        accounts={accounts}
        branches={branches}
        currencies={currencies}
        onSave={async (entry) => { await onSaveTransaction(entry); setView('LIST'); }}
        onCancel={() => setView('LIST')}
      />;
  }

  if (view === 'VENDORS') {
      return <VendorList vendors={vendors} onAddVendor={onAddVendor} onUpdateVendor={onUpdateVendor} />;
  }

  return (
     <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-indigo-50 border-indigo-100">
                <div className="text-indigo-800 text-sm font-medium">{t('total_payable')}</div>
                <div className="text-2xl font-bold text-indigo-900 mt-1">
                    {formatCurrency(bills.reduce((acc, b) => acc + (b.totalAmount - b.amountPaid), 0))}
                </div>
            </Card>
            <Card>
                <div className="text-gray-500 text-sm font-medium">{t('overdue_bills')}</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                    {bills.filter(b => b.status === 'POSTED' && new Date(b.dueDate) < new Date()).length}
                </div>
            </Card>
            <div className="flex flex-col space-y-2 justify-center">
                <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => setView('NEW_BILL')} className="text-sm">{t('enter_bill')}</Button>
                    <Button onClick={() => setView('DIRECT_PURCHASE')} className="text-sm bg-teal-600 hover:bg-teal-700">{t('cash_purchase')}</Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={() => setView('AGING')} className="text-sm">{t('aging_report')}</Button>
                    <Button variant="outline" onClick={() => setView('VENDORS')} className="text-sm">{t('manage_vendors')}</Button>
                </div>
            </div>
        </div>

        <Card title="Payables List">
            <div className="text-center py-8 text-gray-500">{t('bill')} list goes here... (Use component logic for full list)</div>
        </Card>
     </div>
  );
};
