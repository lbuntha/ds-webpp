import React, { useState, useEffect, useMemo } from 'react';
import { ParcelBooking, ParcelItem, Branch, ParcelServiceType } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';
import { calculateDeliveryFee } from '../../src/shared/utils/feeCalculator';

const ITEMS_PER_PAGE = 20;

export const ParcelOperations: React.FC = () => {
    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [services, setServices] = useState<ParcelServiceType[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);

    // View State
    const [viewMode, setViewMode] = useState<'CARD' | 'TABLE'>('TABLE');
    const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PICKED_UP' | 'IN_TRANSIT'>('ALL');
    const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().split('T')[0]);
    const [currentPage, setCurrentPage] = useState(1);

    // Selection State (for Bulk Actions)
    const [selectedBookingIds, setSelectedBookingIds] = useState<Set<string>>(new Set());

    // Verify Modal State
    const [verifyItem, setVerifyItem] = useState<ParcelItem | null>(null);
    const [weightInput, setWeightInput] = useState(0);
    const [currentBookingId, setCurrentBookingId] = useState('');
    const [editMode, setEditMode] = useState<'VERIFY' | 'EDIT'>('VERIFY'); // New: Edit mode doesn't change status

    // Editable parcel fields
    const [editReceiverName, setEditReceiverName] = useState('');
    const [editReceiverPhone, setEditReceiverPhone] = useState('');
    const [editCodAmount, setEditCodAmount] = useState(0);
    const [editCodCurrency, setEditCodCurrency] = useState<'USD' | 'KHR'>('USD');
    const [editDeliveryFee, setEditDeliveryFee] = useState(0);

    // Transfer/Branch Selection Modal
    const [transferItem, setTransferItem] = useState<{ bookingIds: string[] } | null>(null);
    const [targetBranchId, setTargetBranchId] = useState('');

    // Bulk Confirm Modal
    const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [bData, brData, sData] = await Promise.all([
                firebaseService.getParcelBookings(),
                firebaseService.getBranches(),
                firebaseService.getParcelServices()
            ]);
            // Filter out completed/cancelled immediately to reduce noise
            const active = bData.filter(b => b.status !== 'CANCELLED' && b.status !== 'COMPLETED');
            setBookings(active);
            setBranches(brData);
            setServices(sData);
            if (brData.length > 0) setTargetBranchId(brData[0].id);
        } catch (e) {
            // console.error("Failed to load data", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // --- FILTERING & PAGINATION LOGIC ---
    const filteredBookings = useMemo(() => {
        return bookings.filter(b => {
            // Date Filter (Optional: clear date to show all)
            if (dateFilter && b.bookingDate !== dateFilter) return false;

            const bItems = b.items || [];

            // Status Filter
            if (statusFilter !== 'ALL') {
                if (statusFilter === 'PENDING' && b.status !== 'PENDING') return false;
                if (statusFilter === 'PICKED_UP' && !bItems.some(i => i.status === 'PICKED_UP')) return false;
                if (statusFilter === 'IN_TRANSIT' && b.status !== 'IN_TRANSIT') return false;
            }

            // Search Filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matches =
                    (b.senderName || '').toLowerCase().includes(term) ||
                    (b.senderPhone || '').includes(term) ||
                    (b.id || '').toLowerCase().includes(term) ||
                    bItems.some(i => (i.receiverName || '').toLowerCase().includes(term) || (i.trackingCode && i.trackingCode.toLowerCase().includes(term)));
                if (!matches) return false;
            }

            return true;
        }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }, [bookings, searchTerm, statusFilter, dateFilter]);

    const paginatedBookings = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredBookings.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredBookings, currentPage]);

    const totalPages = Math.ceil(filteredBookings.length / ITEMS_PER_PAGE);

    // --- STATS SUMMARY ---
    const stats = useMemo(() => {
        const totalItems = filteredBookings.reduce((sum, b) => sum + (b.items || []).length, 0);
        const totalCOD = filteredBookings.reduce((sum, b) => {
            return sum + (b.items || []).reduce((isum, i) => isum + (Number(i.productPrice) || 0), 0);
        }, 0);
        return { count: filteredBookings.length, items: totalItems, estCod: totalCOD };
    }, [filteredBookings]);

    // --- ACTIONS ---

    const toggleExpand = (id: string) => {
        if (expandedBookingId === id) setExpandedBookingId(null);
        else setExpandedBookingId(id);
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedBookingIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedBookingIds(next);
    };

    const selectAllPage = () => {
        if (selectedBookingIds.size === paginatedBookings.length && paginatedBookings.length > 0) {
            setSelectedBookingIds(new Set());
        } else {
            const ids = new Set(paginatedBookings.map(b => b.id));
            setSelectedBookingIds(ids);
        }
    };

    const openVerify = (bookingId: string, item: ParcelItem, mode: 'VERIFY' | 'EDIT' = 'VERIFY') => {
        setCurrentBookingId(bookingId);
        setVerifyItem(item);
        setWeightInput(item.weight || 0);
        setEditReceiverName(item.receiverName || '');
        setEditReceiverPhone(item.receiverPhone || '');
        setEditCodAmount(item.productPrice || 0);
        setEditCodCurrency(item.codCurrency || 'USD');
        setEditDeliveryFee(item.deliveryFee || 0);
        setEditMode(mode);
    };

    const handleSaveVerify = async () => {
        if (!currentBookingId || !verifyItem) return;

        setProcessing(true);
        try {
            const booking = bookings.find(b => b.id === currentBookingId);
            if (!booking) return;

            // Detect if this is a delivered item being edited
            const isDelivered = verifyItem.status === 'DELIVERED';
            const codChanged = verifyItem.productPrice !== editCodAmount;
            const feeChanged = verifyItem.deliveryFee !== editDeliveryFee;
            const currencyChanged = verifyItem.codCurrency !== editCodCurrency;

            // Calculate differences for adjustment transactions
            const oldCOD = verifyItem.productPrice || 0;
            const newCOD = editCodAmount || 0;
            const oldFee = verifyItem.deliveryFee || 0;
            const newFee = editDeliveryFee || 0;
            const oldCurrency = verifyItem.codCurrency || 'USD';
            const newCurrency = editCodCurrency || 'USD';

            // Warehouse can only edit item details - NO status changes allowed
            const updatedItems = (booking.items || []).map(i => {
                if (i.id === verifyItem.id) {
                    return {
                        ...i,
                        weight: weightInput,
                        receiverName: editReceiverName,
                        receiverPhone: editReceiverPhone,
                        productPrice: editCodAmount,
                        codCurrency: editCodCurrency,
                        deliveryFee: editDeliveryFee,
                    };
                }
                return i;
            });

            // Don't change booking status - warehouse only edits data
            const updatedBooking = { ...booking, items: updatedItems };

            await firebaseService.saveParcelBooking(updatedBooking);

            // --- WALLET ADJUSTMENT LOGIC FOR DELIVERED ITEMS ---
            if (isDelivered && (codChanged || feeChanged || currencyChanged)) {
                try {
                    // Note: Customer wallet entries (COD/Fee) are computed dynamically from booking items,
                    // so they will auto-update. However, we should log the adjustment for transparency.

                    // For driver commissions, we need to create adjustment transactions
                    // since commissions are stored as actual wallet_transactions

                    // Only process fee-based adjustments if fee changed and currency is same
                    // (cross-currency adjustments are complex and should be handled separately)
                    if (feeChanged && !currencyChanged) {
                        const feeDifference = newFee - oldFee;

                        // Adjust collector commission (if exists)
                        if (verifyItem.collectorId && verifyItem.pickupCommission) {
                            // Commission is typically a percentage of fee, so recalculate
                            // For simplicity, we'll create a proportional adjustment
                            const commissionRate = verifyItem.pickupCommission / oldFee;
                            const commissionAdjustment = feeDifference * commissionRate;

                            if (Math.abs(commissionAdjustment) > 0.01) {
                                await firebaseService.processWalletTransaction(
                                    verifyItem.collectorId,
                                    commissionAdjustment,
                                    oldCurrency,
                                    'EARNING',
                                    '',
                                    `Pickup Commission Adjustment: ${verifyItem.receiverName} (${booking.id.slice(-4)}) - Fee ${oldFee} → ${newFee}`
                                );
                            }
                        }

                        // Adjust deliverer commission (if exists)
                        if (verifyItem.delivererId && verifyItem.deliveryCommission) {
                            const commissionRate = verifyItem.deliveryCommission / oldFee;
                            const commissionAdjustment = feeDifference * commissionRate;

                            if (Math.abs(commissionAdjustment) > 0.01) {
                                await firebaseService.processWalletTransaction(
                                    verifyItem.delivererId,
                                    commissionAdjustment,
                                    oldCurrency,
                                    'EARNING',
                                    '',
                                    `Delivery Commission Adjustment: ${verifyItem.receiverName} (${booking.id.slice(-4)}) - Fee ${oldFee} → ${newFee}`
                                );
                            }
                        }
                    }

                    /* console.log('✅ Wallet adjustments processed for delivered item edit:', {
                        itemId: verifyItem.id,
                        codChange: codChanged ? `${oldCOD} → ${newCOD}` : 'none',
                        feeChange: feeChanged ? `${oldFee} → ${newFee}` : 'none',
                        currencyChange: currencyChanged ? `${oldCurrency} → ${newCurrency}` : 'none'
                    }); */
                } catch (error) {
                    // console.error('Failed to process wallet adjustments:', error);
                    toast.error('Item updated but wallet adjustment failed. Please check manually.');
                }
            }

            // Update local state
            setBookings(prev => prev.map(b => b.id === currentBookingId ? updatedBooking : b));
            setVerifyItem(null);
            toast.success(isDelivered && (codChanged || feeChanged) ?
                "Parcel details and wallet adjustments updated." :
                "Parcel details updated.");
        } catch (e) {
            // console.error("Failed to save changes", e);
            toast.error("Failed to save changes");
        } finally {
            setProcessing(false);
        }
    };

    const handleBulkTransfer = async () => {
        if (!transferItem || !targetBranchId) return;
        setProcessing(true);
        try {
            // Process sequentially to avoid race conditions on backend
            for (const bid of transferItem.bookingIds) {
                const booking = bookings.find(b => b.id === bid);
                if (booking) {
                    const updatedItems = (booking.items || []).map(i => ({
                        ...i,
                        status: 'IN_TRANSIT' as const,
                        targetBranchId
                    }));
                    await firebaseService.saveParcelBooking({
                        ...booking,
                        items: updatedItems,
                        status: 'IN_TRANSIT'
                    });
                }
            }
            await loadData();
            setTransferItem(null);
            setSelectedBookingIds(new Set());
            toast.success(`Successfully transferred ${transferItem.bookingIds.length} bookings.`);
        } catch (e) {
            toast.error("Bulk transfer failed.");
        } finally {
            setProcessing(false);
        }
    };

    const handleBulkConfirmClick = () => {
        if (selectedBookingIds.size === 0) return;
        setShowBulkConfirmModal(true);
    };

    const executeBulkConfirm = async () => {
        setProcessing(true);
        try {
            const ids = Array.from(selectedBookingIds);
            for (const bid of ids) {
                const booking = bookings.find(b => b.id === bid);
                if (booking && booking.status === 'PENDING') {
                    const updatedItems = (booking.items || []).map(i => ({
                        ...i,
                        status: 'PICKED_UP' as const
                    }));
                    await firebaseService.saveParcelBooking({
                        ...booking,
                        items: updatedItems,
                        status: 'CONFIRMED'
                    });
                }
            }
            await loadData();
            setSelectedBookingIds(new Set());
            toast.success("Bulk pickup confirmed.");
        } catch (e) {
            toast.error("Bulk confirm failed.");
        } finally {
            setProcessing(false);
            setShowBulkConfirmModal(false);
        }
    };

    // --- RENDER HELPERS ---
    const calculateTotalCOD = (items: ParcelItem[]) => {
        if (!items || items.length === 0) return '$0.00';

        let usd = 0;
        let khr = 0;
        items.forEach(i => {
            const amt = Number(i.productPrice) || 0;
            if (i.codCurrency === 'KHR') khr += amt;
            else usd += amt;
        });
        if (usd > 0 && khr > 0) return `$${usd.toFixed(2)} + ${khr.toLocaleString()}៛`;
        if (khr > 0) return `${khr.toLocaleString()} ៛`;
        return `$${usd.toFixed(2)}`;
    };

    const calculateTotalFee = (items: ParcelItem[]) => {
        if (!items || items.length === 0) return '$0.00';

        let usd = 0;
        let khr = 0;
        items.forEach(i => {
            const fee = Number(i.deliveryFee) || 0;
            if (i.codCurrency === 'KHR') khr += fee;
            else usd += fee;
        });
        if (usd > 0 && khr > 0) return `$${usd.toFixed(2)} + ${khr.toLocaleString()}៛`;
        if (khr > 0) return `${khr.toLocaleString()} ៛`;
        return `$${usd.toFixed(2)}`;
    };

    const getStatusBadge = (status: string) => {
        const map: Record<string, string> = {
            'PENDING': 'bg-yellow-100 text-yellow-800',
            'PICKED_UP': 'bg-blue-100 text-blue-700',
            'IN_TRANSIT': 'bg-purple-100 text-purple-800',
            'DELIVERED': 'bg-green-100 text-green-700',
        };
        return <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${map[status] || 'bg-gray-100'}`}>{status}</span>;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Operations Console</h2>
                    <p className="text-sm text-gray-500">Manage daily pickups and hub transfers</p>
                </div>
                <div className="flex space-x-2">
                    <Button variant="outline" onClick={loadData} isLoading={loading} className="text-xs">Refresh</Button>
                    <div className="bg-gray-100 p-1 rounded-lg flex space-x-1">
                        <button
                            onClick={() => setViewMode('CARD')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'CARD' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
                            title="Card View"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        </button>
                        <button
                            onClick={() => setViewMode('TABLE')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'TABLE' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
                            title="Table View (High Density)"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* --- FILTERS & STATS --- */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <Card className="lg:col-span-3">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Search</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Ref #, Sender, Receiver..."
                                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                        </div>
                        <div className="w-full md:w-48">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                            <input
                                type="date"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                            />
                        </div>
                        <div className="w-full md:w-48">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="PENDING">Pending Pickup</option>
                                <option value="PICKED_UP">Picked Up</option>
                                <option value="IN_TRANSIT">In Transit</option>
                            </select>
                        </div>
                    </div>
                </Card>

                <Card className="bg-indigo-50 border-indigo-100 flex flex-col justify-center">
                    <div className="text-center">
                        <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Workload</p>
                        <div className="text-2xl font-bold text-indigo-900 mt-1">{stats.count} Bookings</div>
                        <p className="text-xs text-indigo-600 mt-1">{stats.items} Items • Est. Volume</p>
                    </div>
                </Card>
            </div>

            {/* --- BULK ACTIONS --- */}
            {selectedBookingIds.size > 0 && (
                <div className="bg-indigo-900 text-white px-6 py-3 rounded-lg shadow-lg flex items-center justify-between animate-fade-in-up sticky top-4 z-20">
                    <span className="font-bold text-sm">{selectedBookingIds.size} Selected</span>
                    <div className="flex space-x-3">
                        <button
                            onClick={handleBulkConfirmClick}
                            disabled={processing}
                            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-md text-xs font-bold transition-colors"
                        >
                            Confirm Pickups
                        </button>
                        <button
                            onClick={() => setTransferItem({ bookingIds: Array.from(selectedBookingIds) })}
                            disabled={processing}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400 px-3 py-1.5 rounded-md text-xs font-bold transition-colors"
                        >
                            Transfer to Branch
                        </button>
                        <button onClick={() => setSelectedBookingIds(new Set())} className="text-indigo-300 hover:text-white">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            )}

            {/* --- DATA VIEW --- */}
            {viewMode === 'TABLE' ? (
                <Card className="p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 w-8">
                                        <input
                                            type="checkbox"
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                            checked={selectedBookingIds.size === paginatedBookings.length && paginatedBookings.length > 0}
                                            onChange={selectAllPage}
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Booking Ref</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sender</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Items</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total COD</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Fee</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200 text-sm">
                                {paginatedBookings.map(b => (
                                    <React.Fragment key={b.id}>
                                        <tr className={`hover:bg-gray-50 ${expandedBookingId === b.id ? 'bg-indigo-50/50' : ''}`}>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                                    checked={selectedBookingIds.has(b.id)}
                                                    onChange={() => toggleSelection(b.id)}
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-mono text-gray-600">
                                                {b.id.slice(-6)}
                                                <div className="text-[10px] text-gray-400">{new Date(b.createdAt || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-gray-900">{b.senderName}</div>
                                                <div className="text-xs text-gray-500">{b.senderPhone}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="max-w-xs truncate text-gray-600" title={b.pickupAddress}>{b.pickupAddress}</div>
                                                {b.serviceTypeName && <span className="text-[10px] bg-gray-100 px-1.5 rounded">{b.serviceTypeName}</span>}
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-gray-700">{(b.items || []).length}</td>
                                            <td className="px-4 py-3 text-right text-red-600 font-medium">
                                                {calculateTotalCOD(b.items)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-indigo-600 font-medium">
                                                {calculateTotalFee(b.items)}
                                            </td>
                                            <td className="px-4 py-3 text-center">{getStatusBadge(b.status)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => toggleExpand(b.id)}
                                                    className="text-indigo-600 hover:text-indigo-900 text-xs font-bold border border-indigo-100 bg-indigo-50 px-2 py-1 rounded"
                                                >
                                                    {expandedBookingId === b.id ? 'Close' : 'Manage'}
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedBookingId === b.id && (
                                            <tr>
                                                <td colSpan={9} className="bg-gray-50 p-4 border-b border-gray-200 shadow-inner">
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {(b.items || []).map((item, idx) => (
                                                            <div key={item.id} className="flex items-center justify-between bg-white p-2 rounded border border-gray-200">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="font-bold text-gray-400 text-xs w-6">#{idx + 1}</span>
                                                                    <div className="w-8 h-8 bg-gray-100 rounded overflow-hidden">
                                                                        <img src={item.image} className="w-full h-full object-cover" alt="img" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs font-bold text-gray-800">{item.receiverName}</p>
                                                                        <p className="text-[10px] text-gray-500">{item.destinationAddress}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {getStatusBadge(item.status || 'PENDING')}
                                                                    <Button
                                                                        variant="outline"
                                                                        className="h-6 text-[10px] px-2"
                                                                        onClick={() => openVerify(b.id, item, item.status === 'PENDING' ? 'VERIFY' : 'EDIT')}
                                                                    >
                                                                        Details
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {paginatedBookings.map(booking => (
                        <Card key={booking.id} className={`border transition-all ${expandedBookingId === booking.id ? 'ring-2 ring-indigo-500' : 'hover:border-indigo-300'}`}>
                            <div className="flex flex-col justify-between cursor-pointer" onClick={() => toggleExpand(booking.id)}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                            checked={selectedBookingIds.has(booking.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={() => toggleSelection(booking.id)}
                                        />
                                        <span className="font-bold text-sm text-gray-900">{booking.senderName}</span>
                                    </div>
                                    {getStatusBadge(booking.status)}
                                </div>
                                <div className="text-xs text-gray-600 mb-2 pl-6">
                                    <p>{booking.pickupAddress}</p>
                                    <p className="mt-1 text-gray-400">{booking.bookingDate}</p>
                                </div>
                                <div className="flex justify-between items-center pl-6 mt-2 border-t border-gray-50 pt-2">
                                    <span className="font-bold text-gray-800">{(booking.items || []).length} items</span>
                                    <span className="font-bold text-red-600">{calculateTotalCOD(booking.items)}</span>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-4">
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        className="px-3 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
                    >
                        Prev
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                        className="px-3 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Verify/Edit Modal */}
            {verifyItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">
                            {editMode === 'VERIFY' ? 'Verify & Pickup Parcel' : 'Edit Parcel Details'}
                        </h3>
                        <div className="flex justify-center mb-4">
                            <img
                                src={verifyItem.image}
                                className="h-40 w-40 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                                alt="verify"
                                title="Click to view full size"
                                onClick={() => window.open(verifyItem.image, '_blank')}
                            />
                        </div>
                        <p className="text-center text-xs text-gray-400 -mt-2 mb-3">Click image to zoom</p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500">Tracking ID</label>
                                <div className="font-mono font-bold text-lg">{verifyItem.trackingCode}</div>
                            </div>

                            {/* Receiver Info */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Receiver Name</label>
                                    <input
                                        type="text"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        value={editReceiverName}
                                        onChange={e => setEditReceiverName(e.target.value)}
                                        placeholder="Recipient name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                    <input
                                        type="tel"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        value={editReceiverPhone}
                                        onChange={e => setEditReceiverPhone(e.target.value)}
                                        placeholder="Phone number"
                                    />
                                </div>
                            </div>

                            {/* COD Amount */}
                            {(() => {
                                const isSettled = verifyItem?.driverSettlementStatus === 'SETTLED' || verifyItem?.customerSettlementStatus === 'SETTLED';
                                return (
                                    <>
                                        {isSettled && (
                                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                                                ⚠️ This parcel has been settled. COD and fee cannot be modified.
                                            </div>
                                        )}
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="col-span-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">COD Amount</label>
                                                <input
                                                    type="number"
                                                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500 ${isSettled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                                    value={editCodAmount || ''}
                                                    onChange={e => setEditCodAmount(parseFloat(e.target.value) || 0)}
                                                    placeholder="0.00"
                                                    disabled={isSettled}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                                                <select
                                                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500 ${isSettled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                                    value={editCodCurrency}
                                                    onChange={e => setEditCodCurrency(e.target.value as 'USD' | 'KHR')}
                                                    disabled={isSettled}
                                                >
                                                    <option value="USD">USD</option>
                                                    <option value="KHR">KHR</option>
                                                </select>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}

                            {/* Delivery Fee */}
                            {(() => {
                                const isSettled = verifyItem?.driverSettlementStatus === 'SETTLED' || verifyItem?.customerSettlementStatus === 'SETTLED';
                                return (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Fee</label>
                                        <input
                                            type="number"
                                            className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500 ${isSettled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                            value={editDeliveryFee || ''}
                                            onChange={e => setEditDeliveryFee(parseFloat(e.target.value) || 0)}
                                            placeholder="0.00"
                                            disabled={isSettled}
                                        />
                                    </div>
                                );
                            })()}

                            {/* Weight */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                                <input
                                    type="number"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    value={weightInput || ''}
                                    onChange={e => setWeightInput(parseFloat(e.target.value) || 0)}
                                    placeholder="0.0"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <Button variant="outline" onClick={() => setVerifyItem(null)}>Cancel</Button>
                            <Button
                                onClick={handleSaveVerify}
                                isLoading={processing}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Transfer Modal */}
            {transferItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Bulk Transfer</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Moving <strong>{transferItem.bookingIds.length}</strong> bookings to a branch hub.
                        </p>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Destination Branch</label>
                            <select
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                                value={targetBranchId}
                                onChange={(e) => setTargetBranchId(e.target.value)}
                            >
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setTransferItem(null)}>Cancel</Button>
                            <Button onClick={handleBulkTransfer} className="bg-indigo-600 hover:bg-indigo-700">Start Transit</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Confirm Modal */}
            {showBulkConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Bulk Pickup</h3>
                        <p className="text-sm text-gray-600 mb-6">
                            Confirm pickup for <strong>{selectedBookingIds.size}</strong> bookings? This will mark all items as <span className="text-green-600 font-bold">PICKED_UP</span>.
                        </p>

                        <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setShowBulkConfirmModal(false)}>Cancel</Button>
                            <Button onClick={executeBulkConfirm} className="bg-green-600 hover:bg-green-700">Confirm All</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
