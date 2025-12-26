import { Customer, UserProfile, SavedLocation } from '../types';
import { BaseService } from './baseService';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

/**
 * Service to sync customer data between users and customers collections
 */
export class SyncService extends BaseService {

    /**
     * Sync data from a UserProfile to its linked Customer record
     * Copies: savedLocations, referralCode, name, phone, address
     */
    async syncUserToCustomer(user: UserProfile): Promise<{ success: boolean; customerId?: string; error?: string }> {
        try {
            // Find linked customer
            const customersRef = collection(this.db, 'customers');
            let customerId: string | undefined;
            let existingCustomer: Customer | undefined;

            // Check by linkedCustomerId first
            if (user.linkedCustomerId) {
                const customerDoc = await this.getDocument<Customer>('customers', user.linkedCustomerId);
                if (customerDoc) {
                    existingCustomer = customerDoc;
                    customerId = user.linkedCustomerId;
                }
            }

            // If not found, search by linkedUserId
            if (!existingCustomer) {
                const q = query(customersRef, where('linkedUserId', '==', user.uid));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    existingCustomer = snap.docs[0].data() as Customer;
                    customerId = snap.docs[0].id;
                }
            }

            if (!existingCustomer || !customerId) {
                return { success: false, error: 'No linked customer found' };
            }

            // Merge data - user data takes precedence for contact info
            const updatedCustomer: Partial<Customer> = {
                ...existingCustomer,
                // Sync contact info from user (canonical source)
                name: user.name || existingCustomer.name,
                phone: user.phone || existingCustomer.phone,
                email: user.email || existingCustomer.email,
                address: user.address || existingCustomer.address,
                // Sync customer-specific fields from user if not already in customer
                savedLocations: this.mergeLocations(existingCustomer.savedLocations, user.savedLocations),
                referralCode: existingCustomer.referralCode || user.referralCode,
                updatedAt: Date.now()
            };

            // Save to customers collection
            await this.saveDocument('customers', { ...updatedCustomer, id: customerId });

            // Update user's link if missing
            if (!user.linkedCustomerId) {
                await updateDoc(doc(this.db, 'users', user.uid), { linkedCustomerId: customerId });
            }

            return { success: true, customerId };
        } catch (error) {
            console.error('Sync failed:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Merge two location arrays, avoiding duplicates by ID
     */
    private mergeLocations(customerLocs?: SavedLocation[], userLocs?: SavedLocation[]): SavedLocation[] {
        const merged: SavedLocation[] = [...(customerLocs || [])];
        const existingIds = new Set(merged.map(l => l.id));

        for (const loc of (userLocs || [])) {
            if (!existingIds.has(loc.id)) {
                merged.push(loc);
            }
        }

        return merged;
    }

    /**
     * Sync all users with linked customers
     */
    async syncAllUsersToCustomers(): Promise<{ synced: number; errors: string[] }> {
        const users = await this.getCollection<UserProfile>('users');
        const errors: string[] = [];
        let synced = 0;

        for (const user of users) {
            // Only sync users who have customer role or linked customer
            if (user.role === 'customer' || user.linkedCustomerId) {
                const result = await this.syncUserToCustomer(user);
                if (result.success) {
                    synced++;
                } else if (result.error && result.error !== 'No linked customer found') {
                    errors.push(`${user.name}: ${result.error}`);
                }
            }
        }

        return { synced, errors };
    }
}
