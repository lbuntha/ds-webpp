import React, { useState } from 'react';
import { Account, Branch, StaffLoan, AccountType, Employee } from '../../src/shared/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { getFriendlyErrorMessage } from '../../src/shared/utils/errorUtils';

interface Props {
  accounts: Account[];
  branches: Branch[];
  employees: Employee[];
  onSave: (loan: StaffLoan) => Promise<void>;
  onCancel: () => void;
}

export const StaffLoanForm: React.FC<Props> = ({ accounts, branches, employees, onSave, onCancel }) => {
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState(''); // Snapshot
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState(0);
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [error, setError] = useState<string | null>(null);
  
  // Account Selection - Exclude Header Accounts
  const receivableAccounts = accounts.filter(a => a.type === AccountType.ASSET && !a.isHeader);
  
  const [assetAccountId, setAssetAccountId] = useState(
      receivableAccounts.find(a => a.code === '1050')?.id || '' 
  ); 
  
  const [payoutAccountId, setPayoutAccountId] = useState('');

  const [loading, setLoading] = useState(false);

  const bankAccounts = accounts.filter(a => 
      a.type === AccountType.ASSET && 
      (a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')) &&
      !a.isHeader
  );

  const handleEmployeeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      setEmployeeId(id);
      const emp = employees.find(x => x.id === id);
      if (emp) {
          setEmployeeName(emp.name);
      } else {
          setEmployeeName('');
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!employeeId || !employeeName || amount <= 0 || !assetAccountId || !payoutAccountId) {
        setError("Please fill all required fields.");
        return;
    }

    setLoading(true);

    const loan: StaffLoan = {
        id: `loan-${Date.now()}`,
        employeeId,
        employeeName,
        description,
        date,
        amount,
        amountRepaid: 0,
        status: 'ACTIVE',
        assetAccountId,
        payoutAccountId,
        branchId,
        createdAt: Date.now()
    };

    try {
        await onSave(loan);
    } catch (e) {
        console.error(e);
        setError(getFriendlyErrorMessage(e));
    } finally {
        setLoading(false);
    }
  };

  return (
    <Card title="Issue New Staff Loan">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <option key={emp.id} value={emp.id}>{emp.name} {emp.position ? `(${emp.position})` : ''}</option>
                    ))}
                </select>
                 {employees.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">No employees found. Please add an employee first.</p>
                )}
            </div>

            <Input 
                label="Date of Issue" 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                required 
            />
            <div className="md:col-span-2">
                <Input 
                    label="Description / Reason" 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    placeholder="e.g. Salary Advance for Nov"
                    required 
                />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount</label>
                <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    value={amount}
                    onChange={e => setAmount(parseFloat(e.target.value))}
                    required
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

        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
            <h4 className="text-sm font-semibold text-indigo-900 mb-3 uppercase tracking-wide">Accounting Configuration</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Loan Receivable Account (Debit)</label>
                    <select 
                        className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                        value={assetAccountId}
                        onChange={e => setAssetAccountId(e.target.value)}
                        required
                    >
                        <option value="">Select Asset Account</option>
                        {receivableAccounts.map(a => (
                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Usually '1050 - Staff Advances'</p>
                </div>

                <div className="w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paid From (Credit)</label>
                    <select 
                        className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                        value={payoutAccountId}
                        onChange={e => setPayoutAccountId(e.target.value)}
                        required
                    >
                        <option value="">Select Bank/Cash</option>
                        {bankAccounts.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>

        {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
            </div>
        )}

        <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" isLoading={loading}>Issue Loan</Button>
        </div>
      </form>
    </Card>
  );
};
