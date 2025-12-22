
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, updatePassword } from 'firebase/auth';
import { Firestore, doc, getDoc, setDoc, updateDoc, collection } from 'firebase/firestore';
import { UserProfile } from '../types';

export class AuthService {
    constructor(private auth: Auth, private db: Firestore) { }

    async login(email: string, pass: string) { await signInWithEmailAndPassword(this.auth, email, pass); }

    async sendRegistrationLink(email: string, userData: any) {
        const actionCodeSettings = {
            // URL you want to redirect back to. The domain (www.example.com) for this
            // URL must be whitelisted in the Firebase Console.
            url: window.location.origin + '/auth/verify',
            // This must be true.
            handleCodeInApp: true,
        };

        await sendSignInLinkToEmail(this.auth, email, actionCodeSettings);

        // Save data for later
        window.localStorage.setItem('registration_email', email);
        window.localStorage.setItem('registration_data', JSON.stringify(userData));
    }

    isEmailLink(url: string) {
        return isSignInWithEmailLink(this.auth, url);
    }

    async completeRegistrationWithLink(email: string, pass: string) {
        const res = await signInWithEmailLink(this.auth, email, window.location.href);

        // Update password (email link sign in doesn't require password, but we want one)
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

        // Cleanup
        window.localStorage.removeItem('registration_email');
        window.localStorage.removeItem('registration_data');
    }

    async register(email: string, pass: string, name: string, extraData?: any) {
        // Keep original register for fallback or admin use, but it's now bypassed by the link flow in UI
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
}
