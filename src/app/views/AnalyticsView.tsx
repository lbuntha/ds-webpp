import { useData } from '../../shared/contexts/DataContext';
import { AnalyticsDashboard } from '../../../components/analytics/AnalyticsDashboard';

export default function AnalyticsView() {
    const { accounts, transactions, invoices, bills } = useData();

    return (
        <AnalyticsDashboard
            accounts={accounts}
            transactions={transactions}
            invoices={invoices}
            bills={bills}
        />
    );
}
