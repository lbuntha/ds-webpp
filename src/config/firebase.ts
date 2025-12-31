import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { env } from './env';

// Initialize Firebase with environment configuration
export const app = initializeApp(env.firebase);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Connect to emulators in development
if (env.isDevelopment) {
    try {
        connectFunctionsEmulator(functions, 'localhost', 5001);
        console.log('[FIREBASE] functions emulator connected');
    } catch (e) {
        console.warn('[FIREBASE] functions emulator already connected or failed');
    }
}

// Google OAuth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// DEBUG: Show connected project
console.log('%c[FIREBASE PROJECT]', 'color: #ff9800; font-weight: bold; font-size: 14px', env.firebase.projectId);

