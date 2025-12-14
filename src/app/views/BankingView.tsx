import { useData } from '../../shared/contexts/DataContext';
import { firebaseService } from '../../services/firebaseService';
import { BankingDashboard } from '../../components/banking/BankingDashboard';

export default function BankingView() {
  const { accounts, transactions, branches, currencies, refreshData } = useData();

  return (
    <BankingDashboard
      accounts={accounts}
      transactions={transactions}
      branches={branches}
      currencies={currencies}
      onTransfer={async (entry) => {
        await firebaseService.addTransaction(entry);
        await refreshData();
      }}
      onAddAccount={async (acc) => {
        await firebaseService.addAccount(acc);
        await refreshData();
      }}
    />
  );
}
