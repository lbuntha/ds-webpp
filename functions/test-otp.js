const admin = require('firebase-admin');
const serviceAccount = require('./firebase-adminsdk.json'); // Might need this or it might use application default credentials if initialized properly

admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

async function run() {
  const db = admin.firestore();
  console.log("Fetching otp...");
  const doc = await db.collection('otp_codes').doc('4256223305').get();
  console.log(doc.exists ? doc.data() : "No document found");
}

run();
