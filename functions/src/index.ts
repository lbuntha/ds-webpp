import * as functions from 'firebase-functions';
import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import bookingRoutes from './routes/booking.routes';
import driverRoutes from './routes/driver.routes';
import walletRoutes from './routes/wallet.routes';
import { telegramRoutes } from './routes/telegram.routes';
import * as notificationTriggers from './triggers/notificationTriggers';

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req: express.Request, res: express.Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes (no /api prefix - Cloud Function is already called 'api')
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/bookings', bookingRoutes);
app.use('/driver', driverRoutes);
app.use('/wallet', walletRoutes);
app.use('/telegram', telegramRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Export the Express app as a Cloud Function (REST API)
export const api = functions.https.onRequest(app);

// Import controllers for Callable mapping
import * as authController from './controllers/auth.controller';

/**
 * Callable Functions for "Firebase API" compatibility
 */
export const requestOTP = functions.https.onCall(async (data, context) => {
    console.log('[CALLABLE] requestOTP started', data);
    try {
        return await new Promise((resolve) => {
            const req = { body: data } as any;
            const res = {
                status: (code: number) => ({
                    json: (payload: any) => resolve({ ...payload, httpStatus: code }),
                    send: (payload: any) => resolve({ ...(typeof payload === 'string' ? { message: payload } : payload), httpStatus: code })
                })
            } as any;
            authController.requestOTP(req, res);
        });
    } catch (error: any) {
        console.error('[CALLABLE] requestOTP error:', error);
        return { success: false, message: error.message, httpStatus: 500 };
    }
});

export const verifyOTP = functions.https.onCall(async (data, context) => {
    console.log('[CALLABLE] verifyOTP started', data);
    try {
        return await new Promise((resolve) => {
            const req = { body: data } as any;
            const res = {
                status: (code: number) => ({
                    json: (payload: any) => resolve({ ...payload, httpStatus: code }),
                    send: (payload: any) => resolve({ ...(typeof payload === 'string' ? { message: payload } : payload), httpStatus: code })
                })
            } as any;
            authController.verifyOTP(req, res);
        });
    } catch (error: any) {
        console.error('[CALLABLE] verifyOTP error:', error);
        return { success: false, message: error.message, httpStatus: 500 };
    }
});

export const resetPasswordOTP = functions.https.onCall(async (data, context) => {
    console.log('[CALLABLE] resetPasswordOTP started', data);
    try {
        return await new Promise((resolve) => {
            const req = { body: data } as any;
            const res = {
                status: (code: number) => ({
                    json: (payload: any) => resolve({ ...payload, httpStatus: code }),
                    send: (payload: any) => resolve({ ...(typeof payload === 'string' ? { message: payload } : payload), httpStatus: code })
                })
            } as any;
            authController.resetPasswordWithOTP(req, res);
        });
    } catch (error: any) {
        console.error('[CALLABLE] resetPasswordOTP error:', error);
        return { success: false, message: error.message, httpStatus: 500 };
    }
});


/**
 * Firestore Triggers
 */
export const onWalletTransactionWritten = notificationTriggers.onWalletTransactionWritten;

import * as userTriggers from './triggers/userTriggers';
export const onUserDeleted = userTriggers.onUserDeleted;

/**
 * Telegram Bot Webhook & Test Endpoints
 */
import { testTelegramMessages, telegramWebhook, setupTelegramWebhook } from './api/telegramWebhook';
export { testTelegramMessages, telegramWebhook, setupTelegramWebhook };



/**
 * Telegram Userbot Scheduled Task
 */
export { checkPayWayUpdates } from './triggers/cron/checkPayWayUpdates';

/**
 * Telegram Broadcast - Send messages to linked users
 * Optimized for 5000+ users with batching and rate limiting
 */
import { TelegramService } from './services/telegramService';
import * as admin from 'firebase-admin';

interface BroadcastRecipient {
    customerId: string;
    chatId: string;
    name: string;
}

interface BroadcastRequest {
    message: string;
    recipients: BroadcastRecipient[];
    batchSize?: number;       // Default: 25 (Telegram limit ~30/sec)
    delayBetweenBatches?: number; // Default: 1000ms
}

// Helper: delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Start a broadcast job (creates background job for large broadcasts)
 */
export const sendTelegramBroadcast = functions.https.onCall(async (data: any, context: any) => {
    // Check authentication
    if (!context?.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to send broadcasts');
    }

    const { message, recipients, batchSize = 25, delayBetweenBatches = 1000 } = data as BroadcastRequest;

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
async function processBroadcastImmediately(
    message: string,
    recipients: BroadcastRecipient[],
    batchSize: number,
    delayBetweenBatches: number
): Promise<{ success: boolean; sent: number; failed: number; immediate: boolean }> {
    const telegramService = new TelegramService();
    let sent = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);

        // Process batch concurrently
        const results = await Promise.allSettled(
            batch.map(async (recipient) => {
                try {
                    const success = await telegramService.sendMessage(recipient.chatId, message);
                    return { success, recipient };
                } catch (e) {
                    return { success: false, recipient, error: e };
                }
            })
        );

        // Count results
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.success) {
                sent++;
            } else {
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
async function processBroadcastInBackground(
    jobId: string,
    message: string,
    recipients: BroadcastRecipient[],
    batchSize: number,
    delayBetweenBatches: number
): Promise<void> {
    const telegramService = new TelegramService();
    const jobRef = admin.firestore().collection('telegram_broadcast_jobs').doc(jobId);

    let sent = 0;
    let failed = 0;
    const total = recipients.length;

    try {
        await jobRef.update({ status: 'PROCESSING', startedAt: admin.firestore.FieldValue.serverTimestamp() });

        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);

            // Process batch concurrently
            const results = await Promise.allSettled(
                batch.map(async (recipient) => {
                    try {
                        const success = await telegramService.sendMessage(recipient.chatId, message);
                        return { success, recipient };
                    } catch (e) {
                        console.error(`[Broadcast] Error sending to ${recipient.chatId}:`, e);
                        return { success: false, recipient };
                    }
                })
            );

            // Count results
            for (const result of results) {
                if (result.status === 'fulfilled' && result.value.success) {
                    sent++;
                } else {
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

    } catch (error) {
        console.error(`[Broadcast] Job ${jobId} FAILED:`, error);
        await jobRef.update({
            status: 'FAILED',
            error: (error as Error).message,
            sent,
            failed,
            failedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
}

/**
 * Get broadcast job status
 */
export const getBroadcastJobStatus = functions.https.onCall(async (data: any, context: any) => {
    if (!context?.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { jobId } = data as { jobId: string };
    if (!jobId) {
        throw new functions.https.HttpsError('invalid-argument', 'jobId is required');
    }

    const jobDoc = await admin.firestore().collection('telegram_broadcast_jobs').doc(jobId).get();

    if (!jobDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Job not found');
    }

    return jobDoc.data();
});


