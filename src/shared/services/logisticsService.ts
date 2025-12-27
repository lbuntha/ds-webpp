
import { BaseService } from './baseService';
import { ParcelServiceType, ParcelPromotion, ParcelStatusConfig, ParcelBooking, ChatMessage, JournalEntry, SystemSettings, DriverCommissionRule, CustomerSpecialRate, UserProfile, ReferralRule, ParcelItem, Employee } from '../types';
import { doc, updateDoc, onSnapshot, collection, query, where, getDoc, getDocs, increment, or } from 'firebase/firestore';
import { db, storage } from './firebaseInstance';
import { calculateDriverCommission } from '../utils/commissionCalculator';

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
            { id: 'ps-out-for-delivery', label: 'Out for Delivery', color: 'bg-purple-100 text-purple-800', order: 3.5, isDefault: false, triggersRevenue: false, isTerminal: false },
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
                // Fetch jobs where this driver is involved (booking-level or item-level)
                // Query 1: driverId matches
                const q1 = query(collection(this.db, 'parcel_bookings'), where('driverId', '==', user.uid));
                // Query 2: involvedDriverIds contains this driver (for item-level assignments)
                const q2 = query(collection(this.db, 'parcel_bookings'), where('involvedDriverIds', 'array-contains', user.uid));

                const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

                // Merge and deduplicate
                const bookingsMap = new Map<string, ParcelBooking>();
                snap1.docs.forEach(d => bookingsMap.set(d.id, d.data() as ParcelBooking));
                snap2.docs.forEach(d => bookingsMap.set(d.id, d.data() as ParcelBooking));

                return Array.from(bookingsMap.values());
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
        // 3. In-progress jobs where they are assigned at item level

        try {
            // Query 1: Involved in this booking (index)
            const q1 = query(collection(this.db, 'parcel_bookings'), where('involvedDriverIds', 'array-contains', driverId));
            const snap1 = await getDocs(q1);

            // Query 2: Assigned directly at booking level (fallback for old records)
            const q2a = query(collection(this.db, 'parcel_bookings'), where('driverId', '==', driverId));
            const snap2a = await getDocs(q2a);

            // Query 3: Pending jobs (Available for pickup)
            const q3 = query(collection(this.db, 'parcel_bookings'), where('status', '==', 'PENDING'));
            const snap3 = await getDocs(q3);

            // Query 4: In-progress bookings (CONFIRMED/IN_TRANSIT) - fallback for item-level assignments
            const q4 = query(collection(this.db, 'parcel_bookings'), where('status', 'in', ['CONFIRMED', 'IN_TRANSIT']));
            const snap4 = await getDocs(q4);

            const bookingsMap = new Map<string, ParcelBooking>();

            snap1.docs.forEach(d => bookingsMap.set(d.id, d.data() as ParcelBooking));
            snap2a.docs.forEach(d => bookingsMap.set(d.id, d.data() as ParcelBooking));
            snap3.docs.forEach(d => bookingsMap.set(d.id, d.data() as ParcelBooking));

            // For Query 4, only add if driver is actually involved at item level
            snap4.docs.forEach(d => {
                const booking = d.data() as ParcelBooking;
                const isInvolved = (booking.items || []).some(i =>
                    i.driverId === driverId || i.collectorId === driverId || i.delivererId === driverId
                );
                if (isInvolved) bookingsMap.set(d.id, booking);
            });

            return Array.from(bookingsMap.values());
        } catch (e) {
            console.error("Error fetching driver jobs", e);
            return [];
        }
    }


    // Updated to accept wallet service for referral triggering
    async saveParcelBooking(b: ParcelBooking, paymentAccountId?: string, walletService?: any, configService?: any, hrService?: any) {
        const bookingToSave = this.cleanData(b);

        // --- ITEM-LEVEL COMMISSION TRIGGER ---
        if (walletService && hrService && bookingToSave.id && bookingToSave.items) {
            try {
                const oldBookingSnap = await getDoc(doc(this.db, 'parcel_bookings', bookingToSave.id));
                const oldBooking = oldBookingSnap.exists() ? oldBookingSnap.data() as ParcelBooking : null;

                const commissionRules = await this.getDriverCommissionRules();
                const employees = await hrService.getEmployees();

                // Fetch exchange rate from currencies collection (KHR rate)
                let commissionExchangeRate = 4000; // Default fallback
                try {
                    const currencies = await configService.getCurrencies();
                    const khrCurrency = currencies.find((c: any) => c.code === 'KHR');
                    if (khrCurrency?.rate) {
                        commissionExchangeRate = khrCurrency.rate;
                    }
                } catch (e) {
                    console.warn("Failed to fetch currencies for exchange rate, using default:", e);
                }

                for (const item of bookingToSave.items) {
                    const oldItem = oldBooking?.items?.find((i: ParcelItem) => i.id === item.id);
                    // Use per-item fee if available, fallback to booking-level for legacy
                    const itemFeeShare = item.deliveryFee ?? ((bookingToSave.totalDeliveryFee || 0) / (bookingToSave.items.length || 1));

                    // COMMISSIONS ONLY TRIGGER ON DELIVERED STATUS
                    // Both pickup and delivery commissions are calculated when the item is delivered
                    const isNowDelivered = item.status === 'DELIVERED';
                    const wasNotDelivered = !oldItem || oldItem.status !== 'DELIVERED';

                    // Commission currency follows the item's COD currency
                    const commissionCurrency = item.codCurrency || bookingToSave.currency || 'USD';
                    // The fee is already in the item's currency (per-item fee), so no conversion needed for percentage rules
                    const feeCurrency = item.deliveryFee !== undefined ? (item.codCurrency || 'USD') : (bookingToSave.currency || 'USD');

                    // Helper function to convert commission to target currency (only needed for FIXED_AMOUNT rules in different currency)
                    // For percentage rules, commission is already in the same currency as the fee
                    const convertCommission = (amount: number, isPercentageRule: boolean = true): number => {
                        // For percentage rules, the commission is calculated from the fee which is already in the correct currency
                        if (isPercentageRule && feeCurrency === commissionCurrency) return amount;

                        // For fixed amount rules, may need conversion
                        if (feeCurrency === commissionCurrency) return amount;
                        if (feeCurrency === 'USD' && commissionCurrency === 'KHR') {
                            return Math.round(amount * commissionExchangeRate);
                        }
                        if (feeCurrency === 'KHR' && commissionCurrency === 'USD') {
                            return Math.round((amount / commissionExchangeRate) * 100) / 100;
                        }
                        return amount;
                    };


                    if (isNowDelivered && wasNotDelivered) {
                        // 1. Pickup Commission (to collector who picked up)
                        if (item.collectorId && !item.pickupCommission) {
                            const collector = employees.find((e: any) => e.linkedUserId === item.collectorId);
                            // Pass commissionCurrency and exchangeRate for correct FIXED_AMOUNT conversion
                            let commission = calculateDriverCommission(collector, bookingToSave, 'PICKUP', commissionRules, itemFeeShare, commissionCurrency, commissionExchangeRate);
                            // No additional conversion needed - commission is now in the correct currency
                            if (commission > 0) {
                                item.pickupCommission = commission;
                                item.pickupCommissionCurrency = commissionCurrency;
                                await walletService.processWalletTransaction(
                                    item.collectorId, commission, commissionCurrency, 'EARNING', '',
                                    `Pickup: ${item.receiverName} (${bookingToSave.id.slice(-4)})`,
                                    [{ bookingId: bookingToSave.id, itemId: item.id }]
                                );
                            }
                        }

                        // 2. Delivery Commission (to deliverer who delivered)
                        if (item.delivererId && !item.deliveryCommission) {
                            const deliverer = employees.find((e: any) => e.linkedUserId === item.delivererId);
                            // Pass commissionCurrency and exchangeRate for correct FIXED_AMOUNT conversion
                            let commission = calculateDriverCommission(deliverer, bookingToSave, 'DELIVERY', commissionRules, itemFeeShare, commissionCurrency, commissionExchangeRate);
                            if (commission > 0) {
                                item.deliveryCommission = commission;
                                item.deliveryCommissionCurrency = commissionCurrency;
                                await walletService.processWalletTransaction(
                                    item.delivererId, commission, commissionCurrency, 'EARNING', '',
                                    `Delivery: ${item.receiverName} (${bookingToSave.id.slice(-4)})`,
                                    [{ bookingId: bookingToSave.id, itemId: item.id }]
                                );
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn("Commission trigger failed:", e);
            }
        }

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

        // --- POPULATE INVOLVED DRIVERS INDEX ---
        const driverIds = new Set<string>();

        // Helper to add IDs and their linked User IDs
        const addDriverId = (id: string | undefined, allEmployees: Employee[]) => {
            if (!id) return;
            driverIds.add(id);
            // Also add the linked user ID if this is an employee ID
            const emp = allEmployees.find(e => e.id === id || e.linkedUserId === id);
            if (emp?.linkedUserId) driverIds.add(emp.linkedUserId);
            if (emp?.id) driverIds.add(emp.id);
        };

        try {
            const allEmployees = hrService ? await hrService.getEmployees() : await this.getCollection<Employee>('employees');

            if (bookingToSave.driverId) addDriverId(bookingToSave.driverId, allEmployees);
            if (bookingToSave.items) {
                bookingToSave.items.forEach((item: ParcelItem) => {
                    addDriverId(item.driverId, allEmployees);
                    addDriverId(item.collectorId, allEmployees);
                    addDriverId(item.delivererId, allEmployees);
                });
            }
            bookingToSave.involvedDriverIds = Array.from(driverIds);
        } catch (e) {
            console.warn("Failed to update involvement index:", e);
            // Fallback to basic IDs if employee fetch fails
            if (bookingToSave.driverId) driverIds.add(bookingToSave.driverId);
            if (bookingToSave.items) {
                bookingToSave.items.forEach((item: ParcelItem) => {
                    if (item.driverId) driverIds.add(item.driverId);
                    if (item.collectorId) driverIds.add(item.collectorId);
                    if (item.delivererId) driverIds.add(item.delivererId);
                });
            }
            bookingToSave.involvedDriverIds = Array.from(driverIds);
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

    async settleParcelItems(
        items: { bookingId: string, itemId: string }[],
        settlementType: 'driver' | 'customer' = 'customer',
        currency?: 'USD' | 'KHR',
        transactionId?: string
    ) {
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
                        // Use different fields for driver vs customer settlement
                        if (settlementType === 'driver') {
                            return {
                                ...i,
                                driverSettlementStatus: 'SETTLED',
                                driverSettledCurrency: currency || i.codCurrency || 'USD',
                                driverSettlementTxnId: transactionId
                            };
                        } else {
                            return {
                                ...i,
                                customerSettlementStatus: 'SETTLED',
                                customerSettledCurrency: currency || i.codCurrency || 'USD',
                                customerSettlementTxnId: transactionId
                            };
                        }
                    }
                    return i;
                });
                await updateDoc(ref, { items: updatedItems });
            }
        }
    }
}

export const logisticsService = new LogisticsService(db, storage);
