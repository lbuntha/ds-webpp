/**
 * Local development server for Cloud Functions
 * Run with: npm run serve
 * 
 * This runs the Express app directly on your machine,
 * connecting to real Firebase/Firestore (not emulators).
 */

// Set project ID for Firebase Admin SDK when running locally
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'doorstep-c75e3';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'doorstep-c75e3';

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
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req: express.Request, res: express.Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), mode: 'local' });
});

// API Routes (same as Cloud Function)
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/bookings', bookingRoutes);
app.use('/driver', driverRoutes);
app.use('/wallet', walletRoutes);

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Local API server running at http://localhost:${PORT}`);
    console.log(`\n📌 Endpoints:`);
    console.log(`   POST http://localhost:${PORT}/auth/signup`);
    console.log(`   POST http://localhost:${PORT}/auth/login`);
    console.log(`   GET  http://localhost:${PORT}/health\n`);
});
