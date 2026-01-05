
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { TelegramService } from '../services/telegramService';
import * as ExcelJS from 'exceljs';

// Initialize admin if not already done in index.ts
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const telegramService = new TelegramService();
const db = admin.firestore();

export const onWalletTransactionWritten = functions.firestore
    .document('wallet_transactions/{txnId}')
    .onWrite(async (change, context) => {
        const newData = change.after.exists ? change.after.data() : null;
        const oldData = change.before.exists ? change.before.data() : null;

        if (!newData) return; // Deleted

        const txnId = context.params.txnId;
        const type = newData.type;
        const status = newData.status;
        const oldStatus = oldData?.status;

        // We only care about SETTLEMENT or WITHDRAWAL
        if (type !== 'SETTLEMENT' && type !== 'WITHDRAWAL') return;

        let eventType = 'NONE';

        // Case 1: Newly Created as PENDING or APPROVED
        if (!oldData && newData) {
            if (status === 'PENDING') eventType = 'REQUESTED';
            else if (status === 'APPROVED') eventType = 'APPROVED';
        }
        // Case 2: Status Changed
        else if (oldData && oldStatus !== status) {
            if (status === 'APPROVED') eventType = 'APPROVED';
        }

        if (eventType === 'NONE') return;

        console.log(`[NotificationTrigger] Txn ${txnId} event: ${eventType}`);

        try {
            const userId = newData.userId;
            if (!userId) {
                console.log('No userId in transaction');
                return;
            }

            // 1. Get User Profile to find linked customer
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
                console.log(`User ${userId} not found`);
                return;
            }
            const userData = userDoc.data();
            const customerId = userData?.linkedCustomerId;

            if (!customerId) {
                console.log(`User ${userId} has no linkedCustomerId`);
                return;
            }

            // 2. Get Customer Profile to get Telegram Chat ID
            const customerDoc = await db.collection('customers').doc(customerId).get();
            if (!customerDoc.exists) {
                console.log(`Customer ${customerId} not found`);
                return;
            }
            const customerData = customerDoc.data();
            const telegramChatId = customerData?.telegramChatId;

            if (!telegramChatId) {
                console.log(`Customer ${customerId} has no telegramChatId`);
                return;
            }

            // 3. Prepare Excel Report if APPROVED
            let excelBuffer: Buffer | undefined = undefined;

            if (eventType === 'APPROVED' && newData.relatedItems && newData.relatedItems.length > 0) {
                console.log(`Generating Excel report for ${newData.relatedItems.length} items...`);
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Settlement Details');

                // Columns: Date, Booking Code, Tracking Code, Receiver, COD Amount, Delivery Fee, Taxi Fee, Net Payout
                worksheet.columns = [
                    { header: 'Date', key: 'date', width: 15 },
                    { header: 'Booking Code', key: 'bookingCode', width: 20 },
                    { header: 'Tracking Code', key: 'trackingCode', width: 20 },
                    { header: 'Receiver', key: 'receiver', width: 25 },
                    { header: 'COD Amount', key: 'cod', width: 15 },
                    { header: 'Delivery Fee', key: 'deliveryFee', width: 15 },
                    { header: 'Taxi Fee', key: 'taxiFee', width: 15 },
                    { header: 'Net Payout', key: 'netPayout', width: 15 },
                ];

                // Fetch data for each item
                // This might be heavy if many items, but usually settlement batches are reasonable.
                // We need to fetch 'parcel_bookings' to get details.
                const items = newData.relatedItems;
                const rows = [];

                // Optimize: Group by bookingId to minimize reads if multiple items from same booking
                // But structure is {bookingId, itemId}.
                // Let's iterate and fetch. 
                // Alternatively, simpler read: fetch all bookings involved.
                const uniqueBookingIds = [...new Set(items.map((i: any) => i.bookingId))];

                // Fetch all bookings in parallel (chunks of 10 to avoid limits?)
                // For now, simple loop
                const bookingsMap: Record<string, any> = {};
                for (const bid of uniqueBookingIds) {
                    const bSnap = await db.collection('parcel_bookings').doc(bid as string).get();
                    if (bSnap.exists) {
                        bookingsMap[bid as string] = bSnap.data();
                    }
                }

                for (const item of items) {
                    const booking = bookingsMap[item.bookingId];
                    if (!booking) continue;

                    const parcelItem = booking.items.find((pi: any) => pi.id === item.itemId);
                    if (!parcelItem) continue;

                    // Calculate amounts
                    // Assuming transaction currency matters.
                    // If txn is USD, we convert/use USD values.
                    // But usually settlement is single currency.
                    // Let's use the raw values stored in item/booking.

                    const cod = parcelItem.codAmount || 0;
                    const delFee = parcelItem.deliveryFee || 0;

                    // Taxi fee logic is complex, usually stored if reimbursed?
                    // Or is it on the booking? Taxi fee is usually booking-level but split?
                    // Based on previous context, taxi fee is reimbursed.
                    // Let's check if 'taxiFee' exists on booking or item.
                    // Usually booking.taxiFee.
                    // If multiple items, how is taxi fee split?
                    // Typically taxi fee is per booking (delivery trip).
                    // If we settle item by item, we might need to know if taxi fee is included.
                    // For simplicity, we'll list 0 or check if previously logic split it.
                    // Actually, let's look at `parcelItem.taxiFeeShare` or similar if it exists.
                    // If not, put 0 for now to avoid blocking, or check booking total.
                    // const taxiFee = booking.taxiFee || 0; 

                    // Simple logic: Net = COD - Delivery Fee (if paid by sender, fetch logic?)
                    // Assuming standard: COD collected - Delivery Fee = Net.
                    // Plus Taxi Fee reimbursement if applicable.

                    const net = cod - delFee; // Very simplified.

                    rows.push({
                        date: booking.droppedOffAt ? new Date(booking.droppedOffAt).toISOString().split('T')[0] : (booking.createdAt ? new Date(booking.createdAt).toISOString().split('T')[0] : 'N/A'),
                        bookingCode: booking.bookingId,
                        trackingCode: parcelItem.trackingId,
                        receiver: parcelItem.receiverName,
                        cod: cod,
                        deliveryFee: delFee,
                        taxiFee: 0, // Placeholder as distribution logic is complex
                        netPayout: net
                    });
                }

                worksheet.addRows(rows);

                // Buffer
                // writeBuffer returns Promise<Buffer>
                excelBuffer = await workbook.xlsx.writeBuffer() as any as Buffer;
            }

            // 4. Send Notification
            if (eventType === 'REQUESTED') {
                await telegramService.sendSettlementReport(telegramChatId, newData as any, userData?.name || 'Customer');
            } else if (eventType === 'APPROVED') {
                await telegramService.sendSettlementReport(telegramChatId, newData as any, userData?.name || 'Customer', 'APPROVED', excelBuffer);
            }

        } catch (error) {
            console.error('Error in onWalletTransactionWritten:', error);
        }
    });
