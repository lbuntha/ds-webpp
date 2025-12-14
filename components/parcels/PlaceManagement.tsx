
import React, { useState, useEffect } from 'react';
import { Place } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { PlaceAutocomplete } from '../ui/PlaceAutocomplete'; // Import for testing
import { firebaseService } from '../../services/firebaseService';

export const PlaceManagement: React.FC = () => {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Test State
  const [testSearch, setTestSearch] = useState('');
  const [testResult, setTestResult] = useState<Place | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('');
  const [phone, setPhone] = useState('');
  
  const loadPlaces = async () => {
      setLoading(true);
      try {
          const data = await firebaseService.placeService.getAllPlaces();
          setPlaces(data.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      loadPlaces();
  }, []);

  const resetForm = () => {
      setEditingId(null);
      setName('');
      setAddress('');
      setCategory('');
      setPhone('');
      setIsFormOpen(false);
  };

  const handleEdit = (p: Place) => {
      setEditingId(p.id);
      setName(p.name);
      setAddress(p.address);
      setCategory(p.category || '');
      setPhone(p.phone || '');
      setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name || !address) return;

      setLoading(true);
      try {
          const place: Place = {
              id: editingId || `place-${Date.now()}`,
              name,
              address,
              category,
              phone,
              // Keywords handled in service
          };

          // Use PlaceService to save, ensuring correct schema (main_text, etc)
          await firebaseService.placeService.addPlace(place);
          
          resetForm();
          await loadPlaces();
      } catch (e) {
          alert("Failed to save place.");
      } finally {
          setLoading(false);
      }
  };

  const handleDelete = async (id: string) => {
      if (!confirm("Delete this place?")) return;
      try {
          await firebaseService.base.deleteDocument('place', id);
          loadPlaces();
      } catch (e) {
          console.error(e);
          alert("Failed to delete.");
      }
  };

  const handleSeed = async () => {
      if (!confirm("Add sample places (Royal Palace, Aeon Mall, etc.) to database?")) return;
      setLoading(true);
      // Samples using internal model, service will map them to DB schema
      const samples = [
          { name: "Royal Palace", address: "Samdach Sothearos Blvd (3), Phnom Penh", category: "Landmark", location: { lat: 11.5639, lng: 104.9317 } },
          { name: "Aeon Mall 1", address: "#132, Street Samdach Sothearos, Phnom Penh", category: "Mall", location: { lat: 11.5495, lng: 104.9356 } },
          { name: "Vattanac Capital", address: "Level 8, Vattanac Capital Tower, 66 Monivong Blvd", category: "Office", location: { lat: 11.5730, lng: 104.9197 } },
          { name: "Central Market", address: "Calmette St. (53), Phnom Penh", category: "Market", location: { lat: 11.5694, lng: 104.9213 } },
          { name: "Independent Monument", address: "Norodom Blvd, Phnom Penh", category: "Landmark", location: { lat: 11.5564, lng: 104.9282 } },
          { name: "មន្ទីរពេទ្យកាល់ម៉ែត", address: "No. 3, Monivong Blvd, Phnom Penh", category: "Hospital", location: { lat: 11.5833, lng: 104.9167 } }
      ];

      for (const p of samples) {
          await firebaseService.placeService.addPlace({ 
              id: `place-seed-${Date.now()}-${Math.floor(Math.random()*1000)}`,
              name: p.name,
              address: p.address,
              category: p.category,
              location: p.location
          });
      }
      
      await loadPlaces();
      setLoading(false);
      alert("Sample places added! You can now search for 'Royal', 'Aeon', 'មន្ទីរ', etc.");
  };

  const filteredPlaces = places.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
                <Card title={editingId ? "Edit Place" : "Add New Place"}>
                    <form onSubmit={handleSave} className="space-y-4">
                        <Input 
                            label="Place Name (Main Text)" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            placeholder="e.g. Royal Palace" 
                            required 
                        />
                        <Input 
                            label="Full Address (Secondary Text)" 
                            value={address} 
                            onChange={e => setAddress(e.target.value)} 
                            placeholder="e.g. Samdach Sothearos Blvd (3), Phnom Penh" 
                            required 
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Input 
                                label="Category" 
                                value={category} 
                                onChange={e => setCategory(e.target.value)} 
                                placeholder="e.g. Landmark, Condo" 
                            />
                            <Input 
                                label="Phone (Optional)" 
                                value={phone} 
                                onChange={e => setPhone(e.target.value)} 
                                placeholder="Contact info" 
                            />
                        </div>
                        
                        <div className="flex justify-end space-x-2 pt-4">
                            {editingId && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}
                            <Button type="submit" isLoading={loading}>{editingId ? 'Update Place' : 'Save Place'}</Button>
                        </div>
                    </form>
                    
                    <div className="mt-6 pt-4 border-t border-gray-100 text-center">
                        <p className="text-xs text-gray-500 mb-2">Want to populate data?</p>
                        <button 
                            type="button" 
                            onClick={handleSeed}
                            className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded border border-indigo-100 hover:bg-indigo-100"
                        >
                            Seed Test Data (Including Khmer)
                        </button>
                    </div>
                </Card>
            </div>

            <div className="lg:col-span-2">
                <Card title={`Places Directory (${filteredPlaces.length})`}>
                    <div className="mb-4">
                        <input 
                            type="text" 
                            placeholder="Search places..." 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-indigo-500"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="overflow-x-auto max-h-[400px]">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredPlaces.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm font-bold text-gray-900">{p.name}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-xs" title={p.address}>{p.address}</td>
                                        <td className="px-4 py-3 text-sm">
                                            {p.category && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{p.category}</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-medium space-x-2">
                                            <button onClick={() => handleEdit(p)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                            <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredPlaces.length === 0 && (
                                    <tr><td colSpan={4} className="text-center py-8 text-gray-500">No places found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>

        {/* --- DEBUGGING SECTION --- */}
        <Card title="Test Autocomplete Component" className="border-2 border-dashed border-gray-300 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Search Input:</label>
                    <PlaceAutocomplete 
                        value={testSearch}
                        onChange={setTestSearch}
                        onSelect={setTestResult}
                        placeholder="Type to search your Places..."
                        className="block w-full px-3 py-2 border border-blue-300 rounded-lg text-sm bg-white focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                        Try typing <strong>"Royal"</strong> or any name you see in the directory above.
                    </p>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Selected Result Data:</label>
                    <div className="bg-gray-900 rounded-lg p-3 overflow-auto max-h-40">
                        {testResult ? (
                            <pre className="text-xs text-green-400 font-mono">
                                {JSON.stringify(testResult, null, 2)}
                            </pre>
                        ) : (
                            <div className="text-xs text-gray-500 italic">No selection yet.</div>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    </div>
  );
};
