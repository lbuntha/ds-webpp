
import { app, auth, db, storage } from './firebaseInstance';
import { AuthService } from './authService';
import { ConfigService } from './configService';
import { FinanceService } from './financeService';
import { BillingService } from './billingService';
import { HRService } from './hrService';
import { LogisticsService } from './logisticsService';
import { WalletService } from './walletService';
import { PlaceService } from './placeService';
import { BaseService } from './baseService';
import { collection, getDocs, deleteDoc, query, writeBatch, limit } from 'firebase/firestore';
import { UserProfile, NavigationItem, Account, WalletTransaction } from '../types';

// Facade Class to maintain backward compatibility with existing components
export class FirebaseService {
    public authService = new AuthService(auth, db);
    public configService = new ConfigService(db, storage);
    public financeService = new FinanceService(db, storage);
    public billingService = new BillingService(db, storage);
    public hrService = new HRService(db, storage);
    public logisticsService = new LogisticsService(db, storage);
    public walletService = new WalletService(db, storage);
    public placeService = new PlaceService(db, storage);

    // Also keep a base service instance if needed for generic ops
    public base = new BaseService(db, storage);

    // --- PROXY METHODS (To avoid breaking changes in UI components) ---

    // Auth
    login(email: string, pass: string) { return this.authService.login(email, pass); }
    register(email: string, pass: string, name: string, extra?: any) { return this.authService.register(email, pass, name, extra); }
    logout() { return this.authService.logout(); }
    resetPassword(email: string) { return this.authService.resetPassword(email); }
    getCurrentUser() { return this.authService.getCurrentUser(); }
    subscribeToAuth(cb: (user: any) => void) { return this.authService.subscribeToAuth(cb); }

    // Config (Settings, Users, etc)
    getSettings() { return this.configService.getSettings(); }
    updateSettings(s: any) { return this.configService.updateSettings(s); }

    getBranches() { return this.configService.getBranches(); }
    addBranch(b: any) { return this.configService.addBranch(b); }
    updateBranch(b: any) { return this.configService.updateBranch(b); }
    deleteBranch(id: string) { return this.configService.deleteBranch(id); }

    getCurrencies() { return this.configService.getCurrencies(); }
    addCurrency(c: any) { return this.configService.addCurrency(c); }
    updateCurrency(c: any) { return this.configService.updateCurrency(c); }

    getTaxRates() { return this.configService.getTaxRates(); }
    addTaxRate(t: any) { return this.configService.addTaxRate(t); }
    updateTaxRate(t: any) { return this.configService.updateTaxRate(t); }

    getUsers() { return this.configService.getUsers(); }
    updateUserRole(uid: string, role: string) { return this.configService.updateUserRole(uid, role); }
    updateUserStatus(uid: string, status: string) { return this.configService.updateUserStatus(uid, status); }
    updateUserProfile(name: string, extra?: any) {
        const u = auth.currentUser;
        return u ? this.configService.updateUserProfile(u.uid, name, extra, auth) : Promise.resolve();
    }
    updateUserBranch(uid: string, bid: string | null) { return this.configService.updateUserBranch(uid, bid); }
    updateUserWalletMapping(uid: string, walletAccountId: string) { return this.configService.updateUserWalletMapping(uid, walletAccountId); }
    getRolePermissions() { return this.configService.getRolePermissions(); }
    updateRolePermissions(p: any) { return this.configService.updateRolePermissions(p); }
    seedDefaultPermissions() { return this.configService.seedDefaultPermissions(); }
    updateUserLocations(locs: any[]) {
        const u = auth.currentUser;
        return u ? this.configService.updateUserLocations(u.uid, locs) : Promise.resolve();
    }
    subscribeToUser(uid: string, cb: any) { return this.configService.subscribeToUserProfile(uid, cb); }

    sendNotification(n: any) { return this.configService.sendNotification(n); }
    getNotifications(uid: string, role: string) { return this.configService.getNotifications(uid, role); }
    subscribeToNotifications(uid: string, role: string, cb: any) { return this.configService.subscribeToNotifications(uid, role, cb); }
    markNotificationRead(id: string) { return this.configService.markNotificationRead(id); }

    // Menu Management
    getMenuItems() { return this.configService.getMenuItems(); }
    saveMenuItem(item: NavigationItem) { return this.configService.saveMenuItem(item); }
    deleteMenuItem(id: string) { return this.configService.deleteMenuItem(id); }
    seedDefaultMenu() { return this.configService.seedDefaultMenu(); }

    // Finance
    getAccounts() { return this.financeService.getAccounts(); }
    addAccount(a: any) { return this.financeService.addAccount(a); }
    updateAccount(a: any) { return this.financeService.updateAccount(a); }
    deleteAccount(id: string) { return this.financeService.deleteAccount(id); }
    importAccounts(accounts: Account[]) { return this.financeService.importAccounts(accounts); }

    getTransactions() { return this.financeService.getTransactions(); }
    addTransaction(t: any) { return this.financeService.addTransaction(t); }
    updateTransaction(t: any) { return this.financeService.updateTransaction(t); }
    deleteTransactions(ids: string[]) { return this.financeService.deleteTransactions(ids); }

    getFixedAssets() { return this.financeService.getFixedAssets(); }
    addFixedAsset(fa: any) { return this.financeService.addFixedAsset(fa); }
    updateFixedAsset(fa: any) { return this.financeService.updateFixedAsset(fa); }
    getFixedAssetCategories() { return this.financeService.getFixedAssetCategories(); }
    addFixedAssetCategory(c: any) { return this.financeService.addFixedAssetCategory(c); }
    updateFixedAssetCategory(c: any) { return this.financeService.updateFixedAssetCategory(c); }
    deleteFixedAssetCategory(id: string) { return this.financeService.deleteFixedAssetCategory(id); }
    runBatchDepreciation(date: string) { return this.financeService.runBatchDepreciation(date); }
    depreciateAsset(id: string, date: string, amt: number) { return this.financeService.depreciateAsset(id, date, amt); }
    disposeAsset(id: string, date: string, amt: number, dep: string, loss: string) { return this.financeService.disposeAsset(id, date, amt, dep, loss); }

    // Billing
    getCustomers() { return this.billingService.getCustomers(); }
    addCustomer(c: any) { return this.billingService.addCustomer(c); }
    updateCustomer(c: any) { return this.billingService.updateCustomer(c); }
    getUserUidByCustomerId(cid: string) { return this.configService.getUserUidByCustomerId(cid); }
    createCustomerFromUser(u: any) { return this.billingService.createCustomerFromUser(u); }

    getInvoices() { return this.billingService.getInvoices(); }
    createInvoice(i: any) { return this.billingService.createInvoice(i); }
    recordPayment(p: any) { return this.billingService.recordPayment(p); }

    getVendors() { return this.billingService.getVendors(); }
    addVendor(v: any) { return this.billingService.addVendor(v); }
    updateVendor(v: any) { return this.billingService.updateVendor(v); }

    getBills() { return this.billingService.getBills(); }
    createBill(b: any) { return this.billingService.createBill(b); }
    recordBillPayment(bp: any) { return this.billingService.recordBillPayment(bp); }
    getBillPayments(bid: string) { return this.billingService.getBillPayments(bid); }

    // HR
    getEmployees() { return this.hrService.getEmployees(); }
    addEmployee(e: any) { return this.hrService.addEmployee(e); }
    updateEmployee(e: any) { return this.hrService.updateEmployee(e); }
    getStaffLoans() { return this.hrService.getStaffLoans(); }
    createStaffLoan(l: any) { return this.hrService.createStaffLoan(l); }
    recordStaffLoanRepayment(r: any) { return this.hrService.recordStaffLoanRepayment(r); }

    // Logistics
    getParcelServices() { return this.logisticsService.getParcelServices(); }
    saveParcelService(s: any) { return this.logisticsService.saveParcelService(s); }
    deleteParcelService(id: string) { return this.logisticsService.deleteParcelService(id); }

    getParcelPromotions() { return this.logisticsService.getParcelPromotions(); }
    saveParcelPromotion(p: any) { return this.logisticsService.saveParcelPromotion(p); }
    deleteParcelPromotion(id: string) { return this.logisticsService.deleteParcelPromotion(id); }

    getParcelStatuses() { return this.logisticsService.getParcelStatuses(); }
    saveParcelStatus(s: any) { return this.logisticsService.saveParcelStatus(s); }
    deleteParcelStatus(id: string) { return this.logisticsService.deleteParcelStatus(id); }
    seedDefaultParcelStatuses() { return this.logisticsService.seedDefaultParcelStatuses(); }

    getParcelBookings() { return this.logisticsService.getParcelBookings(); }
    // New filtered fetch for drivers
    getDriverJobs(driverId: string) { return this.logisticsService.getDriverJobs(driverId); }
    // Secure fetch for wallet dashboard
    getUserBookings(user: UserProfile) { return this.logisticsService.getUserBookings(user); }

    saveParcelBooking(b: any, acc?: string) {
        return this.logisticsService.saveParcelBooking(b, acc, this.walletService, this.configService, this.hrService);
    }
    updateParcelStatus(id: string, sid: string, uid: string, uname: string) { return this.logisticsService.updateParcelStatus(id, sid, uid, uname); }
    updateParcelItemStatus(bookingId: string, itemId: string, status: string) { return this.logisticsService.updateParcelItemStatus(bookingId, itemId, status); }
    updateParcelItemCOD(bookingId: string, itemId: string, amount: number, currency: 'USD' | 'KHR') { return this.logisticsService.updateParcelItemCOD(bookingId, itemId, amount, currency); }
    receiveItemAtWarehouse(bid: string, iid: string, uname: string) { return this.logisticsService.receiveItemAtWarehouse(bid, iid, uname); }

    // Admin sub
    subscribeToParcelBookings(cb: any) { return this.logisticsService.subscribeToParcelBookings(cb); }
    // New Customer sub
    subscribeToCustomerBookings(uid: string, cid: string | undefined, name: string, cb: any) {
        return this.logisticsService.subscribeToCustomerBookings(uid, cid, name, cb);
    }

    sendChatMessage(msg: any) { return this.logisticsService.sendChatMessage(msg); }
    subscribeToChat(id: string, cb: any) { return this.logisticsService.subscribeToChat(id, cb); }
    settleParcelItems(items: any[]) { return this.logisticsService.settleParcelItems(items); }

    // Special Rates
    getCustomerSpecialRates(customerId: string) { return this.logisticsService.getCustomerSpecialRates(customerId); }
    saveCustomerSpecialRate(rate: any) { return this.logisticsService.saveCustomerSpecialRate(rate); }
    deleteCustomerSpecialRate(id: string) { return this.logisticsService.deleteCustomerSpecialRate(id); }

    // Referral Rules
    getReferralRules() { return this.logisticsService.getReferralRules(); }
    saveReferralRule(rule: any) { return this.logisticsService.saveReferralRule(rule); }
    deleteReferralRule(id: string) { return this.logisticsService.deleteReferralRule(id); }

    // Wallet
    getWalletTransactions(uid: string) { return this.walletService.getWalletTransactions(uid); }
    subscribeToWalletTransactions(uid: string, cb: (txns: WalletTransaction[]) => void) { return this.walletService.subscribeToWalletTransactions(uid, cb); }
    getAllWalletTransactions() { return this.walletService.getAllWalletTransactions(); }
    requestWalletTopUp(uid: string, amt: number, curr: string, bid: string, att: string, desc: string) { return this.walletService.requestWalletTopUp(uid, amt, curr, bid, att, desc); }
    requestSettlement(uid: string, name: string, amt: number, curr: string, bid: string, att: string, desc: string, items?: any[]) { return this.walletService.requestSettlement(uid, name, amt, curr, bid, att, desc, items); }
    requestWithdrawal(uid: string, name: string, amt: number, curr: string, bid: string, desc: string, items?: any[]) { return this.walletService.requestWithdrawal(uid, name, amt, curr, bid, desc, items); }
    processWalletTransaction(uid: string, amt: number, curr: string, type: string, bid: string, desc: string) { return this.walletService.processWalletTransaction(uid, amt, curr, type, bid, desc); }
    getPendingWalletTransactions() { return this.walletService.getPendingWalletTransactions(); }
    approveWalletTransaction(id: string, uid: string, journalEntryId?: string) { return this.walletService.approveWalletTransaction(id, uid, journalEntryId); }
    rejectWalletTransaction(id: string, reason: string) { return this.walletService.rejectWalletTransaction(id, reason); }
    processReferralReward(refereeUid: string, referrerCode: string) { return this.walletService.processReferralReward(refereeUid, referrerCode); }

    // Places
    searchPlaces(term: string) { return this.placeService.searchPlaces(term); }
    getAllPlaces() { return this.placeService.getAllPlaces(); }
    addPlace(place: any) { return this.placeService.addPlace(place); }

    // Base
    getDocument(col: string, id: string) { return this.base.getDocument(col, id); }

    async clearFinancialAndLogisticsData() {
        const collections = [
            'transactions',
            'invoices',
            'bills',
            'bill_payments',
            'payments',
            'parcel_bookings',
            'wallet_transactions',
            'staff_loans',
            'loan_repayments',
            'fixed_assets',
            'fixed_asset_categories',
            'notifications',
            'chat_messages',
            'customer_rates',
            'referral_rules',
            'vendors',
            'customers'
        ];

        console.log("Starting data clear...");

        for (const colName of collections) {
            try {
                const colRef = collection(db, colName);
                // Delete in batches of 400 until empty
                while (true) {
                    const q = query(colRef, limit(400));
                    const snapshot = await getDocs(q);

                    if (snapshot.empty) break;

                    console.log(`Clearing batch from ${colName}: ${snapshot.size} docs`);

                    const batch = writeBatch(db);
                    snapshot.docs.forEach((doc) => {
                        batch.delete(doc.ref);
                    });
                    await batch.commit();
                }
            } catch (e) {
                console.error(`Failed to clear collection ${colName}`, e);
                // Continue to next collection
            }
        }
        console.log("Data clear complete.");
    }

    async initializeCompanyData(settings: any, accounts: any, branches: any, reset: boolean) {
        if (reset) {
            await this.clearFinancialAndLogisticsData();

            // Clear accounts/branches using same robust batch logic
            const cleanMetadata = async (col: string) => {
                try {
                    const colRef = collection(db, col);
                    while (true) {
                        const q = query(colRef, limit(400));
                        const snap = await getDocs(q);
                        if (snap.empty) break;

                        const batch = writeBatch(db);
                        snap.docs.forEach(d => batch.delete(d.ref));
                        await batch.commit();
                    }
                } catch (e) { console.error("Clean meta error", e); }
            };

            await cleanMetadata('accounts');
            await cleanMetadata('branches');
            await cleanMetadata('navigation_menu');
        }

        // Use Batch Import instead of Loop for Accounts (Much Faster)
        await this.financeService.importAccounts(accounts);

        // Branches usually few, loop is fine
        for (const b of branches) await this.addBranch(b);

        // Initialize default menu
        await this.seedDefaultMenu();

        // Save settings LAST to mark setup as complete only after data is ready
        await this.updateSettings(settings);
    }
}

export const firebaseService = new FirebaseService();
