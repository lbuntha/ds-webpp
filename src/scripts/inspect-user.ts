
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'url';
import path from 'path';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGO_URI = 'mongodb://dsUserAdmin:Edcc%4005061990@128.199.152.138:27017/?authSource=admin';
const DB_NAME = 'doorstep';
const COLLECTION = 'user';

async function inspectUser() {
    let client;
    try {
        console.log('Connecting to MongoDB...');
        client = new MongoClient(MONGO_URI);
        await client.connect();

        const db = client.db(DB_NAME);
        const usersCollection = db.collection(COLLECTION);

        // Try user_name (which seemed to be mapped to phone) or phone directly
        const searchVal = '081906500';

        // Match exact query logic from export-mongo-json.ts but for one user
        const query = {
            $or: [
                { type: 'User' },
                { type: 'user' }
            ],
            $and: [
                {
                    $or: [
                        { user_name: searchVal },
                        { phone: searchVal },
                        { phoneNumber: searchVal }
                    ]
                }
            ]
        };

        console.log(`Searching for user with query:`, JSON.stringify(query));

        const user = await usersCollection.findOne(query);

        if (user) {
            console.log('User Found:');
            console.log(JSON.stringify(user, null, 2));
        } else {
            console.log('User not found.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (client) await client.close();
    }
}

inspectUser();
