import { Auth, getAuth, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, updatePassword, signInWithPopup } from 'firebase/auth';
import { Firestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { UserProfile } from '../types';
import { OTPService } from './otpService';
import { normalizePhone, getSyntheticEmail } from '../utils/phoneUtils';
import { hashString } from '../utils/cryptoUtils';
import { env } from '../../config/env';

export class AuthService {
    private otpService: OTPService;

    constructor(private auth: Auth, private db: Firestore) {
        this.otpService = new OTPService(db);
    }

    async login(email: string, pass: string) { await signInWithEmailAndPassword(this.auth, email, pass); }

    private async callApi(path: string, method: string, body: any, authenticate: boolean = false) {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        if (authenticate && this.auth.currentUser) {
            const token = await this.auth.currentUser.getIdToken();
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${env.app.apiUrl}${path}`, {
            method,
            headers,
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'API request failed');
        }
        return data;
    }

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

        // 2. Prepare User Profile (saved to 'users' collection)
        // Note: Password is handled by Firebase Auth, not stored in Firestore
        const userProfile: UserProfile = {
            uid: user.uid,
            email: user.email!,
            name: name,
            role: role,
            status: role === 'customer' ? 'APPROVED' : 'PENDING',
            linkedCustomerId: linkedCustomerId,
            lastLogin: now,
            authMethod: extraData.authMethod || 'email',
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

    async resetPassword(email: string) {
        const actionCodeSettings = {
            url: window.location.origin + '/auth/action',
            handleCodeInApp: true,
        };
        await sendPasswordResetEmail(this.auth, email, actionCodeSettings);
    }

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
    // Note: Password/PIN is now handled entirely by Firebase Auth
    // Use loginWithEmailOrPhone() for verification

    /**
     * Reset PIN via cloud function API (with server-side OTP verification)
     */
    async resetPINWithOTP(phone: string, otp: string, newPin: string): Promise<{ success: boolean; message: string }> {
        try {
            const data = await this.callApi('/auth/reset-password-otp', 'POST', {
                phone,
                otp,
                newPassword: newPin
            });
            return { success: true, message: data.message || 'PIN reset successfully' };
        } catch (error: any) {
            console.error('[PIN RESET] API Error:', error);
            return { success: false, message: error.message || 'Failed to reset PIN' };
        }
    }

    /**
     * Lookup user by phone number
     * Returns the email associated with the phone number
     */
    async lookupUserByPhone(phone: string): Promise<string | null> {
        const normalizedPhone = normalizePhone(phone);
        const usersRef = collection(this.db, 'users');
        const q = query(usersRef, where('phone', '==', normalizedPhone), limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data() as UserProfile;
        return userData.email;
    }

    /**
     * Login with either email or phone number
     * Uses Firebase Auth for verification
     */
    async loginWithEmailOrPhone(identifier: string, password: string) {
        const isEmail = identifier.includes('@');

        if (isEmail) {
            // Email login - standard Firebase Auth
            return await signInWithEmailAndPassword(this.auth, identifier, password);
        } else {
            // Phone login - use synthetic email with Firebase Auth
            const normalizedPhone = normalizePhone(identifier);
            const syntheticEmail = getSyntheticEmail(normalizedPhone);

            try {
                // Verify password directly through Firebase Auth
                return await signInWithEmailAndPassword(this.auth, syntheticEmail, password);
            } catch (authError: any) {
                if (authError.code === 'auth/user-not-found') {
                    throw new Error('No account found with this phone number');
                }
                if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
                    throw new Error('Invalid PIN');
                }
                throw authError;
            }
        }
    }

    /**
     * Register with phone number
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
                        if (userData.linkedCustomerId) {
                            const custSnap = await getDoc(doc(this.db, 'customers', userData.linkedCustomerId));
                            if (custSnap.exists()) {
                                resolve({ ...userData, ...custSnap.data(), uid: user.uid } as UserProfile);
                                return;
                            }
                        }
                        resolve(userData as UserProfile);
                    }
                    else resolve({ uid: user.uid, email: user.email!, name: user.displayName || '', role: 'customer', status: 'APPROVED' });
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
                        if (userData.linkedCustomerId) {
                            const custSnap = await getDoc(doc(this.db, 'customers', userData.linkedCustomerId));
                            if (custSnap.exists()) {
                                callback({ ...userData, ...custSnap.data(), uid: user.uid } as UserProfile);
                                return;
                            }
                        }
                        callback(userData as UserProfile);
                    } else {
                        callback({ uid: user.uid, email: user.email!, name: user.displayName || '', role: 'customer', status: 'APPROVED' });
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

    /**
     * OTP Management via Cloud Function API
     */
    async requestOTP(phone: string, purpose: 'SIGNUP' | 'LOGIN' | 'RESET' = 'LOGIN'): Promise<{ success: boolean; message: string }> {
        try {
            const data = await this.callApi('/auth/request-otp', 'POST', { phone, purpose });
            return { success: true, message: data.message || 'OTP sent successfully' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Failed to send OTP' };
        }
    }

    async verifyOTP(phone: string, code: string): Promise<{ success: boolean; message: string }> {
        try {
            const data = await this.callApi('/auth/verify-otp', 'POST', { phone, otp: code });
            return { success: true, message: data.message || 'OTP verified' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Invalid OTP' };
        }
    }

    async getOTP(phone: string) {
        // Dev-only: Fetch OTP from Firestore for testing
        return await this.otpService.getOTP(phone);
    }

    /**
     * Signup with phone number and OTP verification via cloud API
     */
    async signupWithOTP(phone: string, code: string, name: string, extraData?: any) {
        // 1. Verify OTP via cloud API
        const verifyResult = await this.verifyOTP(phone, code);
        if (!verifyResult.success) {
            throw new Error(verifyResult.message);
        }

        // 2. Create account
        const normalizedPhone = normalizePhone(phone);
        const syntheticEmail = getSyntheticEmail(normalizedPhone);
        const finalPassword = extraData?.password || Math.random().toString(36).slice(-12);

        try {
            const res = await createUserWithEmailAndPassword(this.auth, syntheticEmail, finalPassword);
            await updateProfile(res.user, { displayName: name });
            await this.createProfile(res.user, name, {
                ...extraData,
                phone: normalizedPhone,
                password: finalPassword,
                authMethod: 'phone',
                role: extraData?.role || 'customer'
            });
            return res.user;
        } catch (error: any) {
            if (error.code === 'auth/email-already-in-use') {
                throw new Error('An account with this phone number already exists.');
            }
            throw error;
        }
    }
}
