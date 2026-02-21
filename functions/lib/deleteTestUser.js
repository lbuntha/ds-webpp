"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const firebase_1 = __importDefault(require("./config/firebase"));
async function deleteTestUser() {
    const emailToFind = '012989898@doorsteps.com';
    const alternativeEmail = '012989898@doorsteps.';
    try {
        console.log(`Looking for user with email: ${emailToFind} or ${alternativeEmail}`);
        let userAuth;
        try {
            userAuth = await firebase_1.default.auth().getUserByEmail(emailToFind);
        }
        catch (e) {
            try {
                userAuth = await firebase_1.default.auth().getUserByEmail(alternativeEmail);
            }
            catch (e2) { }
        }
        if (!userAuth) {
            // Wait, might be a phone number? Let's just list users and find one that matches.
            const listUsersResult = await firebase_1.default.auth().listUsers(1000);
            userAuth = listUsersResult.users.find(u => {
                var _a, _b;
                return ((_a = u.email) === null || _a === void 0 ? void 0 : _a.includes('012989898')) ||
                    ((_b = u.phoneNumber) === null || _b === void 0 ? void 0 : _b.includes('012989898'));
            });
        }
        if (userAuth) {
            console.log(`Found user in Auth: ${userAuth.uid}, Email: ${userAuth.email}`);
            await firebase_1.default.auth().deleteUser(userAuth.uid);
            console.log(`Deleted user ${userAuth.uid} from Auth.`);
            // Also delete from Firestore if exists
            await firebase_1.default.firestore().collection('users').doc(userAuth.uid).delete();
            console.log(`Deleted user ${userAuth.uid} from Firestore users collection.`);
            // Try to find if user has linkedCustomerId
            const usersRef = firebase_1.default.firestore().collection('users');
            const linkedCustSnap = await usersRef.where('linkedCustomerId', '==', userAuth.uid).get();
            if (!linkedCustSnap.empty) {
                // That's wrong, linkedCustomerId is a field inside users pointing to 'customers'
            }
        }
        else {
            console.log(`User "012989898" not found in Auth!`);
        }
    }
    catch (error) {
        console.error("Error during deletion:", error);
    }
}
deleteTestUser().then(() => process.exit(0)).catch(() => process.exit(1));
//# sourceMappingURL=deleteTestUser.js.map