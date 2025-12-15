import { BaseService } from './baseService';
import { SystemSettings, Branch, CurrencyConfig, TaxRate, UserProfile, UserRole, Permission, SavedLocation, AppNotification, NavigationItem } from '../types';
import { doc, getDoc, setDoc, updateDoc, query, collection, where, getDocs, onSnapshot, orderBy, limit, writeBatch } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { DEFAULT_NAVIGATION } from '../constants';

export class ConfigService extends BaseService {
    // Settings
    async getSettings(): Promise<SystemSettings> {
        const snap = await getDoc(doc(this.db, 'settings', 'general'));
        return snap.exists() ? snap.data() as SystemSettings : {};
    }
    async updateSettings(s: SystemSettings) { await setDoc(doc(this.db, 'settings', 'general'), s, { merge: true }); }

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
        await updateDoc(doc(this.db, 'users', uid), { name, ...extra });
        if (auth && auth.currentUser) await updateProfile(auth.currentUser, { displayName: name });
    }
    async updateUserBranch(uid: string, branchId: string | null) { await updateDoc(doc(this.db, 'users', uid), { managedBranchId: branchId }); }
    async updateUserWalletMapping(uid: string, walletAccountId: string) { await updateDoc(doc(this.db, 'users', uid), { walletAccountId }); }

    async getRolePermissions(): Promise<Record<UserRole, Permission[]>> {
        const snap = await getDoc(doc(this.db, 'settings', 'permissions'));
        return snap.exists() ? snap.data() as any : {};
    }
    async updateRolePermissions(perms: any) { await setDoc(doc(this.db, 'settings', 'permissions'), perms); }

    async getUserUidByCustomerId(customerId: string): Promise<string | undefined> {
        const q = query(collection(this.db, 'users'), where('linkedCustomerId', '==', customerId));
        const snap = await getDocs(q);
        if (!snap.empty) return snap.docs[0].id;
        return undefined;
    }

    async updateUserLocations(uid: string, locs: SavedLocation[]) {
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
        // Use Batch for atomicity and speed
        const batch = writeBatch(this.db);

        for (const item of DEFAULT_NAVIGATION) {
            const ref = doc(this.db, 'navigation_menu', item.id);
            // Merge true ensures we don't overwrite custom role changes if they exist, 
            // but we ensure the item exists
            batch.set(ref, item, { merge: true });
        }

        await batch.commit();
    }

    // --- Routes Management ---
    async getRoutes(): Promise<any[]> {
        const snap = await getDocs(collection(this.db, 'app_routes'));
        return snap.docs.map(d => d.data()).sort((a, b) => a.order - b.order);
    }

    async saveRoute(route: any) {
        await this.saveDocument('app_routes', route);
    }

    async deleteRoute(id: string) {
        await this.deleteDocument('app_routes', id);
    }

    async seedDefaultRoutes(defaultRoutes: any[]) {
        const batch = writeBatch(this.db);

        for (const route of defaultRoutes) {
            const ref = doc(this.db, 'app_routes', route.id);
            batch.set(ref, route, { merge: true });
        }

        await batch.commit();
    }
}