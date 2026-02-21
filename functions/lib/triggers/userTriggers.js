"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserDeleted = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firebase_1 = require("../config/firebase");
/**
 * Triggered when a document is deleted in the `users` collection.
 * This deletes the corresponding user in Firebase Authentication.
 */
exports.onUserDeleted = (0, firestore_1.onDocumentDeleted)('users/{userId}', async (event) => {
    const userId = event.params.userId;
    console.log(`[userTriggers] User document deleted for ID: ${userId}. Attempting to delete from Firebase Auth.`);
    try {
        await firebase_1.auth.deleteUser(userId);
        console.log(`[userTriggers] Successfully deleted user ${userId} from Firebase Auth.`);
    }
    catch (error) {
        if (error.code === 'auth/user-not-found') {
            console.log(`[userTriggers] User ${userId} was not found in Firebase Auth. (Already deleted?)`);
        }
        else {
            console.error(`[userTriggers] Error deleting user ${userId} from Firebase Auth:`, error);
            throw new Error(`Failed to delete user from Auth: ${error.message}`);
        }
    }
});
//# sourceMappingURL=userTriggers.js.map