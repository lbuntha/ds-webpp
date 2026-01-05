import React, { useState, useMemo } from 'react';
import { Account, Branch, StaffLoan, StaffLoanRepayment, AccountType, Employee, JournalEntry, CurrencyConfig } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { toast } from '../../src/shared/utils/toast';

interface Props {
    loans: StaffLoan[];
    employees: Employee[];
    accounts: Account[];
    branches: Branch[];
    currencies?: CurrencyConfig[];
    transactions: JournalEntry[];
    onCreateLoan: (loan: StaffLoan) => Promise<void>;
    onRepayLoan: (repayment: StaffLoanRepayment) => Promise<void>;
    onAddEmployee: (employee: Employee) => Promise<void>;
    onUpdateEmployee: (employee: Employee) => Promise<void>;
    onSaveTransaction: (entry: JournalEntry) => Promise<void>;
}

export const StaffLoansDashboard: React.FC<Props> = ({
    loans, employees, accounts, branches, currencies = [], transactions,
    onCreateLoan, onRepayLoan, onAddEmployee, onUpdateEmployee, onSaveTransaction
}) => {
    const [view, setView] = useState<'LIST' | 'NEW' | 'EMPLOYEES' | 'SETTLEMENT' | 'DEPOSIT'>('LIST');
    const [repayModalOpen, setRepayModalOpen] = useState(false);
    const [selectedLoan, setSelectedLoan] = useState<StaffLoan | null>(null);

    // Repayment Form State
    const [repayAmount, setRepayAmount] = useState<number>(0);
    const [depositAccount, setDepositAccount] = useState<string>('');
    const [repayDate, setRepayDate] = useState(new Date().toISOString().split('T')[0]);
    const [processing, setProcessing] = useState(false);

    // Filter for Bank/Cash accounts for deposit
    const assetAccounts = accounts.filter(a =>
        a.type === AccountType.ASSET &&
        ((a.name || '').toLowerCase().includes('cash') || (a.name || '').toLowerCase().includes('bank'))
    );

    const formatCurrency = (num: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);

    const openRepayModal = (loan: StaffLoan) => {
        setSelectedLoan(loan);
        setRepayAmount(loan.amount - loan.amountRepaid);
        setDepositAccount(assetAccounts[0]?.id || '');
        setRepayModalOpen(true);
    };

    const handleRepaymentSubmit = async () => {
        if (!selectedLoan || !depositAccount || repayAmount <= 0) return;

        setProcessing(true);
        try {
            const repayment: StaffLoanRepayment = {
                id: `lpay-${Date.now()}`,
                loanId: selectedLoan.id,
                date: repayDate,
                amount: repayAmount,
                depositAccountId: depositAccount,
                createdAt: Date.now()
            };
            await onRepayLoan(repayment);
            setRepayModalOpen(false);
            setSelectedLoan(null);
        } catch (e) {
            toast.error("Failed to record repayment");
        } finally {
            setProcessing(false);
        }
    };

    // --- Stats ---
    const stats = useMemo(() => {
        const totalLent = loans.reduce((acc, l) => acc + l.amount, 0);
        const totalRepaid = loans.reduce((acc, l) => acc + l.amountRepaid, 0);
        const outstanding = totalLent - totalRepaid;
        return { totalLent, totalRepaid, outstanding };
    }, [loans]);

    // --- Filter Transactions for Staff History ---
    const staffActivity = useMemo(() => {
        return transactions.filter(t =>
            t.id.startsWith('je-settle-') || // DriverSettlementForm
            t.id.startsWith('je-dep-') ||    // StaffDepositForm
            t.id.startsWith('je-loan-') ||   // Loan Issue
            t.id.startsWith('je-lpay-')      // Repayment
        );
    }, [transactions]);

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-indigo-50 border-indigo-100">
                    <div className="text-indigo-800 text-sm font-medium">Total Outstanding</div>
                    <div className="text-2xl font-bold text-indigo-900 mt-1">
                        {formatCurrency(stats.outstanding)}
                    </div>
                </Card>
                <Card>
                    <div className="text-gray-500 text-sm font-medium">Total Issued (All Time)</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">
                        {formatCurrency(stats.totalLent)}
                    </div>
                </Card>
            </div>

            <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">Loan Records</h2>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase pl-8">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loans.map(loan => {
                                const balance = loan.amount - loan.amountRepaid;
                                return (
                                    <tr key={loan.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm text-gray-500">{loan.date}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{loan.employeeName}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{loan.description}</td>
                                        <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(loan.amount)}</td>
                                        <td className="px-6 py-4 text-sm text-right text-green-600">{formatCurrency(loan.amountRepaid)}</td>
                                        <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">{formatCurrency(balance)}</td>
                                        <td className="px-6 py-4 text-sm pl-8">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${loan.status === 'PAID' ? 'bg-green-100 text-green-800' :
                                                'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {loan.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm">
                                            {loan.status === 'ACTIVE' && (
                                                <button
                                                    onClick={() => openRepayModal(loan)}
                                                    className="text-indigo-600 hover:text-indigo-900 font-medium"
                                                >
                                                    Repay
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {loans.length === 0 && (
                                <tr><td colSpan={8} className="text-center py-8 text-gray-500">No loan records found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <h2 className="text-lg font-medium text-gray-900 pt-4">Recent Staff Activity</h2>
            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activity Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {staffActivity.length > 0 ? staffActivity.slice(0, 15).map(txn => {
                                let typeLabel = 'Transaction';
                                let typeColor = 'bg-gray-100 text-gray-800';

                                if (txn.id.startsWith('je-settle-')) { typeLabel = 'Settlement'; typeColor = 'bg-blue-100 text-blue-800'; }
                                else if (txn.id.startsWith('je-dep-')) { typeLabel = 'Deposit'; typeColor = 'bg-green-100 text-green-800'; }
                                else if (txn.id.startsWith('je-loan-')) { typeLabel = 'Loan Issued'; typeColor = 'bg-orange-100 text-orange-800'; }
                                else if (txn.id.startsWith('je-lpay-')) { typeLabel = 'Repayment'; typeColor = 'bg-teal-100 text-teal-800'; }

                                const totalAmount = txn.originalTotal || txn.lines.reduce((sum, l) => sum + l.debit, 0);

                                return (
                                    <tr key={txn.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm text-gray-500">{txn.date}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeColor}`}>
                                                {typeLabel}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">{txn.description}</td>
                                        <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                                            {formatCurrency(totalAmount)}
                                            {txn.currency && txn.currency !== 'USD' && (
                                                <span className="text-xs text-gray-500 ml-1">({txn.currency})</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr><td colSpan={4} className="text-center py-8 text-gray-500">No recent activity found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Repayment Modal */}
            {repayModalOpen && selectedLoan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-900">Record Repayment</h3>
                            <button onClick={() => setRepayModalOpen(false)} className="text-gray-400 hover:text-gray-500">&times;</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-500">
                                Recording payment from <strong>{selectedLoan.employeeName}</strong>.
                                <br />
                                Outstanding Balance: <span className="font-semibold text-gray-900">{formatCurrency(selectedLoan.amount - selectedLoan.amountRepaid)}</span>
                            </p>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Amount</label>
                                <input
                                    type="number"
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={repayAmount}
                                    onChange={e => setRepayAmount(parseFloat(e.target.value))}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                <input
                                    type="date"
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={repayDate}
                                    onChange={e => setRepayDate(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Deposit To (Bank/Cash)</label>
                                <select
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={depositAccount}
                                    onChange={e => setDepositAccount(e.target.value)}
                                >
                                    <option value="">Select Account</option>
                                    {assetAccounts.map(a => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end space-x-3">
                            <Button variant="outline" onClick={() => setRepayModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleRepaymentSubmit} isLoading={processing}>Save Repayment</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};