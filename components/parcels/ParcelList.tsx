import React, { useState, useEffect, useMemo } from 'react';
import { ParcelBooking, ParcelStatusConfig, ParcelItem, Customer, Employee } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { ChatModal } from '../ui/ChatModal';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { TrackingTimeline } from '../customer/TrackingTimeline';
import { useLanguage } from '../../src/shared/contexts/LanguageContext';
import { toast } from '../../src/shared/utils/toast';
import { AssignDriverModal } from './AssignDriverModal';
import { StatusUpdateModal } from './StatusUpdateModal';

const ITEMS_PER_PAGE = 20;

const DEFAULT_STATUS_CONFIGS: ParcelStatusConfig[] = [
    { id: 'PENDING', label: 'Pending', color: 'bg-yellow-100 text-yellow-800', order: 1, isDefault: true, triggersRevenue: false, isTerminal: false },
    { id: 'CONFIRMED', label: 'Confirmed', color: 'bg-blue-100 text-blue-800', order: 2, isDefault: false, triggersRevenue: false, isTerminal: false },
    { id: 'PICKED_UP', label: 'Picked Up', color: 'bg-purple-100 text-purple-800', order: 3, isDefault: false, triggersRevenue: false, isTerminal: false },
    { id: 'AT_WAREHOUSE', label: 'At Warehouse', color: 'bg-indigo-100 text-indigo-800', order: 4, isDefault: false, triggersRevenue: false, isTerminal: false },
    { id: 'IN_TRANSIT', label: 'In Transit', color: 'bg-orange-100 text-orange-800', order: 5, isDefault: false, triggersRevenue: false, isTerminal: false },
    { id: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', color: 'bg-teal-100 text-teal-800', order: 6, isDefault: false, triggersRevenue: false, isTerminal: false },
    { id: 'DELIVERED', label: 'Delivered', color: 'bg-green-100 text-green-800', order: 7, isDefault: false, triggersRevenue: true, isTerminal: true },
    { id: 'CANCELLED', label: 'Cancelled', color: 'bg-red-100 text-red-800', order: 8, isDefault: false, triggersRevenue: false, isTerminal: true },
    { id: 'RETURN_TO_SENDER', label: 'Return to Sender', color: 'bg-red-100 text-red-800', order: 9, isDefault: false, triggersRevenue: false, isTerminal: true }
];

export const ParcelList: React.FC = () => {
    const { t } = useLanguage();
    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [statuses, setStatuses] = useState<ParcelStatusConfig[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);

    // Helper to get today's date string YYYY-MM-DD
    const getTodayString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Filters (Input State)
    const [searchTerm, setSearchTerm] = useState('');
    const [customerFilter, setCustomerFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFrom, setDateFrom] = useState(getTodayString());
    const [dateTo, setDateTo] = useState(getTodayString());

    // Active Filters (Applied State)
    // Active Filters (Applied State)
    const [appliedFilters, setAppliedFilters] = useState({
        searchTerm: '',
        customerFilter: '',
        statusFilter: '',
        dateFrom: getTodayString(),
        dateTo: getTodayString()
    });



    // Pagination
    const [currentPage, setCurrentPage] = useState(1);

    // Status Update Modal
    const [updatingBooking, setUpdatingBooking] = useState<ParcelBooking | null>(null);
    const [activeChat, setActiveChat] = useState<{ itemId: string, bookingId: string, itemName: string, recipientName: string, recipientId?: string } | null>(null);
    const [assigningBooking, setAssigningBooking] = useState<ParcelBooking | null>(null);

    const [currentUser, setCurrentUser] = useState<any>(null);

    // View Detail Modal
    const [viewingBooking, setViewingBooking] = useState<ParcelBooking | null>(null);
    // Inline Detail View
    const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

    const toggleDetails = (bookingId: string) => {
        setExpandedBookingId(prev => prev === bookingId ? null : bookingId);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [bookingsData, statusData, customersData, employeesData, user] = await Promise.all([
                firebaseService.getParcelBookings(),
                firebaseService.getParcelStatuses(),
                firebaseService.getCustomers(),
                firebaseService.hrService.getEmployees(),
                firebaseService.getCurrentUser()
            ]);
            setBookings(bookingsData); // Sorting happens in useMemo

            // Fallback to default statuses if API returns empty
            if (!statusData || statusData.length === 0) {
                setStatuses(DEFAULT_STATUS_CONFIGS);
            } else {
                setStatuses(statusData);
            }

            setCustomers(customersData);
            setEmployees(employeesData);
            setCurrentUser(user);
        } catch (e) {
            console.error("Failed to load data", e);
            // Even on error, ensure we have status configs so UI doesn't break
            setStatuses(DEFAULT_STATUS_CONFIGS);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleApplyFilters = async () => {
        setAppliedFilters({
            searchTerm,
            customerFilter,
            statusFilter,
            dateFrom,
            dateTo
        });
        setCurrentPage(1);
        await loadData();
    };

    const handleResetFilters = () => {
        const today = getTodayString();
        // Reset inputs
        setSearchTerm('');
        setCustomerFilter('');
        setStatusFilter('');
        setDateFrom(today);
        setDateTo(today);

        // Reset applied filters
        setAppliedFilters({
            searchTerm: '',
            customerFilter: '',
            statusFilter: '',
            dateFrom: today,
            dateTo: today
        });
        setCurrentPage(1);
    };

    const filteredBookings = useMemo(() => {
        let result = bookings;
        const { searchTerm, customerFilter, statusFilter, dateFrom, dateTo } = appliedFilters;

        // 1. Text Search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(b =>
                (b.senderName || '').toLowerCase().includes(term) ||
                (b.senderPhone || '').toLowerCase().includes(term) ||
                (b.id || '').toLowerCase().includes(term) ||
                (b.items || []).some(i =>
                    (i.receiverName || '').toLowerCase().includes(term) ||
                    (i.receiverPhone || '').toLowerCase().includes(term) ||
                    (i.trackingCode && i.trackingCode.toLowerCase().includes(term))
                )
            );
        }

        // 2. Customer Filter
        if (customerFilter) {
            result = result.filter(b => b.senderId === customerFilter);
        }

        if (statusFilter) {
            // Filter bookings that have AT LEAST one item with the selected status
            result = result.filter(b => (b.items || []).some(i => (i.status || 'PENDING') === statusFilter));
        }

        // 4. Date Range Filter
        if (dateFrom) {
            result = result.filter(b => b.bookingDate >= dateFrom);
        }
        if (dateTo) {
            result = result.filter(b => b.bookingDate <= dateTo);
        }

        // 5. Quick Status Filter (Item Level)


        // Sort by date desc
        return result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }, [bookings, appliedFilters]);

    // Pagination Logic
    const paginatedBookings = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredBookings.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredBookings, currentPage]);

    const totalPages = Math.ceil(filteredBookings.length / ITEMS_PER_PAGE);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, customerFilter, statusFilter, dateFrom, dateTo]);

    // Calculate Status Counts (Item Level)
    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        // Initialize with 0 for all known statuses
        statuses.forEach(s => counts[s.id] = 0);

        bookings.forEach(b => {
            (b.items || []).forEach(item => {
                const s = item.status || 'PENDING';
                counts[s] = (counts[s] || 0) + 1;
            });
        });
        return counts;
    }, [bookings, statuses]);

    const calculateTotalCOD = (items: ParcelItem[]) => {
        if (!items) return '-';
        let usd = 0;
        let khr = 0;
        items.forEach(i => {
            const amt = Number(i.productPrice) || 0;
            if (i.codCurrency === 'KHR') khr += amt;
            else usd += amt;
        });

        if (usd === 0 && khr === 0) return '-';
        if (usd > 0 && khr > 0) return `$${usd.toFixed(2)} + ${khr.toLocaleString()}៛`;
        if (khr > 0) return `${khr.toLocaleString()} ៛`;
        return `$${usd.toFixed(2)} `;
    };

    // Calculate total fee split by currency (using per-item fees)
    // Calculate total fee split by currency (using per-item fees)
    const calculateTotalFee = (items: ParcelItem[]) => {
        if (!items || items.length === 0) return '-';
        let usd = 0;
        let khr = 0;
        items.forEach(i => {
            const item = i as any;
            if (item.deliveryFeeUSD && Number(item.deliveryFeeUSD) > 0) {
                usd += Number(item.deliveryFeeUSD);
            } else if (item.deliveryFeeKHR && Number(item.deliveryFeeKHR) > 0) {
                khr += Number(item.deliveryFeeKHR);
            } else {
                const fee = Number(i.deliveryFee) || 0;
                if (fee > 0) {
                    // Heuristic: If fee >= 100, assume KHR. Else USD.
                    if (fee >= 100) {
                        khr += fee;
                    } else {
                        usd += fee;
                    }
                }
            }
        });

        if (usd === 0 && khr === 0) return '-';
        if (usd > 0 && khr > 0) return `$${usd.toFixed(2)} + ${khr.toLocaleString()}៛`;
        if (khr > 0) return `${khr.toLocaleString()} ៛`;
        return `$${usd.toFixed(2)}`;
    };

    const drivers = useMemo(() => employees.filter(e => e.isDriver), [employees]);



    const renderStatus = (booking: ParcelBooking) => {
        // Derive effective status from items if possible
        let effectiveStatus = booking.status;
        let effectiveStatusId = booking.statusId;

        if (booking.items && booking.items.length > 0) {
            // Get all unique item statuses
            const itemStatuses = Array.from(new Set(booking.items.map(i => i.status || 'PENDING')));

            // If all items have the same status, use that as the source of truth
            if (itemStatuses.length === 1) {
                effectiveStatus = itemStatuses[0];
                // If we are overriding with item status, ignore the potentially stale statusId
                if (effectiveStatus !== booking.status) {
                    effectiveStatusId = undefined;
                }
            }
        }

        if (effectiveStatusId) {
            const config = statuses.find(s => s.id === effectiveStatusId);
            if (config) {
                return (
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${config.color}`}>
                        {config.label}
                    </span>
                );
            }
        }

        const colors: Record<string, string> = {
            'PENDING': 'bg-yellow-100 text-yellow-800',
            'CONFIRMED': 'bg-blue-100 text-blue-800',
            'PICKED_UP': 'bg-purple-100 text-purple-800',
            'AT_WAREHOUSE': 'bg-indigo-100 text-indigo-800',
            'IN_TRANSIT': 'bg-orange-100 text-orange-800',
            'OUT_FOR_DELIVERY': 'bg-teal-100 text-teal-800',
            'DELIVERED': 'bg-green-100 text-green-800',
            'COMPLETED': 'bg-green-100 text-green-800',
            'CANCELLED': 'bg-red-100 text-red-800',
            'RETURN_TO_SENDER': 'bg-red-100 text-red-800'
        };

        // Format status for display (replace underscores with spaces if no translation)
        const displayLabel = effectiveStatus.replace(/_/g, ' ');

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${colors[effectiveStatus] || 'bg-gray-100'}`}>
                {displayLabel}
            </span>
        );
    };

    const openUpdateModal = (booking: ParcelBooking) => {
        if (booking.status === 'COMPLETED') {
            return;
        }
        setUpdatingBooking(booking);
    };



    return (
        <Card title={t('parcel_list')}>
            {/* Status Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
                {statuses.map(s => {
                    const count = statusCounts[s.id] || 0;
                    const isActive = statusFilter === s.id;
                    return (
                        <div
                            key={s.id}
                            onClick={() => setStatusFilter(isActive ? '' : s.id)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 ${isActive
                                ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-md transform scale-105'
                                : 'border-gray-100 bg-white hover:border-indigo-200 hover:shadow-sm'
                                }`}
                        >
                            <div className="flex flex-col">
                                <span className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${isActive ? 'text-indigo-700' : 'text-gray-500'
                                    }`}>
                                    {s.label}
                                </span>
                                <div className="flex items-end justify-between">
                                    <span className={`text-2xl font-bold leading-none ${isActive ? 'text-indigo-900' : 'text-gray-900'
                                        }`}>
                                        {count}
                                    </span>
                                    <div className={`w-2 h-2 rounded-full ${s.color.split(' ')[0].replace('text-', 'bg-')}`}></div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mb-6 space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Search */}
                    <div className="lg:col-span-1">
                        <label className="block text-xs font-bold text-gray-500 mb-1">{t('search')}</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder={t('search_placeholder')}
                                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>

                    {/* Customer Filter */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">{t('customer')}</label>
                        <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            value={customerFilter}
                            onChange={(e) => setCustomerFilter(e.target.value)}
                        >
                            <option value="">{t('all_customers')}</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">{t('status')}</label>
                        <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">{t('all_statuses')}</option>
                            {statuses.map(s => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date From */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">{t('from_date')}</label>
                        <input
                            type="date"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                    </div>

                    {/* Date To */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">{t('to_date')}</label>
                        <input
                            type="date"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                    <p className="text-xs text-gray-500">
                        {t('showing')} {paginatedBookings.length} / {filteredBookings.length}
                    </p>
                    <div className="flex gap-4">
                        <button
                            onClick={handleApplyFilters}
                            disabled={loading}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold py-2 px-4 rounded transition-colors flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Filtering...
                                </>
                            ) : (
                                'Filter'
                            )}
                        </button>
                        <button
                            onClick={handleResetFilters}
                            className="text-xs text-red-600 hover:text-red-800 font-medium hover:underline"
                        >
                            {t('reset_filters')}
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">{t('loading')}</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('date')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sender')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('service')}</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('items')}</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">COD</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('fee')}</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('status')}</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {paginatedBookings.map(b => (
                                <React.Fragment key={b.id}>
                                    <tr
                                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${expandedBookingId === b.id ? 'bg-indigo-50/50' : ''}`}
                                        onClick={() => toggleDetails(b.id)}
                                    >
                                        <td className="px-6 py-4 text-nowrap text-sm text-gray-500">
                                            <div className="font-bold text-gray-900">
                                                {new Date(b.createdAt || b.bookingDate).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </div>
                                            <div className="text-[10px] text-gray-400">
                                                {new Date(b.createdAt || b.bookingDate).toLocaleTimeString('en-US', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })} • {b.id.slice(-6).toUpperCase()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                            <span className="text-gray-900 font-bold">
                                                {b.senderName}
                                            </span>
                                            <div className="text-xs text-gray-500">{b.senderPhone}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700">
                                            <div>{(b.items?.[0] as any)?.serviceName || 'Standard'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm text-gray-600">
                                            <div className="font-bold">{(b.items || []).length}</div>
                                            {(b.items || []).length === 1 && b.items[0].trackingCode && (
                                                <div className="text-[10px] font-mono text-gray-400 mt-0.5">{b.items[0].trackingCode}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-medium text-red-600 whitespace-nowrap">
                                            {calculateTotalCOD(b.items)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-bold text-indigo-600 whitespace-nowrap">
                                            {calculateTotalFee(b.items)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {renderStatus(b)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setViewingBooking(b);
                                                    }}
                                                    className="text-gray-600 hover:text-gray-900 text-xs font-medium border border-gray-200 px-2 py-1 rounded hover:bg-gray-50"
                                                    title="View Details"
                                                >
                                                    {t('view')}
                                                </button>
                                                {b.status === 'PENDING' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setAssigningBooking(b);
                                                        }}
                                                        className="text-indigo-600 hover:text-indigo-900 text-xs font-medium border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-50"
                                                        title="Assign Driver"
                                                    >
                                                        Assign
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedBookingId === b.id && (
                                        <tr>
                                            <td colSpan={8} className="px-0 py-0 border-b border-gray-200 bg-indigo-50/30">
                                                <div className="pl-12 pr-4 py-3">
                                                    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
                                                        <table className="min-w-full divide-y divide-gray-200">
                                                            <thead className="bg-gray-50">
                                                                <tr>
                                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Images</th>
                                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Barcode</th>
                                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receiver</th>
                                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destination</th>
                                                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">COD</th>
                                                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                                                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Chat</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="bg-white divide-y divide-gray-200">
                                                                {(b.items || [])
                                                                    .filter(item => !statusFilter || (item.status || 'PENDING') === statusFilter)
                                                                    .map((item, idx) => (
                                                                        <tr key={idx} className="hover:bg-gray-50">
                                                                            <td className="px-4 py-2 text-sm">
                                                                                <div className="flex gap-2">
                                                                                    {item.image && (
                                                                                        <a href={item.image} target="_blank" rel="noopener noreferrer" className="block w-8 h-8 rounded bg-gray-100 border border-gray-200 overflow-hidden hover:opacity-80 transition-opacity" title="Parcel Image">
                                                                                            <img src={item.image} alt="Parcel" className="w-full h-full object-cover" />
                                                                                        </a>
                                                                                    )}
                                                                                    {item.proofOfDelivery ? (
                                                                                        <a href={item.proofOfDelivery} target="_blank" rel="noopener noreferrer" className="block w-8 h-8 rounded bg-green-50 border border-green-200 overflow-hidden hover:opacity-80 transition-opacity" title="Proof of Delivery">
                                                                                            <img src={item.proofOfDelivery} alt="POD" className="w-full h-full object-cover" />
                                                                                        </a>
                                                                                    ) : (item.status === 'DELIVERED' && (
                                                                                        <div className="w-8 h-8 rounded bg-red-50 border border-red-200 flex items-center justify-center" title="Missing Proof of Delivery">
                                                                                            <span className="text-[10px] text-red-500 font-bold leading-none text-center">No<br />POD</span>
                                                                                        </div>
                                                                                    ))}
                                                                                    {!item.image && !item.proofOfDelivery && item.status !== 'DELIVERED' && (
                                                                                        <span className="text-gray-300 text-xs italic">No img</span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-4 py-2 text-sm font-mono text-gray-600">
                                                                                <span className="flex items-center gap-2">
                                                                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                                                                    {item.barcode || item.trackingCode || '-'}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-4 py-2 text-sm text-gray-900">
                                                                                {item.driverName || b.driverName || <span className="text-gray-400 italic">Unassigned</span>}
                                                                            </td>
                                                                            <td className="px-4 py-2 text-sm text-gray-900 font-medium">{item.receiverName}</td>
                                                                            <td className="px-4 py-2 text-sm text-gray-500">{item.receiverPhone}</td>
                                                                            <td className="px-4 py-2 text-sm text-gray-500 truncate max-w-[150px]" title={item.destinationAddress}>{item.destinationAddress}</td>
                                                                            <td className="px-4 py-2 text-right text-sm font-medium text-red-600">
                                                                                {item.productPrice > 0
                                                                                    ? (item.codCurrency === 'KHR' ? `${item.productPrice.toLocaleString()} ៛` : `$${item.productPrice.toFixed(2)}`)
                                                                                    : '-'}
                                                                            </td>
                                                                            <td className="px-4 py-2 text-center text-xs text-gray-500 whitespace-nowrap">
                                                                                {(item.modifications && item.modifications.length > 0)
                                                                                    ? new Date(item.modifications[item.modifications.length - 1].timestamp).toLocaleString()
                                                                                    : ((b.statusHistory && b.statusHistory.length > 0) ? new Date(b.statusHistory[b.statusHistory.length - 1].timestamp).toLocaleString() : '-')}
                                                                            </td>
                                                                            <td className="px-4 py-2 text-center">
                                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${(item.status || 'PENDING') === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                                                                                    (item.status || 'PENDING') === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                                                                        'bg-gray-100 text-gray-800'
                                                                                    }`}>
                                                                                    {(item.status || b.status || 'PENDING').replace(/_/g, ' ')}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-4 py-2 text-center">
                                                                                <button
                                                                                    onClick={async (e) => {
                                                                                        e.stopPropagation();
                                                                                        const currentUser = await firebaseService.getCurrentUser();
                                                                                        // Prioritize driver, then customer
                                                                                        const targetName = item.driverName || b.senderName || 'Unknown';
                                                                                        // Ideally we need target ID, but ChatModal might handle finding it or we use system chat
                                                                                        // For now, let's pass generic info and use item-based chat room
                                                                                        setActiveChat({
                                                                                            itemId: item.id,
                                                                                            bookingId: b.id,
                                                                                            itemName: item.trackingCode ? `${item.trackingCode} - ${item.receiverName}` : item.receiverName,
                                                                                            recipientName: targetName,
                                                                                            recipientId: item.driverId || undefined // Optional, if known
                                                                                        });
                                                                                    }}
                                                                                    disabled={['DELIVERED', 'RETURN_TO_SENDER'].includes(item.status || '')}
                                                                                    className={`transition-colors p-1 rounded-full ${['DELIVERED', 'RETURN_TO_SENDER'].includes(item.status || '') ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                                                                    title={['DELIVERED', 'RETURN_TO_SENDER'].includes(item.status || '') ? "Chat disabled for completed orders" : "Chat / Comment"}
                                                                                >
                                                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                            {paginatedBookings.length === 0 && (
                                <tr><td colSpan={8} className="text-center py-8 text-gray-500">No bookings found matching your criteria.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-4">
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        className="px-3 py-1 rounded border hover:bg-gray-50 disabled:opacity-50 text-sm"
                    >
                        Prev
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-600 flex items-center">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                        className="px-3 py-1 rounded border hover:bg-gray-50 disabled:opacity-50 text-sm"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Status Update Modal */}
            {updatingBooking && (
                <StatusUpdateModal
                    isOpen={!!updatingBooking}
                    onClose={() => setUpdatingBooking(null)}
                    booking={updatingBooking}
                    statuses={statuses}
                    onSuccess={loadData}
                />
            )}

            {/* View Details Modal */}
            {viewingBooking && (
                <TrackingTimeline
                    booking={viewingBooking}
                    onClose={() => setViewingBooking(null)}
                />
            )}

            {activeChat && currentUser && (
                <ChatModal
                    itemId={activeChat.itemId}
                    bookingId={activeChat.bookingId}
                    itemName={activeChat.itemName}
                    currentUser={currentUser}
                    recipientName={activeChat.recipientName}
                    recipientId={activeChat.recipientId}
                    onClose={() => setActiveChat(null)}
                />
            )}

            {assigningBooking && (
                <AssignDriverModal
                    isOpen={!!assigningBooking}
                    onClose={() => setAssigningBooking(null)}
                    booking={assigningBooking}
                    drivers={drivers}
                    onSuccess={loadData}
                />
            )}
        </Card>
    );
};
