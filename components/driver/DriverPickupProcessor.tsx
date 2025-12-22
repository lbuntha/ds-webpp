
import React, { useState, useEffect } from 'react';
import { ParcelBooking, ParcelItem, UserProfile, Place, ParcelServiceType } from '../../types';
import { Button } from '../ui/Button';
import { useLanguage } from '../../contexts/LanguageContext';
import { LocationPicker } from '../ui/LocationPicker';
import { PlaceAutocomplete } from '../ui/PlaceAutocomplete'; // Import
import { toast } from '../../src/shared/utils/toast';

interface Props {
    job: ParcelBooking;
    user: UserProfile;
    onSave: (updatedJob: ParcelBooking) => Promise<void>; // Just save, don't close
    onFinish: () => Promise<void>; // Done with everything, refresh parent
    onCancel: () => void; // Abort
    services: ParcelServiceType[];
}

export const DriverPickupProcessor: React.FC<Props> = ({ job, user, services, onSave, onFinish, onCancel }) => {
    const { t } = useLanguage();

    // Initialize items state from the job prop
    const [items, setItems] = useState<ParcelItem[]>(
        job.items.map(i => ({
            ...i,
            productPrice: Number(i.productPrice) || 0,
            weight: Number(i.weight) || 0,
            codCurrency: i.codCurrency || (Number(i.productPrice) >= 1000 ? 'KHR' : 'USD'),
            status: i.status || 'PENDING'
        }))
    );

    // Track active index
    const [activeIndex, setActiveIndex] = useState(0);

    // Image Viewer State
    const [rotation, setRotation] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [isSaving, setIsSaving] = useState(false);

    // Location State
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [gpsLoading, setGpsLoading] = useState(false);

    // Initialize: Find first pending item
    useEffect(() => {
        const firstPending = items.findIndex(i => i.status === 'PENDING');
        if (firstPending !== -1) setActiveIndex(firstPending);
    }, []);

    // Reset view when switching items
    useEffect(() => {
        setRotation(0);
        setZoom(1);
    }, [activeIndex]);

    const activeItem = items[activeIndex];
    const pendingCount = items.filter(i => i.status === 'PENDING').length;

    // Helper to update local item state
    const updateActiveItem = (field: keyof ParcelItem, value: any) => {
        const newItems = [...items];
        const updatedItem = { ...newItems[activeIndex] };

        // Handle numeric fields
        if (field === 'productPrice' || field === 'weight') {
            const num = parseFloat(value);
            // @ts-ignore
            updatedItem[field] = isNaN(num) ? 0 : num;

            if (field === 'productPrice') {
                updatedItem.codCurrency = (num >= 1000) ? 'KHR' : 'USD';
            }
        } else {
            // @ts-ignore
            updatedItem[field] = value;
        }

        newItems[activeIndex] = updatedItem;
        setItems(newItems);
    };

    const handleGpsLocation = () => {
        if (!navigator.geolocation) {
            toast.warning("Geolocation is not supported by this browser.");
            return;
        }

        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                // 1. Update Coordinates
                const newItems = [...items];
                newItems[activeIndex] = {
                    ...newItems[activeIndex],
                    destinationLocation: { lat: latitude, lng: longitude }
                };
                setItems(newItems);

                // 2. Reverse Geocode for Address Text
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const data = await res.json();
                    if (data && data.display_name) {
                        updateActiveItem('destinationAddress', data.display_name);
                    }
                } catch (e) {
                    console.error("Reverse geocoding failed", e);
                    // Non-blocking, coordinate is saved anyway
                } finally {
                    setGpsLoading(false);
                }
            },
            (error) => {
                console.error(error);
                toast.error("Unable to retrieve location.");
                setGpsLoading(false);
            },
            { enableHighAccuracy: true }
        );
    };

    const handleMapLocation = (lat: number, lng: number, address: string) => {
        const newItems = [...items];
        newItems[activeIndex] = {
            ...newItems[activeIndex],
            destinationAddress: address,
            destinationLocation: { lat, lng }
        };
        setItems(newItems);
        setShowMapPicker(false);
    };

    const handlePlaceSelect = (place: Place) => {
        const newItems = [...items];
        newItems[activeIndex] = {
            ...newItems[activeIndex],
            destinationAddress: place.address,
            destinationLocation: place.location
        };
        setItems(newItems);
    };

    const handleSaveAndNext = async () => {
        // Validation
        if (!activeItem.receiverName || activeItem.receiverName.trim() === '' || activeItem.receiverName === 'Details in Photo') {
            toast.warning("Please enter the Receiver Name from the image.");
            return;
        }

        setIsSaving(true);

        // 1. Update status of CURRENT item locally
        const newItems = [...items];
        const processedItem = {
            ...activeItem,
            status: 'PICKED_UP' as const,
            driverId: user.uid,
            driverName: user.name,
            collectorId: user.uid,
            collectorName: user.name,
            // Track modification history
            modifications: [
                ...(activeItem.modifications || []),
                {
                    timestamp: Date.now(),
                    userId: user.uid,
                    userName: user.name,
                    field: 'Status',
                    oldValue: activeItem.status || 'PENDING',
                    newValue: 'PICKED_UP'
                }
            ]
        };
        newItems[activeIndex] = processedItem;
        setItems(newItems); // Optimistic update

        // 2. Save to Backend (Entire Booking Object)
        try {
            const updatedJob = {
                ...job,
                items: newItems,
                // Update parent status if needed
                status: newItems.every(i => i.status === 'PICKED_UP') ? 'IN_TRANSIT' : 'CONFIRMED'
            };

            // Fee Recalculation Support
            if (services && services.length > 0) {
                const service = services.find(s => s.id === job.serviceTypeId);
                if (service) {
                    const firstItem = newItems[0]; // Use the items we just updated (optimistic)
                    const isKHR = firstItem?.codCurrency === 'KHR';
                    const bookingCurrency = isKHR ? 'KHR' : 'USD';

                    const basePrice = isKHR ? (service.defaultPriceKHR || 0) : service.defaultPrice;
                    const pricePerKm = isKHR ? (service.pricePerKmKHR || 0) : (service.pricePerKm || 0);

                    // Re-calculate
                    const count = Math.max(newItems.length, 1);
                    const subtotal = basePrice * count + (job.distance || 0) * pricePerKm;

                    // Note: resetting discount to 0 as we can't reliably recalculate it without promo context
                    // If this is a photo booking, discount is usually 0 anyway.
                    const discount = 0;
                    const taxable = subtotal - discount;

                    // Simplified tax (assuming taxRate is not needed or we reuse existing rate logic if we had taxRates)
                    // For now, let's keep it simple: assume inclusive or just base calculation?
                    // Previous logic fetched taxRates. Here we don't have taxRates prop.
                    // We will preserve existing tax logic if reasonable, or just set total = subtotal for driver updates
                    // as driver usually doesn't calculate tax details.
                    // Actually, let's just update totalDeliveryFee.

                    updatedJob.subtotal = subtotal;
                    updatedJob.discountAmount = discount;
                    updatedJob.totalDeliveryFee = subtotal; // Ignoring tax for simplicity in driver view for now, or assume 0
                    updatedJob.currency = bookingCurrency;
                }
            }

            await onSave(updatedJob);

            // 3. Navigation Logic
            const remainingPending = newItems.filter(i => i.status === 'PENDING');

            if (remainingPending.length > 0) {
                // Find the next pending index
                const nextPendingIndex = newItems.findIndex(i => i.status === 'PENDING');
                if (nextPendingIndex !== -1) {
                    setActiveIndex(nextPendingIndex);
                }
            } else {
                // All done
                await onFinish();
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to save. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!activeItem) return null;

    const isLastItem = pendingCount <= 1 && activeItem.status === 'PENDING';

    return (
        <div className="fixed inset-0 z-[100] bg-gray-100 flex flex-col h-full md:flex-row overflow-hidden">

            {/* --- LEFT: IMAGE VIEWER --- */}
            <div className="relative flex-1 bg-gray-900 flex items-center justify-center overflow-hidden h-[40vh] md:h-full group">

                {/* Image Canvas with Key for forceful re-render */}
                <div className="w-full h-full p-4 flex items-center justify-center">
                    <img
                        key={`${activeItem.id}-${activeIndex}`} // Force reload on change
                        src={activeItem.image}
                        alt="Parcel"
                        className="max-w-full max-h-full object-contain transition-transform duration-200"
                        style={{
                            transform: `rotate(${rotation}deg) scale(${zoom})`,
                            cursor: zoom > 1 ? 'grab' : 'default'
                        }}
                    />
                </div>

                {/* Mobile Header Overlay */}
                <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent flex justify-between items-start md:hidden z-20">
                    <div className="text-white">
                        <h3 className="font-bold text-lg">Parcel {activeIndex + 1} of {items.length}</h3>
                        <p className="text-xs opacity-80">{pendingCount} remaining</p>
                    </div>
                    <button onClick={onCancel} className="text-white bg-white/20 p-2 rounded-full backdrop-blur-sm">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Image Controls */}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-gray-800/90 backdrop-blur rounded-full px-4 py-2 shadow-xl border border-gray-700 z-20">
                    <button onClick={() => setRotation(r => r - 90)} className="text-gray-300 hover:text-white"><span className="text-xl">↺</span></button>
                    <div className="h-5 w-px bg-gray-600"></div>
                    <button onClick={() => setZoom(z => Math.max(1, z - 0.5))} className="text-gray-300 hover:text-white font-bold text-xl">-</button>
                    <button onClick={() => setZoom(z => Math.min(4, z + 0.5))} className="text-gray-300 hover:text-white font-bold text-xl">+</button>
                </div>
            </div>

            {/* --- RIGHT: FORM --- */}
            <div className="w-full md:w-[450px] bg-white border-l border-gray-200 flex flex-col h-[60vh] md:h-full shadow-2xl relative z-10">

                {/* Desktop Header */}
                <div className="hidden md:flex px-6 py-4 border-b border-gray-100 justify-between items-center bg-white">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Details Processing</h2>
                        <p className="text-xs text-gray-500">Sender: {job.senderName}</p>
                    </div>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">Close</button>
                </div>

                {/* Thumbnail Navigation Strip */}
                <div className="bg-gray-50 border-b border-gray-200 p-3 overflow-x-auto whitespace-nowrap scrollbar-hide">
                    <div className="flex gap-3">
                        {items.map((it, idx) => (
                            <div
                                key={it.id}
                                onClick={() => setActiveIndex(idx)}
                                className={`
                                relative flex-shrink-0 w-14 h-14 rounded-lg border-2 cursor-pointer overflow-hidden transition-all
                                ${idx === activeIndex ? 'border-indigo-600 ring-2 ring-indigo-200 transform scale-105' : 'border-gray-200 opacity-70 hover:opacity-100'}
                            `}
                            >
                                <img src={it.image} className="w-full h-full object-cover" alt="" />
                                {/* Status Overlay */}
                                <div className={`absolute inset-0 flex items-center justify-center bg-black/20 ${it.status === 'PICKED_UP' ? 'bg-green-500/80' : ''}`}>
                                    {it.status === 'PICKED_UP' && (
                                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                    )}
                                    {idx === activeIndex && it.status !== 'PICKED_UP' && (
                                        <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                                    )}
                                </div>
                                <div className="absolute bottom-0 right-0 bg-black/60 text-white text-[9px] px-1 rounded-tl">
                                    #{idx + 1}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Form Fields */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Receiver Name <span className="text-red-500">*</span></label>
                        <input
                            className="w-full text-lg font-bold border-b-2 border-gray-200 focus:border-indigo-600 focus:outline-none py-2 transition-colors placeholder-gray-300 text-gray-900"
                            placeholder="Type Name from Label..."
                            value={activeItem.receiverName === 'Details in Photo' ? '' : activeItem.receiverName}
                            onChange={e => updateActiveItem('receiverName', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone Number</label>
                        <input
                            className="w-full text-base border-b-2 border-gray-200 focus:border-indigo-600 focus:outline-none py-2 transition-colors placeholder-gray-300"
                            placeholder="012 345 678"
                            type="tel"
                            value={activeItem.receiverPhone}
                            onChange={e => updateActiveItem('receiverPhone', e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Address / Location</label>
                        <PlaceAutocomplete
                            value={activeItem.destinationAddress === 'Driver to extract details' ? '' : activeItem.destinationAddress}
                            onChange={val => updateActiveItem('destinationAddress', val)}
                            onSelect={handlePlaceSelect}
                            placeholder="House #, Street, Sangkat..."
                            className="w-full text-sm border-2 border-gray-100 rounded-xl p-3 focus:border-indigo-500 focus:ring-0 transition-colors placeholder-gray-300 bg-gray-50 focus:bg-white"
                        />

                        {/* Location Tools */}
                        <div className="flex gap-2 mt-2">
                            <button
                                type="button"
                                onClick={handleGpsLocation}
                                disabled={gpsLoading}
                                className="flex items-center text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors font-medium"
                            >
                                {gpsLoading ? (
                                    <span className="animate-spin mr-1">⌛</span>
                                ) : (
                                    <svg className="w-3 h-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                )}
                                Use GPS
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowMapPicker(true)}
                                className="flex items-center text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg transition-colors font-medium border border-indigo-100"
                            >
                                <svg className="w-3 h-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7m0 0L9.553 4.553A1 1 0 009 7" /></svg>
                                Pick on Map
                            </button>
                            {activeItem.destinationLocation && (
                                <span className="flex items-center text-xs text-green-600 ml-auto font-medium">
                                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                    Saved
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                            <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Cash to Collect</label>
                            <div className="flex items-center">
                                <input
                                    type="number"
                                    className="w-full bg-transparent font-bold text-2xl text-indigo-900 border-none p-0 focus:ring-0 placeholder-indigo-300"
                                    placeholder="0"
                                    value={activeItem.productPrice || ''}
                                    onChange={e => updateActiveItem('productPrice', e.target.value)}
                                />
                                <select
                                    className="bg-transparent border-none text-xs font-bold text-indigo-500 focus:ring-0 p-0 ml-1 cursor-pointer uppercase"
                                    value={activeItem.codCurrency}
                                    onChange={e => updateActiveItem('codCurrency', e.target.value)}
                                >
                                    <option value="USD">USD</option>
                                    <option value="KHR">KHR</option>
                                </select>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Weight (Kg)</label>
                            <input
                                type="number"
                                className="w-full bg-transparent font-bold text-2xl text-gray-800 border-none p-0 focus:ring-0 placeholder-gray-300"
                                placeholder="0.0"
                                value={activeItem.weight || ''}
                                onChange={e => updateActiveItem('weight', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-100 bg-white flex gap-3 safe-area-pb shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <Button
                        onClick={handleSaveAndNext}
                        isLoading={isSaving}
                        className={`flex-1 text-base py-3 justify-center shadow-lg h-12 transition-colors ${isLastItem ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
                    >
                        {isLastItem ? 'Save & Finish' : 'Save & Next'}
                    </Button>
                </div>
            </div>

            {/* Map Picker Modal */}
            {showMapPicker && (
                <LocationPicker
                    initialLat={activeItem.destinationLocation?.lat}
                    initialLng={activeItem.destinationLocation?.lng}
                    onConfirm={handleMapLocation}
                    onClose={() => setShowMapPicker(false)}
                />
            )}
        </div>
    );
};
