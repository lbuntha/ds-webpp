import React, { useState, useEffect, useMemo } from 'react';
import { ParcelBooking, ParcelStatusConfig, ParcelItem, Customer } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { TrackingTimeline } from '../customer/TrackingTimeline';
import { useLanguage } from '../../src/shared/contexts/LanguageContext';
import { toast } from '../../src/shared/utils/toast';

const ITEMS_PER_PAGE = 20;

export const ParcelList: React.FC = () => {
    const { t } = useLanguage();
    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [statuses, setStatuses] = useState<ParcelStatusConfig[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
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
    const [selectedStatusId, setSelectedStatusId] = useState('');

    // View Detail Modal
    const [viewingBooking, setViewingBooking] = useState<ParcelBooking | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [bookingsData, statusData, customersData] = await Promise.all([
                firebaseService.getParcelBookings(),
                firebaseService.getParcelStatuses(),
                firebaseService.getCustomers()
            ]);
            setBookings(bookingsData); // Sorting happens in useMemo
            setStatuses(statusData);
            setCustomers(customersData);
        } catch (e) {
            console.error("Failed to load data", e);
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

        // 3. Status Filter
        if (statusFilter) {
            result = result.filter(b => b.statusId === statusFilter || b.status === statusFilter);
        }

        // 4. Date Range Filter
        if (dateFrom) {
            result = result.filter(b => b.bookingDate >= dateFrom);
        }
        if (dateTo) {
            result = result.filter(b => b.bookingDate <= dateTo);
        }

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
        return `$${usd.toFixed(2)}`;
    };

    // Calculate total fee split by currency (using per-item fees)
    const calculateTotalFee = (items: ParcelItem[]) => {
        if (!items) return '-';
        let usd = 0;
        let khr = 0;
        items.forEach(i => {
            const fee = Number(i.deliveryFee) || 0;
            if (i.codCurrency === 'KHR') khr += fee;
            else usd += fee;
        });

        if (usd === 0 && khr === 0) return '-';
        if (usd > 0 && khr > 0) return `$${usd.toFixed(2)} + ${khr.toLocaleString()}៛`;
        if (khr > 0) return `${khr.toLocaleString()} ៛`;
        return `$${usd.toFixed(2)}`;
    };

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
        setSelectedStatusId(booking.statusId || '');
    };

    const handleUpdateStatus = async () => {
        if (!updatingBooking || !selectedStatusId) return;

        const user = await firebaseService.getCurrentUser();
        const userName = user?.name || 'Unknown Staff';
        const userId = user?.uid || 'uid-unknown';

        try {
            await firebaseService.updateParcelStatus(updatingBooking.id, selectedStatusId, userId, userName);
            setUpdatingBooking(null);
            loadData();
        } catch (e) {
            console.error(e);
            toast.error("Failed to update status.");
        }
    };



    return (
        <Card title={t('parcel_list')}>
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
                                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {b.bookingDate}
                                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">{(b.id || '').slice(-6)}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                        {b.senderName}
                                        <div className="text-xs text-gray-500">{b.senderPhone}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700">{b.serviceTypeName}</td>
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
                                                onClick={() => setViewingBooking(b)}
                                                className="text-gray-600 hover:text-gray-900 text-xs font-medium border border-gray-200 px-2 py-1 rounded hover:bg-gray-50"
                                                title="View Details"
                                            >
                                                {t('view')}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Update Delivery Status</h3>
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Move <strong>{updatingBooking.senderName}'s</strong> parcel to:
                            </p>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {statuses.map(s => (
                                    <label key={s.id} className={`flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${selectedStatusId === s.id ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
                                        <input
                                            type="radio"
                                            name="status"
                                            value={s.id}
                                            checked={selectedStatusId === s.id}
                                            onChange={() => setSelectedStatusId(s.id)}
                                            className="text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <div className="ml-3 flex-1">
                                            <span className="block text-sm font-medium text-gray-900">{s.label}</span>
                                            {s.triggersRevenue && (
                                                <span className="text-[10px] text-green-600 font-medium bg-green-50 px-1.5 rounded">Records Revenue</span>
                                            )}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3 mt-6">
                            <Button variant="outline" onClick={() => setUpdatingBooking(null)}>{t('cancel')}</Button>
                            <Button onClick={handleUpdateStatus}>{t('save')}</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Details Modal */}
            {viewingBooking && (
                <TrackingTimeline
                    booking={viewingBooking}
                    onClose={() => setViewingBooking(null)}
                />
            )}
        </Card>
    );
};
