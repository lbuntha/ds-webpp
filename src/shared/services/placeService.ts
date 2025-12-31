
import { BaseService } from './baseService';
import { Place } from '../types';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

export class PlaceService extends BaseService {

    // Helper to map Firestore Document to App Interface
    private mapDocToPlace(id: string, data: any): Place {
        return {
            id: id,
            // Map 'main_text' from DB to 'name' in App
            name: data.main_text || data.name || 'Unknown Place',
            // Map 'description' or 'secondary_text' to 'address'
            address: data.description || data.secondary_text || data.address || '',
            // Map 'lat_lon' to 'location'. Ensure it has lat/lng structure.
            location: data.lat_lon || data.location,
            category: data.category,
            phone: data.phone,
            keywords: data.keywords
        };
    }

    // OPTIMIZED: Use Firestore array-contains query with keywords index
    async searchPlaces(term: string): Promise<Place[]> {
        if (!term || term.length < 2) return [];

        try {
            const placesRef = collection(this.db, 'place');
            const lowerTerm = term.toLowerCase().trim();

            // Try indexed search first (much faster for large collections)
            const { query, where, limit: firestoreLimit } = await import('firebase/firestore');

            const indexedQuery = query(
                placesRef,
                where('keywords', 'array-contains', lowerTerm),
                firestoreLimit(20)
            );

            const indexedSnap = await getDocs(indexedQuery);

            if (indexedSnap.size > 0) {
                console.log(`[SEARCH] Found ${indexedSnap.size} matches using keywords index`);
                return indexedSnap.docs.map(d => this.mapDocToPlace(d.id, d.data()));
            }

            // Fallback: Load all and filter client-side (for un-indexed places)
            console.log(`[SEARCH] Fallback to client-side search for '${term}'`);
            const snap = await getDocs(placesRef);
            const allPlaces = snap.docs.map(d => this.mapDocToPlace(d.id, d.data()));

            const results = allPlaces.filter(p => {
                const nameMatch = p.name?.toLowerCase().includes(lowerTerm);
                const addrMatch = p.address?.toLowerCase().includes(lowerTerm);
                const keywordMatch = p.keywords?.some(k => k.toLowerCase().includes(lowerTerm));
                return nameMatch || addrMatch || keywordMatch;
            });

            console.log(`[SEARCH] Client-side found ${results.length} matches for '${term}'`);
            return results.slice(0, 20);

        } catch (e) {
            console.error("Place search failed", e);
            return [];
        }
    }

    async getAllPlaces(): Promise<Place[]> {
        // Connect to 'place' collection (Singular)
        const snap = await getDocs(collection(this.db, 'place'));
        return snap.docs.map(d => this.mapDocToPlace(d.id, d.data()));
    }

    async addPlace(place: Place) {
        // Transform App Interface -> Firestore Schema
        const docData = {
            id: place.id,
            // Save as 'main_text' to match your schema
            main_text: place.name,
            secondary_text: place.address,
            description: `${place.name}, ${place.address}`,
            lat_lon: place.location,
            category: place.category,
            phone: place.phone,
            // Generate keywords for easier searching if not present
            keywords: place.keywords || place.name.toLowerCase().split(' ').concat(place.address.toLowerCase().split(' '))
        };

        // Save to 'place' collection (Singular) using sanitized method
        await this.saveDocument('place', docData);
    }
}
