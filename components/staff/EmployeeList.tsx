import React, { useState } from 'react';
import { Employee } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { toast } from '../../src/shared/utils/toast';

interface Props {
  employees: Employee[];
  onAddEmployee: (employee: Employee) => Promise<void>;
  onUpdateEmployee: (employee: Employee) => Promise<void>;
}

export const EmployeeList: React.FC<Props> = ({ employees, onAddEmployee, onUpdateEmployee }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [isDriver, setIsDriver] = useState(false);
  const [hasBaseSalary, setHasBaseSalary] = useState(false);
  const [baseSalaryAmount, setBaseSalaryAmount] = useState<number>(0);
  const [baseSalaryCurrency, setBaseSalaryCurrency] = useState<'USD' | 'KHR'>('USD');
  const [bankAccount, setBankAccount] = useState(''); // Legacy, keeping for compatibility or repurposing

  // New Fields
  const [paymentFrequency, setPaymentFrequency] = useState<'MONTHLY' | 'WEEKLY'>('MONTHLY');
  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'CASH'>('BANK_TRANSFER');
  const [bankName, setBankName] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');

  const [taxId, setTaxId] = useState('');
  const [taxStatus, setTaxStatus] = useState<'RESIDENT' | 'NON_RESIDENT'>('RESIDENT');
  const [numberOfDependents, setNumberOfDependents] = useState(0);

  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setEmail('');
    setPhone('');
    setPosition('');
    setDepartment('');
    setIsDriver(false);
    setHasBaseSalary(false);
    setBaseSalaryAmount(0);
    setBaseSalaryCurrency('USD');
    setBankAccount('');
    // Reset New
    setPaymentFrequency('MONTHLY');
    setPaymentMethod('BANK_TRANSFER');
    setBankName('');
    setBankAccountName('');
    setBankAccountNumber('');
    setTaxId('');
    setTaxStatus('RESIDENT');
    setNumberOfDependents(0);
  };

  const openAdd = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const openEdit = (e: Employee) => {
    setEditingId(e.id);
    setName(e.name);
    setEmail(e.email || '');
    setPhone(e.phone || '');
    setPosition(e.position || '');
    setDepartment(e.department || '');
    setIsDriver(e.isDriver || false);
    setHasBaseSalary(e.hasBaseSalary || false);
    setBaseSalaryAmount(e.baseSalaryAmount || 0);
    setBaseSalaryCurrency(e.baseSalaryCurrency || 'USD');
    setBankAccount(e.bankAccount || '');
    // Edit New
    setPaymentFrequency(e.paymentFrequency || 'MONTHLY');
    setPaymentMethod(e.paymentMethod || 'BANK_TRANSFER');
    setBankName(e.bankName || '');
    setBankAccountName(e.bankAccountName || '');
    setBankAccountNumber(e.bankAccountNumber || e.bankAccount || ''); // Fallback to old field
    setTaxId(e.taxId || '');
    setTaxStatus(e.taxStatus || 'RESIDENT');
    setNumberOfDependents(e.numberOfDependents || 0);

    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setLoading(true);

    const employeeData: Employee = {
      id: editingId || `emp-${Date.now()}`,
      name,
      email,
      phone,
      position,
      department,
      isDriver,
      hasBaseSalary, // Allow for non-drivers too now
      baseSalaryAmount: hasBaseSalary ? baseSalaryAmount : undefined,
      baseSalaryCurrency: hasBaseSalary ? baseSalaryCurrency : undefined,
      bankAccount: bankAccountNumber, // Sync legacy field

      // New
      paymentFrequency,
      paymentMethod,
      bankName,
      bankAccountName,
      bankAccountNumber,
      taxId,
      taxStatus,
      numberOfDependents,

      createdAt: editingId ? (employees.find(e => e.id === editingId)?.createdAt || Date.now()) : Date.now()
    };

    try {
      if (editingId) {
        await onUpdateEmployee(employeeData);
      } else {
        await onAddEmployee(employeeData);
      }
      setIsFormOpen(false);
      resetForm();
    } catch (e) {
      console.error("Failed to save employee", e);
      toast.error("Failed to save employee record");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Staff Management</h1>
          <p className="text-gray-500 font-medium">Manage your team members, organizational roles, and driver payroll.</p>
        </div>
        {!isFormOpen && (
          <Button
            onClick={openAdd}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-100 px-6 py-2.5 rounded-2xl flex items-center gap-2 transform active:scale-95 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add New Member
          </Button>
        )}
      </div>

      {isFormOpen && (
        <Card className="border-none shadow-[0_20px_50px_rgba(79,70,229,0.1)] bg-white rounded-[2rem] overflow-hidden animate-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleSubmit} className="p-2">
            <div className="bg-gray-50/50 p-6 rounded-[1.5rem] border border-gray-100">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{editingId ? 'Edit Employee Profile' : 'Create New Employee'}</h3>
                  <p className="text-sm text-gray-500 mt-1">Fill in the professional details for your team member.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 hover:bg-white rounded-full text-gray-400 hover:text-gray-600 transition-colors shadow-sm"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="md:col-span-2">
                  <Input
                    label="Full Name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    placeholder="e.g. John Doe"
                    className="text-lg font-bold py-3 px-4"
                  />
                </div>

                <Input label="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" />
                <Input label="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+855 ..." />

                <Input label="Job Title / Position" value={position} onChange={e => setPosition(e.target.value)} placeholder="e.g. Driver, Manager" />
                <Input label="Department" value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Logistics, Operations" />

                <div className="md:col-span-2">
                  <Input
                    label="Bank Account Information"
                    value={bankAccount}
                    onChange={e => setBankAccount(e.target.value)}
                    placeholder="e.g. ABA: 000 000 000"
                  />
                </div>
              </div>

              {/* Payroll & Tax Configuration */}
              {(isDriver || hasBaseSalary || true) && ( // Show for all, or just Drivers? Plan says 'Employee Management', implies all.
                <div className="md:col-span-2 space-y-6 mt-6">
                  <h4 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2">Payroll & Tax Details</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Salary Config - Moved here/Refined */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
                      <label className="font-bold text-gray-700 flex items-center gap-2">
                        <input type="checkbox" checked={hasBaseSalary} onChange={e => setHasBaseSalary(e.target.checked)} className="rounded text-indigo-600" />
                        Enable Base Salary
                      </label>

                      {hasBaseSalary && (
                        <div className="space-y-3 pl-6 border-l-2 border-indigo-100 ml-1">
                          <Input label="Amount" type="number" step="0.01" value={baseSalaryAmount} onChange={e => setBaseSalaryAmount(parseFloat(e.target.value))} />
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Currency</label>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setBaseSalaryCurrency('USD')} className={`px-3 py-1 rounded-lg text-xs font-bold ${baseSalaryCurrency === 'USD' ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>USD</button>
                              <button type="button" onClick={() => setBaseSalaryCurrency('KHR')} className={`px-3 py-1 rounded-lg text-xs font-bold ${baseSalaryCurrency === 'KHR' ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>KHR</button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Payment Frequency</label>
                            <select value={paymentFrequency} onChange={e => setPaymentFrequency(e.target.value as any)} className="w-full text-sm border-gray-300 rounded-lg">
                              <option value="MONTHLY">Monthly</option>
                              <option value="WEEKLY">Weekly</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bank Details */}
                    <div className="space-y-4">
                      <Input label="Bank Name" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. ABA Bank" />
                      <Input label="Account Name" value={bankAccountName} onChange={e => setBankAccountName(e.target.value)} placeholder="e.g. JOHN DOE" />
                      <Input label="Account Number" value={bankAccountNumber} onChange={e => setBankAccountNumber(e.target.value)} placeholder="000 111 222" />
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Payment Method</label>
                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)} className="w-full text-sm border-gray-300 rounded-lg">
                          <option value="BANK_TRANSFER">Bank Transfer</option>
                          <option value="CASH">Cash</option>
                        </select>
                      </div>
                    </div>

                    {/* Tax Info */}
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <Input label="Tax ID (TIN)" value={taxId} onChange={e => setTaxId(e.target.value)} placeholder="Likely N/A for most" />
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Tax Status</label>
                        <select value={taxStatus} onChange={e => setTaxStatus(e.target.value as any)} className="w-full text-sm border-gray-300 rounded-lg">
                          <option value="RESIDENT">Resident</option>
                          <option value="NON_RESIDENT">Non-Resident</option>
                        </select>
                      </div>
                      <Input label="No. of Dependents" type="number" value={numberOfDependents} onChange={e => setNumberOfDependents(parseInt(e.target.value) || 0)} />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end items-center gap-3 mt-10 pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
                >
                  Discard Changes
                </button>
                <Button
                  type="submit"
                  isLoading={loading}
                  className="bg-gray-900 hover:bg-black text-white px-8 py-2.5 rounded-xl shadow-xl transition-all flex items-center gap-2"
                >
                  {editingId ? 'Update Profile' : 'Create Staff Record'}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {/* Staff Directory Table */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center">
          <h3 className="font-bold text-gray-900">Active Staff Members</h3>
          <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 shadow-sm">
            {employees.length} Total
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-white">
                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">Staff Information</th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">Role & Department</th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">Contact Details</th>
                <th className="px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {employees.map((e, idx) => (
                <tr key={e.id} className="group hover:bg-indigo-50/30 transition-all duration-300">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <Avatar name={e.name} size="md" className="rounded-2xl shadow-sm border-2 border-white group-hover:scale-110 transition-transform duration-300" />
                      <div>
                        <div className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{e.name}</div>
                        <div className="text-[10px] font-bold text-gray-400 mt-0.5 tracking-wider uppercase">ID: {e.id.substring(0, 8)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 shadow-sm uppercase tracking-wide">
                          {e.position || 'Staff'}
                        </span>
                        {e.isDriver && (
                          <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-black shadow-lg shadow-indigo-100 uppercase tracking-wide">
                            Driver
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-gray-400 ml-1">
                        {e.department || 'Unassigned Dept'}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {e.email || 'No Email'}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {e.phone || 'No Phone'}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button
                      onClick={() => openEdit(e)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-900 shadow-sm hover:shadow-md hover:border-indigo-100 hover:text-indigo-600 transition-all active:scale-90"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 border-2 border-dashed border-gray-200">
                        <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No Staff Members Found</p>
                      <p className="text-gray-300 text-sm mt-1">Start by adding your first team member.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
