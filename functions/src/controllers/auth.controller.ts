import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { HTTP_STATUS, ERROR_CODES } from '../config/constants';
import { auth, db } from '../config/firebase';
import * as crypto from 'crypto';

const hashString = (text: string): string => {
    return crypto.createHash('sha256').update(text).digest('hex');
};

const generateReferralCode = (name: string): string => {
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
export const signup = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password, name, phone, role = 'customer', referredBy, address } = req.body;

        // Validate required fields
        if (!email || !password || !name) {
            sendError(res, 'Email, password, and name are required', ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
            return;
        }

        if (password.length < 6) {
            sendError(res, 'Password must be at least 6 characters', ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
            return;
        }

        // Create Firebase Auth user (phone stored in Firestore only)
        const userRecord = await auth.createUser({
            email,
            password,
            displayName: name,
        });

        const now = Date.now();
        const isCustomer = role === 'customer';
        let linkedCustomerId: string | null = null;
        const referralCode = isCustomer ? generateReferralCode(name) : null;

        // For customers, create a linked Customer record first
        if (isCustomer) {
            const customerRef = db.collection('customers').doc();
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
        const userProfile: Record<string, any> = {
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

        await db.collection('users').doc(userRecord.uid).set(userProfile);

        // Fetch the created documents to return
        const userDoc = await db.collection('users').doc(userRecord.uid).get();
        const customerDoc = linkedCustomerId
            ? await db.collection('customers').doc(linkedCustomerId).get()
            : null;

        sendSuccess(res, 'User created successfully', {
            uid: userRecord.uid,
            email: userRecord.email,
            user: userDoc.data(),
            customer: customerDoc?.data() || null,
            note: isCustomer
                ? 'Account is active. Use Firebase Client SDK to sign in.'
                : 'Account requires admin approval before access.'
        }, HTTP_STATUS.CREATED);
    } catch (error: any) {
        console.error('Signup error:', error);

        // Handle Firebase Auth specific errors
        if (error.code === 'auth/email-already-exists') {
            sendError(res, 'Email already in use', ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
            return;
        }
        if (error.code === 'auth/invalid-email') {
            sendError(res, 'Invalid email format', ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
            return;
        }
        if (error.code === 'auth/invalid-phone-number') {
            sendError(res, 'Invalid phone number format', ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
            return;
        }

        sendError(res, error.message || 'Failed to create user', ERROR_CODES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_ERROR);
    }
};

/**
 * Login with email/password (returns custom token)
 * POST /auth/login
 * Body: { email, password }
 * Note: For proper login, use Firebase Client SDK. This endpoint is for server-to-server.
 */
export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email } = req.body;

        if (!email) {
            sendError(res, 'Email is required', ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
            return;
        }

        // Get user by email
        const userRecord = await auth.getUserByEmail(email);

        // Get Firestore user data
        const userDoc = await db.collection('users').doc(userRecord.uid).get();
        const userData = userDoc.exists ? userDoc.data() : null;

        // Note: For actual login, use Firebase Client SDK with email/password
        // This endpoint just returns user info for verification purposes

        sendSuccess(res, 'User found', {
            uid: userRecord.uid,
            email: userRecord.email,
            user: userData,
            note: 'Use Firebase Client SDK to sign in with email/password'
        });
    } catch (error: any) {
        console.error('Login error:', error);

        if (error.code === 'auth/user-not-found') {
            sendError(res, 'User not found', ERROR_CODES.AUTHENTICATION_ERROR, HTTP_STATUS.UNAUTHORIZED);
            return;
        }

        sendError(res, error.message || 'Login failed', ERROR_CODES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_ERROR);
    }
};

/**
 * Logout (invalidate tokens)
 * POST /auth/logout
 * Requires: Authorization header with Bearer token
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            sendError(res, 'No token provided', ERROR_CODES.AUTHENTICATION_ERROR, HTTP_STATUS.UNAUTHORIZED);
            return;
        }

        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(idToken);

        // Revoke all refresh tokens for this user
        await auth.revokeRefreshTokens(decodedToken.uid);

        sendSuccess(res, 'Logged out successfully');
    } catch (error: any) {
        console.error('Logout error:', error);
        sendError(res, error.message || 'Logout failed', ERROR_CODES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_ERROR);
    }
};

/**
 * Refresh token
 * POST /auth/refresh-token
 * Note: Use Firebase Client SDK for proper token refresh
 */
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
    sendError(res, 'Use Firebase Client SDK for token refresh', ERROR_CODES.INTERNAL_ERROR, HTTP_STATUS.BAD_REQUEST);
};

/**
 * Request OTP (placeholder for future implementation)
 */
export const requestOTP = async (req: Request, res: Response): Promise<void> => {
    sendError(res, 'OTP not implemented. Use email/password signup.', ERROR_CODES.INTERNAL_ERROR, HTTP_STATUS.NOT_IMPLEMENTED);
};

/**
 * Verify OTP (placeholder for future implementation)
 */
export const verifyOTP = async (req: Request, res: Response): Promise<void> => {
    sendError(res, 'OTP not implemented. Use email/password signup.', ERROR_CODES.INTERNAL_ERROR, HTTP_STATUS.NOT_IMPLEMENTED);
};

/**
 * Reset password via OTP
 * POST /auth/reset-password-otp
 * Body: { phone, otp, newPassword }
 */
export const resetPasswordWithOTP = async (req: Request, res: Response): Promise<void> => {
    try {
        const { phone, otp, newPassword } = req.body;

        if (!phone || !otp || !newPassword) {
            sendError(res, 'Phone, OTP, and new password are required', ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
            return;
        }

        // 1. Normalize phone
        const normalizedPhone = phone.replace(/\D/g, '');
        const syntheticEmail = `${normalizedPhone}@doorsteps.tech`;

        // 2. Verify OTP in Firestore
        const otpDoc = await db.collection('otp_codes').doc(normalizedPhone).get();
        if (!otpDoc.exists) {
            sendError(res, 'No OTP found for this phone number. Please request a new code.', ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
            return;
        }

        const otpData = otpDoc.data();
        const now = Date.now();

        if (otpData?.code !== otp) {
            sendError(res, 'Invalid OTP code', ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
            return;
        }

        if (otpData?.expiry < now) {
            sendError(res, 'OTP has expired', ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
            return;
        }

        // 3. Find user by synthetic email
        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(syntheticEmail);
        } catch (e: any) {
            if (e.code === 'auth/user-not-found') {
                sendError(res, 'No account found with this phone number', ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.NOT_FOUND);
                return;
            }
            throw e;
        }

        // 4. Update password
        const hashedNewPassword = hashString(newPassword);
        await auth.updateUser(userRecord.uid, {
            password: hashedNewPassword
        });

        // 5. Clean up OTP and update User Profile
        await db.collection('otp_codes').doc(normalizedPhone).delete();
        await db.collection('users').doc(userRecord.uid).update({
            pin: hashedNewPassword,
            hasPin: true,
            updatedAt: Date.now()
        });

        sendSuccess(res, 'Password reset successfully');
    } catch (error: any) {
        console.error('Password reset OTP error:', error);
        sendError(res, error.message || 'Failed to reset password', ERROR_CODES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_ERROR);
    }
};


