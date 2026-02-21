
import { BaseService } from './baseService';
import { WalletTransaction, ReferralRule } from '../types';
import { query, collection, where, getDocs, updateDoc, doc, getDoc, setDoc, increment, onSnapshot } from 'firebase/firestore';

export class WalletService extends BaseService {
    async getWalletTransactions(uid: string): Promise<WalletTransaction[]> {
        const q = query(collection(this.db, 'wallet_transactions'), where('userId', '==', uid));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as WalletTransaction);
    }

    subscribeToWalletTransactions(uid: string, cb: (transactions: WalletTransaction[]) => void) {
        const q = query(collection(this.db, 'wallet_transactions'), where('userId', '==', uid));
        return onSnapshot(q, (snap) => {
            cb(snap.docs.map(d => d.data() as WalletTransaction));
        });
    }

    // Admin: Get all transactions for reporting
    async getAllWalletTransactions(): Promise<WalletTransaction[]> {
        const snap = await getDocs(collection(this.db, 'wallet_transactions'));
        return snap.docs.map(d => d.data() as WalletTransaction);
    }

    async requestWalletTopUp(uid: string, amount: number, currency: string, bankId: string, attachment: string, desc: string) {
        if (attachment && attachment.startsWith('data:')) attachment = await this.uploadAttachment(attachment);
        const txn: WalletTransaction = {
            id: `wtxn-${Date.now()}`,
            userId: uid,
            amount,
            currency: currency as any,
            type: 'DEPOSIT',
            status: 'PENDING',
            date: new Date().toISOString().split('T')[0],
            description: desc,
            bankAccountId: bankId,
            attachment
        };
        await this.saveDocument('wallet_transactions', txn);
    }

    async requestWithdrawal(uid: string, userName: string, amount: number, currency: string, bankId: string, desc: string, items?: { bookingId: string, itemId: string }[]) {
        const txn: WalletTransaction = {
            id: `wtxn-wd-${Date.now()}`,
            userId: uid,
            userName,
            amount,
            currency: currency as any,
            type: 'WITHDRAWAL',
            status: 'PENDING', // Requires Finance Approval
            date: new Date().toISOString().split('T')[0],
            description: desc,
            bankAccountId: bankId,
            relatedItems: items
        };
        await this.saveDocument('wallet_transactions', txn);
    }

    async requestSettlement(uid: string, userName: string, amount: number, currency: string, bankId: string, attachment: string, desc: string, items?: { bookingId: string, itemId: string }[], excludeFees?: boolean) {
        if (attachment && attachment.startsWith('data:')) attachment = await this.uploadAttachment(attachment);
        const txn: WalletTransaction = {
            id: `wtxn-stl-${Date.now()}`,
            userId: uid,
            userName,
            amount,
            currency: currency as any,
            type: 'SETTLEMENT',
            status: 'PENDING',
            date: new Date().toISOString().split('T')[0],
            description: desc,
            bankAccountId: bankId,
            attachment,
            relatedItems: items,
            excludeFees: excludeFees || false
        };
        await this.saveDocument('wallet_transactions', txn);
    }

    async processWalletTransaction(uid: string, amount: number, currency: string, type: string, bankId: string, desc: string, relatedItems?: { bookingId: string, itemId: string }[]) {
        const txn: WalletTransaction = {
            id: `wtxn-${Date.now()}`,
            userId: uid,
            amount,
            currency: currency as any,
            type: type as any,
            status: 'APPROVED',
            date: new Date().toISOString().split('T')[0],
            description: desc,
            bankAccountId: bankId,
            relatedItems
        };
        await this.saveDocument('wallet_transactions', txn);
    }

    async getPendingWalletTransactions(): Promise<WalletTransaction[]> {
        const q = query(collection(this.db, 'wallet_transactions'), where('status', '==', 'PENDING'));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as WalletTransaction);
    }

    async approveWalletTransaction(id: string, approverId: string, journalEntryId?: string, approvalNote?: string) {
        // Fetch the transaction first to check for excludeFees
        const txnDoc = await getDoc(doc(this.db, 'wallet_transactions', id));
        if (!txnDoc.exists()) return;
        const txn = txnDoc.data() as WalletTransaction;

        const updates: any = { status: 'APPROVED' };
        if (journalEntryId) updates.journalEntryId = journalEntryId;
        if (approvalNote) updates.approvalNote = approvalNote;
        await updateDoc(doc(this.db, 'wallet_transactions', id), updates);

        console.log(`[DEBUG] approveWalletTransaction: ID=${id}, Type=${txn.type}, excludeFees=${txn.excludeFees}, relatedItems:`, txn.relatedItems);

        // --- NEW: FeeReceivable Logic ---
        // If this is a SETTLEMENT and we EXCLUDED fees (Pay Gross), we must explicitly track the owed fees.
        if (txn.type === 'SETTLEMENT' && txn.excludeFees && txn.relatedItems && txn.relatedItems.length > 0) {
            console.log(`[DEBUG] approveWalletTransaction: Entering FeeReceivable creation block for ${txn.relatedItems.length} items`);

            // Group the related items by bookingId to minimize Firestore fetches
            const itemsByBooking: { [bookingId: string]: string[] } = {};
            txn.relatedItems.forEach(item => {
                if (!itemsByBooking[item.bookingId]) itemsByBooking[item.bookingId] = [];
                itemsByBooking[item.bookingId].push(item.itemId);
            });

            // Fetch bookings and create FeeReceivable objects
            for (const bookingId of Object.keys(itemsByBooking)) {
                console.log(`[DEBUG] fetching booking: ${bookingId}`);
                const bookingDoc = await getDoc(doc(this.db, 'parcel_bookings', bookingId));
                if (bookingDoc.exists()) {
                    const bookingData = bookingDoc.data();
                    const targetItemIds = itemsByBooking[bookingId];

                    // Find the specific items in the booking
                    const items = bookingData.items || [];
                    for (const item of items) {
                        if (targetItemIds.includes(item.id)) {
                            // Extract the fee
                            const feeUSD = Number(item.deliveryFeeUSD) || 0;
                            const feeKHR = Number(item.deliveryFeeKHR) || 0;
                            // Default to USD if both are 0 but legacy deliveryFee exists
                            const legacyFee = Number(item.deliveryFee) || 0;

                            // Fallback to booking level totalDeliveryFee if item level is not set (useful for single-item bookings)
                            const bookingLevelFee = Number(bookingData.totalDeliveryFee) || 0;

                            // Start with the COD Currency as the target currency for the fee
                            let currency: 'USD' | 'KHR' = item.codCurrency || bookingData.currency || 'USD';
                            let amount = 0;

                            if (currency === 'USD') {
                                amount = feeUSD || legacyFee || (items.length === 1 ? bookingLevelFee : 0);
                                if (amount === 0 && feeKHR > 0) {
                                    // Extreme fallback: they assigned a KHR fee but COD is USD. 
                                    amount = feeKHR;
                                    currency = 'KHR';
                                }
                            } else {
                                amount = feeKHR || legacyFee || (items.length === 1 ? bookingLevelFee : 0);
                                if (amount === 0 && feeUSD > 0) {
                                    // Extreme fallback: they assigned a USD fee but COD is KHR.
                                    amount = feeUSD;
                                    currency = 'USD';
                                }
                            }

                            console.log(`[DEBUG] Extracted Fee amounts for item ${item.id}: USD=${feeUSD}, KHR=${feeKHR}, Legacy=${legacyFee}, BookingLevel=${bookingLevelFee}. Will use amount=${amount}`);

                            // Create the FeeReceivable record if there's a fee
                            if (amount > 0) {
                                const feeRecId = `fee-rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                                console.log(`[DEBUG] Creating FeeReceivable: ${feeRecId} for ${amount} ${currency}`);
                                const feeReceivable: any = { // Using any to avoid importing the type here, since this is a service
                                    id: feeRecId,
                                    customerId: bookingData.customerId || bookingData.senderId, // Fallback to senderId
                                    customerName: bookingData.customerName || bookingData.senderName, // Fallback to senderName
                                    userId: txn.userId, // The wallet user who got paid gross
                                    bookingId: bookingId,
                                    itemId: item.id,
                                    totalAmount: amount,
                                    paidAmount: 0,
                                    currency: currency,
                                    status: 'UNPAID',
                                    sourceSettlementTxnId: id,
                                    createdAt: Date.now()
                                };
                                await setDoc(doc(this.db, 'fee_receivables', feeRecId), feeReceivable);
                            }
                        }
                    }
                } else {
                    console.log(`[DEBUG] Booking ${bookingId} does NOT exist!`);
                }
            }
        }
    }

    // Mark TAXI_FEE wallet transactions as settled (to exclude from balance)
    async markTaxiFeeTransactionsAsSettled(items: { bookingId: string, itemId: string }[], userId?: string) {
        // Find TAXI_FEE transactions that reference these items and mark them as settled
        const q = query(collection(this.db, 'wallet_transactions'), where('type', '==', 'TAXI_FEE'));
        const snap = await getDocs(q);

        const itemKeys = new Set(items.map(i => `${i.bookingId}|${i.itemId}`));

        for (const txnDoc of snap.docs) {
            const txn = txnDoc.data() as WalletTransaction;

            // Skip if already settled
            if (txn.taxiFeeSettled) continue;

            let shouldMark = false;

            // Method 1: Match by relatedItems (for new transactions)
            if (txn.relatedItems && txn.relatedItems.length > 0) {
                shouldMark = txn.relatedItems.some(ri =>
                    itemKeys.has(`${ri.bookingId}|${ri.itemId}`)
                );
            }

            // Method 2: Fallback - Match by userId (for old transactions without relatedItems)
            if (!shouldMark && userId && txn.userId === userId && (!txn.relatedItems || txn.relatedItems.length === 0)) {
                shouldMark = true;
            }

            if (shouldMark) {
                await updateDoc(doc(this.db, 'wallet_transactions', txnDoc.id), {
                    taxiFeeSettled: true
                });
            }
        }
    }

    async rejectWalletTransaction(id: string, reason: string) { await updateDoc(doc(this.db, 'wallet_transactions', id), { status: 'REJECTED', rejectionReason: reason }); }

    // --- Referral Logic ---
    async processReferralReward(refereeUid: string, referrerCode: string) {
        // Deprecated, kept for fallback
    }

    async executeReferralRule(refereeUid: string, referrerCode: string, rule: ReferralRule) {
        const q = query(collection(this.db, 'users'), where('referralCode', '==', referrerCode));
        const snap = await getDocs(q);
        if (snap.empty) return;

        const referrerUser = snap.docs[0].data();
        const referrerUid = referrerUser.uid;
        if (referrerUid === refereeUid) return;

        const today = new Date().toISOString().split('T')[0];

        // 1. Reward Referrer
        if (rule.referrerAmount > 0) {
            const txn: WalletTransaction = {
                id: `wtxn-ref-out-${Date.now()}`,
                userId: referrerUid,
                userName: referrerUser.name,
                amount: rule.referrerAmount,
                currency: rule.referrerCurrency,
                type: 'EARNING',
                status: 'APPROVED',
                date: today,
                description: `Referral Reward: ${rule.name}`,
                bankAccountId: ''
            };
            await this.saveDocument('wallet_transactions', txn);

            await updateDoc(doc(this.db, 'users', referrerUid), {
                'referralStats.count': increment(1),
                'referralStats.earnings': increment(rule.referrerAmount)
            });
        }

        // 2. Reward Referee (Cashback)
        if (rule.refereeAmount > 0) {
            const txnReferee: WalletTransaction = {
                id: `wtxn-ref-in-${Date.now()}`,
                userId: refereeUid,
                userName: 'Referee',
                amount: rule.refereeAmount,
                currency: rule.refereeCurrency,
                type: 'EARNING',
                status: 'APPROVED',
                date: today,
                description: `Welcome Bonus: ${rule.name}`,
                bankAccountId: ''
            };
            await this.saveDocument('wallet_transactions', txnReferee);
        }
    }
}
