import { BaseService } from './baseService';
import { db, storage } from '../../config/firebase';
import { SystemSettings, CompanyProfile, Branch, CurrencyConfig, TaxRate, UserProfile, UserRole, Permission, SavedLocation, AppNotification, NavigationItem, PayrollConfig } from '../types';
import { doc, getDoc, setDoc, updateDoc, query, collection, where, getDocs, onSnapshot, orderBy, limit, writeBatch } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { DEFAULT_NAVIGATION, ROLE_PERMISSIONS } from '../constants';

export class ConfigService extends BaseService {
    // Settings
    async getSettings(): Promise<SystemSettings> {
        const snap = await getDoc(doc(this.db, 'settings', 'general'));
        return snap.exists() ? snap.data() as SystemSettings : {};
    }
    async updateSettings(s: SystemSettings) { await setDoc(doc(this.db, 'settings', 'general'), s, { merge: true }); }

    // Company Profile
    async getCompanyProfile(): Promise<CompanyProfile> {
        const snap = await getDoc(doc(this.db, 'settings', 'company_profile'));
        return snap.exists() ? snap.data() as CompanyProfile : {} as CompanyProfile;
    }
    async saveCompanyProfile(p: CompanyProfile) {
        await setDoc(doc(this.db, 'settings', 'company_profile'), { ...p, updatedAt: Date.now() }, { merge: true });
    }

    // Payroll Configuration
    async getPayrollConfig(): Promise<PayrollConfig> {
        const snap = await getDoc(doc(this.db, 'settings', 'payroll'));
        if (snap.exists()) return snap.data() as PayrollConfig;
        // Defaults
        return {
            standardWorkingDays: 26,
            standardDayOffs: 4,
            paySchedule: 'SEMI_MONTHLY',
            latenessDeductionAmount: 1.00,
            excessLeavePenaltyAmount: 10.00,
            minDaysForDayOff: 15,
            dayOffsPerPeriod: 2,
            workStartTime: '08:00',
            workEndTime: '17:00',
            lateGracePeriodMinutes: 15
        };
    }
    async updatePayrollConfig(c: PayrollConfig) { await setDoc(doc(this.db, 'settings', 'payroll'), c, { merge: true }); }

    // Branches
    // Branches
    async getBranches() { return this.getCollection<Branch>('branches'); }
    async addBranch(b: Branch) { await this.saveDocument('branches', b); }
    async updateBranch(b: Branch) { await this.saveDocument('branches', b); }
    async deleteBranch(id: string) { await this.deleteDocument('branches', id); }

    // Currencies & Taxes
    async getCurrencies() { return this.getCollection<CurrencyConfig>('currencies'); }
    async addCurrency(c: CurrencyConfig) { await this.saveDocument('currencies', c); }
    async updateCurrency(c: CurrencyConfig) { await this.saveDocument('currencies', c); }

    async getTaxRates() { return this.getCollection<TaxRate>('tax_rates'); }
    async addTaxRate(t: TaxRate) { await this.saveDocument('tax_rates', t); }
    async updateTaxRate(t: TaxRate) { await this.saveDocument('tax_rates', t); }

    // Users
    async getUsers() { return this.getCollection<UserProfile>('users'); }
    async updateUserRole(uid: string, role: string) { await updateDoc(doc(this.db, 'users', uid), { role }); }
    async updateUserStatus(uid: string, status: string) { await updateDoc(doc(this.db, 'users', uid), { status }); }

    async updateUserProfile(uid: string, name: string, extra?: any, auth?: any) {
        // Core User Profile Update
        await updateDoc(doc(this.db, 'users', uid), { name, lastLogin: Date.now() });
        if (auth && auth.currentUser) await updateProfile(auth.currentUser, { displayName: name });

        // If Customer, update specific fields in 'customers' collection
        const userSnap = await getDoc(doc(this.db, 'users', uid));
        if (userSnap.exists()) {
            const userData = userSnap.data() as UserProfile;
            if (userData.linkedCustomerId) {
                // Filter fields that belong to the customer collection
                const customerFields: any = { name, updatedAt: Date.now() };
                const fieldsToMove = ['phone', 'address', 'referralCode', 'isTaxable', 'excludeFeesInSettlement', 'customExchangeRate', 'bankAccounts'];

                if (extra) {
                    fieldsToMove.forEach(f => {
                        if (extra[f] !== undefined) customerFields[f] = extra[f];
                    });
                }

                await updateDoc(doc(this.db, 'customers', userData.linkedCustomerId), customerFields);
            }
        }
    }
    async updateUserBranch(uid: string, branchId: string | null) { await updateDoc(doc(this.db, 'users', uid), { managedBranchId: branchId }); }
    async updateUserWalletMapping(uid: string, walletAccountId: string) { await updateDoc(doc(this.db, 'users', uid), { walletAccountId }); }

    async deleteUserAndCustomer(uid: string, linkedCustomerId?: string) {
        const batch = writeBatch(this.db);
        batch.delete(doc(this.db, 'users', uid));

        if (linkedCustomerId) {
            batch.delete(doc(this.db, 'customers', linkedCustomerId));
        }

        await batch.commit();
    }

    async getRolePermissions(): Promise<Record<UserRole, Permission[]>> {
        const snap = await getDoc(doc(this.db, 'settings', 'permissions'));
        return snap.exists() ? snap.data() as any : {} as any;
    }
    async updateRolePermissions(perms: any) { await setDoc(doc(this.db, 'settings', 'permissions'), perms); }

    async seedDefaultPermissions() {
        // Overwrite/Update permissions with latest code constants
        await setDoc(doc(this.db, 'settings', 'permissions'), ROLE_PERMISSIONS, { merge: true });
    }

    async getUserUidByCustomerId(customerId: string): Promise<string | undefined> {
        const q = query(collection(this.db, 'users'), where('linkedCustomerId', '==', customerId));
        const snap = await getDocs(q);
        if (!snap.empty) return snap.docs[0].id;
        return undefined;
    }

    async updateUserLocations(uid: string, locs: SavedLocation[]) {
        const userSnap = await getDoc(doc(this.db, 'users', uid));
        if (userSnap.exists()) {
            const userData = userSnap.data() as UserProfile;
            if (userData.linkedCustomerId) {
                // Save to customer collection
                await updateDoc(doc(this.db, 'customers', userData.linkedCustomerId), {
                    savedLocations: this.cleanData(locs),
                    updatedAt: Date.now()
                });
                return;
            }
        }
        // Fallback for non-customers
        await updateDoc(doc(this.db, 'users', uid), { savedLocations: this.cleanData(locs) });
    }

    subscribeToUserProfile(uid: string, callback: (user: UserProfile) => void) {
        return onSnapshot(doc(this.db, 'users', uid), (docSnap) => {
            if (docSnap.exists()) {
                callback(docSnap.data() as UserProfile);
            }
        });
    }

    // Notifications
    async sendNotification(n: AppNotification) { await this.saveDocument('notifications', n); }

    async getNotifications(uid: string, role: string): Promise<AppNotification[]> {
        // Fallback one-time fetch
        const q = query(
            collection(this.db, 'notifications'),
            where('targetAudience', 'in', [uid, role, 'ALL']),
            limit(50)
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(d => d.data() as AppNotification);
        return data.sort((a, b) => b.createdAt - a.createdAt);
    }

    subscribeToNotifications(uid: string, role: string, callback: (notifs: AppNotification[]) => void) {
        // Real-time listener
        const q = query(
            collection(this.db, 'notifications'),
            where('targetAudience', 'in', [uid, role, 'ALL']),
            limit(50)
        );
        return onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => doc.data() as AppNotification);
            // Sort client-side to avoid compound index requirement on dynamic fields
            items.sort((a, b) => b.createdAt - a.createdAt);
            callback(items);
        });
    }

    async markNotificationRead(id: string) { await updateDoc(doc(this.db, 'notifications', id), { read: true }); }

    // --- Dynamic Menu ---
    async getMenuItems(): Promise<NavigationItem[]> {
        const snap = await getDocs(collection(this.db, 'navigation_menu'));
        return snap.docs.map(d => d.data() as NavigationItem).sort((a, b) => a.order - b.order);
    }

    async saveMenuItem(item: NavigationItem) {
        await this.saveDocument('navigation_menu', item);
    }

    async deleteMenuItem(id: string) {
        await this.deleteDocument('navigation_menu', id);
    }

    async seedDefaultMenu() {
        await this.overwriteMenu(DEFAULT_NAVIGATION);
    }

    async overwriteMenu(items: NavigationItem[]) {
        const batch = writeBatch(this.db);

        // FIRST: Delete ALL existing menu items to ensure clean reset
        const existing = await getDocs(collection(this.db, 'navigation_menu'));
        existing.docs.forEach(docSnap => {
            batch.delete(docSnap.ref);
        });

        // THEN: Seed with provided items
        for (const item of items) {
            const ref = doc(this.db, 'navigation_menu', item.id);
            batch.set(ref, item);
        }

        await batch.commit();
    }
}


export const configService = new ConfigService(db, storage);