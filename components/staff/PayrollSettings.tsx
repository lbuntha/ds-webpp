import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { toast } from '../../src/shared/utils/toast';
import { configService } from '../../src/shared/services/configService';
import { PayrollConfig } from '../../src/shared/types';

export const PayrollSettings: React.FC = () => {
    const [config, setConfig] = useState<PayrollConfig>({
        standardWorkingDays: 26,
        standardDayOffs: 4,
        paySchedule: 'SEMI_MONTHLY',
        latenessDeductionAmount: 1.00,
        minDaysForDayOff: 15,
        dayOffsPerPeriod: 2,
        attendanceAllowanceAmount: 10.00,
        workStartTime: '08:00',
        workEndTime: '17:00',
        lateGracePeriodMinutes: 15
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const data = await configService.getPayrollConfig();
            setConfig(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load settings");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await configService.updatePayrollConfig(config);
            toast.success("Settings saved successfully!");
        } catch (error) {
            console.error(error);
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: keyof PayrollConfig, value: any) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading settings...</div>;

    return (
        <Card title="Payroll Configuration">
            <div className="space-y-6 max-w-2xl">
                {/* General Settings */}
                <div>
                    <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">General Rules</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Standard Working Days (Month)</label>
                            <input
                                type="number"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                value={config.standardWorkingDays}
                                onChange={(e) => handleChange('standardWorkingDays', Number(e.target.value))}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Divider for Daily Rate (Base Salary / This). <br />
                                Example: $500 / 26 days = $19.23/day.
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Standard Day Offs (Month)</label>
                            <input
                                type="number"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                value={config.standardDayOffs}
                                onChange={(e) => handleChange('standardDayOffs', Number(e.target.value))}
                            />
                            <p className="text-xs text-gray-500 mt-1">Expected number of rest days per month.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Pay Schedule</label>
                            <select
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                value={config.paySchedule}
                                onChange={(e) => handleChange('paySchedule', e.target.value)}
                            >
                                <option value="MONTHLY">Monthly (Once a month)</option>
                                <option value="SEMI_MONTHLY">Semi-Monthly (Split 50%)</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Determines how base salary is split (100% or 50%).</p>
                        </div>
                    </div>
                </div>

                {/* Shift Schedule */}
                <div>
                    <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4 mt-2">Work Shift & Lateness Rules</h3>
                    <p className="text-sm text-gray-600 mb-4 bg-blue-50 p-2 rounded">
                        These rules define when an employee is marked as "Late" or "Left Early".
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Work Start Time</label>
                            <input
                                type="time"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                value={config.workStartTime || '08:00'}
                                onChange={(e) => handleChange('workStartTime', e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-1">Expected clock-in time.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Work End Time</label>
                            <input
                                type="time"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                value={config.workEndTime || '17:00'}
                                onChange={(e) => handleChange('workEndTime', e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-1">Expected clock-out time.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Grace Period (Minutes)</label>
                            <input
                                type="number"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                value={config.lateGracePeriodMinutes || 15}
                                onChange={(e) => handleChange('lateGracePeriodMinutes', Number(e.target.value))}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Buffer before "Late" status applies.<br />
                                E.g., if 15m, 8:15 is OK, 8:16 is Late.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Automation Rules */}
                <div>
                    <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4 mt-2">Deduction & Allowance Logic</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Lateness Deduction Amount ($)</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="block w-full pl-7 border border-gray-300 rounded-md p-2"
                                    value={config.latenessDeductionAmount}
                                    onChange={(e) => handleChange('latenessDeductionAmount', Number(e.target.value))}
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Fixed amount deducted for each "Late" occurrence.<br />
                                Applied manually via "Apply Lateness Deductions".
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Attendance Allowance (Daily Bonus)</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="block w-full pl-7 border border-gray-300 rounded-md p-2"
                                    value={config.attendanceAllowanceAmount || 10}
                                    onChange={(e) => handleChange('attendanceAllowanceAmount', Number(e.target.value))}
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Bonus paid for every day worked ABOVE the Standard Working Days.<br />
                                (Variance &gt; 0) * This Amount.
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Detailed Penalty (Excess Leave)</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="block w-full pl-7 border border-gray-300 rounded-md p-2"
                                    value={config.excessLeavePenaltyAmount || 0}
                                    onChange={(e) => handleChange('excessLeavePenaltyAmount', Number(e.target.value))}
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                EXTRA penalty for days missed BELOW the Standard Working Days.<br />
                                Formula: (Days Missed * Daily Rate) + (Days Missed * This Penalty).
                            </p>
                        </div>
                    </div>
                </div>

                {/* Day Off Accrual Rules */}
                <div>
                    <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4 mt-2">New Hire / Tenure Rules</h3>
                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                        <p className="text-sm font-medium text-gray-800 mb-2">Pro-rated Day Off Eligibility</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Minimum Days to Qualify</label>
                                <input
                                    type="number"
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                    value={config.minDaysForDayOff}
                                    onChange={(e) => handleChange('minDaysForDayOff', Number(e.target.value))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Day Offs per Period</label>
                                <input
                                    type="number"
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                                    value={config.dayOffsPerPeriod}
                                    onChange={(e) => handleChange('dayOffsPerPeriod', Number(e.target.value))}
                                />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 italic">
                            Condition: "If employee worked less than <b>{config.minDaysForDayOff} days</b>, they get 0 paid day offs.
                            If they worked more, they get <b>{config.dayOffsPerPeriod} days</b>."
                        </p>
                    </div>
                </div>

            </div>

            {/* VISUAL CALCULATOR / SIMULATOR */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 mt-8">
                <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    Live Calculation Simulator
                </h3>
                <p className="text-sm text-indigo-700 mb-6">See how your settings affect a payroll calculation in real-time.</p>

                <Simulator
                    config={config}
                />
            </div>

            <div className="flex justify-end pt-4">
                <Button onClick={handleSave} isLoading={saving}>Save Configuration</Button>
            </div>

        </Card >
    );
};

const Simulator: React.FC<{ config: PayrollConfig }> = ({ config }) => {
    const [simSalary, setSimSalary] = useState(500);
    const [simDays, setSimDays] = useState(25);
    const [simLateness, setSimLateness] = useState(2);
    const [simCommission, setSimCommission] = useState(50);

    // Derived Calcs
    const workingDays = config.standardWorkingDays || 26;
    const dailyRate = simSalary / workingDays;
    const variance = simDays - workingDays;

    // Step 3: Attendance Adjustment
    let attendanceAdj = 0;
    let explanation = "";

    if (variance >= 0) {
        const bonus = variance * (config.attendanceAllowanceAmount || 0);
        attendanceAdj = bonus;
        explanation = `Bonus: ${variance} extra days × $${config.attendanceAllowanceAmount} = +$${bonus.toFixed(2)}`;
    } else {
        const missed = Math.abs(variance);
        const rateDed = missed * dailyRate;
        const penalty = missed * (config.excessLeavePenaltyAmount || 0);
        attendanceAdj = -(rateDed + penalty);
        explanation = `Deduction: (${missed} missed × $${dailyRate.toFixed(2)} rate) + (${missed} missed × $${config.excessLeavePenaltyAmount} penalty) = -$${Math.abs(attendanceAdj).toFixed(2)}`;
    }

    // Step 4: Lateness
    const latenessDeduction = simLateness * (config.latenessDeductionAmount || 0);

    // Final Net Pay
    const netPay = simSalary + attendanceAdj - latenessDeduction + simCommission;

    return (
        <div className="space-y-6">
            {/* INPUTS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end bg-white p-4 rounded-lg border border-indigo-100">
                <div>
                    <label className="block text-xs font-bold text-indigo-800 uppercase">Base Salary</label>
                    <div className="relative mt-1">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">$</span>
                        <input
                            type="number"
                            className="pl-6 w-full border-indigo-200 rounded p-1 text-sm font-bold"
                            value={simSalary}
                            onChange={(e) => setSimSalary(Number(e.target.value))}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-indigo-800 uppercase">Days Worked</label>
                    <input
                        type="number"
                        className="mt-1 w-full border-indigo-200 rounded p-1 text-sm font-bold"
                        value={simDays}
                        onChange={(e) => setSimDays(Number(e.target.value))}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-indigo-800 uppercase">Lateness Count</label>
                    <input
                        type="number"
                        className="mt-1 w-full border-indigo-200 rounded p-1 text-sm font-bold"
                        value={simLateness}
                        onChange={(e) => setSimLateness(Number(e.target.value))}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-indigo-800 uppercase">Commission</label>
                    <div className="relative mt-1">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">$</span>
                        <input
                            type="number"
                            className="pl-6 w-full border-indigo-200 rounded p-1 text-sm font-bold"
                            value={simCommission}
                            onChange={(e) => setSimCommission(Number(e.target.value))}
                        />
                    </div>
                </div>
            </div>

            {/* FLOW DIAGRAM */}
            <div className="flex flex-col gap-4">

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                    {/* Step 1 */}
                    <div className="bg-white p-3 rounded border border-gray-200 text-center">
                        <div className="text-xs text-gray-500 uppercase">1. Daily Rate</div>
                        <div className="font-mono font-bold text-gray-800 mt-1">
                            ${simSalary} / {workingDays}d = ${dailyRate.toFixed(2)}
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="bg-white p-3 rounded border border-gray-200 text-center">
                        <div className="text-xs text-gray-500 uppercase">2. Variance</div>
                        <div className={`font-mono font-bold mt-1 ${variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {simDays} - {workingDays} = {variance} days
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className={`p-3 rounded border text-center ${variance < 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                        <div className={`text-xs uppercase ${variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            3. Final Adjustment
                        </div>
                        <div className="font-mono font-bold text-gray-900 mt-1">
                            {variance >= 0 ? '+' : ''}{attendanceAdj.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 italic leading-tight">
                            {explanation}
                        </div>
                    </div>
                </div>

                {/* Final Net Pay Calculation Line */}
                <div className="bg-indigo-900 text-white p-4 rounded-lg shadow-lg">
                    <div className="text-xs font-medium text-indigo-300 uppercase mb-2">Final Calculation</div>
                    <div className="flex flex-wrap items-center gap-2 text-lg font-mono">
                        <span className="opacity-70" title="Base Salary">${simSalary}</span>
                        <span>{attendanceAdj >= 0 ? '+' : '-'} ${Math.abs(attendanceAdj).toFixed(2)}</span>
                        <span>- ${latenessDeduction.toFixed(2)}</span>
                        <span>+ ${simCommission.toFixed(2)}</span>
                        <span className="mx-2 text-indigo-300">=</span>
                        <span className="font-bold text-2xl text-green-300">${netPay.toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-indigo-300 mt-1 flex gap-4">
                        <span>(Base)</span>
                        <span>(Attendance Adj)</span>
                        <span>(Lateness: {simLateness} × ${config.latenessDeductionAmount})</span>
                        <span>(Commission)</span>
                        <span className="font-bold text-white">(Net Pay)</span>
                    </div>
                </div>

            </div>
        </div>
    );
};
