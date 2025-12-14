import { useData } from '../../shared/contexts/DataContext';
import { firebaseService } from '../../services/firebaseService';
import { PayablesDashboard } from '../../components/payables/PayablesDashboard';

export default function PayablesView() {
  const { bills, vendors, accounts, branches, currencies, refreshData } = useData();

  return (
    <PayablesDashboard
      bills={bills}
      vendors={vendors}
      accounts={accounts}
      branches={branches}
      currencies={currencies}
      onCreateBill={async (b) => {
        await firebaseService.createBill(b);
        await refreshData();
      }}
      onAddVendor={async (v) => {
        await firebaseService.addVendor(v);
        await refreshData();
      }}
      onUpdateVendor={async (v) => {
        await firebaseService.updateVendor(v);
        await refreshData();
      }}
      onRecordPayment={async (bid, amt, acc, date, ref) => {
        await firebaseService.recordBillPayment({
          id: `bpay-${Date.now()}`,
          billId: bid,
          amount: amt,
          paymentAccountId: acc,
          date,
          reference: ref,
        });
        await refreshData();
      }}
      onSaveTransaction={async (entry) => {
        await firebaseService.addTransaction(entry);
        await refreshData();
      }}
      onGetBillPayments={(bid) => firebaseService.getBillPayments(bid)}
    />
  );
}
