/**
 * Firestore Migration Script
 * Imports 'places' collection from source Firebase to current project
 * 
 * Usage: Run in browser console while logged in, or run with ts-node
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db as destDb } from '../config/firebase'; // Current project

// Source Firebase configuration
const sourceFirebaseConfig = {
    apiKey: "AIzaSyBqib0e-wk2w9NwrhVZ4qLmAo4-QVAMHGU",
    authDomain: "dsaccounting-18f75.firebaseapp.com",
    projectId: "dsaccounting-18f75",
    storageBucket: "dsaccounting-18f75.firebasestorage.app",
    messagingSenderId: "84268332508",
    appId: "1:84268332508:web:ef4a9143dc6ccf93010b19",
    measurementId: "G-NHX29V4CTY"
};

// Initialize source Firebase (with unique name to avoid conflicts)
const sourceApp = initializeApp(sourceFirebaseConfig, 'source-firebase');
const sourceDb = getFirestore(sourceApp);

interface MigrationResult {
    success: boolean;
    total: number;
    migrated: number;
    errors: string[];
}

export async function migratePlaces(): Promise<MigrationResult> {
    const result: MigrationResult = { success: false, total: 0, migrated: 0, errors: [] };

    try {
        console.log('[MIGRATION] Starting places collection migration...');
        console.log('[MIGRATION] Source: dsaccounting-18f75');
        console.log('[MIGRATION] Destination: doorstep-c75e3');

        // 1. Read all places from source
        const sourcePlacesRef = collection(sourceDb, 'place');
        const snapshot = await getDocs(sourcePlacesRef);

        result.total = snapshot.size;
        console.log(`[MIGRATION] Found ${result.total} places in source database`);

        if (result.total === 0) {
            result.success = true;
            console.log('[MIGRATION] No places to migrate');
            return result;
        }

        // 2. Write to destination in batches (Firestore limit is 500 per batch)
        const BATCH_SIZE = 400;
        let batch = writeBatch(destDb);
        let batchCount = 0;

        for (const docSnap of snapshot.docs) {
            const placeData = docSnap.data();
            const destDocRef = doc(destDb, 'place', docSnap.id);

            batch.set(destDocRef, placeData);
            batchCount++;
            result.migrated++;

            console.log(`[MIGRATION] Queued: ${docSnap.id} - ${placeData.name || 'Unnamed'}`);

            // Commit batch when reaching limit
            if (batchCount >= BATCH_SIZE) {
                await batch.commit();
                console.log(`[MIGRATION] Committed batch of ${batchCount} places`);
                batch = writeBatch(destDb);
                batchCount = 0;
            }
        }

        // Commit remaining
        if (batchCount > 0) {
            await batch.commit();
            console.log(`[MIGRATION] Committed final batch of ${batchCount} places`);
        }

        result.success = true;
        console.log(`[MIGRATION] ✅ Complete! Migrated ${result.migrated}/${result.total} places`);

    } catch (error: any) {
        result.errors.push(error.message);
        console.error('[MIGRATION] ❌ Error:', error);
    }

    return result;
}

// Export for use in Settings or console
export default migratePlaces;
