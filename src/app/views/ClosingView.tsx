import { useData } from '../../shared/contexts/DataContext';
import { firebaseService } from '../../services/firebaseService';
import { ClosingDashboard } from '../../components/closing/ClosingDashboard';

export default function ClosingView() {
  const { settings, accounts, transactions, branches, currencies, invoices, bills, refreshData } = useData();

  return (
    <ClosingDashboard
      settings={settings}
      accounts={accounts}
      transactions={transactions}
      branches={branches}
      currencies={currencies}
      invoices={invoices}
      bills={bills}
      onUpdateSettings={async (s) => {
        await firebaseService.updateSettings(s);
        await refreshData();
      }}
      onPostClosingEntry={async (entry) => {
        await firebaseService.addTransaction(entry);
        await refreshData();
      }}
      onDeleteAccount={async (id) => {
        await firebaseService.deleteAccount(id);
        await refreshData();
      }}
    />
  );
}
