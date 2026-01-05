import { useState, useEffect } from 'react';
import { useData } from '../../shared/contexts/DataContext';
import { useAuth } from '../../shared/contexts/AuthContext';
import { PayrollService } from '../../shared/services/payrollService';
import { HRService } from '../../shared/services/hrService';
import { FinanceService } from '../../shared/services/financeService';
import { PayrollWizard } from '../../../components/payroll/PayrollWizard';
import { PayrollRun } from '../../shared/types';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

export default function PayrollView() {
    const { settings, accounts, refreshData } = useData();
    const { user } = useAuth();

    // Services
    // In a real app these might be injected or from hooks. 
    // Constructing here for MVP since they are classes.
    // Assuming services are not singletons but lightweight.
    // Ideally we use a useService hook.
    // Accessing firestore implicitly via base service which needs db.
    // The previous service files extended BaseService which usually gets DB instance.
    // Assuming default constructor works or we need to pass db.
    // Looking at 'hrService.ts' in previous Steps, it extends BaseService.
    const hrService = new HRService();
    const financeService = new FinanceService();
    const payrollService = new PayrollService(hrService, financeService);

    const [view, setView] = useState<'LIST' | 'WIZARD'>('LIST');
    const [runs, setRuns] = useState<PayrollRun[]>([]);
    const [loading, setLoading] = useState(true);

    const loadRuns = async () => {
        setLoading(true);
        try {
            const data = await hrService.getPayrollRuns();
            // Sort by period desc
            data.sort((a, b) => b.period.localeCompare(a.period));
            setRuns(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRuns();
    }, []);

    if (view === 'WIZARD') {
        return (
            <PayrollWizard
                payrollService={payrollService}
                settings={settings}
                accounts={accounts}
                currentUser={{ uid: user?.uid || '', name: user?.name || 'Admin' }}
                onComplete={() => {
                    refreshData(); // Refresh GL etc
                    loadRuns();
                    setView('LIST');
                }}
                onCancel={() => setView('LIST')}
            />
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Payroll</h1>
                    <p className="text-gray-500 font-medium">Process salaries, generate payslips, and manage staff payments.</p>
                </div>
                <Button onClick={() => setView('WIZARD')} className="bg-indigo-600 shadow-lg shadow-indigo-200">
                    Run Payroll
                </Button>
            </div>

            <Card>
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-900">Payroll History</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-black text-gray-400 uppercase tracking-wider">Period</th>
                                <th className="px-6 py-3 text-left text-xs font-black text-gray-400 uppercase tracking-wider">Run Date</th>
                                <th className="px-6 py-3 text-left text-xs font-black text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-black text-gray-400 uppercase tracking-wider">Total Amount</th>
                                <th className="px-6 py-3 text-left text-xs font-black text-gray-400 uppercase tracking-wider pl-8">Approved By</th>
                                <th className="px-6 py-3 text-right text-xs font-black text-gray-400 uppercase tracking-wider">GL Entry</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {runs.map(run => (
                                <tr key={run.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{run.period}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(run.createdAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-md text-xs font-black uppercase tracking-wide ${run.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                run.status === 'PAID' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {run.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-bold text-indigo-900">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: run.currency }).format(run.totalAmount)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 pl-8">{run.approvedByName || '-'}</td>
                                    <td className="px-6 py-4 text-right text-xs font-mono text-gray-400">
                                        {run.journalEntryId || '-'}
                                    </td>
                                </tr>
                            ))}
                            {runs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-medium">
                                        No payroll runs found. Start your first run above.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
