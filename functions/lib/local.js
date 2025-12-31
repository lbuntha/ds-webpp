"use strict";
/**
 * Local development server for Cloud Functions
 * Run with: npm run serve
 *
 * This runs the Express app directly on your machine,
 * connecting to real Firebase/Firestore (not emulators).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Set project ID for Firebase Admin SDK when running locally
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'dsaccounting-18f75';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'dsaccounting-18f75';
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const errorHandler_1 = require("./middleware/errorHandler");
// Import routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const booking_routes_1 = __importDefault(require("./routes/booking.routes"));
const driver_routes_1 = __importDefault(require("./routes/driver.routes"));
const wallet_routes_1 = __importDefault(require("./routes/wallet.routes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5001;
// Middleware
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), mode: 'local' });
});
// API Routes (same as Cloud Function)
app.use('/auth', auth_routes_1.default);
app.use('/user', user_routes_1.default);
app.use('/bookings', booking_routes_1.default);
app.use('/driver', driver_routes_1.default);
app.use('/wallet', wallet_routes_1.default);
// Error handling middleware
app.use(errorHandler_1.errorHandler);
// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Local API server running at http://localhost:${PORT}`);
    console.log(`\n📌 Endpoints:`);
    console.log(`   POST http://localhost:${PORT}/auth/signup`);
    console.log(`   POST http://localhost:${PORT}/auth/login`);
    console.log(`   GET  http://localhost:${PORT}/health\n`);
});
//# sourceMappingURL=local.js.map