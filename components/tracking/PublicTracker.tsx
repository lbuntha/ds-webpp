import React, { useState } from 'react';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { ParcelBooking, ParcelItem } from '../../src/shared/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TrackingTimeline } from '../customer/TrackingTimeline';

interface Props {
  onClose: () => void;
}

export const PublicTracker: React.FC<Props> = ({ onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ booking: ParcelBooking, highlightItemId?: string } | null>(null);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const query = searchQuery.trim();
      let allBookings: ParcelBooking[] = [];
      let foundBooking: ParcelBooking | undefined;
      
      // Attempt to load bookings efficiently based on user context
      const user = await firebaseService.getCurrentUser();
      
      if (user) {
          // If logged in, search in user's bookings first (Fast & Secure)
          allBookings = await firebaseService.getUserBookings(user);
      } else {
          // If public/anonymous, we can't fetch list. We must try to get exact document.
          // Note: Firestore rules generally block unauthenticated reads unless specific logic exists.
          // Assuming here user might be logged in but accessing tracker.
          // If rules block listing, this might fail if we try getParcelBookings()
      }

      // 1. Search in loaded bookings (if any)
      foundBooking = allBookings.find(b => 
          b.id.toLowerCase() === query.toLowerCase() || 
          b.id.toLowerCase().endsWith(query.toLowerCase()) ||
          (b.id.toLowerCase().includes(query.toLowerCase()) && query.length > 5)
      );

      // 2. If not found in memory, try fetching specific doc by ID (if query looks like ID)
      if (!foundBooking && query.startsWith('pb-')) {
          const doc = await firebaseService.getDocument('parcel_bookings', query) as ParcelBooking;
          if (doc) foundBooking = doc;
      }

      // 3. Search Items (In Memory)
      let highlightItemId = undefined;
      if (!foundBooking && allBookings.length > 0) {
          for (const b of allBookings) {
              const foundItem = b.items.find(i => 
                  i.trackingCode?.toLowerCase() === query.toLowerCase() ||
                  i.trackingCode?.toLowerCase().endsWith(query.toLowerCase())
              );
              if (foundItem) {
                  foundBooking = b;
                  highlightItemId = foundItem.id;
                  break;
              }
          }
      }

      if (foundBooking) {
          setResult({ booking: foundBooking, highlightItemId });
      } else {
          setError("No shipment found. Please check your reference number.");
      }

    } catch (e: any) {
      console.error(e);
      if (e.code === 'permission-denied') {
          setError("Access denied. You can only track your own shipments.");
      } else {
          setError("An error occurred while searching.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-800 p-6 text-white">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold">Track Shipment</h2>
                    <p className="text-red-100 text-sm mt-1">Enter your Booking Reference or Parcel Tracking Code</p>
                </div>
                <button onClick={onClose} className="text-white/80 hover:text-white p-1 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            <form onSubmit={handleSearch} className="mt-6 flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                    <input 
                        className="w-full pl-10 pr-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-red-400 text-gray-900 placeholder-gray-400 shadow-lg"
                        placeholder="e.g. PB-123456 or TRK-999"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <Button type="submit" isLoading={loading} className="w-full sm:w-auto bg-white text-red-700 hover:bg-red-50 font-bold px-6 py-3 shadow-lg border-none justify-center">
                    Track
                </Button>
            </form>
            {error && <p className="text-red-200 text-sm mt-2 font-medium bg-red-900/30 inline-block px-2 py-1 rounded">{error}</p>}
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
            {result ? (
                <div className="p-4">
                    <TrackingTimeline 
                        booking={result.booking} 
                        initialChatItemId={result.highlightItemId}
                        onClose={onClose} 
                        hideCloseButton={true} 
                    />
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7m0 0L9.553 4.553A1 1 0 009 7" /></svg>
                    </div>
                    <p>Enter a tracking number to see status details.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
