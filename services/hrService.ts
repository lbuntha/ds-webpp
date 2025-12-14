
import { BaseService } from './baseService';
import { Employee, StaffLoan, StaffLoanRepayment } from '../types';

export class HRService extends BaseService {
  async getEmployees() { return this.getCollection<Employee>('employees'); }
  async addEmployee(e: Employee) { await this.saveDocument('employees', e); }
  async updateEmployee(e: Employee) { await this.saveDocument('employees', e); }

  async getStaffLoans() { return this.getCollection<StaffLoan>('staff_loans'); }
  async createStaffLoan(l: StaffLoan) { await this.saveDocument('staff_loans', l); }
  async recordStaffLoanRepayment(r: StaffLoanRepayment) { await this.saveDocument('loan_repayments', r); }
}
