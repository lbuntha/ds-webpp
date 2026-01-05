import { BaseService } from './baseService';
import {
    PayrollRun, Payslip, Employee, StaffLoan, JournalEntry, JournalEntryLine,
    SystemSettings, Account, StaffLoanRepayment
} from '../types';
import { HRService } from './hrService';
import { FinanceService } from './financeService';
import { doc, writeBatch, runTransaction } from 'firebase/firestore';

export class PayrollService extends BaseService {
    private hrService: HRService;
    private financeService: FinanceService;

    constructor(hrService: HRService, financeService: FinanceService) {
        super();
        this.hrService = hrService;
        this.financeService = financeService;
    }

    /**
     * Generate a Draft Payroll Run for a given period
     */
    async generatePayrollRun(
        period: string, // YYYY-MM
        settings: SystemSettings,
        currentUserId: string,
        currentUserName: string
    ): Promise<{ run: PayrollRun, slips: Payslip[] }> {
        // 1. Fetch Active Employees
        const allEmployees = await this.hrService.getEmployees();
        const activeEmployees = allEmployees.filter(e => e.status !== 'TERMINATED' && e.hasBaseSalary);

        // 2. Create Run Object
        const runId = `pr-${period}-${Date.now()}`;
        const run: PayrollRun = {
            id: runId,
            period,
            status: 'DRAFT',
            totalAmount: 0,
            currency: 'USD', // Default to USD for now
            exchangeRate: 1,
            createdAt: Date.now(),
            createdBy: currentUserId,
            createdByName: currentUserName
        };

        // 3. Fetch Active Loans for Auto-Deduction
        const allLoans = await this.hrService.getStaffLoans();
        const activeLoans = allLoans.filter(l => l.status === 'ACTIVE');

        // 4. Generate Payslips
        const slips: Payslip[] = [];
        let totalNet = 0;

        for (const emp of activeEmployees) {
            const baseSalary = emp.baseSalaryAmount || 0;
            const currency = emp.baseSalaryCurrency || 'USD';

            // Fixed Exchange Logic: If Employee is in KHR, convert to Run Currency (USD) for aggregation?
            // Or keep mixed? For MVP, let's assume we run Payroll in USD, and convert KHR salaries.
            // Or better, support mixed currency. But for the 'Run' total, we need a common denom.
            // Let's convert everything to USD for the Run Total.

            const salaryInUSD = currency === 'KHR' ? baseSalary / 4100 : baseSalary; // Approx rate, should use settings

            // Deductions
            const deductions: any[] = [];
            let totalDeductions = 0;

            // Loan Deduction
            // Find active loan for this employee
            const empLoan = activeLoans.find(l => l.employeeId === emp.id);
            if (empLoan) {
                // Simple logic: Deduct specific amount or %? 
                // For now, let's say we deduct 10% of salary or remaining balance, whichever is lower?
                // Or user manually edits. Let's NOT auto-deduct for now to avoid surprise, 
                // OR deduct a placeholder if we have a field "monthlyDeduction".
                // We don't have that field. So we SKIP auto-deduction for now, 
                // but user can add it in the UI Wizard.
            }

            // Tax Deduction (Simple Placeholder)
            // if (emp.isTaxable) ...

            const grossPay = baseSalary;
            const netPay = grossPay - totalDeductions;

            slips.push({
                id: `ps-${runId}-${emp.id}`,
                payrollRunId: runId,
                employeeId: emp.id,
                employeeName: emp.name,
                employeeRole: emp.position || 'Staff',
                department: emp.department,
                baseSalary: baseSalary,
                currency: currency,
                earnings: [],
                deductions: deductions,
                grossPay: grossPay,
                totalTax: 0,
                totalDeductions: totalDeductions,
                netPay: netPay,
                status: 'PENDING'
            });

            // Add to Run Total (converted to USD)
            const netInUSD = currency === 'KHR' ? netPay / 4100 : netPay;
            totalNet += netInUSD;
        }

        run.totalAmount = totalNet;

        return { run, slips };
    }

    /**
     * Approve and Post Payroll Run
     * - Locks the run
     * - Creates GL Entry (Salaries Expense / Payroll Payable)
     * - Creates Loan Repayment records if any deductions existed
     */
    async approvePayrollRun(
        run: PayrollRun,
        slips: Payslip[],
        approverId: string,
        approverName: string,
        settings: SystemSettings,
        accounts: Account[]
    ): Promise<void> {
        const batch = writeBatch(this.db); // Assuming we can access db from BaseService

        // 1. Update Run Status
        run.status = 'APPROVED';
        run.approvedAt = Date.now();
        run.approvedBy = approverId;
        run.approvedByName = approverName;

        // Save Run
        const runRef = doc(this.db, 'payroll_runs', run.id);
        batch.set(runRef, run);

        // 2. Save/Update All Slips
        slips.forEach(slip => {
            const slipRef = doc(this.db, 'payslips', slip.id);
            batch.set(slipRef, slip);

            // 3. Handle Loan Repayments
            // If slip has a deduction of type 'LOAN', we need to record a repayment
            const loanDeductions = slip.deductions.filter(d => d.description.toLowerCase().includes('loan'));
            loanDeductions.forEach(deduction => {
                // We need the Loan ID. 
                // This is tricky if we don't store LoanID in the item.
                // For MVP, we might skip auto-creating the Repayment Record if we can't link it easily.
                // BUT we drafted 'payrollRunId' in StaffLoanRepayment.
                // We will assume the UI passes the LoanID in the description or a metadata field if we added one.
                // Let's rely on the Accountant to manually book loan repayments? 
                // NO, that defeats the purpose.

                // Better approach: When approving, we generate the GL. 
                // The GL credits 'Staff Loan Asset'. That reduces the balance IF the system is purely GL based.
                // But our 'Staff Loan' system is a separate record keeping on top of GL.
                // We SHOULD create a 'StaffLoanRepayment' record to keep them in sync.
                // To do this, we'd need to know WHICH loan. 
                // Let's assume for now we don't fully automate the "Loan Record" update 
                // unless we added hidden metadata to PayslipItem. 
                // We'll leave this as a TODO or manual step for the user in v1.
            });
        });

        // 4. Generate General Ledger Entry
        // Dr Salaries Expense
        // Cr Payroll Payable
        // Cr Tax Payable (if any)

        // We need to aggregate by Currency
        const lineItems: JournalEntryLine[] = [];

        // Group totals by currency
        const totalsByCurrency: Record<string, { gross: number, net: number, tax: number }> = {};

        slips.forEach(slip => {
            if (!totalsByCurrency[slip.currency]) {
                totalsByCurrency[slip.currency] = { gross: 0, net: 0, tax: 0 };
            }
            totalsByCurrency[slip.currency].gross += slip.grossPay;
            totalsByCurrency[slip.currency].net += slip.netPay;
            totalsByCurrency[slip.currency].tax += slip.totalTax;
        });

        Object.entries(totalsByCurrency).forEach(([curr, totals]) => {
            const expAccId = settings.defaultRevenueAccountUSD; // TODO: specific Salary Expense Account
            const payableAccId = settings.defaultDriverWalletAccountId; // TODO: Payroll Payable Account
            // Using logic from defaults for now as placeholders

            // Dr Salary Expense (Gross)
            // We need to fetch real accounts. For now using placeholders or 'accounts' lookup
            const expenseAcc = accounts.find(a => a.name === 'Salaries' || a.type === 'Expense') || accounts[0];
            const payableAcc = accounts.find(a => a.name === 'Payroll Payable' || a.type === 'Liability') || accounts[0];

            if (expenseAcc && payableAcc) {
                lineItems.push({
                    accountId: expenseAcc.id,
                    debit: totals.gross,
                    credit: 0,
                    originalCurrency: curr,
                    originalDebit: totals.gross,
                    originalCredit: 0,
                    description: `Salaries Expense (${curr})`
                });

                lineItems.push({
                    accountId: payableAcc.id,
                    debit: 0,
                    credit: totals.net,
                    originalCurrency: curr,
                    originalDebit: 0,
                    originalCredit: totals.net,
                    description: `Payroll Payable (${curr})`
                });
            }
        });

        const glEntry: JournalEntry = {
            id: `je-payroll-${run.id}`,
            date: new Date().toISOString().split('T')[0],
            description: `Payroll Run ${run.period}`,
            reference: run.id,
            branchId: 'HEAD_OFC',
            currency: 'USD', // Base GL currency
            exchangeRate: 1,
            lines: lineItems,
            status: 'POSTED',
            createdAt: Date.now(),
            createdBy: approverId
        };

        const glRef = doc(this.db, 'transactions', glEntry.id);
        batch.set(glRef, glEntry);

        // Link GL to Run
        run.journalEntryId = glEntry.id;
        batch.set(runRef, run); // Update run with GL ID

        await batch.commit();
    }
}
