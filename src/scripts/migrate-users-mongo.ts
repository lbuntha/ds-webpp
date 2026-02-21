import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

// 1. Setup Environment specifically for Node.js execution
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

// Polyfill import.meta.env for the app's configuration
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
const TARGET_COLLECTION = 'user';
const DEFAULT_PIN = '123456';

async function migrateUsers() {
    // Dynamic import to ensure env vars are loaded first
    const { firebaseService } = await import('../shared/services/firebaseService');

    console.log('Connecting to MongoDB...');
    // Connect to MongoDB - READ ONLY operations performed on this connection
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        // Access the specific database - assuming 'doorstep' or listing databases to find it
        const adminDb = client.db('admin');
        const dbs = await adminDb.admin().listDatabases();

        // Simple logic to pick a non-system DB or default to 'doorstep' if it exists
        let dbName = 'doorstep';
        const foundDb = dbs.databases.find(db => db.name !== 'admin' && db.name !== 'local' && db.name !== 'config');
        if (foundDb) {
            console.log(`Found database: ${foundDb.name}`);
            dbName = foundDb.name;
        } else {
            console.log(`No specific user DB found, trying default: ${dbName}`);
        }

        const db = client.db(dbName);

        // List collections to help debug
        const collections = await db.listCollections().toArray();
        console.log('Collections found:', collections.map(c => c.name).join(', '));

        const usersCollection = db.collection(TARGET_COLLECTION);
        const count = await usersCollection.countDocuments();

        console.log(`Found ${count} documents in '${TARGET_COLLECTION}' collection`);

        // Log sample document for verification (commented out intentionally)
        // if (count > 0) {
        //     const sample = await usersCollection.findOne();
        //     console.log('Sample user document:', JSON.stringify(sample, null, 2));
        // }

        // Limit to 10 for safety test
        const cursor = usersCollection.find({});
        let successCount = 0;
        let failCount = 0;

        console.log('Starting migration loop...');

        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            if (!doc) continue;

            const phone = doc.user_name || doc.phone || doc.phoneNumber || doc.mobile;
            const name = doc.full_name || doc.name || doc.username || 'Unknown User';
            const role = 'customer'; // Default role

            if (!phone) {
                // console.warn(`Skipping user ${doc._id}: No phone number found`);
                continue;
            }

            try {
                process.stdout.write(`Migrating ${name} (${phone})... `);

                await firebaseService.registerWithPhone(phone, DEFAULT_PIN, name, {
                    role: role.toLowerCase(),
                    address: doc.address || '',
                    referralCode: doc.referralCode || ''
                });

                console.log(`✅ OK`);
                successCount++;
            } catch (error: any) {
                if (error.message && error.message.includes('already exists')) {
                    console.log(`⚠️  Exists`);
                } else {
                    console.log(`❌ Failed: ${error.message}`);
                }
                failCount++;
            }
        }

        console.log('\n-----------------------------------');
        console.log(`Migration Complete: ${successCount} migrated, ${failCount} failed/skipped`);
        console.log('-----------------------------------');

    } catch (err) {
        console.error('Migration Fatal Error:', err);
    } finally {
        await client.close();
        process.exit(0);
    }
}

migrateUsers().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
