import React, { useState, useEffect, useRef } from 'react';
import { ParcelBooking, ParcelItem, Employee, UserProfile, AppNotification } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { useLanguage } from '../../src/shared/contexts/LanguageContext';
import { toast } from '../../src/shared/utils/toast';

const DELAY_REASONS = [
    "Incorrect Address / Unreachable",
    "Recipient Requested Reschedule",
    "Damaged Packaging - Repacking",
    "Weather Conditions",
    "Vehicle Breakdown",
    "Held for Inspection / Customs",
    "High Volume Backlog",
    "Other"
];

export const WarehouseOperations: React.FC = () => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'INBOUND' | 'OUTBOUND'>('INBOUND');
    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [drivers, setDrivers] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

    // Per-item driver selection state: { [itemId]: driverId }
    const [driverSelections, setDriverSelections] = useState<Record<string, string>>({});

    // Barcode Scanner State
    const [barcodeModal, setBarcodeModal] = useState<{ isOpen: boolean, bookingId: string, item: ParcelItem } | null>(null);
    const [scannedBarcode, setScannedBarcode] = useState('');
    const barcodeInputRef = useRef<HTMLInputElement>(null);

    // Delay Reporting State
    const [delayModal, setDelayModal] = useState<{ isOpen: boolean, bookingId: string, item: ParcelItem } | null>(null);
    const [delayReason, setDelayReason] = useState(DELAY_REASONS[0]);
    const [customDelayReason, setCustomDelayReason] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const [bData, dData, user] = await Promise.all([
                firebaseService.getParcelBookings(),
                firebaseService.getEmployees(),
                firebaseService.getCurrentUser()
            ]);
            // Filter out cancelled/completed
            setBookings(bData.filter(b => b.status !== 'CANCELLED' && b.status !== 'COMPLETED'));
            // Filter for active drivers
            setDrivers(dData.filter(e => e.isDriver && e.status !== 'INACTIVE'));
            setCurrentUser(user);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Auto-focus input when modal opens
    useEffect(() => {
        if (barcodeModal?.isOpen) {
            setTimeout(() => barcodeInputRef.current?.focus(), 100);
        }
    }, [barcodeModal]);

    // --- LOGIC: INBOUND (Driver -> Warehouse) ---
    // Only show items that are EN ROUTE TO this warehouse (have targetBranchId)
    // Items with a driver but NO targetBranchId are OUT FOR DELIVERY and should not appear here
    const inboundItems = bookings.flatMap(b =>
        (b.items || [])
            .filter(i => {
                // Must have a target branch (i.e., heading to a warehouse)
                if (!i.targetBranchId) return false;

                // Filter by managed branch if applicable
                if (currentUser?.managedBranchId && i.targetBranchId !== currentUser.managedBranchId) {
                    return false;
                }

                // Item must be picked up or in transit (heading to warehouse)
                return i.status === 'PICKED_UP' || i.status === 'IN_TRANSIT';
            })
            .map(i => ({
                bookingId: b.id,
                bookingRef: b.senderName,
                serviceType: b.serviceTypeName,
                item: i
            }))
    );

    const handleConfirmReceipt = async (bookingId: string, item: ParcelItem) => {
        setProcessing(true);
        try {
            const userName = currentUser?.name || 'Warehouse Staff';
            await firebaseService.receiveItemAtWarehouse(bookingId, item.id, userName);
            await loadData();
            toast.success("Item received at warehouse.");
        } catch (e) {
            toast.error("Failed to receive item.");
        } finally {
            setProcessing(false);
        }
    };

    // --- LOGIC: OUTBOUND (Warehouse -> Driver) ---
    const outboundItems = bookings.flatMap(b =>
        (b.items || [])
            .filter(i => {
                if (i.status !== 'AT_WAREHOUSE') return false;
                if (currentUser?.managedBranchId && i.targetBranchId !== currentUser.managedBranchId) {
                    return false;
                }
                return true;
            })
            .map(i => ({
                bookingId: b.id,
                bookingRef: b.senderName,
                serviceType: b.serviceTypeName,
                item: i
            }))
    );

    const handleDispatch = async (bookingId: string, item: ParcelItem) => {
        const driverId = driverSelections[item.id];
        if (!driverId) {
            toast.warning("Please select a driver first.");
            return;
        }

        setProcessing(true);
        try {
            const booking = bookings.find(b => b.id === bookingId);
            if (!booking) return;

            const driver = drivers.find(d => d.id === driverId);
            const targetDriverId = driver?.linkedUserId || driver?.id;

            const updatedItems = (booking.items || []).map(i => {
                if (i.id === item.id) {
                    return {
                        ...i,
                        status: 'OUT_FOR_DELIVERY' as const,
                        driverId: targetDriverId,
                        driverName: driver?.name,
                        targetBranchId: undefined, // Ensure target is cleared for delivery
                        modifications: [
                            ...(i.modifications || []),
                            {
                                timestamp: Date.now(),
                                userId: 'system',
                                userName: 'Warehouse Dispatch',
                                field: 'Driver Assigned',
                                oldValue: 'Warehouse',
                                newValue: driver?.name || 'Driver'
                            }
                        ]
                    };
                }
                return i;
            });

            let bookingStatus = booking.status;
            if (updatedItems.some(i => i.status === 'IN_TRANSIT')) {
                bookingStatus = 'IN_TRANSIT';
            } else if (updatedItems.some(i => i.status === 'OUT_FOR_DELIVERY')) {
                // If we have items out for delivery, booking can reflect that or stay IN_TRANSIT/CONFIRMED depending on logic.
                // Keeping it consistent with previous logic or updating if booking status supports it.
                // Assuming Booking status can be 'IN_TRANSIT' for general movement.
                bookingStatus = 'IN_TRANSIT';
            }

            await firebaseService.saveParcelBooking({
                ...booking,
                items: updatedItems,
                status: bookingStatus
            });

            // NOTIFICATION TRIGGER: Notify Customer
            if (booking.senderId) {
                const customerUid = await firebaseService.getUserUidByCustomerId(booking.senderId);
                if (customerUid) {
                    const notification: AppNotification = {
                        id: `notif-oud-${Date.now()}`,
                        targetAudience: customerUid,
                        title: 'Parcel Out for Delivery',
                        message: `Your parcel to ${item.receiverName} is out for delivery!`,
                        type: 'INFO',
                        read: false,
                        createdAt: Date.now(),
                        metadata: { type: 'BOOKING', bookingId: booking.id }
                    };
                    await firebaseService.sendNotification(notification);
                }
            }

            await loadData();

            setDriverSelections(prev => {
                const next = { ...prev };
                delete next[item.id];
                return next;
            });
            toast.success("Item dispatched to driver.");
        } catch (e) {
            toast.error("Failed to dispatch.");
        } finally {
            setProcessing(false);
        }
    };

    // --- BARCODE LOGIC ---
    const openBarcodeScanner = (bookingId: string, item: ParcelItem) => {
        setScannedBarcode(item.barcode || '');
        setBarcodeModal({ isOpen: true, bookingId, item });
    };

    const handleBarcodeSave = async () => {
        if (!barcodeModal) return;
        const { bookingId, item } = barcodeModal;

        // Don't save if no change
        if (scannedBarcode === item.barcode) {
            setBarcodeModal(null);
            return;
        }

        setProcessing(true);
        try {
            const booking = bookings.find(b => b.id === bookingId);
            if (booking) {
                const updatedItems = (booking.items || []).map(i => {
                    if (i.id === item.id) {
                        return { ...i, barcode: scannedBarcode };
                    }
                    return i;
                });
                await firebaseService.saveParcelBooking({ ...booking, items: updatedItems });
                await loadData();
                toast.success("Barcode updated.");
            }
            setBarcodeModal(null);
        } catch (e) {
            toast.error("Failed to update barcode.");
        } finally {
            setProcessing(false);
        }
    };

    // --- DELAY REPORTING LOGIC ---
    const openDelayModal = (bookingId: string, item: ParcelItem) => {
        setDelayReason(DELAY_REASONS[0]);
        setCustomDelayReason('');
        setDelayModal({ isOpen: true, bookingId, item });
    };

    const handleSaveDelay = async () => {
        if (!delayModal) return;
        const { bookingId, item } = delayModal;

        const finalReason = delayReason === 'Other' && customDelayReason ? customDelayReason : delayReason;

        setProcessing(true);
        try {
            const booking = bookings.find(b => b.id === bookingId);
            if (booking) {
                const updatedItems = (booking.items || []).map(i => {
                    if (i.id === item.id) {
                        return {
                            ...i,
                            delayReason: finalReason,
                            modifications: [
                                ...(i.modifications || []),
                                {
                                    timestamp: Date.now(),
                                    userId: currentUser?.uid || 'warehouse',
                                    userName: currentUser?.name || 'Warehouse Staff',
                                    field: 'Delay Reason',
                                    oldValue: i.delayReason || '',
                                    newValue: finalReason
                                }
                            ]
                        };
                    }
                    return i;
                });

                // Save Changes
                await firebaseService.saveParcelBooking({ ...booking, items: updatedItems });

                // Send Notification to Customer
                if (booking.senderId) {
                    const customerUid = await firebaseService.getUserUidByCustomerId(booking.senderId);
                    if (customerUid) {
                        const notification: AppNotification = {
                            id: `notif-delay-${Date.now()}`,
                            targetAudience: customerUid,
                            title: 'Shipment Delayed',
                            message: `Your parcel ${item.trackingCode || ''} is delayed. Reason: ${finalReason}.`,
                            type: 'WARNING',
                            read: false,
                            createdAt: Date.now(),
                            metadata: { type: 'BOOKING', bookingId: booking.id }
                        };
                        await firebaseService.sendNotification(notification);
                    }
                }
                await loadData();
                toast.success("Delay reported and notification sent.");
                setDelayModal(null);
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to save delay reason.");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Warehouse Operations</h2>
                    {currentUser?.managedBranchId && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded border border-indigo-200">
                            Managing Branch ID: {currentUser.managedBranchId}
                        </span>
                    )}
                </div>
                <Button variant="outline" onClick={loadData} isLoading={loading} className="text-xs">
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Refresh
                </Button>
            </div>

            <div className="flex space-x-4 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('INBOUND')}
                    className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'INBOUND' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <span>Incoming</span>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">{inboundItems.length}</span>
                </button>
                <button
                    onClick={() => setActiveTab('OUTBOUND')}
                    className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'OUTBOUND' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <span>Dispatch (Inventory)</span>
                    <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded-full">{outboundItems.length}</span>
                </button>
            </div>

            {
                activeTab === 'INBOUND' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {inboundItems.map((entry, idx) => (
                            <Card key={idx} className="border border-blue-100 hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-gray-400">Incoming From</span>
                                        <div className="font-bold text-gray-900">{entry.item.driverName || 'Drop-off / Transit'}</div>
                                    </div>
                                    <span className="bg-yellow-100 text-yellow-800 text-[10px] px-2 py-1 rounded font-bold">
                                        {entry.item.status === 'PICKED_UP' ? 'Picked Up' : 'In Transit'}
                                    </span>
                                </div>

                                <div className="flex gap-3 mb-4">
                                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                                        <img src={entry.item.image} className="w-full h-full object-cover" alt="parcel" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{entry.item.receiverName}</p>
                                        <p className="text-xs text-gray-500 truncate">{entry.item.destinationAddress}</p>
                                        <p className="text-[10px] text-gray-400 mt-1">Ref: {entry.bookingRef}</p>
                                        {entry.item.barcode && (
                                            <div className="mt-1 flex items-center text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded w-fit">
                                                <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                                                {entry.item.barcode}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => openBarcodeScanner(entry.bookingId, entry.item)}
                                        className="flex-shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-lg transition-colors border border-gray-200"
                                        title="Scan/Edit Barcode"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                                    </button>
                                    <Button
                                        className="flex-1 justify-center bg-blue-600 hover:bg-blue-700"
                                        onClick={() => handleConfirmReceipt(entry.bookingId, entry.item)}
                                        disabled={processing}
                                    >
                                        Confirm Receipt
                                    </Button>
                                </div>
                            </Card>
                        ))}
                        {inboundItems.length === 0 && (
                            <div className="col-span-full text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-500">
                                No incoming parcels found for your branch.
                            </div>
                        )}
                    </div>
                )
            }

            {
                activeTab === 'OUTBOUND' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {outboundItems.map((entry, idx) => (
                                <Card key={idx} className="border border-indigo-100 hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-gray-400">Current Location</span>
                                            <div className="font-bold text-indigo-900">Warehouse</div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-1 rounded font-bold">
                                                Inventory
                                            </span>
                                            {entry.item.delayReason && (
                                                <span className="bg-orange-100 text-orange-800 text-[10px] px-2 py-1 rounded font-bold" title={entry.item.delayReason}>
                                                    Delayed
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-3 mb-4">
                                        <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                                            <img src={entry.item.image} className="w-full h-full object-cover" alt="parcel" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">{entry.item.receiverName}</p>
                                            <p className="text-xs text-gray-500 truncate">{entry.item.destinationAddress}</p>
                                            <p className="text-[10px] text-gray-400 mt-1">{entry.serviceType}</p>
                                            {entry.item.barcode && (
                                                <div className="mt-1 flex items-center text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded w-fit">
                                                    <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                                                    {entry.item.barcode}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => openBarcodeScanner(entry.bookingId, entry.item)}
                                            className="h-8 w-8 flex items-center justify-center bg-gray-50 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors border border-gray-200"
                                            title="Scan/Edit Barcode"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        </button>
                                    </div>

                                    <div className="mb-3">
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Assign Driver</label>
                                        <select
                                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                            value={driverSelections[entry.item.id] || ''}
                                            onChange={(e) => setDriverSelections(prev => ({ ...prev, [entry.item.id]: e.target.value }))}
                                        >
                                            <option value="">-- Select Driver --</option>
                                            {drivers.map(d => (
                                                <option key={d.id} value={d.id}>{d.name} ({d.vehicleType}) {d.linkedUserId ? '🟢' : ''}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openDelayModal(entry.bookingId, entry.item)}
                                            className="flex-1 bg-white border border-orange-200 text-orange-600 hover:bg-orange-50 rounded-lg text-xs font-bold py-2 transition-colors flex items-center justify-center"
                                        >
                                            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            Delay
                                        </button>
                                        <Button
                                            className="flex-[2] justify-center bg-indigo-600 hover:bg-indigo-700"
                                            onClick={() => handleDispatch(entry.bookingId, entry.item)}
                                            disabled={processing || !driverSelections[entry.item.id]}
                                        >
                                            Dispatch
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                            {outboundItems.length === 0 && (
                                <div className="col-span-full text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-500">
                                    Warehouse inventory is empty.
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Barcode Scanner Modal */}
            {
                barcodeModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 transform transition-all scale-100">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-bold text-gray-900">Scan Barcode</h3>
                                <button onClick={() => setBarcodeModal(null)} className="text-gray-400 hover:text-gray-600">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-indigo-50 p-4 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-indigo-200">
                                    <svg className="w-12 h-12 text-indigo-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                                    <p className="text-sm text-indigo-800 font-medium text-center">Ready to Scan</p>
                                    <p className="text-xs text-indigo-600 text-center">Use your scanner or type manually.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Barcode / Label ID</label>
                                    <input
                                        ref={barcodeInputRef}
                                        type="text"
                                        className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg font-mono tracking-wider"
                                        placeholder="Scan here..."
                                        value={scannedBarcode}
                                        onChange={(e) => setScannedBarcode(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleBarcodeSave();
                                            }
                                        }}
                                    />
                                </div>

                                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                                    <strong>Item:</strong> {barcodeModal.item.receiverName}<br />
                                    <strong>Ref:</strong> {barcodeModal.item.trackingCode || 'N/A'}
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 mt-6">
                                <Button variant="outline" onClick={() => setBarcodeModal(null)}>Cancel</Button>
                                <Button onClick={handleBarcodeSave} isLoading={processing} className="bg-indigo-600 hover:bg-indigo-700">Save Barcode</Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Delay Reason Modal */}
            {
                delayModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 transform transition-all scale-100">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-bold text-gray-900">Report Parcel Delay</h3>
                                <button onClick={() => setDelayModal(null)} className="text-gray-400 hover:text-gray-600">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <p className="text-sm text-gray-600 mb-4">
                                This will notify the customer that their parcel is delayed.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                        value={delayReason}
                                        onChange={(e) => setDelayReason(e.target.value)}
                                    >
                                        {DELAY_REASONS.map(r => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                    </select>
                                </div>

                                {delayReason === 'Other' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Specific Reason</label>
                                        <textarea
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                            rows={2}
                                            placeholder="Enter details..."
                                            value={customDelayReason}
                                            onChange={(e) => setCustomDelayReason(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end space-x-3 mt-6">
                                <Button variant="outline" onClick={() => setDelayModal(null)}>Cancel</Button>
                                <Button onClick={handleSaveDelay} isLoading={processing} className="bg-orange-600 hover:bg-orange-700 text-white border-none">
                                    Report & Notify
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
