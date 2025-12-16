
import { BaseService } from './baseService';
import { ParcelServiceType, ParcelPromotion, ParcelStatusConfig, ParcelBooking, ChatMessage, JournalEntry, SystemSettings, DriverCommissionRule, CustomerSpecialRate, UserProfile, ReferralRule } from '../types';
import { doc, updateDoc, onSnapshot, collection, query, where, getDoc, getDocs, increment, or } from 'firebase/firestore';

export class LogisticsService extends BaseService {
    // Config
    async getParcelServices() { return this.getCollection<ParcelServiceType>('parcel_services'); }
    async saveParcelService(s: ParcelServiceType) {
        if (s.image && s.image.startsWith('data:')) s.image = await this.uploadAttachment(s.image);
        await this.saveDocument('parcel_services', s);
    }
    async deleteParcelService(id: string) { await this.deleteDocument('parcel_services', id); }

    async getParcelPromotions() { return this.getCollection<ParcelPromotion>('parcel_promotions'); }
    async saveParcelPromotion(p: ParcelPromotion) { await this.saveDocument('parcel_promotions', p); }
    async deleteParcelPromotion(id: string) { await this.deleteDocument('parcel_promotions', id); }

    async getParcelStatuses() { return this.getCollection<ParcelStatusConfig>('parcel_statuses'); }
    async saveParcelStatus(s: ParcelStatusConfig) { await this.saveDocument('parcel_statuses', s); }
    async deleteParcelStatus(id: string) { await this.deleteDocument('parcel_statuses', id); }
    async seedDefaultParcelStatuses() {
        const defaults: ParcelStatusConfig[] = [
            { id: 'ps-pending', label: 'Pending', color: 'bg-gray-100 text-gray-800', order: 1, isDefault: true, triggersRevenue: false, isTerminal: false },
            { id: 'ps-pickup', label: 'Picked Up', color: 'bg-blue-100 text-blue-800', order: 2, isDefault: false, triggersRevenue: false, isTerminal: false },
            { id: 'ps-transit', label: 'In Transit', color: 'bg-yellow-100 text-yellow-800', order: 3, isDefault: false, triggersRevenue: false, isTerminal: false },
            { id: 'ps-delivered', label: 'Delivered', color: 'bg-green-100 text-green-800', order: 4, isDefault: false, triggersRevenue: true, isTerminal: true },
            { id: 'ps-returned', label: 'Returned', color: 'bg-orange-100 text-orange-800', order: 5, isDefault: false, triggersRevenue: false, isTerminal: true },
            { id: 'ps-cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800', order: 6, isDefault: false, triggersRevenue: false, isTerminal: true },
        ];
        for (const s of defaults) await this.saveParcelStatus(s);
    }

    // --- NEW: Driver Commission Rules ---
    async getDriverCommissionRules() { return this.getCollection<DriverCommissionRule>('driver_commissions'); }
    async saveDriverCommissionRule(rule: DriverCommissionRule) { await this.saveDocument('driver_commissions', rule); }
    async deleteDriverCommissionRule(id: string) { await this.deleteDocument('driver_commissions', id); }

    // --- NEW: Customer Special Rates ---
    async getCustomerSpecialRates(customerId: string): Promise<CustomerSpecialRate[]> {
        const q = query(collection(this.db, 'customer_rates'), where('customerId', '==', customerId));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as CustomerSpecialRate);
    }
    async saveCustomerSpecialRate(rate: CustomerSpecialRate) { await this.saveDocument('customer_rates', rate); }
    async deleteCustomerSpecialRate(id: string) { await this.deleteDocument('customer_rates', id); }

    // --- Referral Rules ---
    async getReferralRules() { return this.getCollection<ReferralRule>('referral_rules'); }
    async saveReferralRule(rule: ReferralRule) { await this.saveDocument('referral_rules', rule); }
    async deleteReferralRule(id: string) { await this.deleteDocument('referral_rules', id); }

    // Ops (Admin/General)
    async getParcelBookings() { return this.getCollection<ParcelBooking>('parcel_bookings'); }

    // --- Ops (Secure Fetch for Wallet/Profile) ---
    async getUserBookings(user: UserProfile): Promise<ParcelBooking[]> {
        try {
            if (user.role === 'driver') {
                // Fetch jobs assigned to this driver
                const q = query(collection(this.db, 'parcel_bookings'), where('driverId', '==', user.uid));
                const snap = await getDocs(q);
                return snap.docs.map(d => d.data() as ParcelBooking);
            } else if (user.role === 'customer') {
                let q;
                if (user.linkedCustomerId) {
                    q = query(collection(this.db, 'parcel_bookings'), where('senderId', '==', user.linkedCustomerId));
                } else {
                    q = query(collection(this.db, 'parcel_bookings'), where('senderName', '==', user.name));
                }
                const snap = await getDocs(q);
                return snap.docs.map(d => d.data() as ParcelBooking);
            } else if (['system-admin', 'accountant', 'finance-manager', 'warehouse'].includes(user.role)) {
                // Internal staff can likely read all, but generally wallet view is personal.
                // If an admin views their own wallet, they might not have bookings.
                // We return empty for now unless they are also active as a driver/customer.
                return [];
            }
            return [];
        } catch (e) {
            console.error("Error fetching user bookings", e);
            return [];
        }
    }

    // --- Ops (Driver Specific) ---
    async getDriverJobs(driverId: string): Promise<ParcelBooking[]> {
        // Driver needs:
        // 1. Jobs assigned to them (driverId == uid)
        // 2. Available jobs (status == 'PENDING' AND driverId == null/undefined)

        try {
            // Query 1: Assigned to me
            const q1 = query(collection(this.db, 'parcel_bookings'), where('driverId', '==', driverId));
            const snap1 = await getDocs(q1);

            // Query 2: Pending jobs (Available for pickup)
            const q2 = query(collection(this.db, 'parcel_bookings'), where('status', '==', 'PENDING'));
            const snap2 = await getDocs(q2);

            const bookingsMap = new Map<string, ParcelBooking>();

            snap1.docs.forEach(d => bookingsMap.set(d.id, d.data() as ParcelBooking));
            snap2.docs.forEach(d => bookingsMap.set(d.id, d.data() as ParcelBooking));

            return Array.from(bookingsMap.values());
        } catch (e) {
            console.error("Error fetching driver jobs", e);
            return [];
        }
    }

    // Updated to accept wallet service for referral triggering
    async saveParcelBooking(b: ParcelBooking, paymentAccountId?: string, walletService?: any, configService?: any) {
        const bookingToSave = this.cleanData(b);

        if (bookingToSave.items && bookingToSave.items.length > 0) {
            const updatedItems = await Promise.all(bookingToSave.items.map(async (item: any) => {
                const updates: any = {};
                if (item.image?.startsWith('data:')) updates.image = await this.uploadAttachment(item.image);
                if (item.proofOfDelivery?.startsWith('data:')) updates.proofOfDelivery = await this.uploadAttachment(item.proofOfDelivery);
                return { ...item, ...updates };
            }));
            bookingToSave.items = updatedItems;
        }

        // --- REFERRAL ENGINE TRIGGER ---
        const isComplete = bookingToSave.status === 'COMPLETED' || bookingToSave.items.every((i: any) => i.status === 'DELIVERED');

        if (isComplete && !bookingToSave.referralProcessed && walletService && configService && bookingToSave.senderId) {
            try {
                const userUid = await configService.getUserUidByCustomerId(bookingToSave.senderId);
                if (userUid) {
                    // 1. Increment Order Count atomically
                    await updateDoc(doc(this.db, 'users', userUid), {
                        completedOrderCount: increment(1)
                    });

                    // 2. Fetch Fresh User Data
                    const userSnap = await getDoc(doc(this.db, 'users', userUid));
                    if (userSnap.exists()) {
                        const userData = userSnap.data() as UserProfile;

                        // Only process if they were referred
                        if (userData.referredBy) {
                            // Use completedOrderCount from snapshot or update logic
                            const reliableCount = userData.completedOrderCount || 1;
                            const joinedAt = userData.joinedAt || userData.createdAt || 0;

                            // 3. Fetch Active Rules
                            const rulesSnap = await getDocs(query(collection(this.db, 'referral_rules'), where('isActive', '==', true)));
                            const rules = rulesSnap.docs.map(d => d.data() as ReferralRule);

                            // 4. Evaluate Rules
                            for (const rule of rules) {
                                let isMatch = false;

                                // Check Time Limit
                                if (rule.expiryDays && rule.expiryDays > 0) {
                                    const daysSinceJoin = (Date.now() - joinedAt) / (1000 * 60 * 60 * 24);
                                    if (daysSinceJoin > rule.expiryDays) continue; // Expired
                                }

                                // Check Trigger
                                if (rule.trigger === 'FIRST_ORDER' && reliableCount === 1) {
                                    isMatch = true;
                                } else if (rule.trigger === 'ORDER_MILESTONE' && rule.milestoneCount && reliableCount === rule.milestoneCount) {
                                    isMatch = true;
                                }

                                if (isMatch) {
                                    console.log(`Executing Referral Rule: ${rule.name} for user ${userUid}`);
                                    await walletService.executeReferralRule(userUid, userData.referredBy, rule);
                                }
                            }
                        }
                    }
                }

                // Mark as processed to avoid re-running logic on next save
                bookingToSave.referralProcessed = true;

            } catch (e: any) {
                // Log warning but do not stop execution. 
                // This often happens if the current user (e.g. Driver) lacks permission to update User Stats.
                console.warn("Referral trigger skipped due to error/permission:", e.message);
            }
        }

        await this.saveDocument('parcel_bookings', bookingToSave);
    }

    async updateParcelStatus(id: string, statusId: string, userId: string, userName: string) {
        await updateDoc(doc(this.db, 'parcel_bookings', id), { statusId, status: 'UPDATED' });
    }

    async receiveItemAtWarehouse(bookingId: string, itemId: string, userName: string) {
        const ref = doc(this.db, 'parcel_bookings', bookingId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const booking = snap.data() as ParcelBooking;
            if (!booking.items) return;
            const updatedItems = booking.items.map((item: any) => {
                if (item.id === itemId) {
                    return {
                        ...item,
                        status: 'AT_WAREHOUSE',
                        driverId: undefined, driverName: undefined,
                        modifications: [...(item.modifications || []), { timestamp: Date.now(), userId: 'warehouse', userName, field: 'Status', oldValue: item.status, newValue: 'AT_WAREHOUSE' }]
                    };
                }
                return item;
            });
            const cleanedItems = this.cleanData(updatedItems);
            await updateDoc(ref, { items: cleanedItems });
        }
    }

    async updateParcelItemStatus(bookingId: string, itemId: string, status: string) {
        const ref = doc(this.db, 'parcel_bookings', bookingId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const booking = snap.data() as ParcelBooking;
            const updatedItems = booking.items.map((item: any) => {
                if (item.id === itemId) {
                    return { ...item, status };
                }
                return item;
            });
            await updateDoc(ref, { items: updatedItems });
        }
    }

    async updateParcelItemCOD(bookingId: string, itemId: string, amount: number, currency: 'USD' | 'KHR') {
        const ref = doc(this.db, 'parcel_bookings', bookingId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const booking = snap.data() as ParcelBooking;
            const updatedItems = booking.items.map((item: any) => {
                if (item.id === itemId) {
                    return { ...item, productPrice: amount, codCurrency: currency };
                }
                return item;
            });
            await updateDoc(ref, { items: updatedItems });
        }
    }

    subscribeToParcelBookings(callback: (bookings: ParcelBooking[]) => void) {
        const q = query(collection(this.db, 'parcel_bookings'));
        return onSnapshot(q, (snapshot) => {
            const bookings = snapshot.docs.map(doc => doc.data() as ParcelBooking);
            callback(bookings);
        });
    }

    // --- NEW: Customer Specific Subscription (Secure) ---
    subscribeToCustomerBookings(userId: string, linkedCustomerId: string | undefined, name: string, callback: (bookings: ParcelBooking[]) => void) {
        let q;
        // If linked to a CRM customer ID, use that (more reliable). Otherwise fallback to name.
        if (linkedCustomerId) {
            q = query(collection(this.db, 'parcel_bookings'), where('senderId', '==', linkedCustomerId));
        } else {
            q = query(collection(this.db, 'parcel_bookings'), where('senderName', '==', name));
        }

        return onSnapshot(q, (snapshot) => {
            const bookings = snapshot.docs.map(doc => doc.data() as ParcelBooking);
            callback(bookings);
        }, (error) => console.error("Customer Subscription Error:", error));
    }

    async sendChatMessage(msg: ChatMessage) {
        await this.saveDocument('chat_messages', msg);
    }

    subscribeToChat(itemId: string, callback: (messages: ChatMessage[]) => void) {
        const q = query(collection(this.db, 'chat_messages'), where('itemId', '==', itemId));
        return onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map(doc => doc.data() as ChatMessage);
            messages.sort((a, b) => a.timestamp - b.timestamp);
            callback(messages);
        });
    }

    async settleParcelItems(items: { bookingId: string, itemId: string }[]) {
        const bookingUpdates: Record<string, string[]> = {};
        items.forEach(i => {
            if (!bookingUpdates[i.bookingId]) bookingUpdates[i.bookingId] = [];
            bookingUpdates[i.bookingId].push(i.itemId);
        });

        for (const [bookingId, itemIds] of Object.entries(bookingUpdates)) {
            const ref = doc(this.db, 'parcel_bookings', bookingId);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const booking = snap.data() as ParcelBooking;
                const updatedItems = booking.items.map(i => {
                    if (itemIds.includes(i.id)) {
                        return { ...i, settlementStatus: 'SETTLED' };
                    }
                    return i;
                });
                await updateDoc(ref, { items: updatedItems });
            }
        }
    }
}
