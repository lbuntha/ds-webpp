import React, { useState, useEffect, useRef } from 'react';
// html5-qrcode imported dynamically for Safari compatibility
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
    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

    // Barcode Scanner State
    const [barcodeModal, setBarcodeModal] = useState<{ isOpen: boolean, bookingId: string, item: ParcelItem } | null>(null);
    const [scannedBarcode, setScannedBarcode] = useState('');
    const barcodeInputRef = useRef<HTMLInputElement>(null);

    // Delay Reporting State
    const [delayModal, setDelayModal] = useState<{ isOpen: boolean, bookingId: string, item: ParcelItem } | null>(null);
    const [delayReason, setDelayReason] = useState(DELAY_REASONS[0]);
    const [customDelayReason, setCustomDelayReason] = useState('');

    // Quick Scan State (for barcode reader to instantly confirm receipt)
    const [quickScanBarcode, setQuickScanBarcode] = useState('');
    const [scanResult, setScanResult] = useState<{ type: 'success' | 'error' | 'not_found', message: string } | null>(null);
    const quickScanInputRef = useRef<HTMLInputElement>(null);
    const [isCameraScanOpen, setIsCameraScanOpen] = useState(false);
    const [showAllDrivers, setShowAllDrivers] = useState(false);
    const [expandedDrivers, setExpandedDrivers] = useState<Record<string, boolean>>({});

    const toggleDriverExpansion = (driverName: string) => {
        setExpandedDrivers(prev => ({
            ...prev,
            [driverName]: !prev[driverName]
        }));
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [bData, user] = await Promise.all([
                firebaseService.getParcelBookings(),
                firebaseService.getCurrentUser()
            ]);
            // Filter out cancelled/completed
            setBookings(bData.filter(b => b.status !== 'CANCELLED' && b.status !== 'COMPLETED'));
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

    // Group inbound items by driver
    const groupedInboundItems = inboundItems.reduce((acc, current) => {
        const driverName = current.item.collectorName || current.item.driverName || 'Other / Unknown';
        if (!acc[driverName]) {
            acc[driverName] = [];
        }
        acc[driverName].push(current);
        return acc;
    }, {} as Record<string, typeof inboundItems>);

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

    // --- QUICK SCAN: Barcode reader for instant receipt confirmation ---
    const handleQuickScan = async (barcode: string) => {
        const code = barcode.trim();
        if (!code) return;

        setProcessing(true);
        setScanResult(null);

        try {
            // 1. Find locally in inbound items (Fastest)
            // Note: inboundItems only includes items NOT yet at warehouse or completed
            let matchedEntry = inboundItems.find(entry => entry.item.barcode === code);
            let foundBookingId = matchedEntry?.bookingId;
            let foundItem = matchedEntry?.item;

            // 2. If not found locally, try Backend Search (Global)
            if (!matchedEntry) {
                try {
                    const backendBooking = await firebaseService.findBookingByBarcode(code);
                    if (backendBooking) {
                        const item = (backendBooking.items || []).find(i =>
                            i.barcode === code || i.trackingCode === code || i.id === code
                        );
                        if (item) {
                            foundBookingId = backendBooking.id;
                            foundItem = item;
                        }
                    }
                } catch (e) {
                    console.error("Backend search failed", e);
                }
            }

            if (!foundItem || !foundBookingId) {
                setScanResult({ type: 'not_found', message: `No incoming parcel found with barcode: ${code}` });
                setQuickScanBarcode('');
                setTimeout(() => setScanResult(null), 4000);
                quickScanInputRef.current?.focus();
                return;
            }

            // Status Validation (Since backend search returns ANY status)
            if (foundItem.status === 'AT_WAREHOUSE') {
                setScanResult({ type: 'error', message: `Parcel is already AT WAREHOUSE.` });
                setTimeout(() => setScanResult(null), 4000);
                return;
            }
            if (['DELIVERED', 'RETURNED', 'CANCELLED'].includes(foundItem.status)) {
                setScanResult({ type: 'error', message: `Parcel is ${foundItem.status}. Cannot receive.` });
                setTimeout(() => setScanResult(null), 4000);
                return;
            }

            // Confirm receipt
            const userName = currentUser?.name || 'Warehouse Staff';
            await firebaseService.receiveItemAtWarehouse(foundBookingId, foundItem.id, userName);

            setScanResult({
                type: 'success',
                message: `✓ Received: ${foundItem.receiverName} (${code})`
            });
            setQuickScanBarcode('');
            await loadData();

            setTimeout(() => {
                setScanResult(null);
                quickScanInputRef.current?.focus();
            }, 2500);

        } catch (e) {
            setScanResult({ type: 'error', message: 'Failed to confirm receipt. Please try again.' });
            setTimeout(() => setScanResult(null), 4000);
        } finally {
            setProcessing(false);
        }
    };

    // --- CAMERA SCAN LOGIC (Safari/iOS Compatible) ---
    const scannerRef = useRef<any>(null);
    const scannerRunningRef = useRef(false);

    useEffect(() => {
        if (!isCameraScanOpen) return;

        let isMounted = true;

        const initScanner = async () => {
            try {
                const { Html5Qrcode } = await import('html5-qrcode');

                await new Promise(resolve => setTimeout(resolve, 150));

                if (!isMounted) return;

                const element = document.getElementById('reader');
                if (!element) {
                    console.error('Scanner element not found');
                    return;
                }

                const scanner = new Html5Qrcode("reader");
                scannerRef.current = scanner;

                const config = {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                };

                const onSuccess = (decodedText: string) => {
                    handleQuickScan(decodedText);
                    scannerRunningRef.current = false;
                    scanner.stop().then(() => {
                        setIsCameraScanOpen(false);
                    }).catch(() => { });
                };

                const onError = () => { };

                try {
                    await scanner.start(
                        { facingMode: "environment" },
                        config,
                        onSuccess,
                        onError
                    );
                    scannerRunningRef.current = true;
                } catch (backCamError) {
                    console.warn('Back camera failed:', backCamError);
                    try {
                        await scanner.start(
                            { facingMode: "user" },
                            config,
                            onSuccess,
                            onError
                        );
                        scannerRunningRef.current = true;
                    } catch (frontCamError) {
                        console.error('All cameras failed:', frontCamError);
                        toast.error('Camera access denied or not available');
                        setIsCameraScanOpen(false);
                    }
                }
            } catch (err) {
                console.error('Scanner init failed:', err);
                toast.error('Failed to start camera');
                if (isMounted) setIsCameraScanOpen(false);
            }
        };

        initScanner();

        return () => {
            isMounted = false;
            if (scannerRef.current && scannerRunningRef.current) {
                scannerRunningRef.current = false;
                scannerRef.current.stop().then(() => {
                    if (scannerRef.current) {
                        scannerRef.current.clear();
                        scannerRef.current = null;
                    }
                }).catch(() => {
                    scannerRef.current = null;
                });
            } else {
                scannerRef.current = null;
            }
        };
    }, [isCameraScanOpen]);

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

            {/* Quick Scan Card - Barcode Reader */}
            <Card className="border-2 border-dashed border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-bold text-gray-800 mb-1">
                            Quick Scan to Confirm Receipt
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    ref={quickScanInputRef}
                                    type="text"
                                    className="w-full pl-4 pr-12 py-3 text-lg font-mono tracking-wider border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white placeholder-gray-400"
                                    placeholder="Scan barcode here..."
                                    value={quickScanBarcode}
                                    onChange={(e) => setQuickScanBarcode(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleQuickScan(quickScanBarcode);
                                        }
                                    }}
                                    disabled={processing}
                                    autoFocus
                                />
                                {processing && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    </div>
                                )}
                            </div>
                            <Button
                                onClick={() => setIsCameraScanOpen(true)}
                                className="bg-blue-600 hover:bg-blue-700 h-auto px-6"
                                title="Scan with Camera"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Use barcode scanner, type manually, or use camera. Press Enter to confirm if typing.
                        </p>
                    </div>
                </div>

                {/* Scan Result Feedback */}
                {scanResult && (
                    <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 ${scanResult.type === 'success' ? 'bg-green-100 text-green-800' :
                        scanResult.type === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-orange-100 text-orange-800'
                        }`}>
                        {scanResult.type === 'success' ? (
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        ) : scanResult.type === 'error' ? (
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        <span className="font-medium">{scanResult.message}</span>
                    </div>
                )}
            </Card>

            {/* Expected from Drivers (Scan to Accept) */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Incoming from Drivers ({inboundItems.length})
                    </h3>
                </div>

                {Object.keys(groupedInboundItems).length === 0 ? (
                    <div className="bg-white border-2 border-dashed rounded-2xl p-12 text-center text-gray-400">
                        <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </div>
                        <p className="text-lg font-medium">No parcels expected</p>
                        <p className="text-sm">All incoming parcels have been processed.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {Object.entries(groupedInboundItems)
                                .slice(0, showAllDrivers ? undefined : 3)
                                .map(([driverName, items]) => {
                                    const isExpanded = expandedDrivers[driverName];
                                    const visibleItems = isExpanded ? items : items.slice(0, 3);

                                    return (
                                        <Card key={driverName} className="border-gray-200 shadow-sm overflow-hidden flex flex-col hover:border-blue-300 transition-colors">
                                            <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-[10px]">
                                                        {driverName.substring(0, 1).toUpperCase()}
                                                    </div>
                                                    <span className="font-bold text-gray-700 text-xs truncate max-w-[120px]">{driverName}</span>
                                                </div>
                                                <span className="bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                                    {items.length} {items.length === 1 ? 'item' : 'items'}
                                                </span>
                                            </div>
                                            <div className="divide-y divide-gray-100 overflow-y-auto max-h-[400px]">
                                                {visibleItems.map((entry, idx) => (
                                                    <div key={`${entry.bookingId}-${entry.item.id}-${idx}`} className="px-3 py-2.5 hover:bg-blue-50 transition-colors group">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold text-gray-900 truncate">{entry.item.receiverName}</p>
                                                                <p className="text-[10px] text-gray-500 font-mono mt-0.5">{entry.item.trackingCode || 'No Ref'}</p>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-1">
                                                                <span className={`text-[8px] px-1 py-0.5 rounded font-bold uppercase ${entry.item.status === 'PICKED_UP' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                                                    }`}>
                                                                    {entry.item.status === 'PICKED_UP' ? 'Hand' : 'Transit'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded w-fit">
                                                            <svg className="w-2.5 h-2.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h10M7 12h10m-8 5h8" /></svg>
                                                            <span className="text-[9px] font-mono font-bold tracking-tight text-gray-600">{entry.item.barcode || 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            {items.length > 3 && (
                                                <div className="p-1.5 bg-gray-50 border-t border-gray-100 text-center">
                                                    <button
                                                        onClick={() => toggleDriverExpansion(driverName)}
                                                        className="text-[10px] text-blue-600 font-bold hover:text-blue-800 transition-colors"
                                                    >
                                                        {isExpanded ? 'Less' : `+${items.length - 3} More`}
                                                    </button>
                                                </div>
                                            )}
                                        </Card>
                                    );
                                })}
                        </div>

                        {Object.keys(groupedInboundItems).length > 3 && (
                            <div className="flex justify-center mt-6">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowAllDrivers(!showAllDrivers)}
                                    className="px-8 py-2 border-blue-200 text-blue-600 hover:bg-blue-50 text-sm"
                                >
                                    {showAllDrivers ? 'Show Less Drivers' : `Show All Drivers (${Object.keys(groupedInboundItems).length})`}
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>

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

            {/* Camera Scan Modal */}
            {isCameraScanOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-90 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">
                        <div className="p-4 bg-gray-100 flex justify-between items-center border-b border-gray-200">
                            <h3 className="font-bold text-gray-800">Scan Barcode / QR</h3>
                            <button onClick={() => setIsCameraScanOpen(false)} className="text-gray-500 hover:text-gray-700">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-4">
                            <div id="reader" className="w-full"></div>
                        </div>
                        <div className="p-4 bg-gray-50 text-center text-xs text-gray-500">
                            Point camera at the parcel barcode
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};
