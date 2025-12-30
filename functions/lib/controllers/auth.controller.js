"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOTP = exports.requestOTP = exports.refreshToken = exports.logout = exports.login = exports.signup = void 0;
const response_1 = require("../utils/response");
const constants_1 = require("../config/constants");
const firebase_1 = require("../config/firebase");
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
        // For customers, create a linked Customer record first
        if (isCustomer) {
            linkedCustomerId = `cust-${now}-${Math.random().toString(36).slice(2, 8)}`;
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
            };
            await firebase_1.db.collection('customers').doc(linkedCustomerId).set(customerData);
        }
        // Create Firestore user document (matching frontend authService.register)
        const userProfile = {
            uid: userRecord.uid,
            email: email,
            name: name,
            role: role,
            // Auto-approve customers, keep others pending for admin review
            status: isCustomer ? 'APPROVED' : 'PENDING',
            linkedCustomerId: linkedCustomerId || undefined,
            lastLogin: now,
            phone: phone || '',
            address: address || '',
            referredBy: referredBy || '',
            createdAt: now,
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
 * Request OTP (placeholder for future implementation)
 */
const requestOTP = async (req, res) => {
    (0, response_1.sendError)(res, 'OTP not implemented. Use email/password signup.', constants_1.ERROR_CODES.INTERNAL_ERROR, constants_1.HTTP_STATUS.NOT_IMPLEMENTED);
};
exports.requestOTP = requestOTP;
/**
 * Verify OTP (placeholder for future implementation)
 */
const verifyOTP = async (req, res) => {
    (0, response_1.sendError)(res, 'OTP not implemented. Use email/password signup.', constants_1.ERROR_CODES.INTERNAL_ERROR, constants_1.HTTP_STATUS.NOT_IMPLEMENTED);
};
exports.verifyOTP = verifyOTP;
//# sourceMappingURL=auth.controller.js.map