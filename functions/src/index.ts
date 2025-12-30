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

// Error handling middleware (must be last)
app.use(errorHandler);

// Export the Express app as a Cloud Function
export const api = functions.https.onRequest(app);
