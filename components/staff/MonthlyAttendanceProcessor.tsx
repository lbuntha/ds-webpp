import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../src/shared/contexts/DataContext';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { configService } from '../../src/shared/services/configService'; // Import ConfigService
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { DailyAttendance, StaffTransaction, Employee, PayrollConfig } from '../../src/shared/types';
import { toast } from '../../src/shared/utils/toast';

export const MonthlyAttendanceProcessor: React.FC = () => {
    const { employees } = useData();
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [attendanceData, setAttendanceData] = useState<DailyAttendance[]>([]);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [calculatedRecords, setCalculatedRecords] = useState<any[]>([]);

    // Configuration
    const [config, setConfig] = useState<PayrollConfig>({
        standardWorkingDays: 26,
        standardDayOffs: 4,
        paySchedule: 'SEMI_MONTHLY',
        latenessDeductionAmount: 1.00,
        minDaysForDayOff: 15,
        dayOffsPerPeriod: 2,
        attendanceAllowanceAmount: 10,
        workStartTime: '08:00',
        workEndTime: '17:00',
        lateGracePeriodMinutes: 15,
        excessLeavePenaltyAmount: 10
    });

    useEffect(() => {
        loadData();
    }, [selectedMonth]);

    const loadData = async () => {
        // Load Config first
        const conf = await configService.getPayrollConfig();
        setConfig(conf);

        const allAttendance = await firebaseService.getDailyAttendance();
        const monthly = allAttendance.filter(a => a.date.startsWith(selectedMonth));
        setAttendanceData(monthly);
    };

    const processRecords = () => {
        const records = employees.map(emp => {
            const empAttendance = attendanceData.filter(a => a.employeeId === emp.id);
            // Count valid days
            const daysWorked = empAttendance.filter(a =>
                ['PRESENT', 'LATE', 'LEFT_EARLY'].includes(a.status)
            ).length;

            const variance = daysWorked - config.standardWorkingDays; // Dynamic
            let adjustmentAmount = 0;

            // Use correct field from Employee interface
            const baseSalary = emp.baseSalaryAmount || 0;
            const dailyRate = baseSalary > 0 ? baseSalary / config.standardWorkingDays : 0; // Dynamic

            if (variance > 0) {
                // Allowance: Configurable Amount (Default $10)
                adjustmentAmount = variance * (config.attendanceAllowanceAmount || 10);
            } else if (variance < 0) {
                // Deduction: Daily Rate per day + Penalty
                const daysMissed = Math.abs(variance);
                const penalty = config.excessLeavePenaltyAmount || 0;
                adjustmentAmount = (daysMissed * dailyRate) + (daysMissed * penalty);
            }

            return {
                employee: emp,
                daysWorked,
                variance,
                adjustmentAmount,
                baseSalary,
                type: variance >= 0 ? 'ALLOWANCE' : 'DEDUCTION'
            };
        });

        setCalculatedRecords(records);
    };

    const handleCreateAdjustment = async (record: any) => {
        if (record.variance === 0) return;
        setProcessingId(record.employee.id);
        try {
            const txn: StaffTransaction = {
                id: `adj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                employeeId: record.employee.id,
                employeeName: record.employee.name,
                type: record.type,
                category: record.type === 'ALLOWANCE' ? 'INCENTIVE' : 'ABSENCE', // Ad-hoc mapping
                amount: record.adjustmentAmount,
                currency: 'USD', // Defaulting to USD for now based on $10 rule
                date: new Date().toISOString().split('T')[0], // Transaction date is today
                description: `Monthly Adjustment for ${selectedMonth}: ${record.daysWorked} days worked. (${record.variance} days variance)`,
                status: 'PENDING_PAYROLL',
                branchId: record.employee.branchId || 'HEAD_OFFICE', // Required field
                createdAt: Date.now(), // Required field
                createdBy: 'SYSTEM'
            };

            await firebaseService.createStaffTransaction(txn);
            toast.success(`Created adjustment for ${record.employee.name}`);
        } catch (e) {
            console.error(e);
            toast.error("Failed to create transaction");
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <Card title="Monthly Attendance Processing">
            <div className="flex gap-4 items-end mb-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Month</label>
                    <input
                        type="month"
                        className="border rounded-lg px-3 py-2 text-sm"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                    />
                </div>
                <Button onClick={processRecords}>Calculate Adjustments</Button>
            </div>

            {calculatedRecords.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Worked</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Variance ({config.standardWorkingDays}d)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adjustment</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {calculatedRecords.map((rec, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {rec.employee.name}
                                        <div className="text-xs text-gray-500">Base: ${rec.baseSalary.toLocaleString()}</div>
                                        {rec.baseSalary === 0 && <div className="text-xs text-red-500 font-bold">⚠️ No Salary Set</div>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rec.daysWorked}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${rec.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {rec.variance > 0 ? `+${rec.variance}` : rec.variance}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                        ${rec.adjustmentAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        <span className="text-xs font-normal text-gray-500 ml-1">({rec.type})</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                        {rec.variance !== 0 && (
                                            <Button
                                                variant="secondary"
                                                onClick={() => handleCreateAdjustment(rec)}
                                                isLoading={processingId === rec.employee.id}
                                                disabled={rec.baseSalary === 0 && rec.type === 'DEDUCTION'}
                                            >
                                                Post Adjustment
                                            </Button>
                                        )}
                                        {rec.variance === 0 && <span className="text-gray-400 text-sm italic">No adjustment</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Card>
    );
};
