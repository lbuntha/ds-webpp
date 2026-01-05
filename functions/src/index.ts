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

/**
 * Telegram Bot Webhook & Test Endpoints
 */
import { testTelegramMessages, telegramWebhook, setupTelegramWebhook } from './api/telegramWebhook';
export { testTelegramMessages, telegramWebhook, setupTelegramWebhook };



/**
 * Telegram Userbot Scheduled Task
 */
export { checkPayWayUpdates } from './triggers/cron/checkPayWayUpdates';
