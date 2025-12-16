import { useData } from '../../shared/contexts/DataContext';
import { firebaseService } from '../../shared/services/firebaseService';
import { StaffLoansDashboard } from '../../../components/staff/StaffLoansDashboard';

export default function StaffLoansView() {
  const { loans, employees, accounts, branches, currencies, transactions, refreshData } = useData();

  return (
    <StaffLoansDashboard
      loans={loans}
      employees={employees}
      accounts={accounts}
      branches={branches}
      currencies={currencies}
      transactions={transactions}
      onCreateLoan={async (l) => {
        await firebaseService.createStaffLoan(l);
        await refreshData();
      }}
      onRepayLoan={async (r) => {
        await firebaseService.recordStaffLoanRepayment(r);
        await refreshData();
      }}
      onAddEmployee={async (e) => {
        await firebaseService.addEmployee(e);
        await refreshData();
      }}
      onUpdateEmployee={async (e) => {
        await firebaseService.updateEmployee(e);
        await refreshData();
      }}
      onSaveTransaction={async (e) => {
        await firebaseService.addTransaction(e);
        await refreshData();
      }}
    />
  );
}
