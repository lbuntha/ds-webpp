import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { sendError, sendSuccess } from '../utils/response';
import { ERROR_CODES } from '../config/constants';
import { db } from '../config/firebase';


// --- Types ---
interface LedgerItem {
    id: string;
    date: string;
    timestamp?: number;
    description: string;
    type: 'FEE' | 'COD' | 'DEPOSIT' | 'WITHDRAWAL' | 'SETTLEMENT' | 'EARNING' | 'REFUND' | 'TAXI_FEE';
    amount: number;
    currency: string;
    status: string;
    reference?: string;
    isCredit: boolean;
}

// --- Helper Functions ---
const round2 = (val: number) => Math.round((val + Number.EPSILON) * 100) / 100;


// --- Controller ---

export const getWalletLedger = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = req.user!;
        const daysBack = req.query.days ? parseInt(req.query.days as string) : 90;
        const targetCurrency = (req.query.currency as string) || 'USD';

        // 1. Calculate Date Cutoff
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        const cutoffTimestamp = cutoffDate.getTime();

        // 2. Parallel Fetches
        const promises: any[] = [
            // a. Transactions
            db.collection('wallet_transactions')
                .where('userId', '==', user.uid)
                .orderBy('date', 'desc')
                .limit(500) // Safety limit
                .get(),

            // b. User Details (for linkedCustomerId)
            db.collection('users').doc(user.uid).get()
        ];

        const [txnsSnap, userSnap] = await Promise.all(promises);

        const userData = userSnap.data();
        const linkedCustomerId = userData?.linkedCustomerId;
        const userName = userData?.name;

        // 3. Fetch Bookings (Optimized queries)
        let bookings: any[] = [];

        if (user.role === 'driver') {
            const q1 = db.collection('parcel_bookings')
                .where('driverId', '==', user.uid)
                .where('createdAt', '>=', cutoffTimestamp);
            const q2 = db.collection('parcel_bookings')
                .where('involvedDriverIds', 'array-contains', user.uid)
                .where('createdAt', '>=', cutoffTimestamp);

            const [bSnap1, bSnap2] = await Promise.all([q1.get(), q2.get()]);
            const bookingMap = new Map();
            bSnap1.docs.forEach(d => bookingMap.set(d.id, { id: d.id, ...d.data() }));
            bSnap2.docs.forEach(d => bookingMap.set(d.id, { id: d.id, ...d.data() }));
            bookings = Array.from(bookingMap.values());

        } else if (user.role === 'customer') {
            let q;
            if (linkedCustomerId) {
                q = db.collection('parcel_bookings').where('senderId', '==', linkedCustomerId); // Ideally add date index, but reusing existing logic
            } else {
                q = db.collection('parcel_bookings').where('senderName', '==', userName);
            }
            const bSnap = await q.get();
            // Client-side date filter (as per recent optimization)
            bookings = bSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter((b: any) => (b.createdAt || 0) >= cutoffTimestamp);
        }

        // 4. Process Logic
        const ledger: LedgerItem[] = [];
        const transactions = txnsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

        // A. Transactions
        transactions.forEach((t: any) => {
            let isCredit = false;
            if (['DEPOSIT', 'EARNING', 'REFUND', 'TAXI_FEE'].includes(t.type)) isCredit = true;
            if (t.type === 'SETTLEMENT') {
                const isDriver = user.role === 'driver' || user.role === 'warehouse';
                isCredit = isDriver;
            }

            ledger.push({
                id: t.id,
                date: t.date,
                timestamp: new Date(t.date).getTime(),
                description: t.description || t.type,
                type: t.type,
                amount: t.amount,
                currency: t.currency,
                status: t.status,
                reference: (t.id || '').slice(-6),
                isCredit
            });
        });

        // B. Booking Logic
        bookings.forEach((b: any) => {
            const bItems = b.items || [];
            const isSender = (linkedCustomerId && b.senderId === linkedCustomerId) || b.senderName === userName;
            const isDriver = b.driverId === user.uid ||
                (b.involvedDriverIds || []).includes(user.uid) ||
                bItems.some((i: any) => i.driverId === user.uid || i.collectorId === user.uid || i.delivererId === user.uid);

            // Customer Logic
            if (isSender) {
                // COD Collection
                bItems.forEach((item: any) => {
                    if (item.status === 'DELIVERED') {
                        ledger.push({
                            id: `cod-${item.id}`,
                            date: b.bookingDate,
                            timestamp: b.createdAt || new Date(b.bookingDate).getTime(),
                            description: `COD Collected: ${item.receiverName}`,
                            type: 'COD',
                            amount: item.productPrice || 0,
                            currency: item.codCurrency || 'USD',
                            status: 'COLLECTED',
                            reference: item.trackingCode || 'N/A',
                            isCredit: true
                        });
                    }
                });

                // Fees
                if (b.status !== 'CANCELLED') {
                    const itemsDelivered = bItems.filter((i: any) => i.status === 'DELIVERED').length;
                    if (itemsDelivered > 0 || b.status === 'COMPLETED' || b.status === 'CONFIRMED') {
                        let khrFeeTotal = 0;
                        let usdFeeTotal = 0;

                        bItems.forEach((item: any) => {
                            if (item.status === 'DELIVERED') {
                                const isKHR = item.codCurrency === 'KHR';
                                if (item.deliveryFeeUSD !== undefined || item.deliveryFeeKHR !== undefined) {
                                    if (isKHR) khrFeeTotal += item.deliveryFeeKHR || 0;
                                    else usdFeeTotal += item.deliveryFeeUSD || 0;
                                } else {
                                    const itemFee = Number(item.deliveryFee) || 0;
                                    if (isKHR) khrFeeTotal += itemFee;
                                    else usdFeeTotal += itemFee;
                                }
                            }
                        });

                        if (khrFeeTotal > 0) {
                            ledger.push({
                                id: `fee-${b.id}-khr`,
                                date: b.bookingDate,
                                timestamp: b.createdAt || new Date(b.bookingDate).getTime(),
                                description: `Service Fee (KHR): ${b.serviceTypeName}`,
                                type: 'FEE',
                                amount: khrFeeTotal,
                                currency: 'KHR',
                                status: 'APPLIED',
                                reference: (b.id || '').slice(-6),
                                isCredit: false
                            });
                        }
                        if (usdFeeTotal > 0) {
                            ledger.push({
                                id: `fee-${b.id}-usd`,
                                date: b.bookingDate,
                                timestamp: b.createdAt || new Date(b.bookingDate).getTime(),
                                description: `Service Fee (USD): ${b.serviceTypeName}`,
                                type: 'FEE',
                                amount: usdFeeTotal,
                                currency: 'USD',
                                status: 'APPLIED',
                                reference: (b.id || '').slice(-6),
                                isCredit: false
                            });
                        }
                    }
                }

                // Taxi Fee
                bItems.forEach((item: any) => {
                    if (item.isTaxiDelivery && item.taxiFee && item.taxiFee > 0) {
                        ledger.push({
                            id: `taxi-${item.id}`,
                            date: b.bookingDate,
                            timestamp: b.createdAt || new Date(b.bookingDate).getTime(),
                            description: `🚕 Taxi Fee: ${item.receiverName}`,
                            type: 'FEE',
                            amount: item.taxiFee,
                            currency: item.taxiFeeCurrency || 'USD',
                            status: 'APPLIED',
                            reference: item.trackingCode || 'N/A',
                            isCredit: false
                        });
                    }
                });
            }

            // Driver Logic
            if (isDriver) {
                bItems.forEach((item: any) => {
                    const isDeliveredByMe = item.delivererId === user.uid || (!item.delivererId && item.driverId === user.uid);

                    if (item.status === 'DELIVERED' && isDeliveredByMe) {
                        // COD Cash Held (Always show, even if zero)
                        ledger.push({
                            id: `held-${item.id}`,
                            date: b.bookingDate,
                            description: `Cash Collected: ${item.receiverName}`,
                            type: 'COD',
                            amount: item.productPrice || 0,
                            currency: item.codCurrency || 'USD',
                            status: item.settlementStatus || 'HELD',
                            reference: item.trackingCode || 'N/A',
                            isCredit: false // Debit
                        });

                        // Taxi Reimbursement
                        if (item.isTaxiDelivery && item.taxiFee && item.taxiFee > 0) {
                            ledger.push({
                                id: `taxi-reimburse-${item.id}`,
                                date: b.bookingDate,
                                timestamp: b.createdAt || new Date(b.bookingDate).getTime(),
                                description: `🚕 Taxi Reimbursement: ${item.receiverName}`,
                                type: 'TAXI_FEE',
                                amount: item.taxiFee,
                                currency: item.taxiFeeCurrency || 'USD',
                                status: 'EARNED',
                                reference: item.trackingCode || 'N/A',
                                isCredit: true
                            });
                        }
                    }
                });
            }
        });

        // 5. Calculate Balance
        let balanceUsd = 0;
        let balanceKhr = 0;
        const isDriverUser = user.role === 'driver' || user.role === 'warehouse';

        ledger.forEach(item => {
            const validStatus = ['APPROVED', 'APPLIED', 'COLLECTED', 'EARNED', 'HELD'].includes(item.status);
            if (!validStatus) return;

            if (isDriverUser && item.type === 'SETTLEMENT') return; // Settlement just clears debt

            const val = item.amount;
            if (item.currency === 'KHR') {
                if (item.isCredit) balanceKhr += val; else balanceKhr -= val;
            } else {
                if (item.isCredit) balanceUsd += val; else balanceUsd -= val;
            }
        });

        // 6. Sort and Return
        ledger.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        sendSuccess(res, 'Wallet Ledger fetched successfully', {
            balance: {
                usd: round2(balanceUsd),
                khr: Math.round(balanceKhr)
            },
            ledger: targetCurrency === 'ALL' ? ledger : ledger.filter(i => i.currency === targetCurrency),
            meta: {
                totalCount: ledger.length,
                daysBack
            }
        });

    } catch (error: any) {
        console.error('Get Wallet Ledger Error:', error);
        sendError(res, 'Failed to fetch wallet ledger', ERROR_CODES.INTERNAL_ERROR);
    }
};
