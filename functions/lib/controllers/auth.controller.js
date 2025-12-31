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
exports.resetPasswordWithOTP = exports.verifyOTP = exports.requestOTP = exports.refreshToken = exports.logout = exports.login = exports.signup = void 0;
const response_1 = require("../utils/response");
const constants_1 = require("../config/constants");
const firebase_1 = require("../config/firebase");
const crypto = __importStar(require("crypto"));
const hashString = (text) => {
    return crypto.createHash('sha256').update(text).digest('hex');
};
const generateReferralCode = (name) => {
    const prefix = (name || 'USR').replace(/[^A-Z]/gi, '').substring(0, 3).toUpperCase() || 'USR';
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${random}`;
};
/**
 * Sign up a new user
 * POST /auth/signup
 * Body: { email, password, name, phone?, role?, referredBy?, address? }
 *
 * For customers: Auto-approved (status=APPROVED) and creates linked Customer record
 * For drivers/others: Requires admin approval (status=PENDING)
 */
const signup = async (req, res) => {
    try {
        const { email, password, name, phone, role = 'customer', referredBy, address } = req.body;
        // Validate required fields
        if (!email || !password || !name) {
            (0, response_1.sendError)(res, 'Email, password, and name are required', constants_1.ERROR_CODES.VALIDATION_ERROR, constants_1.HTTP_STATUS.BAD_REQUEST);
            return;
        }
        if (password.length < 6) {
            (0, response_1.sendError)(res, 'Password must be at least 6 characters', constants_1.ERROR_CODES.VALIDATION_ERROR, constants_1.HTTP_STATUS.BAD_REQUEST);
            return;
        }
        // Create Firebase Auth user (phone stored in Firestore only)
        const userRecord = await firebase_1.auth.createUser({
            email,
            password,
            displayName: name,
        });
        const now = Date.now();
        const isCustomer = role === 'customer';
        let linkedCustomerId = null;
        const referralCode = isCustomer ? generateReferralCode(name) : null;
        // For customers, create a linked Customer record first
        if (isCustomer) {
            const customerRef = firebase_1.db.collection('customers').doc();
            linkedCustomerId = customerRef.id;
            const customerData = {
                id: linkedCustomerId,
                name: name,
                email: email,
                phone: phone || '',
                status: 'ACTIVE',
                linkedUserId: userRecord.uid,
                type: 'INDIVIDUAL',
                createdAt: now,
                updatedAt: now,
                bankAccounts: [],
                address: address || '',
                referralCode: referralCode
            };
            await customerRef.set(customerData);
        }
        // Create Firestore user document (matching frontend authService.register)
        const userProfile = {
            uid: userRecord.uid,
            email: email,
            name: name,
            role: role,
            // Auto-approve customers, keep others pending for admin review
            status: isCustomer ? 'APPROVED' : 'PENDING',
            linkedCustomerId: linkedCustomerId,
            lastLogin: now,
            joinedAt: now,
            phone: phone || '',
            address: address || '',
            referralCode: referralCode || undefined,
            referredBy: referredBy || null,
            pin: password ? hashString(password) : null,
            hasPin: !!password,
            authMethod: 'email'
        };
        await firebase_1.db.collection('users').doc(userRecord.uid).set(userProfile);
        // Fetch the created documents to return
        const userDoc = await firebase_1.db.collection('users').doc(userRecord.uid).get();
        const customerDoc = linkedCustomerId
            ? await firebase_1.db.collection('customers').doc(linkedCustomerId).get()
            : null;
        (0, response_1.sendSuccess)(res, 'User created successfully', {
            uid: userRecord.uid,
            email: userRecord.email,
            user: userDoc.data(),
            customer: (customerDoc === null || customerDoc === void 0 ? void 0 : customerDoc.data()) || null,
            note: isCustomer
                ? 'Account is active. Use Firebase Client SDK to sign in.'
                : 'Account requires admin approval before access.'
        }, constants_1.HTTP_STATUS.CREATED);
    }
    catch (error) {
        console.error('Signup error:', error);
        // Handle Firebase Auth specific errors
        if (error.code === 'auth/email-already-exists') {
            (0, response_1.sendError)(res, 'Email already in use', constants_1.ERROR_CODES.VALIDATION_ERROR, constants_1.HTTP_STATUS.BAD_REQUEST);
            return;
        }
        if (error.code === 'auth/invalid-email') {
            (0, response_1.sendError)(res, 'Invalid email format', constants_1.ERROR_CODES.VALIDATION_ERROR, constants_1.HTTP_STATUS.BAD_REQUEST);
            return;
        }
        if (error.code === 'auth/invalid-phone-number') {
            (0, response_1.sendError)(res, 'Invalid phone number format', constants_1.ERROR_CODES.VALIDATION_ERROR, constants_1.HTTP_STATUS.BAD_REQUEST);
            return;
        }
        (0, response_1.sendError)(res, error.message || 'Failed to create user', constants_1.ERROR_CODES.INTERNAL_ERROR, constants_1.HTTP_STATUS.INTERNAL_ERROR);
    }
};
exports.signup = signup;
/**
 * Login with email/password (returns custom token)
 * POST /auth/login
 * Body: { email, password }
 * Note: For proper login, use Firebase Client SDK. This endpoint is for server-to-server.
 */
const login = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            (0, response_1.sendError)(res, 'Email is required', constants_1.ERROR_CODES.VALIDATION_ERROR, constants_1.HTTP_STATUS.BAD_REQUEST);
            return;
        }
        // Get user by email
        const userRecord = await firebase_1.auth.getUserByEmail(email);
        // Get Firestore user data
        const userDoc = await firebase_1.db.collection('users').doc(userRecord.uid).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        // Note: For actual login, use Firebase Client SDK with email/password
        // This endpoint just returns user info for verification purposes
        (0, response_1.sendSuccess)(res, 'User found', {
            uid: userRecord.uid,
            email: userRecord.email,
            user: userData,
            note: 'Use Firebase Client SDK to sign in with email/password'
        });
    }
    catch (error) {
        console.error('Login error:', error);
        if (error.code === 'auth/user-not-found') {
            (0, response_1.sendError)(res, 'User not found', constants_1.ERROR_CODES.AUTHENTICATION_ERROR, constants_1.HTTP_STATUS.UNAUTHORIZED);
            return;
        }
        (0, response_1.sendError)(res, error.message || 'Login failed', constants_1.ERROR_CODES.INTERNAL_ERROR, constants_1.HTTP_STATUS.INTERNAL_ERROR);
    }
};
exports.login = login;
/**
 * Logout (invalidate tokens)
 * POST /auth/logout
 * Requires: Authorization header with Bearer token
 */
const logout = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!(authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer '))) {
            (0, response_1.sendError)(res, 'No token provided', constants_1.ERROR_CODES.AUTHENTICATION_ERROR, constants_1.HTTP_STATUS.UNAUTHORIZED);
            return;
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await firebase_1.auth.verifyIdToken(idToken);
        // Revoke all refresh tokens for this user
        await firebase_1.auth.revokeRefreshTokens(decodedToken.uid);
        (0, response_1.sendSuccess)(res, 'Logged out successfully');
    }
    catch (error) {
        console.error('Logout error:', error);
        (0, response_1.sendError)(res, error.message || 'Logout failed', constants_1.ERROR_CODES.INTERNAL_ERROR, constants_1.HTTP_STATUS.INTERNAL_ERROR);
    }
};
exports.logout = logout;
/**
 * Refresh token
 * POST /auth/refresh-token
 * Note: Use Firebase Client SDK for proper token refresh
 */
const refreshToken = async (req, res) => {
    (0, response_1.sendError)(res, 'Use Firebase Client SDK for token refresh', constants_1.ERROR_CODES.INTERNAL_ERROR, constants_1.HTTP_STATUS.BAD_REQUEST);
};
exports.refreshToken = refreshToken;
/**
 * Request OTP via phone
 * POST /auth/request-otp
 * Body: { phone, purpose }
 */
const requestOTP = async (req, res) => {
    try {
        const { phone, purpose = 'LOGIN' } = req.body;
        if (!phone) {
            (0, response_1.sendError)(res, 'Phone number is required', constants_1.ERROR_CODES.VALIDATION_ERROR, constants_1.HTTP_STATUS.BAD_REQUEST);
            return;
        }
        const normalizedPhone = phone.replace(/\D/g, '');
        const now = Date.now();
        const OTP_EXPIRY_MS = 5 * 60 * 1000;
        const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
        const MAX_REQUESTS_PER_HOUR = 5;
        // Check existing OTP for rate limiting
        const otpRef = firebase_1.db.collection('otp_codes').doc(normalizedPhone);
        const otpDoc = await otpRef.get();
        const existingData = otpDoc.exists ? otpDoc.data() : null;
        if (existingData) {
            const isWithinLimit = (now - existingData.createdAt) < RATE_LIMIT_WINDOW_MS;
            if (isWithinLimit && (existingData.requestCount || 0) >= MAX_REQUESTS_PER_HOUR) {
                (0, response_1.sendError)(res, 'Too many requests. Please try again in an hour.', constants_1.ERROR_CODES.VALIDATION_ERROR, constants_1.HTTP_STATUS.TOO_MANY_REQUESTS);
                return;
            }
        }
        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = now + OTP_EXPIRY_MS;
        const otpRecord = {
            id: normalizedPhone,
            code,
            phone,
            createdAt: now,
            expiry: expiresAt, // Backend uses 'expiry', frontend uses 'expiresAt'. Synchronizing to 'expiry' for backend consistency.
            attempts: 0,
            verified: false,
            purpose,
            requestCount: ((existingData === null || existingData === void 0 ? void 0 : existingData.requestCount) || 0) + 1
        };
        await otpRef.set(otpRecord);
        // DEBUG LOG
        console.log(`[AUTH-API] Generated OTP for ${phone}: ${code}`);
        (0, response_1.sendSuccess)(res, 'OTP generated successfully', {
            note: 'In development, check function logs for the code.'
        });
    }
    catch (error) {
        console.error('Request OTP error:', error);
        (0, response_1.sendError)(res, error.message || 'Failed to request OTP', constants_1.ERROR_CODES.INTERNAL_ERROR, constants_1.HTTP_STATUS.INTERNAL_ERROR);
    }
};
exports.requestOTP = requestOTP;
/**
 * Verify OTP
 * POST /auth/verify-otp
 * Body: { phone, otp }
 */
const verifyOTP = async (req, res) => {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp) {
            (0, response_1.sendError)(res, 'Phone and OTP are required', constants_1.ERROR_CODES.VALIDATION_ERROR, constants_1.HTTP_STATUS.BAD_REQUEST);
            return;
        }
        const normalizedPhone = phone.replace(/\D/g, '');
        const otpDoc = await firebase_1.db.collection('otp_codes').doc(normalizedPhone).get();
        if (!otpDoc.exists) {
            (0, response_1.sendError)(res, 'No OTP found for this phone number', constants_1.ERROR_CODES.VALIDATION_ERROR, constants_1.HTTP_STATUS.BAD_REQUEST);
            return;
        }
        const data = otpDoc.data();
        const now = Date.now();
        if ((data === null || data === void 0 ? void 0 : data.code) !== otp) {
            (0, response_1.sendError)(res, 'Invalid OTP code', constants_1.ERROR_CODES.VALIDATION_ERROR, constants_1.HTTP_STATUS.BAD_REQUEST);
            return;
        }
        if ((data === null || data === void 0 ? void 0 : data.expiry) < now) {
            (0, response_1.sendError)(res, 'OTP has expired', constants_1.ERROR_CODES.VALIDATION_ERROR, constants_1.HTTP_STATUS.BAD_REQUEST);
            return;
        }
        // Mark as verified instead of deleting (so the next step can use it)
        await firebase_1.db.collection('otp_codes').doc(normalizedPhone).update({
            verified: true
        });
        (0, response_1.sendSuccess)(res, 'OTP verified successfully');
    }
    catch (error) {
        console.error('Verify OTP error:', error);
        (0, response_1.sendError)(res, error.message || 'Failed to verify OTP', constants_1.ERROR_CODES.INTERNAL_ERROR, constants_1.HTTP_STATUS.INTERNAL_ERROR);
    }
};
exports.verifyOTP = verifyOTP;
/**
 * Reset password/PIN via OTP verification
 * POST /auth/reset-password-otp
 * Body: { phone, otp, newPassword }
 *
 * This endpoint validates OTP server-side before resetting the PIN.
 */
const resetPasswordWithOTP = async (req, res) => {
    try {
        const { phone, otp, newPassword } = req.body;
        // Validate required fields
        if (!phone || !otp || !newPassword) {
            (0, response_1.sendError)(res, 'Phone, OTP, and new password are required', constants_1.ERROR_CODES.VALIDATION_ERROR, constants_1.HTTP_STATUS.BAD_REQUEST);
            return;
        }
        if (newPassword.length < 4) {
            (0, response_1.sendError)(res, 'PIN must be at least 4 characters', constants_1.ERROR_CODES.VALIDATION_ERROR, constants_1.HTTP_STATUS.BAD_REQUEST);
            return;
        }
        // 1. Normalize phone
        const normalizedPhone = phone.replace(/\D/g, '');
        // 2. Verify OTP
        const otpDoc = await firebase_1.db.collection('otp_codes').doc(normalizedPhone).get();
        if (!otpDoc.exists) {
            (0, response_1.sendError)(res, 'No OTP found. Please request a new OTP.', constants_1.ERROR_CODES.VALIDATION_ERROR, constants_1.HTTP_STATUS.BAD_REQUEST);
            return;
        }
        const otpData = otpDoc.data();
        const now = Date.now();
        // Check if OTP matches
        if ((otpData === null || otpData === void 0 ? void 0 : otpData.code) !== otp) {
            (0, response_1.sendError)(res, 'Invalid OTP code', constants_1.ERROR_CODES.VALIDATION_ERROR, constants_1.HTTP_STATUS.BAD_REQUEST);
            return;
        }
        // Check if OTP has expired
        if ((otpData === null || otpData === void 0 ? void 0 : otpData.expiry) < now) {
            (0, response_1.sendError)(res, 'OTP has expired. Please request a new OTP.', constants_1.ERROR_CODES.VALIDATION_ERROR, constants_1.HTTP_STATUS.BAD_REQUEST);
            return;
        }
        // Check if OTP purpose is for password reset
        if ((otpData === null || otpData === void 0 ? void 0 : otpData.purpose) && otpData.purpose !== 'RESET' && otpData.purpose !== 'LOGIN') {
            (0, response_1.sendError)(res, 'Invalid OTP purpose', constants_1.ERROR_CODES.VALIDATION_ERROR, constants_1.HTTP_STATUS.BAD_REQUEST);
            return;
        }
        // 3. Create synthetic email and find user
        const syntheticEmail = `${normalizedPhone}@doorsteps.tech`;
        let userRecord;
        try {
            userRecord = await firebase_1.auth.getUserByEmail(syntheticEmail);
        }
        catch (e) {
            if (e.code === 'auth/user-not-found') {
                (0, response_1.sendError)(res, 'No account found with this phone number', constants_1.ERROR_CODES.VALIDATION_ERROR, constants_1.HTTP_STATUS.NOT_FOUND);
                return;
            }
            throw e;
        }
        // 4. Update password in Firebase Auth (Firebase hashes internally, so use RAW password)
        await firebase_1.auth.updateUser(userRecord.uid, {
            password: newPassword // RAW password - Firebase handles hashing
        });
        // 5. Update PIN hash in Firestore user profile (our own hash for fallback verification)
        const hashedPin = hashString(newPassword);
        await firebase_1.db.collection('users').doc(userRecord.uid).update({
            pin: hashedPin,
            hasPin: true,
            updatedAt: Date.now()
        });
        // 6. Delete the used OTP
        await firebase_1.db.collection('otp_codes').doc(normalizedPhone).delete();
        console.log(`[PIN RESET] Successfully reset PIN for ${normalizedPhone}`);
        (0, response_1.sendSuccess)(res, 'PIN reset successfully');
    }
    catch (error) {
        console.error('PIN reset error:', error);
        (0, response_1.sendError)(res, error.message || 'Failed to reset PIN', constants_1.ERROR_CODES.INTERNAL_ERROR, constants_1.HTTP_STATUS.INTERNAL_ERROR);
    }
};
exports.resetPasswordWithOTP = resetPasswordWithOTP;
//# sourceMappingURL=auth.controller.js.map