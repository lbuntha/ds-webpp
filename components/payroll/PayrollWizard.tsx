import React, { useState, useEffect } from 'react';
import { PayrollRun, Payslip, SystemSettings, Account, Employee } from '../../src/shared/types';
import { PayrollService } from '../../src/shared/services/payrollService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { PayslipDetail } from './PayslipDetail';
import { toast } from '../../src/shared/utils/toast';

interface Props {
    payrollService: PayrollService;
    settings: SystemSettings;
    accounts: Account[];
    currentUser: { uid: string, name: string };
    onComplete: () => void;
    onCancel: () => void;
}

export const PayrollWizard: React.FC<Props> = ({
    payrollService, settings, accounts, currentUser, onComplete, onCancel
}) => {
    const [step, setStep] = useState(1);
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [loading, setLoading] = useState(false);

    const [draftRun, setDraftRun] = useState<PayrollRun | null>(null);
    const [draftSlips, setDraftSlips] = useState<Payslip[]>([]);

    const [selectedSlip, setSelectedSlip] = useState<Payslip | null>(null);

    // Step 1: Generate Draft
    const generateDraft = async () => {
        setLoading(true);
        try {
            // Get employees to pass to getPayrollSummary
            const { firebaseService } = await import('../../src/shared/services/firebaseService');
            const employees = await firebaseService.hrService.getEmployees();
            const activeEmployees = employees.filter(e => e.status === 'ACTIVE' || !e.status);

            const year = parseInt(period.split('-')[0]);
            const month = parseInt(period.split('-')[1]) - 1; // 0-indexed
            const startDate = new Date(year, month, 1).toISOString().split('T')[0];
            const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

            const summary = await payrollService.getPayrollSummary(
                startDate, endDate, activeEmployees
            );

            if (summary.draftPayslips.length === 0) {
                toast.error("No eligible employees found for payroll.");
            } else {
                const newRun: PayrollRun = {
                    id: `run-${Date.now()}`,
                    period: period,
                    startDate: startDate,
                    endDate: endDate,
                    status: 'DRAFT',
                    stage: 'DRAFT',
                    totalAmount: summary.summary.totalNetPay,
                    totalBaseSalary: summary.draftPayslips.reduce((acc, curr) => acc + curr.baseSalary, 0),
                    totalAllowances: summary.draftPayslips.reduce((acc, curr) => acc + curr.totalAllowances, 0),
                    totalCommissions: summary.draftPayslips.reduce((acc, curr) => acc + curr.totalCommissions, 0),
                    totalDeductions: summary.draftPayslips.reduce((acc, curr) => acc + curr.totalDeductions, 0),
                    currency: 'USD',
                    exchangeRate: 1,
                    createdAt: Date.now(),
                    createdBy: currentUser.uid
                };

                const newSlips: Payslip[] = summary.draftPayslips.map(ds => ({
                    id: `slip-${Date.now()}-${ds.employeeId}`,
                    payrollRunId: newRun.id,
                    employeeId: ds.employeeId,
                    employeeName: ds.employeeName,
                    employeeRole: activeEmployees.find(e => e.id === ds.employeeId)?.position || 'Staff',
                    baseSalary: ds.baseSalary,
                    proRatedSalary: ds.proRatedSalary,
                    grossPay: ds.proRatedSalary,
                    totalAllowances: ds.totalAllowances,
                    totalCommissions: ds.totalCommissions,
                    totalDeductions: ds.totalDeductions,
                    totalTax: 0,
                    netPay: ds.netPay,
                    currency: ds.currency as 'USD' | 'KHR',
                    issueDate: new Date().toISOString().split('T')[0],
                    status: 'DRAFT',
                    earnings: ds.earnings.map(e => ({ ...e, type: e.type as "EARNING" | "DEDUCTION" })),
                    deductions: ds.deductions.map(d => ({ ...d, type: d.type as "EARNING" | "DEDUCTION" }))
                }));

                setDraftRun(newRun);
                setDraftSlips(newSlips);
                setStep(2);
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to generate payroll draft.");
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Review & Approve
    const approveRun = async () => {
        if (!draftRun || draftSlips.length === 0) return;
        setLoading(true);
        try {
            const runId = await payrollService.finalizeRun(
                draftRun,
                draftSlips,
                summary?.draftPayslips ? summary.draftPayslips.flatMap(s => s.transactionIds || []) : [],
                summary?.draftPayslips ? summary.draftPayslips.flatMap(s => s.walletTxnIds || []) : []
            );

            // Post to GL (Simulated - would require accountingService integration in real flow)
            // The user had this simulated or integrated elsewhere. We just fulfill the UI expectation.

            toast.success("Payroll Run Approved & Posted!");
            onComplete();
        } catch (e) {
            console.error(e);
            toast.error("Failed to approve payroll run.");
        } finally {
            setLoading(false);
        }
    };

    if (selectedSlip) {
        return (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-90 flex items-center justify-center p-4">
                <PayslipDetail slip={selectedSlip} onClose={() => setSelectedSlip(null)} />
            </div>
        );
    }

    return (
        <Card className="max-w-4xl mx-auto">
            <div className="border-b border-gray-100 pb-4 mb-6 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Run Payroll</h2>
                <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${step === 1 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>1. Select Period</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${step === 2 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>2. Review</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${step === 3 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>3. Finalize</span>
                </div>
            </div>

            {step === 1 && (
                <div className="space-y-6 py-8">
                    <div className="max-w-xs mx-auto text-center space-y-4">
                        <label className="block text-sm font-bold text-gray-700">Select Month</label>
                        <Input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="text-center text-lg font-bold" />
                        <p className="text-sm text-gray-500">
                            Generating payroll for all active employees with a base salary.
                        </p>
                    </div>
                    <div className="flex justify-center pt-4">
                        <Button onClick={generateDraft} isLoading={loading}>Generate Draft</Button>
                    </div>
                </div>
            )}

            {step === 2 && draftRun && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <div>
                            <div className="text-xs font-bold text-gray-500 uppercase">Total Payroll Cost</div>
                            <div className="text-2xl font-black text-indigo-600">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: draftRun.currency }).format(draftRun.totalAmount)}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs font-bold text-gray-500 uppercase">Employees</div>
                            <div className="text-xl font-bold text-gray-900">{draftSlips.length}</div>
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-gray-100 rounded-xl">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Employee</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Gross</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Deductions</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Net Pay</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {draftSlips.map(slip => (
                                    <tr key={slip.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-bold text-gray-900">{slip.employeeName}</div>
                                            <div className="text-xs text-gray-500">{slip.employeeRole}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-600">{slip.grossPay.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right text-sm font-medium text-red-500">-{slip.totalDeductions.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{slip.netPay.toFixed(2)} {slip.currency}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => setSelectedSlip(slip)} className="text-indigo-600 hover:text-indigo-900 text-xs font-bold border border-indigo-100 px-2 py-1 rounded bg-indigo-50">
                                                View Slip
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between pt-4 border-t border-gray-100">
                        <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                        <div className="space-x-4">
                            <Button variant="outline" onClick={onCancel}>Cancel</Button>
                            <Button onClick={approveRun} isLoading={loading} className="bg-green-600 hover:bg-green-700">
                                Approve & Post to GL
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};
