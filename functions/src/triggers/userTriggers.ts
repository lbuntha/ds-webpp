import * as functions from 'firebase-functions';
import { auth } from '../config/firebase';

/**
 * Triggered when a document is deleted in the `users` collection.
 * This deletes the corresponding user in Firebase Authentication.
 */
export const onUserDeleted = functions.firestore
    .document('users/{userId}')
    .onDelete(async (snap, context) => {
        const userId = context.params.userId;

        console.log(`[userTriggers] User document deleted for ID: ${userId}. Attempting to delete from Firebase Auth.`);

        try {
            await auth.deleteUser(userId);
            console.log(`[userTriggers] Successfully deleted user ${userId} from Firebase Auth.`);
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                console.log(`[userTriggers] User ${userId} was not found in Firebase Auth. (Already deleted?)`);
            } else {
                console.error(`[userTriggers] Error deleting user ${userId} from Firebase Auth:`, error);
                throw new Error(`Failed to delete user from Auth: ${error.message}`);
            }
        }
    });
