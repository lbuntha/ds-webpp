import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { env } from './env';

// Initialize Firebase with environment configuration
export const app = initializeApp(env.firebase);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
