import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../shared/contexts/DataContext';
import { firebaseService } from '../../shared/services/firebaseService';
import { StaffAllowanceForm } from '../../../components/staff/StaffAllowanceForm';
import { DailyAttendanceForm } from '../../../components/staff/DailyAttendanceForm';
import { MonthlyAttendanceProcessor } from '../../../components/staff/MonthlyAttendanceProcessor';
import { PayrollPipeline } from '../../../components/staff/PayrollPipeline';
import { PayrollSettings } from '../../../components/staff/PayrollSettings';
import { StaffTransaction, TransactionType, DailyAttendance } from '../../shared/types';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { toast } from '../../shared/utils/toast';

export default function StaffAllowanceView() {
    const { employees, accounts, branches, refreshData } = useData();
    const [transactions, setTransactions] = useState<StaffTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'ALLOWANCES' | 'ATTENDANCE' | 'MONTHLY' | 'PAYROLL' | 'SETTINGS'>('ALLOWANCES');
    const [showForm, setShowForm] = useState(false);

    // Attendance State
    const [attendanceRecords, setAttendanceRecords] = useState<DailyAttendance[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [showAttendanceForm, setShowAttendanceForm] = useState(false);
    const [editingAttendance, setEditingAttendance] = useState<DailyAttendance | null>(null);

    useEffect(() => {
        loadTransactions();
        loadAttendance();
    }, []);

    const loadTransactions = async () => {
        try {
            const data = await firebaseService.getStaffTransactions();
            setTransactions(data);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load transactions");
        } finally {
            setLoading(false);
        }
    };

    const loadAttendance = async () => {
        try {
            const data = await firebaseService.getDailyAttendance();
            setAttendanceRecords(data || []);
        } catch (e) {
            console.error(e);
        }
    };

    const handleSaveTransaction = async (txn: StaffTransaction) => {
        await firebaseService.createStaffTransaction(txn);
        await loadTransactions();
        setShowForm(false);
        toast.success("Transaction saved successfully!");
    };

    const handleSaveAttendance = async (record: DailyAttendance) => {
        try {
            await firebaseService.saveDailyAttendance(record);
            await loadAttendance();
            setShowAttendanceForm(false);
            setEditingAttendance(null);
            toast.success("Attendance saved.");
        } catch (e) {
            toast.error("Failed to save attendance.");
        }
    };

    const handleAddNewAttendance = () => {
        setEditingAttendance(null);
        setShowAttendanceForm(true);
    };

    const handleEditAttendance = (record: DailyAttendance) => {
        setEditingAttendance(record);
        setShowAttendanceForm(true);
    };

    const filteredAttendance = useMemo(() => {
        return attendanceRecords.filter(r => r.date.startsWith(selectedMonth)).sort((a, b) => b.date.localeCompare(a.date));
    }, [attendanceRecords, selectedMonth]);

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Staff Allowances & Attendance</h1>
                {activeTab === 'ALLOWANCES' && !showForm && (
                    <Button onClick={() => setShowForm(true)} className="flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        New Transaction
                    </Button>
                )}
            </div>

            {/* TABS */}
            <div className="flex space-x-1 bg-white p-1 rounded-xl border border-gray-200 shadow-sm w-fit">
                <button
                    onClick={() => setActiveTab('ALLOWANCES')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'ALLOWANCES' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    Allowances & Deductions
                </button>
                <button
                    onClick={() => setActiveTab('ATTENDANCE')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'ATTENDANCE' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    Daily Time Clock
                </button>
                <button
                    onClick={() => setActiveTab('MONTHLY')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'MONTHLY' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    Monthly Processing
                </button>
                <button
                    onClick={() => setActiveTab('PAYROLL')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'PAYROLL' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    Payroll Run
                </button>
                <button
                    onClick={() => setActiveTab('SETTINGS')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'SETTINGS' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    Settings
                </button>
            </div>

            {/* CONTENT */}
            {
                activeTab === 'ALLOWANCES' && (
                    <>
                        {showForm ? (
                            <StaffAllowanceForm
                                employees={employees}
                                accounts={accounts}
                                branches={branches}
                                onSave={handleSaveTransaction}
                                onCancel={() => setShowForm(false)}
                            />
                        ) : (
                            <Card>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {transactions.sort((a, b) => b.date.localeCompare(a.date)).map(txn => (
                                                <tr key={txn.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{txn.date}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{txn.employeeName}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${txn.type === 'ALLOWANCE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                            {txn.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{txn.category}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                                        {txn.currency === 'USD' ? '$' : '៛'} {txn.amount.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {txn.status === 'PENDING_PAYROLL' ? (
                                                            <span className="text-yellow-600 bg-yellow-50 px-2 py-1 rounded text-xs">Pending Payroll</span>
                                                        ) : (
                                                            <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs">Paid</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {transactions.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                                        No transactions found. Click "New Transaction" to add one.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        )}
                    </>
                )
            }

            {
                activeTab === 'ATTENDANCE' && (
                    <>
                        {showAttendanceForm ? (
                            <DailyAttendanceForm
                                employees={employees}
                                existingRecord={editingAttendance}
                                onSave={handleSaveAttendance}
                                onCancel={() => { setShowAttendanceForm(false); setEditingAttendance(null); }}
                            />
                        ) : (
                            <Card action={
                                <div className="flex gap-2">
                                    <input
                                        type="month"
                                        className="border rounded-lg px-3 py-2 text-sm"
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(e.target.value)}
                                    />
                                    <Button onClick={() => handleAddNewAttendance()}>+ Manual Entry</Button>
                                </div>
                            }>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock In</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock Out</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {filteredAttendance.map(record => (
                                                <tr key={record.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.date}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.employeeName}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {new Date(record.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {record.clockOut
                                                            ? new Date(record.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                            : <span className="text-red-400 italic">Missing</span>
                                                        }
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                        ${record.status === 'PRESENT' ? 'bg-green-100 text-green-800' : ''}
                                                        ${record.status === 'LATE' ? 'bg-yellow-100 text-yellow-800' : ''}
                                                        ${record.status === 'MISSING_CLOCK_OUT' ? 'bg-red-100 text-red-800' : ''}
                                                        ${record.status === 'ABSENT' ? 'bg-gray-100 text-gray-800' : ''}
                                                    `}>
                                                            {record.status.replace(/_/g, ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <button onClick={() => handleEditAttendance(record)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredAttendance.length === 0 && (
                                                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No attendance records for {selectedMonth}.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        )}
                    </>
                )
            }

            {
                activeTab === 'MONTHLY' && (
                    <MonthlyAttendanceProcessor />
                )
            }

            {
                activeTab === 'PAYROLL' && (
                    <PayrollPipeline />
                )
            }

            {
                activeTab === 'SETTINGS' && (
                    <PayrollSettings />
                )
            }
        </div >
    );
}
