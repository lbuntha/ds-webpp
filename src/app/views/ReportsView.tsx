import { useData } from '../../shared/contexts/DataContext';
import { Reports } from '../../../components/Reports';

export default function ReportsView() {
  const { transactions, accounts, branches } = useData();

  return <Reports transactions={transactions} accounts={accounts} branches={branches} />;
}
