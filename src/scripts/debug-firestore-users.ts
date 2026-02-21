import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';

// 1. Setup Environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env variables
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Polyfill import.meta.env
const processEnv = process.env;
(global as any).import = {
    meta: {
        env: {
            ...processEnv,
            VITE_FIREBASE_API_KEY: processEnv.VITE_FIREBASE_API_KEY || processEnv.FIREBASE_API_KEY,
            VITE_FIREBASE_AUTH_DOMAIN: processEnv.VITE_FIREBASE_AUTH_DOMAIN || processEnv.FIREBASE_AUTH_DOMAIN,
            VITE_FIREBASE_PROJECT_ID: processEnv.VITE_FIREBASE_PROJECT_ID || processEnv.FIREBASE_PROJECT_ID,
        }
    }
};

async function debugFirestoreUsers() {
    const { firebaseService } = await import('../shared/services/firebaseService');
    const { db } = await import('../shared/services/firebaseInstance');

    // Login to gain access
    try {
        console.log('Logging in as 012222222...');
        await firebaseService.login('012222222', '123456');
        console.log('✅ Logged in successfully');
    } catch (e) {
        console.error('Failed to login:', e);
        return;
    }

    console.log('Fetching 5 random users from Firestore to check phone formats...');

    const { collection, getDocs, limit, query } = await import('firebase/firestore');
    const snapshot = await getDocs(query(collection(db, 'users'), limit(5)));

    if (snapshot.empty) {
        console.log('No users found in Firestore.');
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id}`);
        console.log(`  Name: ${data.name}`);
        console.log(`  Phone: '${data.phone}'`);
        console.log(`  Email: '${data.email}'`);
        console.log('-----------------------------------');
    });
}

debugFirestoreUsers().catch(console.error).finally(() => process.exit(0));
