import React, { useEffect, useRef, useState } from 'react';
import { firebaseService } from '../../src/shared/services/firebaseService';
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
    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [drivers, setDrivers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    const defaultCenter = { lat: 11.5564, lng: 104.9282 }; // Phnom Penh

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [allBookings, allUsers] = await Promise.all([
                firebaseService.getParcelBookings(),
                firebaseService.getUsers()
            ]);

            setBookings(allBookings);

            // Filter drivers with location
            const activeDrivers = allUsers.filter(u =>
                (u.role === 'driver' || u.role === 'fleet-driver') &&
                u.lastLocation &&
                (u.lastLocation.lat || u.lastLocation.latitude) &&
                (u.lastLocation.lng || u.lastLocation.longitude)
            );
            setDrivers(activeDrivers);

        } catch (error) {
            console.error("Error loading map data:", error);
            toast.error("Failed to load map data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!loading && (bookings.length >= 0 || drivers.length >= 0)) {
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
                script.onload = initMap;
                document.body.appendChild(script);
            } else {
                setTimeout(initMap, 100);
            }
        }
    }, [loading]);

    const initMap = () => {
        if (!mapContainerRef.current || map) return;
        if ((mapContainerRef.current as any)._leaflet_id) return;

        try {
            const mapInstance = window.L.map(mapContainerRef.current).setView([defaultCenter.lat, defaultCenter.lng], 13);

            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(mapInstance);

            const redIcon = window.L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
                iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });

            const blueIcon = window.L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
                iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });

            const markers = window.L.layerGroup().addTo(mapInstance);
            const boundsPoints: [number, number][] = [];

            // Plot Bookings
            bookings.forEach(booking => {
                const maxStatus = (booking.status || '').toUpperCase();
                // Check if the BOOKING is pending (usually means ready for pickup)
                if (maxStatus === 'PENDING' || maxStatus === 'PS-PENDING' || maxStatus === 'PENDING_PICKUP') {
                    if (booking.pickupLocation?.lat && booking.pickupLocation?.lng) {
                        const marker = window.L.marker(
                            [booking.pickupLocation.lat, booking.pickupLocation.lng],
                            { icon: redIcon }
                        );

                        const itemCount = booking.items ? booking.items.length : 0;
                        const popupContent = `
                            <div class="p-2">
                                <p class="font-bold text-sm mb-1">Pending Pickup: ${booking.senderName || 'Unknown Customer'}</p>
                                <p class="text-xs text-gray-600 mb-1">Items: ${itemCount || 1}</p>
                                <p class="text-xs text-gray-600 mb-1">Booking: ${booking.id.slice(0, 8)}...</p>
                                <p class="text-xs">Status: <span class="font-medium">${booking.status}</span></p>
                                <p class="text-xs">Total COD: $${booking.items ? booking.items.reduce((acc: number, i: any) => acc + (i.productPrice || 0), 0) : 0}</p>
                                <p class="text-xs italic mt-1">${booking.pickupAddress}</p>
                            </div>
                        `;

                        marker.bindPopup(popupContent);
                        markers.addLayer(marker);
                        boundsPoints.push([booking.pickupLocation.lat, booking.pickupLocation.lng]);
                    }
                }
            });

            // Plot Drivers
            drivers.forEach(driver => {
                const lat = driver.lastLocation?.lat || driver.lastLocation?.latitude;
                const lng = driver.lastLocation?.lng || driver.lastLocation?.longitude;

                if (lat && lng) {
                    const marker = window.L.marker(
                        [lat, lng],
                        { icon: blueIcon }
                    );

                    // Format timestamp if available
                    const timeStr = driver.lastLocation?.timestamp
                        ? new Date(driver.lastLocation.timestamp).toLocaleTimeString()
                        : 'Unknown Time';

                    const popupContent = `
                        <div class="p-2">
                            <p class="font-bold text-sm mb-1 text-blue-700">DRIVER: ${driver.name}</p>
                            <p class="text-xs text-gray-600 mb-1">Phone: ${driver.phone || 'N/A'}</p>
                            <p class="text-xs text-gray-600 mb-1">Last Active: ${timeStr}</p>
                        </div>
                    `;

                    marker.bindPopup(popupContent);
                    markers.addLayer(marker);
                    boundsPoints.push([lat, lng]);
                }
            });

            // Fit bounds if there are markers
            if (boundsPoints.length > 0) {
                const bounds = window.L.latLngBounds(boundsPoints);
                // Increased padding to 100 to zoom out a bit more
                mapInstance.fitBounds(bounds, { padding: [100, 100], maxZoom: 14 });
            } else {
                mapInstance.setView([defaultCenter.lat, defaultCenter.lng], 11); // Default to a slightly zoomed out view (11 instead of 13)
            }

            setMap(mapInstance);

        } catch (e) {
            console.error("Map init error:", e);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800">Booking Map Report</h2>
                <div className="text-sm text-gray-500">
                    {drivers.length} Drivers | {bookings.length} Orders
                </div>
            </div>

            <div className="flex-1 relative min-h-[500px]">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                )}
                <div ref={mapContainerRef} className="w-full h-full z-0" />
            </div>
        </div>
    );
};
