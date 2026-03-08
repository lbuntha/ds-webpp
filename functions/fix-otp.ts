import * as admin from 'firebase-admin';

admin.initializeApp({
  projectId: 'doorstep-c75e3',
  databaseURL: 'https://doorstep-c75e3.firebaseio.com'
});

async function main() {
    try {
        const db = admin.firestore();
        const now = Date.now();
        const OTP_EXPIRY_MS = 5 * 60 * 1000;
        
        await db.collection('otp_codes').doc('8554256223305').set({
            code: '888888',
            createdAt: now,
            expiry: now + OTP_EXPIRY_MS,
            verified: false,
            purpose: 'LOGIN'
        });
        
        await db.collection('otp_codes').doc('4256223305').set({
            code: '888888',
            createdAt: now,
            expiry: now + OTP_EXPIRY_MS,
            verified: false,
            purpose: 'LOGIN'
        });
        
        console.log("OTP docs created.");
    } catch (e) {
        console.error(e);
    }
}

main();
