import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import { doc, updateDoc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

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

const MONGO_URI = 'mongodb://dsUserAdmin:Edcc%4005061990@128.199.152.138:27017/?authSource=admin';
const TARGET_COLLECTION = 'user'; // Confirmed collection name
const DEFAULT_PIN = '123456';
const MIGRATION_LIMIT = 2; // User requested top 2

async function migrateComprehensive() {
    // Dynamic import
    const { firebaseService } = await import('../shared/services/firebaseService');
    const { db } = await import('../shared/services/firebaseInstance');

    console.log('Connecting to MongoDB...');
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        // Database Discovery Phase
        const adminDb = client.db('admin');
        const dbs = await adminDb.admin().listDatabases();

        let dbName = 'doorstep';
        const foundDb = dbs.databases.find(db => db.name !== 'admin' && db.name !== 'local' && db.name !== 'config');
        if (foundDb) {
            console.log(`Using MongoDB database: ${foundDb.name}`);
            dbName = foundDb.name;
        }

        const mongoDb = client.db(dbName);
        const usersCollection = mongoDb.collection(TARGET_COLLECTION);

        // Query: Only Customers (type: 'User')
        const query = {
            // 'type' field in MongoDB seems to distinguish User vs Driver
            $or: [
                { type: 'User' },
                { type: 'user' },
                // If type is missing, we might assume customer? safely skipping for now
            ]
        };

        const totalCustomers = await usersCollection.countDocuments(query);
        console.log(`Found approximately ${totalCustomers} customers to migrate.`);
        console.log(`LIMITING TO ${MIGRATION_LIMIT} for this test run.`);

        // Fetch cursor
        const cursor = usersCollection.find(query).limit(MIGRATION_LIMIT);

        let successCount = 0;
        let failCount = 0;
        let existsCount = 0;

        while (await cursor.hasNext()) {
            const mongoDoc = await cursor.next();
            if (!mongoDoc) continue;

            // --- 1. Map Data ---
            const phone = mongoDoc.user_name || mongoDoc.phone || mongoDoc.phoneNumber || '';
            const name = mongoDoc.full_name || mongoDoc.name || 'Unknown User';
            const mongoId = mongoDoc._id.toString();

            if (!phone) {
                console.warn(`[SKIP] Missing phone for doc ${mongoId}`);
                continue;
            }

            console.log(`\nProcessing: ${name} (${phone})`);

            try {
                // --- 2. Register User (Creating Auth + Basic Profile) ---
                let isNew = false;

                // Variable to store UID if found during login/registration
                let foundUid: string | null = null;
                let foundUser: any = null;

                try {
                    // Try to register
                    const regResult = await firebaseService.registerWithPhone(phone, DEFAULT_PIN, name, {
                        role: 'customer',
                        address: mongoDoc.address_line || '',
                        referralCode: mongoDoc.referralCode || ''
                    });

                    if (regResult && regResult.uid) {
                        foundUid = regResult.uid;
                        foundUser = regResult;
                    }

                    isNew = true;
                    console.log(`   -> Created new user`);

                    // Login to ensure we have permission to update (register signs in automatically usually, but let's be safe)
                    // Actually registerWithPhone in authService does NOT automatically sign in the user in the returned state context of this script?
                    // The script runs in Node, auth state is global.
                    // Let's assume register signs in.

                } catch (e: any) {
                    // Check for both email-in-use and phone-number-exists errors
                    if (e.message && (e.message.includes('email-already-in-use') || e.message.includes('auth/email-already-in-use'))) {
                        console.log(`   -> User already exists. Attempting login to update profile...`);
                        existsCount++;

                        try {
                            // Try to login with default PIN to gain permission to update
                            const loginResult = await firebaseService.login(phone, DEFAULT_PIN);
                            if (loginResult && loginResult.user) {
                                foundUid = loginResult.user.uid;
                                console.log(`   -> Logged in successfully. UID: ${foundUid}`);
                            } else {
                                console.warn(`   [WARN] Login successful but no user object returned.`);
                            }
                        } catch (loginErr: any) {
                            console.warn(`   [WARN] Could not login as user (PIN changed?): ${loginErr.message}`);
                            console.warn(`   [SKIP] Skipping update for this user.`);
                            continue;
                        }

                    } else {
                        // unexpected error
                        throw e;
                    }
                }

                // Look up the UID from Firestore based on phone
                const { collection, query, where, getDocs, doc: firestoreDoc } = await import('firebase/firestore');

                const usersRef = collection(db, 'users');
                let userDoc = null;
                let uid = foundUid;

                // 1. If we have UID from login/register, use it directly! (Most reliable)
                if (uid) {
                    console.log(`   -> Fetching profile using UID: ${uid}`);
                    const directSnap = await getDoc(firestoreDoc(db, 'users', uid));
                    if (directSnap.exists()) {
                        userDoc = directSnap;
                    } else {
                        console.warn(`   [WARN] User exists in Auth but not in 'users' collection? creating/syncing...`);
                        // Logic to create if missing could go here, but for now we fallback to search
                    }
                }

                // 2. Fallback to phone search if no UID or doc not found
                if (!userDoc) {
                    // ... (keep existing robust search logic as backup)
                    // Robust Phone Normalization Logic
                    // 1. Convert to +855 format (strip leading 0)
                    let phoneWithPrefix = phone;
                    if (phone.startsWith('0')) {
                        phoneWithPrefix = '+855' + phone.substring(1);
                    } else if (!phone.startsWith('+')) {
                        phoneWithPrefix = '+855' + phone;
                    }

                    // 2. Local format (0...)
                    let phoneLocal = phone;
                    if (phone.startsWith('+855')) {
                        phoneLocal = '0' + phone.substring(4);
                    } else if (!phone.startsWith('0')) {
                        phoneLocal = '0' + phone;
                    }

                    // 3. Raw format (stripped)
                    const phoneRaw = phone.replace(/\D/g, '');

                    console.log(`   Detailed Lookup for: ${phone}`);
                    console.log(`     - Prefix: ${phoneWithPrefix}`);
                    console.log(`     - Local:  ${phoneLocal}`);
                    console.log(`     - Raw:    ${phoneRaw}`);

                    // Based on debug output, phone numbers are stored as:
                    // '012666666' (standard local)
                    // '17555555' (local without leading zero)
                    // They are NOT consistently stored as +855

                    // Search Priority:
                    // 1. Exact match (phone from Mongo might be '012...' or '855...')
                    let q = query(usersRef, where('phone', '==', phone));
                    let userSnapshot = await getDocs(q);

                    // 2. Local format with leading zero (if input handles it differently)
                    if (userSnapshot.empty && !phone.startsWith('0')) {
                        const localZero = '0' + phone;
                        q = query(usersRef, where('phone', '==', localZero));
                        userSnapshot = await getDocs(q);
                    }

                    // 3. Normalized Global (+855) - just in case some are stored that way
                    if (userSnapshot.empty) {
                        q = query(usersRef, where('phone', '==', phoneWithPrefix));
                        userSnapshot = await getDocs(q);
                    }

                    // 4. Checking synthetic email
                    if (userSnapshot.empty) {
                        const syntheticEmail = `${phoneWithPrefix.replace(/\+/g, '')}@doorstep.app`;
                        console.log(`     - Checking synthetic email: ${syntheticEmail}`);
                        q = query(usersRef, where('email', '==', syntheticEmail));
                        userSnapshot = await getDocs(q);
                    }

                    if (userSnapshot.empty) {
                        // 5. Try by Name as fallback? No, risky. 
                        // Try raw digits?
                        if (phoneRaw !== phone) {
                            q = query(usersRef, where('phone', '==', phoneRaw));
                            userSnapshot = await getDocs(q);
                        }
                    }

                    if (!userSnapshot.empty) {
                        userDoc = userSnapshot.docs[0];
                        uid = userDoc.id;
                    }
                }

                if (!userDoc || !uid) {
                    console.warn(`   [WARN] Could not find Firestore profile for phone ${phone}. Skipping update.`);
                    continue;
                }

                const userData = userDoc.data();
                const customerId = userData.linkedCustomerId;

                console.log(`   -> Found UID: ${uid}, CustomerID: ${customerId || 'None'}`);

                // --- 3. Prepare Updates (Timestamps & Extra Fields) ---
                const joinedAtVal = mongoDoc.joinedAt || mongoDoc.createdAt || Date.now();
                const lastLoginVal = mongoDoc.lastLogin || Date.now();

                // Fields to update in 'users/{uid}'
                const userUpdates: any = {
                    joinedAt: joinedAtVal,
                    lastLogin: lastLoginVal,
                    isOnline: !!mongoDoc.isOnline,
                    mongoId: mongoId
                };

                if (mongoDoc.photo) userUpdates.photo = mongoDoc.photo;

                // Fields to update in 'customers/{customerId}'
                if (customerId) {
                    const customerUpdates: any = {
                        createdAt: joinedAtVal, // Match join date
                        mongoId: mongoId
                    };

                    if (mongoDoc.photo) customerUpdates.photo = mongoDoc.photo;

                    // Location Data
                    if (mongoDoc.lastLocation && mongoDoc.lastLocation.latitude && mongoDoc.lastLocation.longitude) {
                        const loc = {
                            name: 'Last Known Location',
                            address: mongoDoc.address_line || 'Unknown Address',
                            lat: mongoDoc.lastLocation.latitude,
                            lng: mongoDoc.lastLocation.longitude,
                            timestamp: mongoDoc.lastLocation.timestamp || Date.now()
                        };
                        customerUpdates.savedLocations = [loc];
                    }

                    // Use firestoreDoc or just doc (but we renamed loop var to mongoDoc so doc is free if imported)
                    // We imported doc as firestoreDoc just to be safe
                    const customerRef = firestoreDoc(db, 'customers', customerId);
                    await updateDoc(customerRef, customerUpdates);
                    console.log(`   -> Updated Customer Profile (Timestamps, Location)`);
                }

                // --- 4. Perform Updates ---
                await updateDoc(userDoc.ref, userUpdates);
                console.log(`   -> Updated User Profile (Timestamps)`);

                successCount++;
                console.log(`   ✅ Complete`);

            } catch (err: any) {
                console.error(`   ❌ Failed: ${err.message}`);
                failCount++;
            }
        }

        console.log('\n-----------------------------------');
        console.log(`Migration Test Complete`);
        console.log(`Processed: ${successCount}`);
        console.log(`Failed: ${failCount}`);
        console.log(`Already Existed (Updated): ${existsCount}`);
        console.log('-----------------------------------');

    } catch (err) {
        console.error('Fatal Error:', err);
    } finally {
        await client.close();
        process.exit(0);
    }
}

migrateComprehensive().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
