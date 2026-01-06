
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    const serviceAccount = require('../../service-account.json'); // Adjust path if needed or use default creds if running in proper environment
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
}

const db = admin.firestore();

async function enableSMS() {
    console.log('Enabling SMS configuration...');
    try {
        await db.collection('otp_options').doc('config').set({
            enabled: true,
            provider: 'plasgate',
            template: 'Your DoorStep verification code is: {{code}}'
        });
        console.log('SMS configuration enabled successfully!');
    } catch (error) {
        console.error('Error enabling SMS config:', error);
    }
}

enableSMS();
