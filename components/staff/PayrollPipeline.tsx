import React, { useState, useEffect } from 'react';
import { useData } from '../../src/shared/contexts/DataContext';
import { payrollService } from '../../src/shared/services/payrollService';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { toast } from '../../src/shared/utils/toast';
import { Employee } from '../../src/shared/types';

const STAGES = ['SETUP', 'REVIEW', 'PREVIEW', 'FINALIZE'];

export const PayrollPipeline: React.FC = () => {
    const { employees } = useData();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // Filter State
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        // Default to mid-month (15th) or end (30th)
        if (d.getDate() < 15) d.setDate(15);
        else { d.setMonth(d.getMonth() + 1); d.setDate(0); }
        return d.toISOString().split('T')[0];
    });

    // Data State
    const [summaryData, setSummaryData] = useState<any>(null);

    const handleNext = async () => {
        if (step === 0) {
            // Fetch Data
            setLoading(true);
            try {
                const data = await payrollService.getPayrollSummary(startDate, endDate, employees);
                setSummaryData(data);
                setStep(1);
            } catch (e) {
                toast.error("Failed to fetch payroll data");
            } finally {
                setLoading(false);
            }
        } else if (step === 1) {
            // Acknowledge Review
            setStep(2);
        } else if (step === 2) {
            // Finalize
            await handleFinalize();
        }
    };

    const handleFinalize = async () => {
        if (!summaryData) return;
        setLoading(true);
        try {
            const run = {
                id: `pr-${Date.now()}`,
                period: startDate.slice(0, 7),
                startDate,
                endDate,
                stage: 'COMPLETED',
                status: 'PAID',
                totalAmount: summaryData.summary.totalNetPay,
                totalBaseSalary: 0, // Todo: sum up
                totalAllowances: 0,
                totalCommissions: 0,
                totalDeductions: 0,
                currency: 'USD',
                exchangeRate: 1,
                createdAt: Date.now(),
                createdBy: 'SYSTEM'
            };

            // Convert draft payslips to proper Payslip objects
            const realPayslips = summaryData.draftPayslips.map((dp: any) => ({
                payrollRunId: '', // set in service
                employeeId: dp.employeeId,
                employeeName: dp.employeeName,
                baseSalary: dp.baseSalary,
                proRatedSalary: dp.proRatedSalary,
                currency: 'USD',
                earnings: dp.earnings,
                deductions: dp.deductions,
                grossPay: dp.proRatedSalary + dp.totalAllowances + (dp.totalCommissions || 0),
                totalTax: 0,
                totalCommissions: dp.totalCommissions || 0,
                totalDeductions: dp.totalDeductions,
                netPay: dp.netPay,
                status: 'PAID'
            }));

            // Collect all IDs
            const allTxnIds = summaryData.draftPayslips.flatMap((dp: any) => dp.transactionIds);
            const allWalletIds = summaryData.draftPayslips.flatMap((dp: any) => dp.walletTxnIds || []);

            await payrollService.finalizeRun(run as any, realPayslips, allTxnIds, allWalletIds);

            setStep(3); // Success Screen
            toast.success("Payroll Finalized!");
        } catch (e) {
            toast.error("Failed to finalize payroll");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* STEPPER UI */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                {STAGES.map((label, idx) => (
                    <div key={label} className={`flex items-center ${idx <= step ? 'text-indigo-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mr-2 ${idx <= step ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                            {idx + 1}
                        </div>
                        <span className="font-medium text-sm hidden sm:block">{label}</span>
                        {idx < STAGES.length - 1 && <div className="h-0.5 w-8 bg-gray-200 mx-2 sm:mx-4" />}
                    </div>
                ))}
            </div>

            {/* STEP 1: SETUP */}
            {step === 0 && (
                <Card title="1. Payroll Configuration">
                    <div className="grid grid-cols-2 gap-4 max-w-lg">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                            <input type="date" className="border rounded-lg px-3 py-2 w-full" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                            <input type="date" className="border rounded-lg px-3 py-2 w-full" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="mt-6">
                        <Button onClick={handleNext} isLoading={loading}>Start Processing &rarr;</Button>
                    </div>
                </Card>
            )}

            {/* STEP 2: REVIEW (CHECKLIST) */}
            {step === 1 && summaryData && (
                <div className="space-y-6">
                    {/* CHECKLIST ITEMS */}
                    <Card title="2. Big Picture Review">
                        <div className="space-y-4">
                            {/* ATTENDANCE CHECK */}
                            <div className={`p-4 rounded-lg border ${summaryData.attendanceIssues.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                                <h3 className={`font-bold ${summaryData.attendanceIssues.length > 0 ? 'text-red-800' : 'text-green-800'}`}>
                                    {summaryData.attendanceIssues.length > 0 ? '⚠️ Attendance Issues Detected' : '✅ Attendance OK'}
                                </h3>
                                {summaryData.attendanceIssues.length > 0 ? (
                                    <ul className="list-disc pl-5 mt-2 text-sm text-red-700">
                                        {summaryData.attendanceIssues.map((a: any, i: number) => (
                                            <li key={i}>{a.employeeName} - {a.date}: {a.status}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-green-700 mt-1">No missing clock-outs found in this period.</p>
                                )}
                            </div>

                            {/* TRANSACTIONS CHECK */}
                            <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
                                <h3 className="font-bold text-blue-800">
                                    📋 Pending Transactions ({summaryData.pendingTxns.length})
                                </h3>
                                <p className="text-sm text-blue-700 mt-1">
                                    Found {summaryData.pendingTxns.filter((t: any) => t.type === 'ALLOWANCE').length} Allowances and {summaryData.pendingTxns.filter((t: any) => t.type === 'DEDUCTION').length} Deductions to process.
                                </p>
                            </div>

                            {/* LATENESS CHECK */}
                            {summaryData.unprocessedLateness && summaryData.unprocessedLateness.length > 0 && (
                                <div className="p-4 rounded-lg border bg-yellow-50 border-yellow-200">
                                    <h3 className="font-bold text-yellow-800">
                                        🕒 Unprocessed Lateness ({summaryData.unprocessedLateness.length})
                                    </h3>
                                    <p className="text-sm text-yellow-700 mt-1 mb-3">
                                        Staff were marked LATE but no deduction found.
                                    </p>
                                    <ul className="list-disc pl-5 mt-2 text-sm text-yellow-700 mb-3">
                                        {summaryData.unprocessedLateness.slice(0, 5).map((a: any, i: number) => (
                                            <li key={i}>{a.employeeName} - {a.date} ({a.status})</li>
                                        ))}
                                        {summaryData.unprocessedLateness.length > 5 && <li>...and {summaryData.unprocessedLateness.length - 5} more</li>}
                                    </ul>
                                    <Button
                                        onClick={async () => {
                                            setLoading(true);
                                            await payrollService.createLatenessDeductions(summaryData.unprocessedLateness);
                                            toast.success("Applied deductions! Refreshing...");
                                            // Refresh
                                            const data = await payrollService.getPayrollSummary(startDate, endDate, employees);
                                            setSummaryData(data);
                                            setLoading(false);
                                        }}
                                        isLoading={loading}
                                        className="bg-yellow-600 hover:bg-yellow-700 text-white"
                                    >
                                        Apply Lateness Deductions
                                    </Button>
                                </div>
                            )}

                            {/* MONTHLY PROCESSING REMINDER */}
                            {parseInt(endDate.split('-')[2]) > 20 && (
                                <div className="p-4 rounded-lg border bg-indigo-50 border-indigo-200 mt-4">
                                    <h3 className="font-bold text-indigo-800 flex items-center">
                                        📅 End-of-Month Reminder
                                    </h3>
                                    <p className="text-sm text-indigo-700 mt-1">
                                        Since this is an end-of-month run, please ensure you have completed the
                                        <strong> Monthly Attendance Processing</strong> to calculate adjustments for
                                        Absences/Variance (based on the 26-day rule).
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
                            <Button onClick={handleNext}>Looks Good, Continue &rarr;</Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* STEP 3: PREVIEW */}
            {step === 2 && summaryData && (
                <Card title="3. Calculation Preview">
                    <p className="text-sm text-gray-500 mb-4">
                        Based on Period: {startDate} to {endDate}.
                        Assuming {startDate.slice(-2)} to {endDate.slice(-2)} logic for pro-ration ({(summaryData.draftPayslips[0]?.proRatedSalary / (summaryData.draftPayslips[0]?.baseSalary || 1) * 100).toFixed(0)}% base).
                    </p>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Base (Pro-rated)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase text-blue-600">Commissions</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase text-green-600">+ Allowances</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase text-red-600">- Deductions</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase font-bold">Net Pay</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {summaryData.draftPayslips.map((dp: any, i: number) => (
                                    <tr key={i}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{dp.employeeName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            ${dp.proRatedSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            <span className="text-xs ml-1 text-gray-400">(${dp.baseSalary.toLocaleString()})</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                                            {dp.totalCommissions > 0 ? `$${dp.totalCommissions.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                                            +${dp.totalAllowances.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            {dp.earnings.length > 0 && (
                                                <div className="mt-1 flex flex-col gap-0.5">
                                                    {dp.earnings.map((e: any, idx: number) => (
                                                        <span key={idx} className="text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded -ml-1.5 w-fit whitespace-normal">
                                                            {e.description}: ${e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                                            -${dp.totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            {dp.deductions.length > 0 && (
                                                <div className="mt-1 flex flex-col gap-0.5">
                                                    {dp.deductions.map((d: any, idx: number) => (
                                                        <span key={idx} className="text-xs text-red-700 bg-red-50 px-1.5 py-0.5 rounded -ml-1.5 w-fit whitespace-normal">
                                                            {d.description}: ${d.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">${dp.netPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-6 flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
                        <Button onClick={handleNext} isLoading={loading}>Complete & Finalize</Button>
                    </div>
                </Card>
            )}

            {/* STEP 4: SUCCESS */}
            {step === 3 && (
                <div className="text-center py-16">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Payroll Finalized!</h2>
                    <p className="text-gray-500 mb-6">Transactions have been marked as paid and payslips archived.</p>
                    <Button onClick={() => setStep(0)}>Start New Run</Button>
                </div>
            )}
        </div>
    );
};
