"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserDeleted = void 0;
const functions = __importStar(require("firebase-functions"));
const firebase_1 = require("../config/firebase");
/**
 * Triggered when a document is deleted in the `users` collection.
 * This deletes the corresponding user in Firebase Authentication.
 */
exports.onUserDeleted = functions.firestore
    .document('users/{userId}')
    .onDelete(async (snap, context) => {
    const userId = context.params.userId;
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