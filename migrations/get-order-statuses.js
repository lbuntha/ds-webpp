import { MongoClient } from 'mongodb';

// Connection URL
const url = 'mongodb://dsUserAdmin:Edcc%4005061990@128.199.152.138:27017/doorstep?authSource=admin';
const client = new MongoClient(url);

// Database Name
const dbName = 'doorstep';

async function main() {
    try {
        await client.connect();
        console.log('Connected successfully to server');
        const db = client.db(dbName);
        const collection = db.collection('order');

        // Get distinct status texts
        const statuses = await collection.distinct('status_text');
        console.log('Distinct status_text values:', statuses);

        // Get distinct status array last element status
        // distinct matches on array elements, so this shows all statuses ever used
        const statusArrayStatuses = await collection.distinct('status.status');
        console.log('Distinct status.status values:', statusArrayStatuses);

        return 'done.';
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

main()
    .then(console.log)
    .catch(console.error);
