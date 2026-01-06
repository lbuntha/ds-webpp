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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBroadcastJobStatus = exports.sendTelegramBroadcast = exports.checkPayWayUpdates = exports.setupTelegramWebhook = exports.telegramWebhook = exports.testTelegramMessages = exports.onWalletTransactionWritten = exports.resetPasswordOTP = exports.verifyOTP = exports.requestOTP = exports.api = void 0;
const functions = __importStar(require("firebase-functions"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const errorHandler_1 = require("./middleware/errorHandler");
// Import routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const booking_routes_1 = __importDefault(require("./routes/booking.routes"));
const driver_routes_1 = __importDefault(require("./routes/driver.routes"));
const wallet_routes_1 = __importDefault(require("./routes/wallet.routes"));
const telegram_routes_1 = require("./routes/telegram.routes");
const notificationTriggers = __importStar(require("./triggers/notificationTriggers"));
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// API Routes (no /api prefix - Cloud Function is already called 'api')
app.use('/auth', auth_routes_1.default);
app.use('/user', user_routes_1.default);
app.use('/bookings', booking_routes_1.default);
app.use('/driver', driver_routes_1.default);
app.use('/wallet', wallet_routes_1.default);
app.use('/telegram', telegram_routes_1.telegramRoutes);
// Error handling middleware (must be last)
app.use(errorHandler_1.errorHandler);
// Export the Express app as a Cloud Function (REST API)
exports.api = functions.https.onRequest(app);
// Import controllers for Callable mapping
const authController = __importStar(require("./controllers/auth.controller"));
/**
 * Callable Functions for "Firebase API" compatibility
 */
exports.requestOTP = functions.https.onCall(async (data, context) => {
    console.log('[CALLABLE] requestOTP started', data);
    try {
        return await new Promise((resolve) => {
            const req = { body: data };
            const res = {
                status: (code) => ({
                    json: (payload) => resolve(Object.assign(Object.assign({}, payload), { httpStatus: code })),
                    send: (payload) => resolve(Object.assign(Object.assign({}, (typeof payload === 'string' ? { message: payload } : payload)), { httpStatus: code }))
                })
            };
            authController.requestOTP(req, res);
        });
    }
    catch (error) {
        console.error('[CALLABLE] requestOTP error:', error);
        return { success: false, message: error.message, httpStatus: 500 };
    }
});
exports.verifyOTP = functions.https.onCall(async (data, context) => {
    console.log('[CALLABLE] verifyOTP started', data);
    try {
        return await new Promise((resolve) => {
            const req = { body: data };
            const res = {
                status: (code) => ({
                    json: (payload) => resolve(Object.assign(Object.assign({}, payload), { httpStatus: code })),
                    send: (payload) => resolve(Object.assign(Object.assign({}, (typeof payload === 'string' ? { message: payload } : payload)), { httpStatus: code }))
                })
            };
            authController.verifyOTP(req, res);
        });
    }
    catch (error) {
        console.error('[CALLABLE] verifyOTP error:', error);
        return { success: false, message: error.message, httpStatus: 500 };
    }
});
exports.resetPasswordOTP = functions.https.onCall(async (data, context) => {
    console.log('[CALLABLE] resetPasswordOTP started', data);
    try {
        return await new Promise((resolve) => {
            const req = { body: data };
            const res = {
                status: (code) => ({
                    json: (payload) => resolve(Object.assign(Object.assign({}, payload), { httpStatus: code })),
                    send: (payload) => resolve(Object.assign(Object.assign({}, (typeof payload === 'string' ? { message: payload } : payload)), { httpStatus: code }))
                })
            };
            authController.resetPasswordWithOTP(req, res);
        });
    }
    catch (error) {
        console.error('[CALLABLE] resetPasswordOTP error:', error);
        return { success: false, message: error.message, httpStatus: 500 };
    }
});
/**
 * Firestore Triggers
 */
exports.onWalletTransactionWritten = notificationTriggers.onWalletTransactionWritten;
/**
 * Telegram Bot Webhook & Test Endpoints
 */
const telegramWebhook_1 = require("./api/telegramWebhook");
Object.defineProperty(exports, "testTelegramMessages", { enumerable: true, get: function () { return telegramWebhook_1.testTelegramMessages; } });
Object.defineProperty(exports, "telegramWebhook", { enumerable: true, get: function () { return telegramWebhook_1.telegramWebhook; } });
Object.defineProperty(exports, "setupTelegramWebhook", { enumerable: true, get: function () { return telegramWebhook_1.setupTelegramWebhook; } });
/**
 * Telegram Userbot Scheduled Task
 */
var checkPayWayUpdates_1 = require("./triggers/cron/checkPayWayUpdates");
Object.defineProperty(exports, "checkPayWayUpdates", { enumerable: true, get: function () { return checkPayWayUpdates_1.checkPayWayUpdates; } });
/**
 * Telegram Broadcast - Send messages to linked users
 * Optimized for 5000+ users with batching and rate limiting
 */
const telegramService_1 = require("./services/telegramService");
const admin = __importStar(require("firebase-admin"));
// Helper: delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
/**
 * Start a broadcast job (creates background job for large broadcasts)
 */
exports.sendTelegramBroadcast = functions.https.onCall(async (data, context) => {
    // Check authentication
    if (!(context === null || context === void 0 ? void 0 : context.auth)) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to send broadcasts');
    }
    const { message, recipients, batchSize = 25, delayBetweenBatches = 1000 } = data;
    if (!message || !message.trim()) {
        throw new functions.https.HttpsError('invalid-argument', 'Message is required');
    }
    if (!recipients || recipients.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'At least one recipient is required');
    }
    const totalRecipients = recipients.length;
    console.log(`[Broadcast] Starting broadcast to ${totalRecipients} recipients`);
    // For small broadcasts (< 50), process immediately
    if (totalRecipients <= 50) {
        return await processBroadcastImmediately(message, recipients, batchSize, delayBetweenBatches);
    }
    // For large broadcasts, create a background job
    const jobId = `broadcast_${Date.now()}_${context.auth.uid}`;
    const jobRef = admin.firestore().collection('telegram_broadcast_jobs').doc(jobId);
    await jobRef.set({
        id: jobId,
        status: 'QUEUED',
        message: message,
        totalRecipients: totalRecipients,
        sent: 0,
        failed: 0,
        progress: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: context.auth.uid,
        recipientIds: recipients.map(r => r.customerId)
    });
    // Start background processing (fire and forget)
    processBroadcastInBackground(jobId, message, recipients, batchSize, delayBetweenBatches);
    return {
        success: true,
        jobId: jobId,
        message: `Broadcast queued for ${totalRecipients} recipients. Check job status for progress.`,
        immediate: false
    };
});
/**
 * Process small broadcasts immediately
 */
async function processBroadcastImmediately(message, recipients, batchSize, delayBetweenBatches) {
    const telegramService = new telegramService_1.TelegramService();
    let sent = 0;
    let failed = 0;
    // Process in batches
    for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        // Process batch concurrently
        const results = await Promise.allSettled(batch.map(async (recipient) => {
            try {
                const success = await telegramService.sendMessage(recipient.chatId, message);
                return { success, recipient };
            }
            catch (e) {
                return { success: false, recipient, error: e };
            }
        }));
        // Count results
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.success) {
                sent++;
            }
            else {
                failed++;
            }
        }
        // Rate limit delay between batches
        if (i + batchSize < recipients.length) {
            await delay(delayBetweenBatches);
        }
    }
    console.log(`[Broadcast] Immediate complete: ${sent} sent, ${failed} failed`);
    return { success: true, sent, failed, immediate: true };
}
/**
 * Process large broadcasts in background with progress tracking
 */
async function processBroadcastInBackground(jobId, message, recipients, batchSize, delayBetweenBatches) {
    const telegramService = new telegramService_1.TelegramService();
    const jobRef = admin.firestore().collection('telegram_broadcast_jobs').doc(jobId);
    let sent = 0;
    let failed = 0;
    const total = recipients.length;
    try {
        await jobRef.update({ status: 'PROCESSING', startedAt: admin.firestore.FieldValue.serverTimestamp() });
        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);
            // Process batch concurrently
            const results = await Promise.allSettled(batch.map(async (recipient) => {
                try {
                    const success = await telegramService.sendMessage(recipient.chatId, message);
                    return { success, recipient };
                }
                catch (e) {
                    console.error(`[Broadcast] Error sending to ${recipient.chatId}:`, e);
                    return { success: false, recipient };
                }
            }));
            // Count results
            for (const result of results) {
                if (result.status === 'fulfilled' && result.value.success) {
                    sent++;
                }
                else {
                    failed++;
                }
            }
            // Update progress every batch
            const progress = Math.round(((i + batch.length) / total) * 100);
            await jobRef.update({
                sent,
                failed,
                progress,
                lastBatchAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`[Broadcast] Job ${jobId}: ${progress}% (${sent} sent, ${failed} failed)`);
            // Rate limit delay between batches
            if (i + batchSize < recipients.length) {
                await delay(delayBetweenBatches);
            }
        }
        // Mark complete
        await jobRef.update({
            status: 'COMPLETED',
            sent,
            failed,
            progress: 100,
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[Broadcast] Job ${jobId} COMPLETED: ${sent} sent, ${failed} failed`);
    }
    catch (error) {
        console.error(`[Broadcast] Job ${jobId} FAILED:`, error);
        await jobRef.update({
            status: 'FAILED',
            error: error.message,
            sent,
            failed,
            failedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
}
/**
 * Get broadcast job status
 */
exports.getBroadcastJobStatus = functions.https.onCall(async (data, context) => {
    if (!(context === null || context === void 0 ? void 0 : context.auth)) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    const { jobId } = data;
    if (!jobId) {
        throw new functions.https.HttpsError('invalid-argument', 'jobId is required');
    }
    const jobDoc = await admin.firestore().collection('telegram_broadcast_jobs').doc(jobId).get();
    if (!jobDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Job not found');
    }
    return jobDoc.data();
});
//# sourceMappingURL=index.js.map