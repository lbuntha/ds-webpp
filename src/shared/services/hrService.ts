
import { BaseService } from './baseService';
import { Employee, StaffLoan, StaffLoanRepayment } from '../types';

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
}
