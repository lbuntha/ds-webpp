import React from 'react';
import { Payslip } from '../../src/shared/types';
import { Card } from '../ui/Card';

interface Props {
    slip: Payslip;
    onClose?: () => void;
}

export const PayslipDetail: React.FC<Props> = ({ slip, onClose }) => {
    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
    };

    return (
        <Card className="max-w-3xl mx-auto shadow-2xl print:shadow-none print:max-w-none">
            <div className="flex justify-between items-start border-b border-gray-100 pb-6 mb-6">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Payslip</h1>
                    <p className="text-gray-500 text-sm mt-1">ID: {slip.id}</p>
                </div>
                <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">{slip.employeeName}</div>
                    <div className="text-xs text-gray-500">{slip.employeeRole}</div>
                    <div className="text-xs text-gray-500">{slip.department}</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Earnings</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Base Salary</span>
                            <span className="font-medium text-gray-900">{formatCurrency(slip.baseSalary, slip.currency)}</span>
                        </div>
                        {slip.earnings.map((e, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                                <span className="text-gray-600">{e.description}</span>
                                <span className="font-medium text-gray-900">{formatCurrency(e.amount, slip.currency)}</span>
                            </div>
                        ))}
                        <div className="flex justify-between text-sm pt-3 border-t border-gray-100 font-bold">
                            <span className="text-gray-800">Total Gross Pay</span>
                            <span className="text-gray-900">{formatCurrency(slip.grossPay, slip.currency)}</span>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Deductions</h3>
                    <div className="space-y-3">
                        {slip.deductions.map((d, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                                <span className="text-gray-600">{d.description}</span>
                                <span className="font-medium text-red-600">-{formatCurrency(d.amount, slip.currency)}</span>
                            </div>
                        ))}
                        {slip.deductions.length === 0 && <p className="text-sm text-gray-400 italic">No deductions</p>}

                        <div className="flex justify-between text-sm pt-3 border-t border-gray-100 font-bold">
                            <span className="text-gray-800">Total Deductions</span>
                            <span className="text-red-600">-{formatCurrency(slip.totalDeductions, slip.currency)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 flex justify-between items-center border border-gray-100">
                <span className="text-lg font-bold text-gray-700">Net Pay</span>
                <span className="text-3xl font-black text-indigo-600">{formatCurrency(slip.netPay, slip.currency)}</span>
            </div>

            {onClose && (
                <div className="mt-8 flex justify-end print:hidden">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-900">Close</button>
                    <button onClick={() => window.print()} className="ml-4 px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold shadow-lg hover:bg-black">Print Payslip</button>
                </div>
            )}
        </Card>
    );
};
