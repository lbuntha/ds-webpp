import React, { useEffect, useRef, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/shared/services/firebaseInstance'; // Ensure this path is correct
import { ParcelBooking, UserProfile } from '../../src/shared/types';
import { toast } from '../../src/shared/utils/toast';

declare global {
    interface Window {
        L: any;
    }
}

export const BookingMapReport: React.FC = () => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<any>(null);
    const [markerLayer, setMarkerLayer] = useState<any>(null);
    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [drivers, setDrivers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    const defaultCenter = { lat: 11.5564, lng: 104.9282 }; // Phnom Penh

    // 1. Load Data Real-time
    useEffect(() => {
        setLoading(true);

        // Listen to active bookings
        // We listen to everything for now and filter client side to mirror previous logic but in real-time
        const bookingsQuery = query(collection(db, 'parcel_bookings'));
        const unsubscribeBookings = onSnapshot(bookingsQuery, (snapshot) => {
            const fetchedBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParcelBooking));
            // Filter active ones
            const active = fetchedBookings.filter(b => {
                const s = (b.status || '').toUpperCase();
                return !['COMPLETED', 'CANCELLED', 'RETURN_TO_SENDER', 'REJECTED'].includes(s);
            });
            setBookings(active);
        }, (error) => {
            console.error("Error watching bookings:", error);
        });

        // Listen to drivers
        const usersQuery = query(collection(db, 'users'), where('role', 'in', ['driver', 'fleet-driver']));
        const unsubscribeDrivers = onSnapshot(usersQuery, (snapshot) => {
            const fetchedDrivers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
            setDrivers(fetchedDrivers);
            setLoading(false);
        }, (error) => {
            console.error("Error watching drivers:", error);
            setLoading(false);
        });

        return () => {
            unsubscribeBookings();
            unsubscribeDrivers();
        };
    }, []);

    // 2. Initialize Map Structure
    useEffect(() => {
        // Load Leaflet resources if not present
        if (!document.getElementById('leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }

        if (!window.L) {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.async = true;
            script.onload = initMapInstance;
            document.body.appendChild(script);
        } else {
            // Slight delay to ensure element is ready
            setTimeout(initMapInstance, 100);
        }
    }, []);

    const initMapInstance = () => {
        if (!mapContainerRef.current || (mapContainerRef.current as any)._leaflet_id) return;

        try {
            const mapInstance = window.L.map(mapContainerRef.current).setView([defaultCenter.lat, defaultCenter.lng], 12);

            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(mapInstance);

            const layerGroup = window.L.layerGroup().addTo(mapInstance);
            setMap(mapInstance);
            setMarkerLayer(layerGroup);
        } catch (e) {
            console.error("Map init error:", e);
        }
    };

    // 3. Update Markers when data or map changes
    useEffect(() => {
        if (!map || !markerLayer) return;

        markerLayer.clearLayers();
        const boundsPoints: [number, number][] = [];

        const redIcon = window.L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        const greenIcon = window.L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        const blueIcon = window.L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        // Plot Bookings - Only Pending/Confirmed (To Be Collected)
        bookings.forEach(booking => {
            const s = (booking.status || 'PENDING').toUpperCase();

            // User Request: "display only status pending to be confirmed to collect"
            // We interpret this as PENDING and CONFIRMED.
            if (['PENDING', 'CONFIRMED'].includes(s)) {

                // Safety check for invalid coords
                const isValid = (lat: any, lng: any) =>
                    !isNaN(Number(lat)) && !isNaN(Number(lng)) && Number(lat) !== 0 && Number(lng) !== 0;

                const lat = booking.pickupLocation?.lat;
                const lng = booking.pickupLocation?.lng;

                if (isValid(lat, lng)) {
                    // Scaling marker size based on parcel count could be a nice touch, but for now just count.
                    const itemCount = booking.items ? booking.items.length : 0;

                    // Use Red Icon for Pickup
                    const marker = window.L.marker([lat, lng], { icon: redIcon });
                    marker.bindPopup(`
                         <div class="p-2 min-w-[150px]">
                             <strong class="text-red-700 text-lg">${itemCount} Parcel${itemCount !== 1 ? 's' : ''}</strong><br/>
                             <div class="mt-1 font-medium">${booking.senderName || 'Unknown Sender'}</div>
                             <div class="text-xs text-gray-500 mb-1">${booking.senderPhone}</div>
                             <div class="text-xs text-gray-600 mb-1">Booking: ${booking.id.slice(-6)}</div>
                             <div class="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">
                                ${s}
                             </div>
                             <p class="text-xs italic mt-2 border-t pt-1 border-gray-100">${booking.pickupAddress || ''}</p>
                         </div>
                     `);
                    markerLayer.addLayer(marker);
                    boundsPoints.push([lat, lng]);
                }
            }
        });

        // Plot Drivers
        const activeDriversWithLocation = drivers.filter(u =>
            u.lastLocation &&
            ((u.lastLocation.lat !== undefined && u.lastLocation.lng !== undefined) ||
                (u.lastLocation.latitude !== undefined && u.lastLocation.longitude !== undefined))
        );

        activeDriversWithLocation.forEach(driver => {
            const loc = driver.lastLocation;
            // Handle both structure types
            const lat = Number(loc?.lat ?? loc?.latitude);
            const lng = Number(loc?.lng ?? loc?.longitude);

            if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                const marker = window.L.marker([lat, lng], { icon: blueIcon });
                const timeStr = loc?.timestamp
                    ? new Date(loc.timestamp).toLocaleTimeString()
                    : '?';

                marker.bindPopup(`
                    <div class="p-2">
                        <strong class="text-blue-700">DRIVER: ${driver.name}</strong><br/>
                        <span class="text-xs text-gray-500">Phone: ${driver.phone || 'N/A'}</span><br/>
                        <span class="text-xs">Last Active: ${timeStr}</span>
                    </div>
                `);
                markerLayer.addLayer(marker);
                boundsPoints.push([lat, lng]);
            }
        });

        // Fit bounds
        if (boundsPoints.length > 0 && map) {
            try {
                const bounds = window.L.latLngBounds(boundsPoints);
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
                } else {
                    console.warn("Invalid bounds generated from points:", boundsPoints);
                }
            } catch (e) {
                console.error("Error fitting bounds:", e);
            }
        } else if (map && boundsPoints.length === 0) {
            // map.setView([defaultCenter.lat, defaultCenter.lng], 12);
        }

    }, [map, markerLayer, bookings, drivers]);

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800">Booking Map Report (Live)</h2>
                <div className="text-sm text-gray-500">
                    {drivers.length} Drivers Found | {bookings.length} Active Orders
                </div>
            </div>

            <div className="flex-1 relative min-h-[500px]">
                {loading && bookings.length === 0 && drivers.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                )}
                <div ref={mapContainerRef} className="w-full h-full z-0" />
            </div>
        </div>
    );
};
