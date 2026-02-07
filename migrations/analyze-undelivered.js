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

        // Find one order that is 'Out for delivery'
        const query = { status_text: 'Out for delivery' };
        const order = await collection.findOne(query);

        if (order) {
            console.log('Found undelivered order:');
            console.dir(order, { depth: null, colors: true });

            // Additional checks for explanation
            const now = Date.now();
            const updateDate = order.update_date;
            const hoursSinceUpdate = (now - updateDate) / (1000 * 60 * 60);
            console.log(`\nAnalysis:`);
            console.log(`- Current Time: ${new Date(now).toISOString()}`);
            console.log(`- Last Update: ${new Date(updateDate).toISOString()}`);
            console.log(`- Hours since last update: ${hoursSinceUpdate.toFixed(2)} hours`);
            console.log(`- Driver Assigned: ${order.driver_name ? 'Yes (' + order.driver_name + ')' : 'No'}`);
        } else {
            console.log('No order found with status "Out for delivery"');
        }

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
