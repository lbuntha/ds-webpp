import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'url';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_PATH = path.resolve(__dirname, '../../users.csv');

// Configuration
const MONGO_URI = 'mongodb://dsUserAdmin:Edcc%4005061990@128.199.152.138:27017/?authSource=admin';
const TARGET_COLLECTION = 'user';
const EXPORT_LIMIT = 10;

async function exportUsers() {
    console.log('Connecting to MongoDB...');
    // Connect to MongoDB - READ ONLY operations performed on this connection
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        // Simple logic to pick a non-system DB or default to 'doorstep' if it exists
        // (Reusing logic from migration script for consistency)
        const adminDb = client.db('admin');
        const dbs = await adminDb.admin().listDatabases();

        let dbName = 'doorstep';
        const foundDb = dbs.databases.find(db => db.name !== 'admin' && db.name !== 'local' && db.name !== 'config');
        if (foundDb) {
            console.log(`Found database: ${foundDb.name}`);
            dbName = foundDb.name;
        }

        const db = client.db(dbName);
        const usersCollection = db.collection(TARGET_COLLECTION);

        console.log(`Fetching top ${EXPORT_LIMIT} users from '${TARGET_COLLECTION}' collection...`);

        // Fetch users
        const users = await usersCollection.find({}).limit(EXPORT_LIMIT).toArray();

        if (users.length === 0) {
            console.log('No users found to export.');
            return;
        }

        // Prepare CSV Content
        const header = 'phone,name,role';
        const rows = users.map(doc => {
            // Mapping based on user feedback:
            // user_name -> phone
            // full_name -> name
            // type -> role

            const phone = doc.user_name || doc.phone || '';
            const name = doc.full_name || doc.name || 'Unknown User';

            let role = 'customer';
            if (doc.type) {
                const type = doc.type.toLowerCase();
                if (type === 'driver') role = 'driver';
                else if (type === 'user') role = 'customer';
                else role = type;
            }

            // Simple CSV escaping
            const escape = (str: string) => {
                const s = String(str);
                if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                    return `"${s.replace(/"/g, '""')}"`;
                }
                return s;
            };

            return `${escape(phone)},${escape(name)},${escape(role)}`;
        });

        const csvContent = [header, ...rows].join('\n');

        // Write to file
        console.log(`Writing to ${CSV_PATH}...`);
        fs.writeFileSync(CSV_PATH, csvContent, 'utf-8');

        console.log('✅ Export Complete!');
        console.log('-----------------------------------');
        console.log(csvContent);
        console.log('-----------------------------------');

    } catch (err) {
        console.error('Export Fatal Error:', err);
    } finally {
        await client.close();
        process.exit(0);
    }
}

exportUsers().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
