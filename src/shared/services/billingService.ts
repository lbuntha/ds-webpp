
import { BaseService } from './baseService';
import { Customer, Invoice, Vendor, Bill, BillPayment, UserProfile } from '../types';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

export class BillingService extends BaseService {
    // Receivables
    async getCustomers() { return this.getCollection<Customer>('customers'); }
    async addCustomer(c: Customer) { await this.saveDocument('customers', c); }
    async updateCustomer(c: Customer) { await this.saveDocument('customers', c); }

    async getInvoices() { return this.getCollection<Invoice>('invoices'); }
    async createInvoice(i: Invoice) { await this.saveDocument('invoices', i); }
    async recordPayment(payment: any) { await this.saveDocument('payments', payment); }

    // Payables
    async getVendors() { return this.getCollection<Vendor>('vendors'); }
    async addVendor(v: Vendor) { await this.saveDocument('vendors', v); }
    async updateVendor(v: Vendor) { await this.saveDocument('vendors', v); }

    async getBills() { return this.getCollection<Bill>('bills'); }
    async createBill(b: Bill) { await this.saveDocument('bills', b); }
    async recordBillPayment(bp: any) { await this.saveDocument('bill_payments', bp); }
    async getBillPayments(billId: string): Promise<BillPayment[]> { return []; }

    // Utilities - Create lightweight customer record linked to user
    async createCustomerFromUser(user: UserProfile) {
        // Check if customer already exists by linkedUserId
        const q = query(collection(this.db, 'customers'), where('linkedUserId', '==', user.uid));
        const snap = await getDocs(q);

        let customerId: string;

        if (!snap.empty) {
            // Exists, just link it
            customerId = snap.docs[0].id;
        } else {
            // Create new lightweight customer (no duplicated fields)
            const newId = `cust-${Date.now()}`;
            const customer: Customer = {
                id: newId,
                linkedUserId: user.uid,  // Required link to UserProfile
                bankAccounts: [],        // Customer-specific: bank details
                createdAt: Date.now(),
                // Note: name/email/phone/address come from UserProfile, not duplicated here
            };
            await this.saveDocument('customers', customer);
            customerId = newId;
        }

        await updateDoc(doc(this.db, 'users', user.uid), { linkedCustomerId: customerId });
    }
}

