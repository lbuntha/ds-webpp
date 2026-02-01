"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onWalletTransactionWritten = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const telegramService_1 = require("../services/telegramService");
const ExcelJS = __importStar(require("exceljs"));
// Initialize admin if not already done in index.ts
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
exports.onWalletTransactionWritten = functions.firestore
    .document('wallet_transactions/{txnId}')
    .onWrite(async (change, context) => {
    // Instantiate here to ensure process.env is ready
    const telegramService = new telegramService_1.TelegramService();
    const newData = change.after.exists ? change.after.data() : null;
    const oldData = change.before.exists ? change.before.data() : null;
    if (!newData)
        return; // Deleted
    const txnId = context.params.txnId;
    const type = newData.type;
    const status = newData.status;
    const oldStatus = oldData === null || oldData === void 0 ? void 0 : oldData.status;
    // We only care about SETTLEMENT or WITHDRAWAL
    if (type !== 'SETTLEMENT' && type !== 'WITHDRAWAL')
        return;
    let eventType = 'NONE';
    // Case 1: Newly Created as PENDING or APPROVED
    if (!oldData && newData) {
        if (status === 'PENDING')
            eventType = 'REQUESTED';
        else if (status === 'APPROVED')
            eventType = 'APPROVED';
    }
    // Case 2: Status Changed
    else if (oldData && oldStatus !== status) {
        if (status === 'APPROVED')
            eventType = 'APPROVED';
    }
    if (eventType === 'NONE')
        return;
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
        const customerId = userData === null || userData === void 0 ? void 0 : userData.linkedCustomerId;
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
        const telegramChatId = customerData === null || customerData === void 0 ? void 0 : customerData.telegramChatId;
        if (!telegramChatId) {
            console.log(`Customer ${customerId} has no telegramChatId`);
            return;
        }
        // 3. Prepare Excel Report if APPROVED
        let excelBuffer = undefined;
        let breakdown = undefined;
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
            const items = newData.relatedItems;
            const rows = [];
            const uniqueBookingIds = [...new Set(items.map((i) => i.bookingId))];
            const bookingsMap = {};
            for (const bid of uniqueBookingIds) {
                const bSnap = await db.collection('parcel_bookings').doc(bid).get();
                if (bSnap.exists) {
                    bookingsMap[bid] = bSnap.data();
                }
            }
            let totalCOD = 0;
            let totalDeliveryFee = 0; // Keep for legacy/backward compat
            let totalDeliveryFeeUSD = 0;
            let totalDeliveryFeeKHR = 0;
            let totalNet = 0;
            let breakdownCODCurrency = newData.currency || 'USD'; // Default to txn currency
            for (const item of items) {
                const booking = bookingsMap[item.bookingId];
                if (!booking)
                    continue;
                const parcelItem = booking.items.find((pi) => pi.id === item.itemId);
                if (!parcelItem)
                    continue;
                const cod = parcelItem.productPrice || 0;
                // Determine currencies
                const itemCODCurrency = parcelItem.codCurrency || breakdownCODCurrency;
                if (item === items[0])
                    breakdownCODCurrency = itemCODCurrency; // Set main currency based on first item if not set
                // Fee Logic - Normalize to COD Currency
                let delFee = 0;
                const RATE = 4000;
                if (itemCODCurrency === 'KHR') {
                    // Target KHR
                    if (parcelItem.deliveryFeeKHR && parcelItem.deliveryFeeKHR > 0) {
                        delFee = parcelItem.deliveryFeeKHR;
                    }
                    else if (parcelItem.deliveryFeeUSD && parcelItem.deliveryFeeUSD > 0) {
                        delFee = parcelItem.deliveryFeeUSD * RATE;
                    }
                    else {
                        // Legacy fallback (assume USD default if not specified, convert to KHR)
                        delFee = (parcelItem.deliveryFee || 0) * RATE;
                    }
                    totalDeliveryFeeKHR += delFee;
                }
                else {
                    // Target USD
                    if (parcelItem.deliveryFeeUSD && parcelItem.deliveryFeeUSD > 0) {
                        delFee = parcelItem.deliveryFeeUSD;
                    }
                    else if (parcelItem.deliveryFeeKHR && parcelItem.deliveryFeeKHR > 0) {
                        delFee = parcelItem.deliveryFeeKHR / RATE;
                    }
                    else {
                        // Legacy fallback (assume USD)
                        delFee = parcelItem.deliveryFee || 0;
                    }
                    totalDeliveryFeeUSD += delFee;
                }
                // Net Calculation
                const net = cod - delFee;
                totalCOD += cod;
                // totalDeliveryFee legacy accumulator (approximate or mixed)
                totalDeliveryFee += delFee;
                totalNet += net;
                rows.push({
                    date: booking.droppedOffAt ? new Date(booking.droppedOffAt).toISOString().split('T')[0] : (booking.createdAt ? new Date(booking.createdAt).toISOString().split('T')[0] : 'N/A'),
                    bookingCode: item.bookingId,
                    trackingCode: parcelItem.trackingCode || parcelItem.trackingId || '',
                    receiver: parcelItem.receiverName,
                    cod: cod,
                    deliveryFee: delFee,
                    taxiFee: 0,
                    netPayout: net
                });
            }
            worksheet.addRows(rows);
            excelBuffer = await workbook.xlsx.writeBuffer();
            breakdown = {
                totalCOD,
                totalDeliveryFee,
                netPayout: totalNet,
                codCurrency: breakdownCODCurrency,
                deliveryFeeUSD: totalDeliveryFeeUSD,
                deliveryFeeKHR: totalDeliveryFeeKHR
            };
        }
        // 4. Send Notification
        if (eventType === 'APPROVED') {
            const approvalNote = newData.approvalNote;
            const excludeFees = newData.excludeFees || false;
            await telegramService.sendSettlementReport(telegramChatId, newData, (userData === null || userData === void 0 ? void 0 : userData.name) || 'Customer', 'APPROVED', excelBuffer, breakdown, approvalNote, excludeFees);
        }
    }
    catch (error) {
        console.error('Error in onWalletTransactionWritten:', error);
    }
});
//# sourceMappingURL=notificationTriggers.js.map