import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();

// Firestore settings
db.settings({ ignoreUndefinedProperties: true });

export default admin;
