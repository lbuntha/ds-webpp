import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, deleteDoc } from 'firebase/firestore';

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

async function cleanupMigrationTest() {
    console.log('Starting Cleanup of Test User...');

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

    const auth = getAuth();
    const db = getFirestore();

    const email = '012222066@doorsteps.tech'; // SAM OL UCH
    const pin = '123456';

    console.log(`Signing in as ${email}...`);
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pin);
        const user = userCredential.user;
        console.log(`✅ Signed in. UID: ${user.uid}`);

        // 1. Get User Profile to find Linked Customer
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            const linkedCustomerId = userData.linkedCustomerId;

            // 2. Delete Customer
            if (linkedCustomerId) {
                console.log(`Deleting Customer ${linkedCustomerId}...`);
                await deleteDoc(doc(db, 'customers', linkedCustomerId));
                console.log('✅ Customer deleted');
            }

            // 3. Delete User Profile
            console.log(`Deleting User Profile ${user.uid}...`);
            await deleteDoc(userRef);
            console.log('✅ User Profile deleted');
        } else {
            console.log('⚠️ User Profile not found in Firestore.');
        }

        // 4. Delete Auth User
        console.log('Deleting Auth User...');
        await deleteUser(user);
        console.log('✅ Auth User deleted');

    } catch (e: any) {
        if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
            console.log('⚠️ User not found or invalid credentials. Already deleted?');
        } else {
            console.error('❌ Error during cleanup:', e.message);
            process.exit(1);
        }
    }

    console.log('Cleanup Complete.');
    process.exit(0);
}

cleanupMigrationTest().catch(console.error);
