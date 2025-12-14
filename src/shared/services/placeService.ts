
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

  // UPDATED: Robust Client-side Search to handle Case Sensitivity
  async searchPlaces(term: string): Promise<Place[]> {
      if (!term || term.length < 1) return [];
      
      try {
          // Connect to 'place' collection (Singular)
          const placesRef = collection(this.db, 'place');
          const snap = await getDocs(placesRef);
          
          const allPlaces = snap.docs.map(d => this.mapDocToPlace(d.id, d.data()));
          
          const lowerTerm = term.toLowerCase().trim();
          
          // Filter in memory for best user experience (Fuzzy-ish matching)
          const results = allPlaces.filter(p => {
              const nameMatch = p.name?.toLowerCase().includes(lowerTerm);
              const addrMatch = p.address?.toLowerCase().includes(lowerTerm);
              // Also check keywords if they exist
              const keywordMatch = p.keywords?.some(k => k.toLowerCase().includes(lowerTerm));
              
              return nameMatch || addrMatch || keywordMatch;
          });

          console.log(`Searching '${term}' in 'place' collection. Found ${results.length} matches.`);
          return results.slice(0, 10); // Limit to top 10
          
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
