import React, { useState, useEffect, useMemo } from 'react';
import { ParcelBooking, Employee, ParcelItem, AppNotification, UserProfile } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';

export const DispatchConsole: React.FC = () => {
    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [allBookings, setAllBookings] = useState<ParcelBooking[]>([]); // For balance calculation
    const [drivers, setDrivers] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);

    // Warehouse Assignment
    const [selectedWarehouseItem, setSelectedWarehouseItem] = useState<{ bookingId: string, item: ParcelItem } | null>(null);
    const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        const [bData, eData] = await Promise.all([
            firebaseService.getParcelBookings(),
            firebaseService.getEmployees()
        ]);
        // Store all bookings for balance calculation
        setAllBookings(bData);
        // Filter for active bookings (for dispatch list)
        setBookings(bData.filter(b => b.status !== 'COMPLETED' && b.status !== 'CANCELLED'));
        // Filter for active drivers only
        setDrivers(eData.filter(e => e.isDriver && e.status !== 'INACTIVE'));
        setLoading(false);
    };

    // Calculate unsettled balance for a driver based on delivered items (same logic as Driver Dashboard)
    const getDriverBalance = (driver: Employee) => {
        const driverUserId = driver.linkedUserId || driver.id;

        // Find all unsettled items for this driver
        const unsettledItems = allBookings.flatMap(b =>
            (b.items || []).filter(i =>
                (i.driverId === driverUserId || i.delivererId === driverUserId) &&
                i.status === 'DELIVERED' &&
                (!i.driverSettlementStatus || i.driverSettlementStatus === 'UNSETTLED')
            )
        );

        let codUsd = 0, codKhr = 0;
        let taxiUsd = 0, taxiKhr = 0;

        unsettledItems.forEach(i => {
            // COD collected (driver owes this)
            const amt = Number(i.productPrice) || 0;
            if (amt > 0) {
                if (i.codCurrency === 'KHR') codKhr += amt; else codUsd += amt;
            }

            // Taxi fee reimbursement (company owes driver)
            if (i.isTaxiDelivery && i.taxiFee && i.taxiFee > 0 && !i.taxiFeeReimbursed) {
                if (i.taxiFeeCurrency === 'KHR') taxiKhr += i.taxiFee;
                else taxiUsd += i.taxiFee;
            }
        });

        // Net balance = COD - Taxi (positive means driver owes company)
        return {
            usd: codUsd - taxiUsd,
            khr: codKhr - taxiKhr,
            itemCount: unsettledItems.length
        };
    };

    const isDriverEligible = (driver: Employee) => {
        const bal = getDriverBalance(driver);
        // Allow dispatch only if no unsettled items
        // Using small threshold to handle floating point noise
        const isUsdClear = Math.abs(bal.usd) < 0.01;
        const isKhrClear = Math.abs(bal.khr) < 1; // 1 Riel threshold
        return isUsdClear && isKhrClear;
    };

    useEffect(() => {
        loadData();
    }, []);

    // Flatten items that are AT_WAREHOUSE
    const warehouseItems = bookings.flatMap(b =>
        (b.items || [])
            .filter(i => i.status === 'AT_WAREHOUSE')
            .map(i => ({ bookingId: b.id, bookingRef: b.senderName, item: i }))
    );

    // --- NEW SCANNING LOGIC ---
    const [barcode, setBarcode] = useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [isCameraScanOpen, setIsCameraScanOpen] = useState(false); // CAMERA STATE
    const [isScanning, setIsScanning] = useState(false); // SPINNER STATE
    const [isDriverScanOpen, setIsDriverScanOpen] = useState(false); // DRIVER QR SCAN STATE
    const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false); // Mobile Bottom Sheet State

    // Focus input when driver matches in Warehouse mode
    useEffect(() => {
        if (selectedDriver && inputRef.current) {
            inputRef.current.focus();
        }
    }, [selectedDriver]);

    // --- DRIVER QR SCAN HANDLER ---
    const handleDriverScan = (code: string) => {
        const cleanCode = code.trim();
        if (!cleanCode) return;

        // Search by employeeCode, id, or linkedUserId
        const matchedDriver = drivers.find(d =>
            d.employeeCode === cleanCode ||
            d.id === cleanCode ||
            d.linkedUserId === cleanCode
        );

        if (matchedDriver) {
            if (!isDriverEligible(matchedDriver)) {
                const balance = getDriverBalance(matchedDriver);
                toast.error(`${matchedDriver.name} is BLOCKED. Owes: ${Math.abs(balance.usd) > 0.01 ? `$${balance.usd.toFixed(2)}` : ''} ${Math.abs(balance.khr) > 1 ? `${balance.khr.toLocaleString()} KHR` : ''}`);
            } else {
                setSelectedDriver(matchedDriver.id);
                toast.success(`Driver selected: ${matchedDriver.name}`);
            }
        } else {
            toast.error(`Driver not found: ${cleanCode}`);
        }
        setIsDriverScanOpen(false);
    };

    // --- DRIVER QR CAMERA SCAN (Safari/iOS Compatible) ---
    const driverScannerRef = React.useRef<any>(null);
    const driverScannerRunningRef = React.useRef(false);

    useEffect(() => {
        if (!isDriverScanOpen) return;

        let isMounted = true;

        const initDriverScanner = async () => {
            try {
                const { Html5Qrcode } = await import('html5-qrcode');

                await new Promise(resolve => setTimeout(resolve, 150));

                if (!isMounted) return;

                const element = document.getElementById('driver-qr-reader');
                if (!element) {
                    console.error('Driver scanner element not found');
                    return;
                }

                const scanner = new Html5Qrcode("driver-qr-reader");
                driverScannerRef.current = scanner;

                const config = {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                };

                const onSuccess = (decodedText: string) => {
                    handleDriverScan(decodedText);
                    driverScannerRunningRef.current = false;
                    scanner.stop().catch(() => { });
                };

                const onError = () => { };

                try {
                    await scanner.start(
                        { facingMode: "environment" },
                        config,
                        onSuccess,
                        onError
                    );
                    driverScannerRunningRef.current = true;
                } catch (backCamError) {
                    console.warn('Back camera failed for driver scan:', backCamError);
                    try {
                        await scanner.start(
                            { facingMode: "user" },
                            config,
                            onSuccess,
                            onError
                        );
                        driverScannerRunningRef.current = true;
                    } catch (frontCamError) {
                        console.error('All cameras failed:', frontCamError);
                        toast.error('Camera access denied or not available');
                        setIsDriverScanOpen(false);
                    }
                }
            } catch (err) {
                console.error('Driver scanner init failed:', err);
                toast.error('Failed to start camera');
                if (isMounted) setIsDriverScanOpen(false);
            }
        };

        initDriverScanner();

        return () => {
            isMounted = false;
            if (driverScannerRef.current && driverScannerRunningRef.current) {
                driverScannerRunningRef.current = false;
                driverScannerRef.current.stop().then(() => {
                    if (driverScannerRef.current) {
                        driverScannerRef.current.clear();
                        driverScannerRef.current = null;
                    }
                }).catch(() => {
                    driverScannerRef.current = null;
                });
            } else {
                driverScannerRef.current = null;
            }
        };
    }, [isDriverScanOpen, drivers]);

    // --- CAMERA SCAN LOGIC (Safari/iOS Compatible) ---
    const scannerRef = React.useRef<any>(null);
    const scannerRunningRef = React.useRef(false);

    useEffect(() => {
        if (!isCameraScanOpen) return;

        let isMounted = true;

        // Small delay to ensure DOM is ready (important for Safari)
        const initScanner = async () => {
            try {
                const { Html5Qrcode } = await import('html5-qrcode');

                // Wait a bit for DOM element to be fully rendered
                await new Promise(resolve => setTimeout(resolve, 150));

                if (!isMounted) return;

                const element = document.getElementById('dispatch-reader');
                if (!element) {
                    console.error('Scanner element not found');
                    return;
                }

                const scanner = new Html5Qrcode("dispatch-reader");
                scannerRef.current = scanner;

                const config = {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                };

                const onSuccess = (decodedText: string) => {
                    setBarcode(decodedText);
                    handleScanLogic(decodedText);

                    // Stop scanner after successful scan
                    scannerRunningRef.current = false;
                    scanner.stop().then(() => {
                        setIsCameraScanOpen(false);
                    }).catch(() => { });
                };

                const onError = () => { /* Ignore continuous scan errors */ };

                // Try back camera first (environment), fallback to front camera (user)
                try {
                    await scanner.start(
                        { facingMode: "environment" },
                        config,
                        onSuccess,
                        onError
                    );
                    scannerRunningRef.current = true;
                } catch (backCamError) {
                    console.warn('Back camera failed, trying front camera:', backCamError);
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
                console.error('Scanner initialization failed:', err);
                toast.error('Failed to start camera');
                if (isMounted) setIsCameraScanOpen(false);
            }
        };

        initScanner();

        // Cleanup
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

    const assignItemToDriver = async (itemEntry: { bookingId: string, item: ParcelItem }, driverId: string) => {
        const driver = drivers.find(d => d.id === driverId);
        const booking = bookings.find(b => b.id === itemEntry.bookingId);

        if (!booking || !driver) return;

        if (!isDriverEligible(driver)) {
            toast.error(`Cannot assign: ${driver.name} has unsettled balance.`);
            return;
        }

        const targetDriverId = driver.linkedUserId || driver.id;

        const updatedItems = (booking.items || []).map(i => {
            if (i.id === itemEntry.item.id) {
                return {
                    ...i,
                    status: 'IN_TRANSIT' as const,
                    driverId: targetDriverId,
                    driverName: driver.name,
                    targetBranchId: null as any
                };
            }
            return i;
        });

        try {
            const updatedBooking: ParcelBooking = {
                ...booking,
                items: updatedItems,
                involvedDriverIds: Array.from(new Set([...(booking.involvedDriverIds || []), targetDriverId]))
            };
            await firebaseService.saveParcelBooking(updatedBooking);

            // Notification
            if (driver.linkedUserId) {
                const notification: AppNotification = {
                    id: `notif-wh-${Date.now()}`,
                    targetAudience: driver.linkedUserId,
                    title: 'Warehouse Pickup Assigned',
                    message: `Collect item for ${itemEntry.item.receiverName} from Warehouse for delivery.`,
                    type: 'INFO',
                    read: false,
                    createdAt: Date.now()
                };
                await firebaseService.sendNotification(notification);
            }

            toast.success(`Assigned ${itemEntry.item.receiverName} (Scan) to ${driver.name}`);
            loadData();
        } catch (e) {
            console.error(e);
            toast.error("Failed to assign item.");
        }
    };

    const handleAssignWarehouseItem = async () => {
        if (!selectedWarehouseItem || !selectedDriver) return;
        await assignItemToDriver(selectedWarehouseItem, selectedDriver);
        setSelectedWarehouseItem(null);
        setSelectedDriver(null);
    };

    // Extracted logic for scan processing to be reusable by Camera
    const handleScanLogic = async (code: string) => {
        if (!selectedDriver) return;

        const cleanCode = code.trim();
        if (!cleanCode) return;

        setIsScanning(true); // START SPINNER

        try {
            // 1. Check if eligible (AT_WAREHOUSE)
            const match = warehouseItems.find(entry =>
                (entry.item.barcode === cleanCode) ||
                (entry.item.trackingCode === cleanCode) ||
                (entry.item.id === cleanCode)
            );

            if (match) {
                await assignItemToDriver(match, selectedDriver);
                setBarcode('');
                return;
            }

            // 2. Global Search for better error message OR fetch from backend
            let foundStatus: string | null = null;
            let foundItem: ParcelItem | null = null;
            let foundBooking: ParcelBooking | null = null;

            const checkInBookings = (inBookings: ParcelBooking[]) => {
                for (const b of inBookings) {
                    const item = (b.items || []).find(i =>
                        i.barcode === cleanCode || i.trackingCode === cleanCode || i.id === cleanCode
                    );
                    if (item) {
                        return { item, booking: b };
                    }
                }
                return null;
            };

            const localResult = checkInBookings(bookings);
            if (localResult) {
                foundStatus = localResult.item.status;
                foundItem = localResult.item;
                foundBooking = localResult.booking;
            } else {
                // 3. Backend Search (Fallback)
                try {
                    const backendBooking = await firebaseService.findBookingByBarcode(cleanCode);
                    if (backendBooking) {
                        const item = (backendBooking.items || []).find(i =>
                            i.barcode === cleanCode || i.trackingCode === cleanCode || i.id === cleanCode
                        );
                        if (item) {
                            foundStatus = item.status;
                            foundItem = item;
                            foundBooking = backendBooking;
                        }
                    }
                } catch (e) {
                    console.error("Backend search failed", e);
                }
            }

            if (foundItem && foundBooking && foundStatus) {
                if (foundStatus === 'AT_WAREHOUSE') {
                    await assignItemToDriver({ bookingId: foundBooking.id, item: foundItem }, selectedDriver);
                    setBarcode('');
                } else if (foundStatus === 'IN_TRANSIT') toast.error(`Parcel is already Out for Delivery.`);
                else if (foundStatus === 'DELIVERED') toast.error(`Parcel is already Delivered.`);
                else if (foundStatus === 'PENDING') toast.error(`Parcel is PENDING (Not picked up yet).`);
                else toast.error(`Parcel status is ${foundStatus}. Must be AT_WAREHOUSE.`);
            } else {
                toast.error(`Parcel not found: ${cleanCode}`);
            }
            setBarcode('');
        } catch (e) {
            console.error("Scan Error", e);
            toast.error("Scanning failed.");
        } finally {
            setIsScanning(false); // STOP SPINNER
        }
    };

    const handleScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && selectedDriver) {
            e.preventDefault();
            handleScanLogic(barcode);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Dispatch Console</h2>
                <Button variant="outline" onClick={loadData} isLoading={loading} className="text-xs">Refresh</Button>
            </div>

            {/* Main Content Area */}
            <div className="block lg:grid lg:grid-cols-3 gap-6 pb-24 lg:pb-0">

                {/* Left Column: Warehouse Inventory List */}
                <div className="lg:col-span-2 space-y-4 mb-4 lg:mb-0">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-bold text-gray-700">Warehouse Inventory ({warehouseItems.length})</h3>
                    </div>

                    {/* Warehouse Items List */}
                    <div className="space-y-4">
                        {warehouseItems.map((entry, idx) => (
                            <div
                                key={idx}
                                onClick={() => {
                                    setSelectedWarehouseItem({ bookingId: entry.bookingId, item: entry.item });
                                    // Auto-open panel on mobile
                                    if (window.innerWidth < 1024) setIsMobilePanelOpen(true);
                                }}
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
                        {warehouseItems.length === 0 && <p className="text-center py-12 text-gray-400">Warehouse is empty.</p>}
                    </div>
                </div>

                {/* Mobile Backdrop */}
                {isMobilePanelOpen && (
                    <div className="lg:hidden fixed inset-0 bg-black/50 z-30 transition-opacity" onClick={() => setIsMobilePanelOpen(false)} />
                )}

                {/* Right Column: Driver Assign (Bottom Sheet on Mobile, Sticky on Desktop) */}
                <div className={`
                    fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl shadow-[0_-5px_25px_-5px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-in-out
                    lg:static lg:z-auto lg:bg-transparent lg:shadow-none lg:rounded-none lg:transform-none lg:block
                    ${isMobilePanelOpen ? 'translate-y-0' : 'translate-y-[calc(100%-80px)] lg:translate-y-0'}
                    h-[80vh] lg:h-auto
                `}>
                    {/* Mobile Handle / Header */}
                    <div
                        className="lg:hidden h-36 w-full flex flex-col items-center pt-2 cursor-pointer bg-white rounded-t-2xl absolute top-0 left-0"
                        onClick={() => setIsMobilePanelOpen(!isMobilePanelOpen)}
                    >
                        <div className="w-12 h-1.5 bg-gray-300 rounded-full mb-3" />
                        <div className="px-4 w-full flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-gray-800">
                                    {selectedWarehouseItem ? 'Assign Driver' : 'Select Item / Driver'}
                                </h3>
                                {(selectedWarehouseItem || selectedDriver) && (
                                    <p className="text-xs text-indigo-600">
                                        {selectedDriver ? 'Driver Selected' : '1 Item Selected'}
                                    </p>
                                )}
                            </div>
                            <Button
                                size="sm"
                                variant={isMobilePanelOpen ? 'secondary' : 'primary'}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMobilePanelOpen(!isMobilePanelOpen);
                                }}
                            >
                                {isMobilePanelOpen ? 'Close' : 'Expand'}
                            </Button>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="h-full pt-16 lg:pt-0 overflow-y-auto lg:overflow-visible px-4 lg:px-0 bg-white lg:bg-transparent">
                        <Card title="Assign Driver" className="h-fit min-h-[50vh] lg:min-h-0 lg:max-h-[85vh] flex flex-col shadow-none border-0 lg:border lg:shadow-sm lg:sticky lg:top-6">
                            <div className="space-y-4 flex-1 flex flex-col">
                                {(!selectedWarehouseItem) ? (
                                    <div className="text-center py-8 text-gray-400 flex flex-col items-center">
                                        <svg className="w-10 h-10 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                                        <p className="text-sm">Select an item to assign.</p>

                                        {/* Mobile: Provide Scan Driver Shortcut even if no item selected */}
                                        <div className="lg:hidden mt-6 w-full px-8">
                                            <Button
                                                variant="outline"
                                                className="w-full"
                                                onClick={() => setIsDriverScanOpen(true)}
                                            >
                                                Scan Driver QR
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Scan Input OR Blocked Message */}
                                        {selectedDriver && (
                                            <>
                                                {isDriverEligible(drivers.find(d => d.id === selectedDriver)!) ? (
                                                    <div className="bg-indigo-50 p-4 rounded-lg border-2 border-indigo-200 mb-2">
                                                        <label className="block text-xs font-bold uppercase text-indigo-700 mb-1">
                                                            SCAN PARCEL FOR {drivers.find(d => d.id === selectedDriver)?.name}
                                                        </label>
                                                        <div className="flex gap-2">
                                                            <div className="relative flex-1">
                                                                <input
                                                                    ref={inputRef}
                                                                    type="text"
                                                                    className="w-full px-3 py-2 border rounded shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none pr-8"
                                                                    placeholder={isScanning ? "Searching..." : "Scan Barcode / Tracking ID..."}
                                                                    value={barcode}
                                                                    onChange={(e) => setBarcode(e.target.value)}
                                                                    onKeyDown={handleScan}
                                                                    autoFocus
                                                                    disabled={isScanning}
                                                                />
                                                                {isScanning && (
                                                                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                                                        <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                        </svg>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <Button
                                                                onClick={() => setIsCameraScanOpen(true)}
                                                                className="px-3 bg-indigo-600 hover:bg-indigo-700"
                                                                title="Scan with Camera"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                </svg>
                                                            </Button>
                                                        </div>
                                                        <p className="text-[10px] text-indigo-400 mt-1">Press Enter to assign instantly.</p>
                                                    </div>
                                                ) : (
                                                    <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200 mb-2 text-center">
                                                        <div className="flex justify-center mb-2">
                                                            <span className="p-2 bg-red-100 rounded-full">
                                                                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                            </span>
                                                        </div>
                                                        <h3 className="text-sm font-bold text-red-800 uppercase">Assignment Blocked</h3>
                                                        <p className="text-xs text-red-600 mt-1">
                                                            {drivers.find(d => d.id === selectedDriver)?.name} has an unsettled wallet balance.
                                                        </p>
                                                        <p className="text-sm font-bold text-red-700 mt-2">
                                                            Owes:
                                                            {Math.abs(getDriverBalance(drivers.find(d => d.id === selectedDriver)!).usd) > 0.01 && ` $${getDriverBalance(drivers.find(d => d.id === selectedDriver)!).usd.toFixed(2)}`}
                                                            {Math.abs(getDriverBalance(drivers.find(d => d.id === selectedDriver)!).khr) > 1 && ` ${getDriverBalance(drivers.find(d => d.id === selectedDriver)!).khr.toLocaleString()} KHR`}
                                                        </p>
                                                        <p className="text-[10px] text-red-400 mt-2">Clear balance to resume assignment.</p>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {/* Assigned Items List (Visible when driver selected) */}
                                        {selectedDriver && (
                                            <div className="mb-4">
                                                <div className="flex justify-between items-center mb-2">
                                                    <p className="text-xs font-bold text-gray-500 uppercase">
                                                        Assigned to {drivers.find(d => d.id === selectedDriver)?.name.split(' ')[0]}
                                                        ({bookings.flatMap(b => (b.items || []).filter(i => i.driverId === selectedDriver && i.status === 'IN_TRANSIT')).length})
                                                    </p>
                                                </div>
                                                <div className="bg-gray-50 rounded-lg border border-gray-200 max-h-[200px] overflow-y-auto divide-y divide-gray-100">
                                                    {bookings.flatMap(b => (b.items || []).filter(i => i.driverId === selectedDriver && i.status === 'IN_TRANSIT').map(i => ({ ...i, bookingRef: b.id })))
                                                        .map(item => (
                                                            <div key={item.id} className="p-2 flex justify-between items-center text-sm">
                                                                <div className="flex items-center gap-2 overflow-hidden">
                                                                    <div className="w-1 h-8 bg-green-500 rounded-full flex-shrink-0"></div>
                                                                    <div className="truncate">
                                                                        <p className="font-medium text-gray-800 truncate">{item.receiverName}</p>
                                                                        <p className="text-xs text-gray-400">{item.trackingCode || item.id.slice(-6)}</p>
                                                                    </div>
                                                                </div>
                                                                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded ml-2 whitespace-nowrap">Out</span>
                                                            </div>
                                                        ))
                                                    }
                                                    {bookings.flatMap(b => (b.items || []).filter(i => i.driverId === selectedDriver && i.status === 'IN_TRANSIT')).length === 0 && (
                                                        <p className="text-xs text-gray-400 text-center py-4">No parcels assigned yet.</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Task Info */}
                                        {(selectedWarehouseItem) && (
                                            <div className="bg-indigo-50 p-3 rounded-lg text-sm text-indigo-800 border border-indigo-100 mb-2">
                                                <span className="block text-xs font-bold uppercase text-indigo-400 mb-1">Selected Task</span>
                                                {`Deliver ${selectedWarehouseItem?.item.receiverName}'s parcel`}
                                            </div>
                                        )}

                                        {/* Driver List */}
                                        <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-[300px]">
                                            <div className="flex justify-between items-center sticky top-0 bg-white pb-2">
                                                <p className="text-xs font-bold text-gray-500 uppercase">Available Drivers ({drivers.length})</p>
                                                <div className="flex items-center gap-2">
                                                    {selectedDriver && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedDriver(null);
                                                                // Don't clear warehouse item on reset, just driver
                                                            }}
                                                            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                                                            title="Clear selected driver"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                            </svg>
                                                            Reset
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setIsDriverScanOpen(true)}
                                                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                                                        title="Scan Driver QR Code"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                                        </svg>
                                                        Scan Driver
                                                    </button>
                                                </div>
                                            </div>
                                            {drivers.map(driver => {
                                                const isEligible = isDriverEligible(driver);
                                                const balance = getDriverBalance(driver);
                                                return (
                                                    <div
                                                        key={driver.id}
                                                        onClick={() => setSelectedDriver(driver.id)}
                                                        className={`p-3 rounded-lg border flex items-center space-x-3 transition-all cursor-pointer ${selectedDriver === driver.id
                                                            ? 'bg-green-50 border-green-500 ring-1 ring-green-500'
                                                            : isEligible
                                                                ? 'bg-white border-gray-200 hover:bg-gray-50'
                                                                : 'bg-red-50 border-red-200 opacity-80'
                                                            }`}
                                                    >
                                                        <div className="h-9 w-9 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 relative">
                                                            {driver.name.charAt(0)}
                                                            {driver.linkedUserId && (
                                                                <span className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 border-2 border-white rounded-full" title="App Connected"></span>
                                                            )}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-start">
                                                                <p className="text-sm font-medium text-gray-900">{driver.name}</p>
                                                                {!isEligible && (
                                                                    <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 rounded">BLOCKED</span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col gap-1 mt-1">
                                                                <div className="flex gap-2">
                                                                    <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 rounded">{driver.vehicleType}</span>
                                                                    {driver.zone && <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 rounded">{driver.zone}</span>}
                                                                </div>
                                                                {!isEligible && (
                                                                    <p className="text-[10px] text-red-600 font-medium">
                                                                        Owes:
                                                                        {Math.abs(balance.usd) > 0.01 && ` $${balance.usd.toFixed(2)}`}
                                                                        {Math.abs(balance.khr) > 1 && ` ${balance.khr.toLocaleString()} KHR`}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {selectedDriver === driver.id && (
                                                            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {drivers.length === 0 && <p className="text-xs text-red-500 text-center py-4">No active drivers found.</p>}
                                        </div>

                                        {/* Confirmation Button */}
                                        {(selectedWarehouseItem) && (
                                            <Button
                                                className="w-full mt-4"
                                                disabled={!selectedDriver}
                                                onClick={() => {
                                                    handleAssignWarehouseItem();
                                                    // Close mobile panel after assignment if logic succeeds (handled inside func?) 
                                                    // Actually handleAssignWarehouseItem clears selection, which will clear the header text, 
                                                    // but we might want to close the panel or keep it open for next? 
                                                    // Let's close it on mobile for better UX.
                                                    if (window.innerWidth < 1024) setIsMobilePanelOpen(false);
                                                }}
                                            >
                                                Confirm Assignment
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

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
                            <div id="dispatch-reader" className="w-full"></div>
                        </div>
                        <div className="p-4 bg-gray-50 text-center text-xs text-gray-500">
                            Point camera at the parcel barcode to assign instantly.
                        </div>
                    </div>
                </div>
            )}

            {/* Driver QR Scan Modal */}
            {isDriverScanOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-90 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">
                        <div className="p-4 bg-indigo-600 flex justify-between items-center">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Scan Driver Badge
                            </h3>
                            <button onClick={() => setIsDriverScanOpen(false)} className="text-white hover:text-indigo-200">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-4">
                            <div id="driver-qr-reader" className="w-full"></div>
                        </div>
                        <div className="p-4 bg-indigo-50 text-center">
                            <p className="text-xs text-indigo-600 font-medium">Point camera at driver's employee badge QR code</p>
                            <p className="text-[10px] text-indigo-400 mt-1">Scans employeeCode to auto-select driver</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
