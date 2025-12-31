/**
 * User Data Cleanup Script
 * 
 * This script cleans up inconsistent fields in the users collection:
 * - Removes: _dev_password, created_date, pin, hasPin, pinUpdatedAt (legacy fields)
 * - Renames: authProvider → authMethod
 * - Adds missing: uid, status
 * 
 * Run this in browser console while logged in as admin, or adapt for Node.js
 */

import { collection, getDocs, updateDoc, doc, deleteField, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

interface CleanupResult {
    total: number;
    updated: number;
    errors: string[];
}

export async function cleanupUserData(): Promise<CleanupResult> {
    const result: CleanupResult = { total: 0, updated: 0, errors: [] };

    try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);

        console.log(`[CLEANUP] Found ${snapshot.size} users to check`);

        const batch = writeBatch(db);
        let batchCount = 0;

        for (const userDoc of snapshot.docs) {
            result.total++;
            const data = userDoc.data();
            const updates: Record<string, any> = {};
            const deletes: string[] = [];

            // 1. Remove _dev_password (debug field)
            if ('_dev_password' in data) {
                deletes.push('_dev_password');
            }

            // 2. Remove created_date (use joinedAt instead)
            if ('created_date' in data) {
                deletes.push('created_date');
            }

            // 3. Rename authProvider → authMethod
            if ('authProvider' in data && !('authMethod' in data)) {
                updates.authMethod = data.authProvider;
                deletes.push('authProvider');
            } else if ('authProvider' in data && 'authMethod' in data) {
                // Both exist, just remove authProvider
                deletes.push('authProvider');
            }

            // 4. Add missing uid
            if (!data.uid) {
                updates.uid = userDoc.id;
            }

            // 5. Add missing status
            if (!data.status) {
                updates.status = data.role === 'customer' ? 'APPROVED' : 'PENDING';
            }

            // 6. Remove pin/hasPin/pinUpdatedAt (now handled by Firebase Auth only)
            if ('pin' in data) {
                deletes.push('pin');
            }
            if ('hasPin' in data) {
                deletes.push('hasPin');
            }
            if ('pinUpdatedAt' in data) {
                deletes.push('pinUpdatedAt');
            }

            // Apply updates if needed
            if (Object.keys(updates).length > 0 || deletes.length > 0) {
                const docRef = doc(db, 'users', userDoc.id);

                // Add updates
                for (const [key, value] of Object.entries(updates)) {
                    batch.update(docRef, { [key]: value });
                }

                // Add deletes
                for (const field of deletes) {
                    batch.update(docRef, { [field]: deleteField() });
                }

                batchCount++;
                result.updated++;

                console.log(`[CLEANUP] User ${userDoc.id}: +${Object.keys(updates).length} updates, -${deletes.length} deletes`);
            }

            // Commit batch every 400 operations (Firestore limit is 500)
            if (batchCount >= 400) {
                await batch.commit();
                console.log(`[CLEANUP] Committed batch of ${batchCount} updates`);
                batchCount = 0;
            }
        }

        // Commit remaining
        if (batchCount > 0) {
            await batch.commit();
            console.log(`[CLEANUP] Committed final batch of ${batchCount} updates`);
        }

        console.log(`[CLEANUP] Complete! Updated ${result.updated}/${result.total} users`);
    } catch (error: any) {
        result.errors.push(error.message);
        console.error('[CLEANUP] Error:', error);
    }

    return result;
}

// Export for use in admin tools
export default cleanupUserData;
