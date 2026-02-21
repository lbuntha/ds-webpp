import admin from './config/firebase';

async function deleteTestUser() {
    const emailToFind = '012989898@doorsteps.com';
    const alternativeEmail = '012989898@doorsteps.';

    try {
        console.log(`Looking for user with email: ${emailToFind} or ${alternativeEmail}`);

        let userAuth;
        try {
            userAuth = await admin.auth().getUserByEmail(emailToFind);
        } catch (e: any) {
            try {
                userAuth = await admin.auth().getUserByEmail(alternativeEmail);
            } catch (e2: any) { }
        }

        if (!userAuth) {
            // Wait, might be a phone number? Let's just list users and find one that matches.
            const listUsersResult = await admin.auth().listUsers(1000);
            userAuth = listUsersResult.users.find(u =>
                u.email?.includes('012989898') ||
                u.phoneNumber?.includes('012989898')
            );
        }

        if (userAuth) {
            console.log(`Found user in Auth: ${userAuth.uid}, Email: ${userAuth.email}`);
            await admin.auth().deleteUser(userAuth.uid);
            console.log(`Deleted user ${userAuth.uid} from Auth.`);

            // Also delete from Firestore if exists
            await admin.firestore().collection('users').doc(userAuth.uid).delete();
            console.log(`Deleted user ${userAuth.uid} from Firestore users collection.`);

            // Try to find if user has linkedCustomerId
            const usersRef = admin.firestore().collection('users');
            const linkedCustSnap = await usersRef.where('linkedCustomerId', '==', userAuth.uid).get();
            if (!linkedCustSnap.empty) {
                // That's wrong, linkedCustomerId is a field inside users pointing to 'customers'
            }

        } else {
            console.log(`User "012989898" not found in Auth!`);
        }
    } catch (error) {
        console.error("Error during deletion:", error);
    }
}

deleteTestUser().then(() => process.exit(0)).catch(() => process.exit(1));
