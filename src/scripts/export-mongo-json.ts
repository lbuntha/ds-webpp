import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'url';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXPORT_PATH = path.resolve(__dirname, '../../users.json');

// Configuration
const MONGO_URI = 'mongodb://dsUserAdmin:Edcc%4005061990@128.199.152.138:27017/?authSource=admin';
const TARGET_COLLECTION = 'user';

async function exportUsersToJson() {
    console.log('Connecting to MongoDB (READ-ONLY)...');

    // Connect to MongoDB
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        // Database Discovery
        const adminDb = client.db('admin');
        const dbs = await adminDb.admin().listDatabases();

        let dbName = 'doorstep';
        const foundDb = dbs.databases.find(db => db.name !== 'admin' && db.name !== 'local' && db.name !== 'config');
        if (foundDb) {
            console.log(`Using database: ${foundDb.name}`);
            dbName = foundDb.name;
        }

        const db = client.db(dbName);
        const usersCollection = db.collection(TARGET_COLLECTION);

        // Filter for Customers only
        const query = {
            $or: [
                { type: 'User' },
                { type: 'user' }
            ]
        };

        console.log(`Fetching customers from '${TARGET_COLLECTION}' collection...`);

        // Fetch users
        const users = await usersCollection.find(query).toArray();

        if (users.length === 0) {
            console.log('No users found to export.');
            return;
        }

        console.log(`Found ${users.length} users. Writing to JSON...`);

        // Serializing to JSON
        const jsonContent = JSON.stringify(users, null, 2);

        // Write to file
        fs.writeFileSync(EXPORT_PATH, jsonContent, 'utf-8');

        console.log(`✅ Export Complete! Data saved to: ${EXPORT_PATH}`);

    } catch (err) {
        console.error('Export Fatal Error:', err);
    } finally {
        await client.close();
        process.exit(0);
    }
}

exportUsersToJson().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
