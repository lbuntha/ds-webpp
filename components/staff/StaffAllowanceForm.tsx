import React, { useState } from 'react';
import { Account, Branch, StaffTransaction, Employee, TransactionType, AllowanceCategory, DeductionCategory } from '../../src/shared/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { getFriendlyErrorMessage } from '../../src/shared/utils/errorUtils';

interface Props {
    employees: Employee[];
    accounts: Account[]; // For payment/expense mapping
    branches: Branch[];
    onSave: (transaction: StaffTransaction) => Promise<void>;
    onCancel: () => void;
}

export const StaffAllowanceForm: React.FC<Props> = ({ employees, accounts, branches, onSave, onCancel }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [employeeId, setEmployeeId] = useState('');
    const [employeeName, setEmployeeName] = useState('');
    const [type, setType] = useState<TransactionType>('ALLOWANCE');
    const [category, setCategory] = useState<string>('GASOLINE');
    const [amount, setAmount] = useState<number>(0);
    const [currency, setCurrency] = useState<'USD' | 'KHR'>('USD');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');
    const [branchId, setBranchId] = useState(branches[0]?.id || '');

    // Payment Mode
    const [paymentMode, setPaymentMode] = useState<'PENDING_PAYROLL' | 'PAID_IMMEDIATELY'>('PENDING_PAYROLL');
    const [paymentAccountId, setPaymentAccountId] = useState(''); // If paid immediately

    // Helper lists
    const allowanceCategories: AllowanceCategory[] = ['GASOLINE', 'PHONE_CARD', 'MEAL', 'ACCOMMODATION', 'OVERTIME', 'BONUS', 'OTHER_ALLOWANCE'];
    const deductionCategories: DeductionCategory[] = ['LATENESS', 'ABSENCE', 'DAMAGED_GOODS', 'LOAN_REPAYMENT', 'OTHER_DEDUCTION'];

    const bankAccounts = accounts.filter(a =>
        (a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')) &&
        !a.isHeader
    );

    const handleEmployeeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setEmployeeId(id);
        const emp = employees.find(x => x.id === id);
        if (emp) setEmployeeName(emp.name);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!employeeId || amount <= 0) {
            setError("Please fill all required fields.");
            return;
        }

        if (paymentMode === 'PAID_IMMEDIATELY' && !paymentAccountId) {
            setError("Please select a Payment Account for immediate payment.");
            return;
        }

        setLoading(true);

        const transaction: StaffTransaction = {
            id: `txn-${Date.now()}`,
            employeeId,
            employeeName,
            type,
            category,
            amount,
            currency,
            date,
            description,
            branchId,
            status: paymentMode,
            paymentAccountId: paymentMode === 'PAID_IMMEDIATELY' ? paymentAccountId : undefined,
            createdAt: Date.now(),
            createdBy: 'system' // Should be current user
        };

        try {
            await onSave(transaction);
        } catch (e) {
            setError(getFriendlyErrorMessage(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card title="Record Staff Transaction">
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Transaction Type Toggle */}
                <div className="flex space-x-4 border-b border-gray-100 pb-4">
                    <label className={`flex items-center space-x-2 cursor-pointer p-3 rounded-lg border transition-all ${type === 'ALLOWANCE' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <input
                            type="radio"
                            name="type"
                            checked={type === 'ALLOWANCE'}
                            onChange={() => { setType('ALLOWANCE'); setCategory('GASOLINE'); }}
                            className="w-4 h-4 text-green-600 focus:ring-green-500"
                        />
                        <span className={`font-medium ${type === 'ALLOWANCE' ? 'text-green-700' : 'text-gray-600'}`}>Allowance</span>
                    </label>
                    <label className={`flex items-center space-x-2 cursor-pointer p-3 rounded-lg border transition-all ${type === 'DEDUCTION' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <input
                            type="radio"
                            name="type"
                            checked={type === 'DEDUCTION'}
                            onChange={() => { setType('DEDUCTION'); setCategory('LATENESS'); }}
                            className="w-4 h-4 text-red-600 focus:ring-red-500"
                        />
                        <span className={`font-medium ${type === 'DEDUCTION' ? 'text-red-700' : 'text-gray-600'}`}>Deduction</span>
                    </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="w-full">
                        <Input
                            label="Date"
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            required
                        />
                    </div>

                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                        <select
                            className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            value={employeeId}
                            onChange={handleEmployeeChange}
                            required
                        >
                            <option value="">Select Employee</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <select
                            className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                            required
                        >
                            {type === 'ALLOWANCE'
                                ? allowanceCategories.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)
                                : deductionCategories.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)
                            }
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-1">
                            <Input
                                label="Amount"
                                type="number"
                                min="0"
                                step="0.01"
                                value={amount}
                                onChange={e => setAmount(parseFloat(e.target.value))}
                                required
                            />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                            <select
                                className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                value={currency}
                                onChange={e => setCurrency(e.target.value as 'USD' | 'KHR')}
                            >
                                <option value="USD">USD ($)</option>
                                <option value="KHR">KHR (៛)</option>
                            </select>
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <Input
                            label="Description"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Details about this transaction..."
                        />
                    </div>

                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                        <select
                            className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            value={branchId}
                            onChange={e => setBranchId(e.target.value)}
                            required
                        >
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Payment Configuration */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 className="text-sm font-bold text-gray-800 mb-3">Payment / Payroll Settings</h4>
                    <div className="space-y-3">
                        <div className="flex space-x-4">
                            <label className="inline-flex items-center">
                                <input type="radio" className="form-radio text-indigo-600"
                                    name="paymentMode"
                                    checked={paymentMode === 'PENDING_PAYROLL'}
                                    onChange={() => setPaymentMode('PENDING_PAYROLL')}
                                />
                                <span className="ml-2 text-sm text-gray-700">Include in Next Payroll</span>
                            </label>
                            <label className="inline-flex items-center">
                                <input type="radio" className="form-radio text-indigo-600"
                                    name="paymentMode"
                                    checked={paymentMode === 'PAID_IMMEDIATELY'}
                                    onChange={() => setPaymentMode('PAID_IMMEDIATELY')}
                                />
                                <span className="ml-2 text-sm text-gray-700">Pay / Deduct Immediately</span>
                            </label>
                        </div>

                        {paymentMode === 'PAID_IMMEDIATELY' && (
                            <div className="mt-2 animate-fade-in-up">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {type === 'ALLOWANCE' ? 'Paid From (Credit Asset)' : 'Deposit To (Debit Asset)'}
                                </label>
                                <select
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                    value={paymentAccountId}
                                    onChange={e => setPaymentAccountId(e.target.value)}
                                    required
                                >
                                    <option value="">Select Account</option>
                                    {bankAccounts.map(a => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <div className="flex justify-end space-x-3">
                    <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button type="submit" isLoading={loading}>
                        {type === 'ALLOWANCE' ? 'Save Allowance' : 'Save Deduction'}
                    </Button>
                </div>
            </form>
        </Card>
    );
};
