import { useData } from '../../shared/contexts/DataContext';
import { useAuth } from '../../shared/contexts/AuthContext';
import { firebaseService } from '../../shared/services/firebaseService';
import { BankingDashboard } from '../../../components/banking/BankingDashboard';

export default function BankingView() {
  const { accounts, transactions, branches, currencies, refreshData } = useData();
  const { user } = useAuth();

  return (
    <BankingDashboard
      accounts={accounts}
      transactions={transactions}
      branches={branches}
      currencies={currencies}
      currentUser={user}
      onTransactionAction={async (entry, action) => {
        if (action === 'SUBMIT') {
          await firebaseService.submitForApproval(entry, user?.uid || '', user?.name || 'Unknown');
        } else if (action === 'APPROVE') {
          await firebaseService.approveJournalEntry(entry.id, user?.uid || '', user?.name || 'Unknown');
        } else if (action === 'REJECT') {
          await firebaseService.rejectJournalEntry(entry.id, entry.rejectionReason || '', user?.uid || '', user?.name || 'Unknown');
        }
        await refreshData();
      }}
      onAddAccount={async (acc) => {
        await firebaseService.addAccount(acc);
        await refreshData();
      }}
    />
  );
}
