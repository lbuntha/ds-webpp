import React, { useMemo } from 'react';
import { Account, Branch, JournalEntry, AccountType } from '../src/shared/types';
import { AccountingService } from '../src/shared/services/accountingService';
import { Card } from './ui/Card';
import { useLanguage } from '../src/shared/contexts/LanguageContext';

interface Props {
    transactions: JournalEntry[];
    accounts: Account[];
    branches: Branch[];
}

export const Dashboard: React.FC<Props> = ({ transactions, accounts }) => {
    const { t } = useLanguage();

    const stats = useMemo(() => {
        const tb = AccountingService.generateTrialBalance(accounts, transactions);

        let revenue = 0;
        let expenses = 0;
        let assets = 0;
        let liabilities = 0;

        tb.forEach(row => {
            // Filter out headers to avoid double counting children
            if (row.isHeader) return;

            if (row.type === AccountType.REVENUE) revenue += (row.credit - row.debit);
            if (row.type === AccountType.EXPENSE) expenses += (row.debit - row.credit);
            if (row.type === AccountType.ASSET) assets += (row.debit - row.credit);
            if (row.type === AccountType.LIABILITY) liabilities += (row.credit - row.debit);
        });

        return { revenue, expenses, netIncome: revenue - expenses, cash: assets - liabilities /* Simplified metric */ };
    }, [transactions, accounts]);

    const StatCard = ({ label, value, color }: { label: string, value: number, color: string }) => (
        <Card className="border-l-4" style={{ borderLeftColor: color }}>
            <dt className="text-sm font-medium text-gray-500 truncate">{label}</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}
            </dd>
        </Card>
    );

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">{t('dashboard')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label={t('revenue')} value={stats.revenue} color="#4f46e5" />
                <StatCard label={t('expenses')} value={stats.expenses} color="#ef4444" />
                <StatCard label={t('net_income')} value={stats.netIncome} color="#10b981" />
            </div>

            <div className="grid grid-cols-1 gap-6">
                <Card title={t('recent_activity')}>
                    <div className="flow-root">
                        <ul className="-my-5 divide-y divide-gray-200">
                            {(transactions || []).slice(-5).reverse().map((txn) => (
                                <li key={txn.id} className="py-4">
                                    <div className="flex items-center space-x-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {txn.description}
                                            </p>
                                            <div className="flex items-center text-sm text-gray-500">
                                                <span>{t('reference')}: {txn.reference || 'N/A'}</span>
                                                <span className="mx-2">•</span>
                                                <span>{new Date(txn.date).toLocaleDateString()}</span>
                                                {txn.currency && txn.currency !== 'USD' && (
                                                    <>
                                                        <span className="mx-2">•</span>
                                                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
                                                            {txn.currency} @ {txn.exchangeRate}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-base font-semibold text-gray-900">
                                                ${txn.lines.reduce((sum, l) => sum + l.debit, 0).toLocaleString()}
                                            </div>
                                            {txn.currency && txn.currency !== 'USD' && txn.originalTotal && (
                                                <div className="text-xs text-gray-500">
                                                    ({txn.originalTotal.toLocaleString()} {txn.currency})
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                            {(transactions || []).length === 0 && <li className="py-4 text-gray-500 text-sm">No transactions yet.</li>}
                        </ul>
                    </div>
                </Card>
            </div>
        </div>
    );
};
