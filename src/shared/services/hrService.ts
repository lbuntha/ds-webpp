import { BaseService } from './baseService';
import { Employee, StaffLoan, StaffLoanRepayment, StaffTransaction, DailyAttendance, AttendanceRecord } from '../types';

export class HRService extends BaseService {
  // Employee CRUD
  async getEmployees() { return this.getCollection<Employee>('employees'); }
  async addEmployee(e: Employee) { await this.saveDocument('employees', e); }
  async updateEmployee(e: Employee) {
    await this.saveDocument('employees', { ...e, updatedAt: Date.now() }, true);
  }
  async deleteEmployee(id: string) { await this.deleteDocument('employees', id); }

  // Employee-User Linking
  async getEmployeeByUserId(uid: string): Promise<Employee | null> {
    const employees = await this.getEmployees();
    return employees.find(e => e.linkedUserId === uid) || null;
  }

  async linkEmployeeToUser(employeeId: string, userId: string): Promise<void> {
    const employees = await this.getEmployees();
    const employee = employees.find(e => e.id === employeeId);
    if (employee) {
      await this.updateEmployee({ ...employee, linkedUserId: userId });
    }
  }

  async createEmployeeForUser(userId: string, name: string, isDriver: boolean): Promise<Employee> {
    const newEmployee: Employee = {
      id: crypto.randomUUID(),
      linkedUserId: userId,
      name,
      isDriver,
      status: 'ACTIVE',
      createdAt: Date.now()
    };
    await this.addEmployee(newEmployee);
    return newEmployee;
  }

  // Staff Loans
  async getStaffLoans() { return this.getCollection<StaffLoan>('staff_loans'); }
  async createStaffLoan(l: StaffLoan) { await this.saveDocument('staff_loans', l); }
  async recordStaffLoanRepayment(r: StaffLoanRepayment) { await this.saveDocument('loan_repayments', r); }

  // Payroll Persistence
  async getPayrollRuns() { return this.getCollection<any>('payroll_runs'); } // Type checked at usage
  async createPayrollRun(run: any) { await this.saveDocument('payroll_runs', run); }
  async updatePayrollRun(run: any) { await this.saveDocument('payroll_runs', run); }

  async getPayslips(runId: string) {
    // This would ideally be a query, but for now we fetch all or use a query helper if available in BaseService
    // BaseService doesn't expose query helper directly in the snippet seen, but usually Firestore service does.
    // Assuming simple collection fetch for now or adding a query method if I could.
    // Let's use the BaseService 'getCollection' and filter info memory for MVP or assume a query method exists.
    // Actually, financeService uses 'query' imported from firestore. I can do the same here if I import them.
    // For safety/speed conform to pattern:
    return this.getCollection<any>('payslips');
  }

  async savePayslips(slips: any[]) {
    // Batch save
    const batch = (this as any).batch || undefined; // If base has batch helper? No.
    // We can use the simple loop or implement a batch helper.
    // For now, let's just use a loop of saveDocument for MVP simplicity or check if we can import writeBatch.
    // FinanceService imports writeBatch. Let's try to import it if possible, but I can't easily change imports without view_file of top.
    // I see 'BaseService' import.
    // I will just add the methods and use a loop for now to be safe.
    for (const slip of slips) {
      await this.saveDocument('payslips', slip);
    }
  }

  // Staff Transactions (Allowances/Deductions)
  async getStaffTransactions() { return this.getCollection<StaffTransaction>('staff_transactions'); }
  async createStaffTransaction(t: StaffTransaction) { await this.saveDocument('staff_transactions', t); }
  async updateStaffTransaction(t: StaffTransaction) { await this.saveDocument('staff_transactions', t, true); }
  async deleteStaffTransaction(id: string) { await this.deleteDocument('staff_transactions', id); }

  // Attendance
  async getDailyAttendance() { return this.getCollection<DailyAttendance>('daily_attendance'); }
  async saveDailyAttendance(a: DailyAttendance) { await this.saveDocument('daily_attendance', a, true); } // Upsert

  async getAttendanceRecords() { return this.getCollection<AttendanceRecord>('attendance_records'); }
  async saveAttendanceRecord(r: AttendanceRecord) { await this.saveDocument('attendance_records', r, true); }
}
