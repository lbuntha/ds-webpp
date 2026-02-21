
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { normalizePhone } from '../shared/utils/phoneUtils';

// 1. Setup Environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env variables
const envPath = path.resolve(__dirname, '../../.env');
const envLocalPath = path.resolve(__dirname, '../../.env.local');

console.log(`Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });

if (fs.existsSync(envLocalPath)) {
    console.log(`Loading .env.local from: ${envLocalPath}`);
    dotenv.config({ path: envLocalPath, override: true });
}

// Polyfill import.meta.env
const processEnv = process.env;
(global as any).import = {
    meta: {
        env: {
            ...processEnv,
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

async function checkUser() {
    // Dynamic import to avoid early validation
    const { db } = await import('../shared/services/firebaseInstance');

    const rawPhone = '081906500';
    const normalized = normalizePhone(rawPhone);
    console.log(`Checking for phone: ${rawPhone} (Normalized: ${normalized})`);

    const usersRef = collection(db, 'users');

    // Check 1: Normalized
    console.log('--- Query 1: Normalized ---');
    const q1 = query(usersRef, where('phone', '==', normalized));
    const snap1 = await getDocs(q1);
    snap1.forEach(d => console.log(`FOUND (Normalized): ${d.id} =>`, JSON.stringify(d.data(), null, 2)));
    if (snap1.empty) console.log('No user found with normalized phone.');

    // Check 2: +855 format
    const globalPhone = '+855' + normalized;
    console.log(`--- Query 2: Global (${globalPhone}) ---`);
    const q2 = query(usersRef, where('phone', '==', globalPhone));
    const snap2 = await getDocs(q2);
    snap2.forEach(d => console.log(`FOUND (Global): ${d.id} =>`, JSON.stringify(d.data(), null, 2)));
    if (snap2.empty) console.log('No user found with global phone.');

    // Check 3: Raw
    console.log(`--- Query 3: Raw (${rawPhone}) ---`);
    const q3 = query(usersRef, where('phone', '==', rawPhone));
    const snap3 = await getDocs(q3);
    snap3.forEach(d => console.log(`FOUND (Raw): ${d.id} =>`, JSON.stringify(d.data(), null, 2)));
    if (snap3.empty) console.log('No user found with raw phone.');
}

checkUser().then(() => process.exit());
