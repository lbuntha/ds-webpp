import { useData } from '../../shared/contexts/DataContext';
import { Dashboard as DashboardComponent } from '../../../components/Dashboard';

export default function DashboardView() {
    const { transactions, accounts, branches } = useData();

    return (
        <DashboardComponent
            transactions={transactions}
            accounts={accounts}
            branches={branches}
        />
    );
}
