import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, updatePassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { Firestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { UserProfile } from '../types';
import { OTPService } from './otpService';
import { normalizePhone, getSyntheticEmail } from '../utils/phoneUtils';
import { hashString } from '../utils/cryptoUtils';

export class AuthService {
    private otpService: OTPService;

    constructor(private auth: Auth, private db: Firestore) {
        this.otpService = new OTPService(db);
    }

    async login(email: string, pass: string) { await signInWithEmailAndPassword(this.auth, email, pass); }

    async sendRegistrationLink(email: string, userData: any) {
        const actionCodeSettings = {
            url: window.location.origin + '/auth/login?mode=VERIFY',
            handleCodeInApp: true,
        };

        // Store registration data excluding password (as it's not captured yet)
        window.localStorage.setItem('registration_email', email);
        window.localStorage.setItem('registration_data', JSON.stringify(userData));

        await sendSignInLinkToEmail(this.auth, email, actionCodeSettings);
    }

    isEmailLink(url: string) {
        return isSignInWithEmailLink(this.auth, url);
    }

    async completeRegistrationWithLink(email: string, password?: string) {
        const res = await signInWithEmailLink(this.auth, email, window.location.href);

        if (!res.user) throw new Error("Failed to sign in with link.");

        const storedData = window.localStorage.getItem('registration_data');
        if (!storedData) throw new Error("Registration data not found. Please start over.");

        const extraData = JSON.parse(storedData);
        const { name, phone, role = 'customer' } = extraData;

        // 1. Set the password
        if (password) {
            await updatePassword(res.user, password);
        }

        // 2. Set display name
        await updateProfile(res.user, { displayName: name });

        // 3. Create profile (which also creates customer record if needed)
        await this.createProfile(res.user, name, { ...extraData, phone, role, password });

        window.localStorage.removeItem('registration_email');
        window.localStorage.removeItem('registration_data');

        return res.user;
    }

    private generateReferralCode(name: string): string {
        const prefix = (name || 'USR').replace(/[^A-Z]/gi, '').substring(0, 3).toUpperCase() || 'USR';
        const random = Math.floor(1000 + Math.random() * 9000);
        return `${prefix}-${random}`;
    }

    /**
     * Shared logic to create user profile and customer record
     */
    private async createProfile(user: any, name: string, extraData: any) {
        let linkedCustomerId = null;
        const role = extraData?.role || 'customer';
        const now = Date.now();

        // 1. Prepare Customer Data (if role is customer)
        if (role === 'customer') {
            const newCustomerRef = doc(collection(this.db, 'customers'));
            linkedCustomerId = newCustomerRef.id;

            const customerData: any = {
                id: linkedCustomerId,
                name: name,
                email: user.email,
                phone: extraData.phone || '',
                status: 'ACTIVE',
                linkedUserId: user.uid,
                createdAt: now,
                bankAccounts: [],
                address: extraData.address || '',
                // Move customer-specific fields here
                referralCode: extraData.referralCode || this.generateReferralCode(name),
                savedLocations: extraData.savedLocations || [],
                isTaxable: extraData.isTaxable || false,
                excludeFeesInSettlement: extraData.excludeFeesInSettlement || false,
            };

            await setDoc(newCustomerRef, customerData);
        }

        // Hash the pin/password before storing
        const pinToStore = extraData.password || extraData.pin || null;
        const hashedPin = pinToStore ? await hashString(pinToStore) : null;

        // 2. Prepare User Profile (saved to 'users' collection)
        const userProfile: UserProfile = {
            uid: user.uid,
            email: user.email!,
            name: name,
            role: role,
            status: role === 'customer' ? 'APPROVED' : 'PENDING',
            linkedCustomerId: linkedCustomerId,
            lastLogin: now,
            pin: hashedPin, // Stores hashed password or PIN
            hasPin: !!hashedPin,
            authMethod: extraData.authProvider || extraData.authMethod || 'email',
            joinedAt: now,
            phone: extraData.phone ? normalizePhone(extraData.phone) : '',
            address: extraData.address || '',
            referralCode: extraData.referralCode || (role === 'customer' ? this.generateReferralCode(name) : undefined),
            referredBy: extraData.referredBy || null,
        };

        // For Google/Phone signups that might have missing email in extraData but available in user object
        if (!userProfile.email && user.email) {
            userProfile.email = user.email;
        }

        await setDoc(doc(this.db, 'users', user.uid), userProfile);
    }

    async register(email: string, pass: string, name: string, extraData?: any) {
        const res = await createUserWithEmailAndPassword(this.auth, email, pass);
        await this.createProfile(res.user, name, { ...extraData, password: pass });
    }

    async logout() { await signOut(this.auth); }
    async resetPassword(email: string) { await sendPasswordResetEmail(this.auth, email); }

    // ==================== GOOGLE OAUTH ====================

    /**
     * Sign in with Google OAuth
     * Creates user profile if first time
     */
    async signInWithGoogle(provider: GoogleAuthProvider, role: string = 'customer') {
        const result = await signInWithPopup(this.auth, provider);
        const user = result.user;

        // Check if user profile exists
        const userDocRef = doc(this.db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
            // First time Google sign-in - create user profile
            await this.createProfile(user, user.displayName || 'Google User', {
                authMethod: 'google',
                role: role
            });
        } else {
            // Existing user - update last login
            await updateDoc(userDocRef, { lastLogin: Date.now() });
        }

        return result;
    }

    // ==================== PIN MANAGEMENT ====================

    /**
     * Set or update user PIN (stores hashed PIN)
     */
    async setUserPIN(uid: string, pin: string): Promise<{ success: boolean; message: string }> {
        if (!/^\d{4,6}$/.test(pin)) {
            return { success: false, message: 'PIN must be 4-6 digits' };
        }

        try {
            // PIN Change Algorithm: Unsalted SHA-256
            const hashedPin = await hashString(pin);

            await updateDoc(doc(this.db, 'users', uid), {
                pin: hashedPin,
                hasPin: true,
                pinUpdatedAt: Date.now()
            });

            return { success: true, message: 'PIN set successfully' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    /**
     * Verify user PIN for quick unlock
     */
    async verifyUserPIN(uid: string, pin: string): Promise<{ success: boolean; message: string }> {
        try {
            const userDocSnap = await getDoc(doc(this.db, 'users', uid));

            if (!userDocSnap.exists()) {
                return { success: false, message: 'User not found' };
            }

            const userData = userDocSnap.data();
            if (!userData.pin) {
                return { success: false, message: 'No PIN set for this account' };
            }

            const expectedHash = await hashString(pin);

            if (userData.pin !== expectedHash) {
                return { success: false, message: 'Incorrect PIN' };
            }

            return { success: true, message: 'PIN verified' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    /**
     * Reset PIN after OTP verification
     * Call this after verifyOTP succeeds
     */
    async resetPINWithOTP(phone: string, otp: string, newPin: string): Promise<{ success: boolean; message: string }> {
        // First verify OTP
        const otpResult = await this.otpService.verifyOTP(phone, otp);
        if (!otpResult.success) {
            return otpResult;
        }

        // Find user by phone
        const usersRef = collection(this.db, 'users');
        const normalizedPhone = normalizePhone(phone);
        const q = query(usersRef, where('phone', '==', normalizedPhone), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return { success: false, message: 'No account found with this phone number' };
        }

        const userDoc = snapshot.docs[0];
        return await this.setUserPIN(userDoc.id, newPin);
    }

    /**
     * Lookup user by phone number
     * Returns the email associated with the phone number
     */
    async lookupUserByPhone(phone: string): Promise<string | null> {
        const normalizedPhone = normalizePhone(phone);

        // Query users collection for matching phone
        const usersRef = collection(this.db, 'users');
        const q = query(usersRef, where('phone', '==', normalizedPhone), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null;
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data() as UserProfile;
        return userData.email;
    }

    /**
     * Login with either email or phone number
     * Automatically detects input type and handles appropriately
     */
    async loginWithEmailOrPhone(identifier: string, password: string) {
        // Detect if identifier is email or phone
        const isEmail = identifier.includes('@');

        if (isEmail) {
            // Direct email login
            return await signInWithEmailAndPassword(this.auth, identifier, password);
        } else {
            // Phone number login - use synthetic email directly
            // This avoids an unauthenticated Firestore read to lookup by phone
            const email = getSyntheticEmail(identifier);
            return await signInWithEmailAndPassword(this.auth, email, password);
        }
    }

    /**
     * Register with phone number (for mobile apps)
     * Creates a synthetic email
     */
    async registerWithPhone(phone: string, password: string, name: string, extraData?: any) {
        const syntheticEmail = getSyntheticEmail(phone);
        const normalizedPhone = normalizePhone(phone);

        return await this.register(syntheticEmail, password, name, {
            ...extraData,
            phone: normalizedPhone,
            authMethod: 'phone'
        });
    }

    async getCurrentUser(): Promise<UserProfile | null> {
        return new Promise(resolve => {
            const unsub = onAuthStateChanged(this.auth, async (user) => {
                unsub();
                if (user) {
                    const snap = await getDoc(doc(this.db, 'users', user.uid));
                    if (snap.exists()) {
                        const userData = snap.data() as UserProfile;
                        // Merge Customer data if exists
                        if (userData.linkedCustomerId) {
                            const custSnap = await getDoc(doc(this.db, 'customers', userData.linkedCustomerId));
                            if (custSnap.exists()) {
                                const custData = custSnap.data();
                                resolve({ ...userData, ...custData, uid: user.uid }); // UID from auth
                                return;
                            }
                        }
                        resolve(userData);
                    }
                    else resolve({ uid: user.uid, email: user.email!, name: user.displayName || '', role: 'customer', status: 'APPROVED', hasPin: false });
                } else {
                    resolve(null);
                }
            });
        });
    }

    subscribeToAuth(callback: (user: UserProfile | null) => void) {
        return onAuthStateChanged(this.auth, async (user) => {
            if (user) {
                try {
                    const snap = await getDoc(doc(this.db, 'users', user.uid));
                    if (snap.exists()) {
                        const userData = snap.data() as UserProfile;
                        // Merge Customer data if exists
                        if (userData.linkedCustomerId) {
                            const custSnap = await getDoc(doc(this.db, 'customers', userData.linkedCustomerId));
                            if (custSnap.exists()) {
                                const custData = custSnap.data();
                                callback({ ...userData, ...custData, uid: user.uid });
                                return;
                            }
                        }
                        callback(userData);
                    } else {
                        callback({ uid: user.uid, email: user.email!, name: user.displayName || '', role: 'customer', status: 'APPROVED', hasPin: false });
                    }
                } catch (e) {
                    console.error("Auth subscription error", e);
                    callback(null);
                }
            } else {
                callback(null);
            }
        });
    }

    // ==================== OTP AUTHENTICATION ====================

    /**
     * Request OTP code for phone number
     * Code will be stored in Firebase (check console or use getOTP to retrieve)
     */
    async requestOTP(phone: string, purpose: 'SIGNUP' | 'LOGIN' = 'LOGIN') {
        return await this.otpService.requestOTP(phone, purpose);
    }

    /**
     * Get OTP code (for development/testing - view in Firebase Console)
     */
    async getOTP(phone: string) {
        return await this.otpService.getOTP(phone);
    }

    /**
     * Signup with OTP (passwordless)
     */
    async signupWithOTP(phone: string, code: string, name: string, extraData?: any) {
        // 1. Verify OTP
        const verification = await this.otpService.verifyOTP(phone, code);

        if (!verification.success) {
            throw new Error(verification.message);
        }

        // 2. Generate synthetic email and status
        const normalizedPhone = normalizePhone(phone);
        const syntheticEmail = getSyntheticEmail(normalizedPhone);
        const finalPassword = extraData?.password || Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);

        try {
            // 3. Create Firebase Auth user
            // If phone already exists, Firebase will throw 'auth/email-already-in-use'
            const res = await createUserWithEmailAndPassword(this.auth, syntheticEmail, finalPassword);
            await updateProfile(res.user, { displayName: name });

            // 4. Create Profile (using centralized logic)
            await this.createProfile(res.user, name, {
                ...extraData,
                phone: normalizedPhone,
                password: finalPassword,
                authMethod: 'phone',
                role: extraData?.role || 'customer'
            });

            return res.user;
        } catch (error: any) {
            // If email already in use, it means the phone exists
            if (error.code === 'auth/email-already-in-use') {
                throw new Error('An account with this phone number already exists. Please log in instead.');
            }
            throw error;
        }
    }

    /**
     * Login with OTP (passwordless)
     */
    async loginWithOTP(phone: string, code: string) {
        // 1. Verify OTP
        const verification = await this.otpService.verifyOTP(phone, code);

        if (!verification.success) {
            throw new Error(verification.message);
        }

        // 2. Lookup user by phone
        const normalizedPhone = normalizePhone(phone);
        const email = await this.lookupUserByPhone(normalizedPhone);

        if (!email) {
            throw new Error('No account found with this phone number. Please sign up first.');
        }

        // 3. Get user document to retrieve password (or use custom token)
        // Since we don't store password, we'll use Firebase Admin SDK approach
        // For now, we'll throw an error and suggest using signupWithOTP for new users

        // ALTERNATIVE: Use Firebase Custom Token (requires backend)
        // For development, user should use the web login with synthetic email

        throw new Error('OTP Login requires Firebase Admin SDK. Please use the mobile app or contact support.');
    }
    /**
     * Reset password using OTP (Client-side Dev Mode)
     * This avoids using Cloud Functions by leveraging stored passwords in Firestore
     */
    async resetPasswordWithOTP(phone: string, code: string, newPassword: string) {
        // 1. Verify OTP
        const verification = await this.otpService.verifyOTP(phone, code);
        if (!verification.success) {
            throw new Error(verification.message);
        }

        const normalizedPhone = normalizePhone(phone);

        // 2. Find user by phone to get their CURRENT password (dev mode)
        const usersRef = collection(this.db, 'users');
        const q = query(usersRef, where('phone', '==', normalizedPhone), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            throw new Error('No account found with this phone number');
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();
        const email = userData.email;
        const currentPin = userData.pin;

        if (!currentPin) {
            throw new Error('This account was not created with Dev Mode password storage. Cannot reset client-side.');
        }

        // 3. Sign in to get a fresh session
        const authResult = await signInWithEmailAndPassword(this.auth, email, currentPin);

        // 4. Update the real Firebase Auth password (using the hash as the password)
        const hashedNewPassword = await hashString(newPassword);
        await updatePassword(authResult.user, hashedNewPassword);

        // 5. Update the stored password in Firestore (using the hash)
        await updateDoc(userDoc.ref, {
            pin: hashedNewPassword,
            updatedAt: Date.now()
        });

        return { success: true, message: 'Password reset successfully' };
    }
}
