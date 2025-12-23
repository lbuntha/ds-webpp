
import React, { useState, useEffect } from 'react';
import { ParcelBooking, Employee, ParcelItem, AppNotification } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';

export const DispatchConsole: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'NEW_JOBS' | 'WAREHOUSE'>('NEW_JOBS');
    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [drivers, setDrivers] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);

    // New Job Assignment
    const [selectedBooking, setSelectedBooking] = useState<string | null>(null);

    // Warehouse Assignment
    const [selectedWarehouseItem, setSelectedWarehouseItem] = useState<{ bookingId: string, item: ParcelItem } | null>(null);
    const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        const [bData, eData] = await Promise.all([
            firebaseService.getParcelBookings(),
            firebaseService.getEmployees()
        ]);
        // Filter for active bookings
        setBookings(bData.filter(b => b.status !== 'COMPLETED' && b.status !== 'CANCELLED'));
        // Filter for active drivers only
        setDrivers(eData.filter(e => e.isDriver && e.status !== 'INACTIVE'));
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleAssignBooking = async () => {
        if (!selectedBooking || !selectedDriver) return;
        const booking = bookings.find(b => b.id === selectedBooking);
        const driver = drivers.find(d => d.id === selectedDriver);

        if (!booking || !driver) return;

        // CRITICAL: Always prefer Linked User ID for the driver so they can see it in their app
        const targetDriverId = driver.linkedUserId || driver.id;

        try {
            const updatedBooking: ParcelBooking = {
                ...booking,
                driverId: targetDriverId,
                driverName: driver.name,
                status: 'CONFIRMED', // Auto-confirm when admin dispatches
                statusId: 'ps-pickup', // Map to Pickup workflow
                involvedDriverIds: [...(booking.involvedDriverIds || []), targetDriverId] // Prompt update
            };
            await firebaseService.saveParcelBooking(updatedBooking);

            // --- SEND NOTIFICATION TO DRIVER ---
            if (driver.linkedUserId) {
                const notification: AppNotification = {
                    id: `notif-${Date.now()}`,
                    targetAudience: driver.linkedUserId,
                    title: 'New Pickup Assigned',
                    message: `Pickup from ${booking.senderName} at ${booking.pickupAddress}`,
                    type: 'INFO',
                    read: false,
                    createdAt: Date.now(),
                    metadata: {
                        type: 'BOOKING',
                        bookingId: booking.id
                    }
                };
                await firebaseService.sendNotification(notification);
            }

            toast.success(`Assigned ${driver.name} to pick up Booking #${booking.id.slice(-6)}`);
            setSelectedBooking(null);
            setSelectedDriver(null);
            loadData();
        } catch (e) {
            console.error(e);
            toast.error("Failed to assign driver.");
        }
    };

    const handleAssignWarehouseItem = async () => {
        if (!selectedWarehouseItem || !selectedDriver) return;
        const driver = drivers.find(d => d.id === selectedDriver);
        const booking = bookings.find(b => b.id === selectedWarehouseItem.bookingId);

        if (!booking || !driver) return;

        const targetDriverId = driver.linkedUserId || driver.id;

        const updatedItems = (booking.items || []).map(item => {
            if (item.id === selectedWarehouseItem.item.id) {
                return {
                    ...item,
                    status: 'IN_TRANSIT' as const, // Moving out of warehouse
                    driverId: targetDriverId,
                    driverName: driver.name,
                    targetBranchId: null as any // Clear to indicate Out for Delivery
                };
            }
            return item;
        });

        try {
            const updatedBooking: ParcelBooking = {
                ...booking,
                items: updatedItems,
                involvedDriverIds: Array.from(new Set([...(booking.involvedDriverIds || []), targetDriverId]))
            };
            await firebaseService.saveParcelBooking(updatedBooking);

            // Notification for Warehouse Transfer
            if (driver.linkedUserId) {
                const notification: AppNotification = {
                    id: `notif-wh-${Date.now()}`,
                    targetAudience: driver.linkedUserId,
                    title: 'Warehouse Pickup Assigned',
                    message: `Collect item for ${selectedWarehouseItem.item.receiverName} from Warehouse for delivery.`,
                    type: 'INFO',
                    read: false,
                    createdAt: Date.now()
                };
                await firebaseService.sendNotification(notification);
            }

            toast.success(`Assigned item to ${driver.name} for delivery.`);
            setSelectedWarehouseItem(null);
            setSelectedDriver(null);
            loadData();
        } catch (e) {
            toast.error("Failed to assign.");
        }
    };

    // Filter Logic
    const unassignedBookings = bookings.filter(b => !b.driverId && b.status === 'PENDING');

    // Flatten items that are AT_WAREHOUSE
    const warehouseItems = bookings.flatMap(b =>
        (b.items || [])
            .filter(i => i.status === 'AT_WAREHOUSE')
            .map(i => ({ bookingId: b.id, bookingRef: b.senderName, item: i }))
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Dispatch Console</h2>
                <Button variant="outline" onClick={loadData} isLoading={loading} className="text-xs">Refresh</Button>
            </div>

            {/* Tabs */}
            <div className="flex space-x-4 border-b border-gray-200">
                <button
                    onClick={() => { setActiveTab('NEW_JOBS'); setSelectedDriver(null); }}
                    className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'NEW_JOBS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    New Pickup Requests ({unassignedBookings.length})
                </button>
                <button
                    onClick={() => { setActiveTab('WAREHOUSE'); setSelectedDriver(null); }}
                    className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'WAREHOUSE' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    In Warehouse ({warehouseItems.length})
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Job List */}
                <div className="lg:col-span-2 space-y-4">
                    {activeTab === 'NEW_JOBS' && (
                        <div className="space-y-4">
                            {unassignedBookings.map(booking => (
                                <div
                                    key={booking.id}
                                    onClick={() => setSelectedBooking(booking.id)}
                                    className={`p-4 border rounded-xl cursor-pointer transition-all bg-white relative overflow-hidden ${selectedBooking === booking.id ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-gray-200 hover:border-indigo-300'}`}
                                >
                                    {selectedBooking === booking.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>}
                                    <div className="flex justify-between items-start pl-2">
                                        <div>
                                            <h4 className="font-bold text-gray-900">{booking.senderName} <span className="text-gray-400 font-normal">({booking.senderPhone})</span></h4>
                                            <p className="text-xs text-gray-500 mt-1">{booking.bookingDate} • {(booking.items || []).length} Pkgs</p>
                                        </div>
                                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-bold">Pending Pickup</span>
                                    </div>
                                    <div className="mt-3 text-xs text-gray-600 bg-gray-50 p-2 rounded flex items-center pl-2">
                                        <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        {booking.pickupAddress}
                                    </div>
                                </div>
                            ))}
                            {unassignedBookings.length === 0 && (
                                <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                    <p className="text-gray-500 text-sm">No new pickup requests pending.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'WAREHOUSE' && (
                        <div className="space-y-4">
                            {warehouseItems.map((entry, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedWarehouseItem({ bookingId: entry.bookingId, item: entry.item })}
                                    className={`p-4 border rounded-xl cursor-pointer transition-all bg-white relative overflow-hidden ${selectedWarehouseItem?.item.id === entry.item.id ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-gray-200 hover:border-indigo-300'}`}
                                >
                                    {selectedWarehouseItem?.item.id === entry.item.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>}
                                    <div className="flex gap-4 pl-2">
                                        <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                                            <img src={entry.item.image} className="w-full h-full object-cover" alt="item" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between">
                                                <h4 className="font-bold text-gray-900">{entry.item.receiverName}</h4>
                                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold">At Warehouse</span>
                                            </div>
                                            <p className="text-xs text-gray-500 truncate mt-1">{entry.item.destinationAddress}</p>
                                            <p className="text-[10px] text-gray-400 mt-1">From Booking: {entry.bookingRef}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {warehouseItems.length === 0 && <div className="text-center py-12 text-gray-400">Warehouse is empty.</div>}
                        </div>
                    )}
                </div>

                {/* Right Column: Driver Assign */}
                <div className="space-y-6">
                    <Card title="Assign Driver" className="sticky top-6 h-fit max-h-[85vh] flex flex-col">
                        <div className="space-y-4 flex-1 flex flex-col">
                            {(!selectedBooking && !selectedWarehouseItem) ? (
                                <div className="text-center py-8 text-gray-400 flex flex-col items-center">
                                    <svg className="w-10 h-10 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                                    <p className="text-sm">Select a job from the list to begin assignment.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-indigo-50 p-3 rounded-lg text-sm text-indigo-800 border border-indigo-100 mb-2">
                                        <span className="block text-xs font-bold uppercase text-indigo-400 mb-1">Selected Task</span>
                                        {activeTab === 'NEW_JOBS'
                                            ? `Pickup for ${bookings.find(b => b.id === selectedBooking)?.senderName}`
                                            : `Deliver ${selectedWarehouseItem?.item.receiverName}'s parcel`
                                        }
                                    </div>

                                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-[400px]">
                                        <p className="text-xs font-bold text-gray-500 uppercase sticky top-0 bg-white pb-2">Available Drivers ({drivers.length})</p>
                                        {drivers.map(driver => (
                                            <div
                                                key={driver.id}
                                                onClick={() => setSelectedDriver(driver.id)}
                                                className={`p-3 rounded-lg border cursor-pointer flex items-center space-x-3 transition-all ${selectedDriver === driver.id ? 'bg-green-50 border-green-500 ring-1 ring-green-500' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                                            >
                                                <div className="h-9 w-9 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 relative">
                                                    {driver.name.charAt(0)}
                                                    {driver.linkedUserId && (
                                                        <span className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 border-2 border-white rounded-full" title="App Connected"></span>
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-gray-900">{driver.name}</p>
                                                    <div className="flex gap-2">
                                                        <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 rounded">{driver.vehicleType}</span>
                                                        {driver.zone && <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 rounded">{driver.zone}</span>}
                                                    </div>
                                                </div>
                                                {selectedDriver === driver.id && (
                                                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                                )}
                                            </div>
                                        ))}
                                        {drivers.length === 0 && <p className="text-xs text-red-500 text-center py-4">No active drivers found.</p>}
                                    </div>

                                    <Button
                                        className="w-full mt-4"
                                        disabled={!selectedDriver}
                                        onClick={activeTab === 'NEW_JOBS' ? handleAssignBooking : handleAssignWarehouseItem}
                                    >
                                        Confirm Assignment
                                    </Button>
                                </>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
