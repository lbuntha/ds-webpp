/**
 * Build Search Index for Place Collection
 * 
 * This script creates a 'keywords' array field for each place document
 * containing lowercase, normalized search terms from:
 * - main_text (place name)
 * - secondary_text (address/description)
 * 
 * This enables efficient Firestore queries using array-contains
 */

import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

interface IndexResult {
    total: number;
    indexed: number;
    errors: string[];
}

/**
 * Generate search keywords from text
 * Splits text into lowercase words, removes short words and duplicates
 */
function generateKeywords(text: string): string[] {
    if (!text) return [];

    // Normalize: lowercase, remove special chars
    const normalized = text.toLowerCase()
        .replace(/[^\u1780-\u17FFa-z0-9\s]/g, ' ')  // Keep Khmer, English, numbers
        .replace(/\s+/g, ' ')
        .trim();

    // Split into words
    const words = normalized.split(' ').filter(w => w.length >= 2);

    // Add partial matches (prefixes) for autocomplete
    const keywords: Set<string> = new Set();

    words.forEach(word => {
        keywords.add(word);
        // Add prefixes for autocomplete (e.g., "phnom" matches "phnom penh")
        for (let i = 2; i <= word.length; i++) {
            keywords.add(word.substring(0, i));
        }
    });

    // Also add the full normalized text for exact phrase search
    if (normalized.length >= 2) {
        keywords.add(normalized);
    }

    return Array.from(keywords).slice(0, 50);  // Limit to 50 keywords per doc
}

export async function buildPlaceSearchIndex(): Promise<IndexResult> {
    const result: IndexResult = { total: 0, indexed: 0, errors: [] };

    try {
        console.log('[INDEX] Starting place search index build...');

        const placesRef = collection(db, 'place');
        const snapshot = await getDocs(placesRef);

        result.total = snapshot.size;
        console.log(`[INDEX] Found ${result.total} places to index`);

        const BATCH_SIZE = 400;
        let batch = writeBatch(db);
        let batchCount = 0;

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();

            // Extract searchable text
            const mainText = data.main_text || data.name || '';
            const secondaryText = data.secondary_text || data.description || data.address || '';

            // Combine and generate keywords
            const combinedText = `${mainText} ${secondaryText}`;
            const keywords = generateKeywords(combinedText);

            // Update document with keywords
            const docRef = doc(db, 'place', docSnap.id);
            batch.update(docRef, {
                keywords: keywords,
                searchIndex: combinedText.toLowerCase()  // Full text for backup search
            });

            batchCount++;
            result.indexed++;

            // Commit batch at limit
            if (batchCount >= BATCH_SIZE) {
                await batch.commit();
                console.log(`[INDEX] Committed batch of ${batchCount} places`);
                batch = writeBatch(db);
                batchCount = 0;
            }
        }

        // Commit remaining
        if (batchCount > 0) {
            await batch.commit();
            console.log(`[INDEX] Committed final batch of ${batchCount} places`);
        }

        console.log(`[INDEX] ✅ Complete! Indexed ${result.indexed}/${result.total} places`);

    } catch (error: any) {
        result.errors.push(error.message);
        console.error('[INDEX] ❌ Error:', error);
    }

    return result;
}

export default buildPlaceSearchIndex;
