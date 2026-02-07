import { MongoClient } from 'mongodb';

// Connection URL
const url = 'mongodb://dsUserAdmin:Edcc%4005061990@128.199.152.138:27017/doorstep?authSource=admin';
const client = new MongoClient(url);

// Database Name
const dbName = 'doorstep';

async function main() {
  // Use connect method to connect to the server
  try {
    await client.connect();
    console.log('Connected successfully to server');
    const db = client.db(dbName);
    
    // List collections to verify connection
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));

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
