import * as admin from 'firebase-admin';

// Initialize the default app
admin.initializeApp({
  projectId: 'doorstep-c75e3',
  databaseURL: 'https://doorstep-c75e3.firebaseio.com' 
});

async function main() {
    try {
        const db = admin.firestore();
        const doc = await db.collection('otp_codes').doc('4256223305').get();
        if (doc.exists) {
            console.log("OTP Doc:", doc.data());
        } else {
            console.log("Doc does not exist for 4256223305");
        }
    } catch (e) {
        console.error(e);
    }
}

main();
