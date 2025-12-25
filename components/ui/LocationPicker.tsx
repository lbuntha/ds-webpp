import React, { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { toast } from '../../src/shared/utils/toast';

interface Props {
    initialLat?: number;
    initialLng?: number;
    onConfirm: (lat: number, lng: number, address: string) => void;
    onClose: () => void;
    apiKey?: string; // Deprecated, kept for compatibility but ignored
}

declare global {
    interface Window {
        L: any;
    }
}

export const LocationPicker: React.FC<Props> = ({ initialLat, initialLng, onConfirm, onClose }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const [map, setMap] = useState<any>(null);
    const [marker, setMarker] = useState<any>(null);

    const [selectedLocation, setSelectedLocation] = useState<{ lat: number, lng: number } | null>(
        initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
    );
    const [selectedAddress, setSelectedAddress] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Default to Phnom Penh
    const defaultCenter = { lat: 11.5564, lng: 104.9282 };

    useEffect(() => {
        // Load Leaflet CSS
        if (!document.getElementById('leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }

        // Load Leaflet JS
        if (!window.L) {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.async = true;
            script.onload = initMap;
            script.onerror = () => setError("Failed to load map resources.");
            document.body.appendChild(script);
        } else {
            // Short timeout to ensure container is ready
            setTimeout(initMap, 100);
        }

        return () => {
            if (map) {
                map.remove();
            }
        };
    }, []);

    const initMap = () => {
        if (!mapContainerRef.current) return;

        // Prevent double init
        if ((mapContainerRef.current as any)._leaflet_id) return;

        try {
            const startLat = selectedLocation?.lat || defaultCenter.lat;
            const startLng = selectedLocation?.lng || defaultCenter.lng;

            const mapInstance = window.L.map(mapContainerRef.current).setView([startLat, startLng], 15);

            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(mapInstance);

            // Fix marker icon issue in React/Webpack/Leaflet context
            const icon = window.L.icon({
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });

            const markerInstance = window.L.marker([startLat, startLng], {
                draggable: true,
                icon: icon
            }).addTo(mapInstance);

            setMap(mapInstance);
            setMarker(markerInstance);
            setLoading(false);

            // Events
            mapInstance.on('click', (e: any) => {
                updatePosition(e.latlng.lat, e.latlng.lng, markerInstance, mapInstance);
            });

            markerInstance.on('dragend', (e: any) => {
                const pos = e.target.getLatLng();
                updatePosition(pos.lat, pos.lng, markerInstance, mapInstance, false);
            });

            // Initial reverse geocode
            if (selectedLocation) {
                reverseGeocode(startLat, startLng);
            }

        } catch (e: any) {
            console.error(e);
            setError("Map init failed");
            setLoading(false);
        }
    };

    const updatePosition = (lat: number, lng: number, markerInst: any, mapInst: any, pan = true) => {
        setSelectedLocation({ lat, lng });
        markerInst.setLatLng([lat, lng]);
        if (pan) mapInst.panTo([lat, lng]);
        reverseGeocode(lat, lng);
    };

    const reverseGeocode = async (lat: number, lng: number) => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await res.json();
            if (data && data.display_name) {
                setSelectedAddress(data.display_name);
                if (searchInputRef.current) searchInputRef.current.value = data.display_name;
            }
        } catch (e) {
            console.error("Geocoding failed", e);
        }
    };

    const handleSearch = async () => {
        const query = searchInputRef.current?.value;
        if (!query) return;

        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data && data.length > 0) {
                const first = data[0];
                const lat = parseFloat(first.lat);
                const lng = parseFloat(first.lon);

                if (marker && map) {
                    updatePosition(lat, lng, marker, map);
                    setSelectedAddress(first.display_name);
                }
            } else {
                toast.warning("Location not found");
            }
        } catch (e) {
            toast.error("Search failed");
        }
    };

    const handleCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                const { latitude, longitude } = pos.coords;
                if (marker && map) {
                    updatePosition(latitude, longitude, marker, map);
                }
            });
        }
    };

    const handleConfirm = () => {
        if (selectedLocation) {
            onConfirm(selectedLocation.lat, selectedLocation.lng, selectedAddress);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900 bg-opacity-75 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[80vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white z-10">
                    <h3 className="text-lg font-bold text-gray-900">Select Location</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Map Area */}
                <div className="relative flex-1 bg-gray-100">
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-100 text-gray-500">
                            Loading Map...
                        </div>
                    )}

                    <div className="absolute top-4 left-4 right-4 z-[400] mx-auto max-w-lg flex gap-2">
                        <div className="relative flex-1 shadow-lg rounded-xl">
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search address (OpenStreetMap)..."
                                className="w-full pl-10 pr-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 text-sm focus:outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <button
                            onClick={handleSearch}
                            className="bg-indigo-600 text-white px-4 rounded-xl font-medium shadow-lg hover:bg-indigo-700"
                        >
                            Search
                        </button>
                    </div>

                    <button
                        onClick={handleCurrentLocation}
                        className="absolute bottom-6 right-4 z-[400] bg-white p-3 rounded-full shadow-lg text-gray-600 hover:text-indigo-600 transition-colors"
                        title="Current Location"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>

                    <div ref={mapContainerRef} className="w-full h-full z-0" />
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-sm text-gray-600 truncate w-full sm:w-auto">
                        {selectedAddress ? (
                            <span className="font-medium text-gray-900">{selectedAddress}</span>
                        ) : (
                            <span className="italic">Click map to select</span>
                        )}
                        {selectedLocation && (
                            <div className="text-xs text-gray-400 font-mono mt-0.5">
                                {(selectedLocation.lat || 0).toFixed(6)}, {(selectedLocation.lng || 0).toFixed(6)}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">Cancel</Button>
                        <Button onClick={handleConfirm} disabled={!selectedLocation} className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700">
                            Confirm Location
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
