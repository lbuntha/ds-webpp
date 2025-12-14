import { useData } from '../../shared/contexts/DataContext';
import { firebaseService } from '../../services/firebaseService';
import { ReceivablesDashboard } from '../../components/receivables/ReceivablesDashboard';

export default function ReceivablesView() {
    const { invoices, customers, accounts, branches, currencies, taxRates, refreshData } = useData();

    return (
        <ReceivablesDashboard
            invoices={invoices}
            customers={customers}
            accounts={accounts}
            branches={branches}
            currencies={currencies}
            taxRates={taxRates}
            onCreateInvoice={async (inv) => {
                await firebaseService.createInvoice(inv);
                await refreshData();
            }}
            onAddCustomer={async (c) => {
                await firebaseService.addCustomer(c);
                await refreshData();
            }}
            onUpdateCustomer={async (c) => {
                await firebaseService.updateCustomer(c);
                await refreshData();
            }}
            onReceivePayment={async (id, amt, acc) => {
                await firebaseService.recordPayment({
                    id: `pay-${Date.now()}`,
                    invoiceId: id,
                    amount: amt,
                    date: new Date().toISOString().split('T')[0],
                    depositAccountId: acc,
                });
                await refreshData();
            }}
        />
    );
}
