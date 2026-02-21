import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

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

async function verifyUser() {
    console.log('Verifying Firestore User...');

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
    const phone = '012222066'; // SAM OL UCH
    const email = '012222066@doorsteps.tech'; // Synthetic email
    const pin = '123456';

    console.log(`Signing in as ${email}...`);
    try {
        await signInWithEmailAndPassword(auth, email, pin);
        console.log('✅ Signed in successfully');
    } catch (e: any) {
        console.error('❌ Sign in failed:', e.message);
        process.exit(1);
    }


    console.log(`Querying for phone: ${phone}`);

    // 1. Check Users Collection
    const usersRef = collection(db, 'users');
    const qUser = query(usersRef, where('phone', '==', phone));
    const userSnap = await getDocs(qUser);

    if (userSnap.empty) {
        console.log('❌ User NOT found in "users" collection');
    } else {
        console.log('✅ User FOUND in "users" collection:');
        userSnap.forEach(doc => {
            console.log(JSON.stringify(doc.data(), null, 2));
        });
    }

    // 2. Check Customers Collection
    const customersRef = collection(db, 'customers');
    const qCustomer = query(customersRef, where('phone', '==', phone));
    const custSnap = await getDocs(qCustomer);

    if (custSnap.empty) {
        console.log('❌ Customer NOT found in "customers" collection');
    } else {
        console.log('✅ Customer FOUND in "customers" collection:');
        custSnap.forEach(doc => {
            console.log(JSON.stringify(doc.data(), null, 2));
        });
    }

    process.exit(0);
}

verifyUser().catch(console.error);
