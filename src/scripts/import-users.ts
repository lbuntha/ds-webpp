import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// 1. Setup Environment specifically for Node.js execution
// We need to do this BEFORE importing any app code that relies on env.ts
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env variables
const envPath = path.resolve(__dirname, '../../.env');
const envLocalPath = path.resolve(__dirname, '../../.env.local');

console.log(`Loading .env from: ${envPath}`);
const result = dotenv.config({ path: envPath });
if (result.error) {
    console.error('Error loading .env:', result.error);
}

if (fs.existsSync(envLocalPath)) {
    console.log(`Loading .env.local from: ${envLocalPath}`);
    dotenv.config({ path: envLocalPath, override: true });
}

// Debug what keys we have
console.log('Environment loaded check:');
console.log('FIREBASE_API_KEY:', process.env.FIREBASE_API_KEY ? 'Present' : 'Missing');
console.log('VITE_FIREBASE_API_KEY:', process.env.VITE_FIREBASE_API_KEY ? 'Present' : 'Missing');

// Polyfill import.meta.env for the app's configuration
// This is a hack to make the Vite-based env.ts work in Node.js
const processEnv = process.env;
(global as any).import = {
    meta: {
        env: {
            ...processEnv,
            // Map standard env vars to what env.ts might expect if they aren't prefixed
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

interface UserRecord {
    phone: string;
    name: string;
    role: string;
}

// Default PIN
const DEFAULT_PIN = '123456';

async function importUsers() {
    // Dynamic import to ensure env vars are loaded first
    const { firebaseService } = await import('../shared/services/firebaseService');

    const csvPath = path.resolve(__dirname, '../../users.csv');


    if (!fs.existsSync(csvPath)) {
        console.error(`Error: users.csv not found at ${csvPath}`);
        console.log('Please create a users.csv file with headers: phone,name,role');
        process.exit(1);
    }

    console.log(`Reading users from ${csvPath}...`);
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n');

    // Parse CSV
    const headers = lines[0].trim().split(',').map(h => h.trim().toLowerCase());
    const phoneIdx = headers.indexOf('phone');
    const nameIdx = headers.indexOf('name');
    const roleIdx = headers.indexOf('role');

    if (phoneIdx === -1 || nameIdx === -1) {
        console.error('Error: CSV must contain "phone" and "name" columns');
        process.exit(1);
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(',').map(c => c.trim());
        const phone = cols[phoneIdx];
        const name = cols[nameIdx];
        const role = roleIdx !== -1 ? cols[roleIdx] : 'customer';

        if (!phone || !name) {
            console.warn(`Skipping line ${i + 1}: Missing phone or name`);
            continue;
        }

        try {
            console.log(`Processing ${name} (${phone})...`);

            // Register using the service
            // Note: registerWithPhone uses register() internally which creates the Auth user and Profile
            // We pass the default PIN as the password
            await firebaseService.registerWithPhone(phone, DEFAULT_PIN, name, {
                role: role.toLowerCase(),
                address: '', // Optional default
                referralCode: ''
            });

            console.log(`✅ created successfully`);
            successCount++;
        } catch (error: any) {
            if (error.message && error.message.includes('already exists')) {
                console.log(`⚠️  User ${phone} already exists. Skipping.`);
            } else {
                console.error(`❌ Failed to create ${name}:`, error.message);
            }
            failCount++;
        }
    }

    console.log('\n-----------------------------------');
    console.log(`Import Complete: ${successCount} created, ${failCount} failed/skipped`);
    console.log('-----------------------------------');

    // Force exit as Firebase connection might keep process alive
    process.exit(0);
}

// Run
importUsers().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
