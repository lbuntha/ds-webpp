import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';

// 1. Setup Environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Polyfill for Client SDK in Node
const processEnv = process.env;
(global as any).import = {
    meta: {
        env: {
            VITE_FIREBASE_API_KEY: processEnv.VITE_FIREBASE_API_KEY || processEnv.FIREBASE_API_KEY,
            VITE_FIREBASE_AUTH_DOMAIN: processEnv.VITE_FIREBASE_AUTH_DOMAIN || processEnv.FIREBASE_AUTH_DOMAIN,
            VITE_FIREBASE_PROJECT_ID: processEnv.VITE_FIREBASE_PROJECT_ID || processEnv.FIREBASE_PROJECT_ID,
            VITE_FIREBASE_STORAGE_BUCKET: processEnv.VITE_FIREBASE_STORAGE_BUCKET || processEnv.FIREBASE_STORAGE_BUCKET,
            VITE_FIREBASE_MESSAGING_SENDER_ID: processEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || processEnv.FIREBASE_MESSAGING_SENDER_ID,
            VITE_FIREBASE_APP_ID: processEnv.VITE_FIREBASE_APP_ID || processEnv.FIREBASE_APP_ID,
            VITE_FIREBASE_MEASUREMENT_ID: processEnv.VITE_FIREBASE_MEASUREMENT_ID || processEnv.FIREBASE_MEASUREMENT_ID,
        }
    }
};

// Import services AFTER env setup
import { normalizePhone, getSyntheticEmail } from '../shared/utils/phoneUtils';

const DEFAULT_PIN = '123456';

// Re-implementing logic from MigrationPage.tsx for Node execution
async function runMigration() {
    console.log('Starting Migration Verification Script...');

    // 1. Initialize Firebase
    // We need to initialize it manually here because we are not using the app's main entry point
    const firebaseConfig = {
        apiKey: (global as any).import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: (global as any).import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: (global as any).import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: (global as any).import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: (global as any).import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: (global as any).import.meta.env.VITE_FIREBASE_APP_ID,
    };

    if (!getApps().length) {
        initializeApp(firebaseConfig);
    }

    const db = getFirestore();
    const auth = getAuth();

    // 2. Read users.json
    const jsonPath = path.resolve(__dirname, '../../users.json');
    if (!fs.existsSync(jsonPath)) {
        console.error('users.json not found!');
        process.exit(1);
    }

    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const users = JSON.parse(rawData);

    console.log(`Loaded ${users.length} users from users.json`);

    // Limit for testing?
    // const testUsers = users.slice(0, 10); 
    // console.log(`Processing first 10 users for safety...`);
    const testUsers = users.filter((u: any) => (u.user_name || u.phone) === '012222066');
    console.log(`Processing filtered users: ${testUsers.length}`);

    let success = 0;
    let failed = 0;
    let exists = 0;
    let skipped = 0;

    for (const user of testUsers) {
        const phone = user.user_name || user.phone || user.phoneNumber || '';
        const name = user.full_name || user.name || 'Unknown User';
        const mongoId = user._id;

        if (!phone) {
            skipped++;
            continue;
        }

        const normalizedPhone = normalizePhone(phone);
        const email = getSyntheticEmail(normalizedPhone);

        try {
            console.log(`Migrating: ${name} (${phone}) -> ${normalizedPhone}`);

            let uid;

            // Try to create user
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, DEFAULT_PIN);
                uid = userCredential.user.uid;
                await updateProfile(userCredential.user, { displayName: name });
                success++;
            } catch (authErr: any) {
                if (authErr.code === 'auth/email-already-in-use') {
                    // Attempt 1: Try to Sign In with Default PIN to get UID
                    try {
                        const signInCred = await signInWithEmailAndPassword(auth, email, DEFAULT_PIN);
                        uid = signInCred.user.uid;
                        exists++;
                        console.log(`  User exists (Signed in): ${uid}`);
                    } catch (signInErr) {
                        // Sign In failed
                        console.warn(`  User exists but Sign In failed:`, signInErr.message);
                        // In a script we can't easily query Firestore if rules prevent it without auth
                        // But if we are running locally with admin privileges or open rules...
                        // Actually the script is using Client SDK. 
                        // If we can't sign in, we can't proceed for this user unless we use Admin SDK.
                        // But let's assume valid users can sign in with default pin OR we skip.
                        failed++;
                        continue;
                    }
                } else {
                    console.error(`  Auth Error: ${authErr.message}`);
                    failed++;
                    continue;
                }
            }

            if (!uid) continue;

            // 2. Create/Update Firestore Profile
            const joinedAtVal = user.joinedAt || user.create_date || Date.now(); // Note: create_date from Mongo map
            const lastLoginVal = user.lastLogin || Date.now();

            const userUpdates: any = {
                uid: uid,
                name: name,
                email: email,
                phone: normalizedPhone,
                role: 'customer',
                status: 'APPROVED',
                authMethod: 'phone',
                joinedAt: joinedAtVal,
                lastLogin: lastLoginVal,
                mongoId: mongoId,
                address: user.address_line || '',
                hasPin: true,
                created_date: new Date(joinedAtVal),
                updated_date: new Date(),
            };

            if (user.photo) userUpdates.photo = user.photo;

            await setDoc(doc(db, 'users', uid), userUpdates, { merge: true });

            // 3. Create/Update Customer Profile
            let customerId;
            const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));

            if (!userSnap.empty) {
                customerId = userSnap.docs[0].data().linkedCustomerId;
            }

            if (!customerId) {
                const newCustomerRef = doc(collection(db, 'customers'));
                customerId = newCustomerRef.id;
                await setDoc(doc(db, 'users', uid), { linkedCustomerId: customerId }, { merge: true });
            }

            // Prepare Customer Data
            const customerUpdates: any = {
                id: customerId,
                name: name,
                email: email,
                phone: normalizedPhone,
                status: 'ACTIVE',
                linkedUserId: uid,
                createdAt: joinedAtVal,
                mongoId: mongoId,
                address: user.address_line || '',
                referralCode: user.referralCode || '',
            };

            if (user.photo) customerUpdates.photo = user.photo;

            // Map Bank Account Info
            // Mongo export structure: "bank_account": { "bank_name": "", ... }
            if (user.bank_account && (user.bank_account.bank_name || user.bank_account.account_number_USD || user.bank_account.account_number_KHR)) {
                customerUpdates.bankAccounts = [{
                    id: 'default',
                    bankName: user.bank_account.bank_name || 'Unknown Bank',
                    accountName: user.bank_account.account_holder || name,
                    accountNumber: user.bank_account.account_number_USD || user.bank_account.account_number_KHR || '',
                    qrCode: ''
                }];
            }

            await setDoc(doc(db, 'customers', customerId), customerUpdates, { merge: true });
        } catch (err: any) {
            console.error(`  Migration Error for ${name}:`, err.message);
            failed++;
        }
    }

    console.log('\nMigration Summary:');
    console.log(`Total: ${users.length}`);
    console.log(`Success (New): ${success}`);
    console.log(`Exists (Updated): ${exists}`);
    console.log(`Failed: ${failed}`);
    console.log(`Skipped: ${skipped}`);

    process.exit(0);
}

runMigration().catch(e => {
    console.error(e);
    process.exit(1);
});
