import 'dotenv/config';
import { firebaseService } from './src/shared/services/firebaseService';
import { db, auth } from './src/config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { DEFAULT_NAVIGATION } from './src/shared/constants';

// Polyfill window to avoid reference errors in baseService.ts
if (typeof global !== 'undefined') {
    (global as any).window = {
        location: { hostname: 'localhost' },
        localStorage: {
            getItem: () => null,
            setItem: () => { },
            removeItem: () => { }
        }
    };
    (global as any).HTMLElement = class { };
}

async function run() {
    try {
        console.log('Logging in...');
        const testAdminPhone = '011223344';
        const testAdminPin = '888888';
        await firebaseService.authService.loginWithEmailOrPhone(testAdminPhone, testAdminPin);

        await new Promise(r => setTimeout(r, 2000)); // wait for auth state

        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Login failed - currentUser is null");

        console.log('Self-promoting to system-admin...');
        await updateDoc(doc(db, 'users', currentUser.uid), { role: 'system-admin' });

        console.log('Seeding default menu to Firebase...');
        await firebaseService.seedDefaultMenu(DEFAULT_NAVIGATION);
        console.log('✅ Menu seeded successfully.');
    } catch (error) {
        console.error('❌ Error seeding menu:', error);
    } finally {
        process.exit(0);
    }
}

run();
