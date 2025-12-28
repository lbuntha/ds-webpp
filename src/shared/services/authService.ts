
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, updatePassword } from 'firebase/auth';
import { Firestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { UserProfile } from '../types';
import { OTPService } from './otpService';

export class AuthService {
    private otpService: OTPService;

    constructor(private auth: Auth, private db: Firestore) {
        this.otpService = new OTPService(db);
    }

    async login(email: string, pass: string) { await signInWithEmailAndPassword(this.auth, email, pass); }

    async sendRegistrationLink(email: string, userData: any) {
        const actionCodeSettings = {
            url: window.location.origin + '/auth/verify',
            handleCodeInApp: true,
        };

        await sendSignInLinkToEmail(this.auth, email, actionCodeSettings);

        window.localStorage.setItem('registration_email', email);
        window.localStorage.setItem('registration_data', JSON.stringify(userData));
    }

    isEmailLink(url: string) {
        return isSignInWithEmailLink(this.auth, url);
    }

    async completeRegistrationWithLink(email: string, pass: string) {
        const res = await signInWithEmailLink(this.auth, email, window.location.href);

        if (res.user) {
            await updatePassword(res.user, pass);
        }

        const storedData = window.localStorage.getItem('registration_data');
        if (!storedData) throw new Error("Registration data not found. Please start over.");

        const extraData = JSON.parse(storedData);
        const name = extraData.name;

        await updateProfile(res.user, { displayName: name });

        let linkedCustomerId = null;
        const role = extraData?.role || 'customer';

        if (role === 'customer') {
            const newCustomerRef = doc(collection(this.db, 'customers'));
            linkedCustomerId = newCustomerRef.id;

            const customerData = {
                id: linkedCustomerId,
                name: name,
                email: email,
                phone: extraData.phone || '',
                status: 'ACTIVE',
                linkedUserId: res.user.uid,
                createdAt: Date.now(),
                bankAccounts: [],
                address: ''
            };

            await setDoc(newCustomerRef, customerData);
        }

        const userProfile: UserProfile = {
            uid: res.user.uid,
            email: res.user.email!,
            name: name,
            role: role,
            status: role === 'customer' ? 'APPROVED' : 'PENDING',
            linkedCustomerId: linkedCustomerId || undefined,
            ...extraData
        };

        await setDoc(doc(this.db, 'users', res.user.uid), userProfile);

        window.localStorage.removeItem('registration_email');
        window.localStorage.removeItem('registration_data');
    }

    async register(email: string, pass: string, name: string, extraData?: any) {
        const res = await createUserWithEmailAndPassword(this.auth, email, pass);
        await updateProfile(res.user, { displayName: name });

        let linkedCustomerId = null;
        const role = extraData?.role || 'customer';

        // If user is a customer, create a corresponding Customer record in CRM
        if (role === 'customer') {
            const newCustomerRef = doc(collection(this.db, 'customers'));
            linkedCustomerId = newCustomerRef.id;

            const customerData = {
                id: linkedCustomerId,
                name: name,
                email: email,
                phone: extraData.phone || '',
                status: 'ACTIVE',
                linkedUserId: res.user.uid,
                createdAt: Date.now(),
                // Default empty banks
                bankAccounts: [],
                address: ''
            };

            await setDoc(newCustomerRef, customerData);
        }

        const userProfile: UserProfile = {
            uid: res.user.uid,
            email: res.user.email!,
            name: name,
            role: role,
            // Auto-approve customers, keep others pending for admin review
            status: role === 'customer' ? 'APPROVED' : 'PENDING',
            linkedCustomerId: linkedCustomerId || undefined,
            ...extraData
        };

        await setDoc(doc(this.db, 'users', res.user.uid), userProfile);
    }

    async logout() { await signOut(this.auth); }
    async resetPassword(email: string) { await sendPasswordResetEmail(this.auth, email); }

    /**
     * Lookup user by phone number
     * Returns the email associated with the phone number
     */
    async lookupUserByPhone(phone: string): Promise<string | null> {
        const normalizedPhone = phone.replace(/\s+/g, ''); // Remove spaces

        // Query users collection for matching phone
        const usersRef = collection(this.db, 'users');
        const q = query(usersRef, where('phone', '==', normalizedPhone));
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
            // Phone number login - lookup email first
            const email = await this.lookupUserByPhone(identifier);

            if (!email) {
                throw new Error('No account found with this phone number');
            }

            return await signInWithEmailAndPassword(this.auth, email, password);
        }
    }

    /**
     * Register with phone number (for mobile apps)
     * Creates a synthetic email: {phone}@sms.yourapp.com
     */
    async registerWithPhone(phone: string, password: string, name: string, extraData?: any) {
        const normalizedPhone = phone.replace(/\s+/g, ''); // Remove spaces

        // Check if phone already exists
        const existingEmail = await this.lookupUserByPhone(normalizedPhone);
        if (existingEmail) {
            throw new Error('An account with this phone number already exists');
        }

        // Generate synthetic email
        const syntheticEmail = `${normalizedPhone}@sms.yourapp.com`;

        // Use standard register flow with synthetic email
        await this.register(syntheticEmail, password, name, {
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
                    if (snap.exists()) resolve(snap.data() as UserProfile);
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
                        callback(snap.data() as UserProfile);
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

        // 2. Check if phone already exists
        const normalizedPhone = phone.replace(/\s+/g, '');
        const existingEmail = await this.lookupUserByPhone(normalizedPhone);
        if (existingEmail) {
            throw new Error('An account with this phone number already exists');
        }

        // 3. Generate synthetic email and random password
        const syntheticEmail = `${normalizedPhone}@sms.yourapp.com`;
        const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12); // 24 char random

        // 4. Create Firebase Auth user
        const res = await createUserWithEmailAndPassword(this.auth, syntheticEmail, randomPassword);
        await updateProfile(res.user, { displayName: name });

        let linkedCustomerId = null;
        const role = extraData?.role || 'customer';

        // 5. Create Customer record if customer role
        if (role === 'customer') {
            const newCustomerRef = doc(collection(this.db, 'customers'));
            linkedCustomerId = newCustomerRef.id;

            const customerData = {
                id: linkedCustomerId,
                name: name,
                email: syntheticEmail,
                phone: normalizedPhone,
                status: 'ACTIVE',
                linkedUserId: res.user.uid,
                createdAt: Date.now(),
                bankAccounts: [],
                address: '',
                type: 'INDIVIDUAL'
            };

            await setDoc(newCustomerRef, customerData);
        }

        // 6. Create User Profile
        const userProfile: UserProfile = {
            uid: res.user.uid,
            email: syntheticEmail,
            name: name,
            role: role,
            status: role === 'customer' ? 'APPROVED' : 'PENDING',
            linkedCustomerId: linkedCustomerId || undefined,
            phone: normalizedPhone,
            ...extraData
        };

        await setDoc(doc(this.db, 'users', res.user.uid), userProfile);

        return res.user;
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
        const normalizedPhone = phone.replace(/\s+/g, '');
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
}
