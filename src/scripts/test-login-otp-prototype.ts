import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc } from 'firebase/firestore';
import fetch from 'node-fetch';

// Load env vars
const API_URL = process.env.VITE_API_URL || 'http://127.0.0.1:5001/doorstep-delivery-2ad27/us-central1/api';

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Use Emulators if configured (optional, but good for local dev)
// if (process.env.VITE_USE_EMULATORS === 'true') {
//     connectAuthEmulator(auth, 'http://127.0.0.1:9099');
//     connectFirestoreEmulator(db, '127.0.0.1', 8080);
// }

async function testLoginOTP() {
    const testPhone = '012888999';
    const testOtp = '123456';
    const normalizedPhone = '85512888999'; // Assuming normalize logic
    // Actually our backend logic is just .replace(/\D/g, '') -> '012888999'
    // Wait, the backend uses `phone.replace(/\D/g, '')`.
    // If I send '012 888 999', it becomes '012888999'.

    // 1. Setup Data directly in Firestore (Admin SDK would be better but I don't have it initialized here easily with credentials)
    // Actually, I can't write to OTP collection easily from client SDK without admin privileges if rules block it.
    // But I can use the requestOTP endpoint!

    console.log(`1. Requesting OTP for ${testPhone}...`);
    try {
        const reqRes = await fetch(`${API_URL}/auth/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: testPhone, purpose: 'LOGIN' })
        });
        const reqData = await reqRes.json();
        console.log('Request OTP Result:', reqData);

        if (!reqRes.ok) throw new Error(reqData.message);

        // 2. We need the OTP code. In dev mode, maybe I can find it?
        // Or I can just simulate the backend state if I had admin access.
        // Since I can't easily get the OTP code (it's random),
        // I will use `view_file` tool to inspect the `otp_codes` collection if I fail to get it.
        // BUT, I can try to use a known test number if the system supports it.
        // The backend `testSMS` might help? No.

        // Wait, if I am running locally with emulators, I can inspect Firestore.
        // But the user is running `npm run dev` which might be using live Firebase dev project.
        // Let's assume I need to get the real Code.

        // ALTERNATIVE: Use a hardcoded OTP if I can modify backend?
        // No.

        // Let's check `auth.controller.ts` again.
        // It saves to `otp_codes` collection.
        // Use `admin` SDK in this script to read it!
        // I have `service-account.json` or I can rely on `gcloud` auth?
        // The previous `migrate-mongo-comprehensive.ts` used `firebase-admin`.
        // I can copy the setup from there.

    } catch (e) {
        console.error(e);
    }
}

// testLoginOTP();
