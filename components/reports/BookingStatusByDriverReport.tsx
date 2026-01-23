import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../src/shared/contexts/DataContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useLanguage } from '../../src/shared/contexts/LanguageContext';
import { logisticsService } from '../../src/shared/services/logisticsService';
import { ParcelBooking, Employee } from '../../src/shared/types';
import { Search, RotateCw, Download } from 'lucide-react';
import { TrackingTimeline } from '../customer/TrackingTimeline';

export const BookingStatusByDriverReport: React.FC = () => {
    // Context Data
    const { employees } = useData();

    // Local State
    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [loading, setLoading] = useState(false);
    const [viewingBooking, setViewingBooking] = useState<ParcelBooking | null>(null);

    // Filters
    const [selectedDriverId, setSelectedDriverId] = useState<string>('');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [statusFilter, setStatusFilter] = useState<string>('ALL');

    // Derived Data
    const drivers = useMemo(() => {
        return employees.filter(e => e.isDriver);
    }, [employees]);

    const formatCurrency = (val: number, currency: string = 'USD') => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(val);
    };

    const fetchBookings = async () => {
        setLoading(true);
        try {
            // Fetch all recent bookings first (optimized) or fetch by driver if selected
            // For now, we'll fetch all and filter in memory or use the service's efficient queries if available.
            // Using a simple strategy: Fetch all for date range if possible, or just fetch all and filter client side 
            // since Firestore doesn't support complex multi-field inequalities easily without composite indexes.
            // IMPROVEMENT: Use logisticsService to fetch by date range or driver.

            // Let's rely on the service to get bookings. The service has `getParcelBookings` which gets everything (collection).
            // This might be heavy. Let's try to use `getDriverJobs` if a driver is selected, OR `getParcelBookings` if not.

            let data: ParcelBooking[] = [];

            if (selectedDriverId) {
                data = await logisticsService.getDriverJobs(selectedDriverId);
            } else {
                data = await logisticsService.getParcelBookings();
            }

            // Client-side filtering for Date and Status
            const start = new Date(startDate).getTime();
            const end = new Date(endDate).getTime() + (24 * 60 * 60 * 1000) - 1; // End of day

            const filtered = data.filter(b => {
                const bookingDate = b.createdAt || 0;
                const matchesDate = bookingDate >= start && bookingDate <= end;
                const matchesStatus = statusFilter === 'ALL' || b.statusId === statusFilter || b.status === statusFilter;

                // If driver was selected, `getDriverJobs` returns involved jobs. 
                // We might want to be stricter: is he the *assigned* driver?
                // The requirement says "Booking status by driver", implying we want to see their workload.
                // Depending on interpretation, involved is good, or assigned is better.
                // Let's stick to the filter `driverId` property for strict assignment if desired, 
                // but `getDriverJobs` is broader. 
                // Let's filter by `driverId` strictly if a driver is selected in the UI dropdown 
                // to be precise about "whose booking this is".
                const matchesDriver = !selectedDriverId || b.driverId === selectedDriverId;

                return matchesDate && matchesStatus && matchesDriver;
            });

            setBookings(filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));

        } catch (error) {
            console.error("Error fetching report data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Initial fetch
    useEffect(() => {
        fetchBookings();
    }, []);

    const handleSearch = () => {
        fetchBookings();
    };

    const handlePrint = () => {
        window.print();
    };

    // Aggregation Logic
    const driverSummary = useMemo(() => {
        const summary: Record<string, {
            driverName: string;
            total: number;
            pending: number;
            pickup: number;
            outForDelivery: number;
            delivered: number;
            cancelled: number;
            returned: number;
        }> = {};

        bookings.forEach(b => {
            const dId = b.driverId || 'unassigned';
            if (!summary[dId]) {
                summary[dId] = {
                    driverName: b.driverId ? (b.driverName || 'Unknown Driver') : 'Unassigned',
                    total: 0,
                    pending: 0,
                    pickup: 0,
                    outForDelivery: 0,
                    delivered: 0,
                    cancelled: 0,
                    returned: 0
                };
            }
            summary[dId].total++;

            const s = (b.statusId || b.status || '').toLowerCase();
            // Map statuses loosely to categories
            if (s.includes('pending')) summary[dId].pending++;
            else if (s.includes('pickup') || s.includes('picked')) summary[dId].pickup++;
            else if (s.includes('out') || s.includes('transit')) summary[dId].outForDelivery++;
            else if (s.includes('delivered') || s.includes('complete')) summary[dId].delivered++;
            else if (s.includes('cancel')) summary[dId].cancelled++;
            else if (s.includes('return')) summary[dId].returned++;
            else summary[dId].pending++; // Fallback or 'other'
        });

        return Object.values(summary).sort((a, b) => b.total - a.total);
    }, [bookings]);

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-col space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <h2 className="text-xl font-bold text-gray-800">Booking Status by Driver</h2>
                        <div className="flex space-x-2">
                            <Button variant="outline" onClick={handlePrint} className="print:hidden">
                                <Download className="w-4 h-4 mr-2" />
                                Print / PDF
                            </Button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100 print:hidden">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Driver</label>
                            <select
                                className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-indigo-500"
                                value={selectedDriverId}
                                onChange={(e) => setSelectedDriverId(e.target.value)}
                            >
                                <option value="">All Drivers</option>
                                {drivers.map(d => (
                                    <option key={d.id} value={d.linkedUserId || d.id}>{d.name} ({d.phone})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                            <select
                                className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-indigo-500"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="ps-pending">Pending</option>
                                <option value="ps-pickup">Picked Up</option>
                                <option value="ps-transit">In Transit</option>
                                <option value="ps-out-for-delivery">Out for Delivery</option>
                                <option value="ps-delivered">Delivered</option>
                                <option value="ps-returned">Returned</option>
                                <option value="ps-cancelled">Cancelled</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                            <input
                                type="date"
                                className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                            <div className="flex space-x-2">
                                <input
                                    type="date"
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                                <Button onClick={handleSearch} disabled={loading}>
                                    {loading ? <RotateCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Summary Table */}
            <Card>
                <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Summary by Driver</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver Name</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider text-yellow-600">Pending</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider text-blue-600">Picked Up</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider text-purple-600">Delivery</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider text-green-600">Delivered</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider text-red-600">Cancelled</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider text-orange-600">Returned</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 text-sm">
                            {driverSummary.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-4 text-center text-gray-500">No data available for summary.</td>
                                </tr>
                            )}
                            {driverSummary.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-6 py-3 font-medium text-gray-900">{row.driverName}</td>
                                    <td className="px-6 py-3 text-right font-bold">{row.total}</td>
                                    <td className="px-6 py-3 text-right text-yellow-600">{row.pending || '-'}</td>
                                    <td className="px-6 py-3 text-right text-blue-600">{row.pickup || '-'}</td>
                                    <td className="px-6 py-3 text-right text-purple-600">{row.outForDelivery || '-'}</td>
                                    <td className="px-6 py-3 text-right text-green-600">{row.delivered || '-'}</td>
                                    <td className="px-6 py-3 text-right text-red-600">{row.cancelled || '-'}</td>
                                    <td className="px-6 py-3 text-right text-orange-600">{row.returned || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Card>
                <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Detailed Booking List</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sender</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receiver</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Fee</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">COD</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 text-sm">
                            {bookings.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                                        No bookings found matching filters.
                                    </td>
                                </tr>
                            )}
                            {bookings.map((booking) => (
                                <tr
                                    key={booking.id}
                                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                                    onClick={() => setViewingBooking(booking)}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                                        {new Date(booking.createdAt || 0).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-indigo-600">
                                        {booking.id}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                                        {booking.driverName || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                        <div className="text-gray-900">{booking.senderName}</div>
                                        <div className="text-xs">{booking.senderPhone}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                        {booking.items && booking.items.length > 0 ? (
                                            <div>
                                                <div className="text-gray-900">{booking.items[0].receiverName}</div>
                                                <div className="text-xs">{booking.items[0].receiverPhone}</div>
                                                {booking.items.length > 1 && <span className="text-xs text-gray-400">+{booking.items.length - 1} more</span>}
                                            </div>
                                        ) : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium 
                                            ${booking.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                                                booking.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                                    booking.status === 'PENDING' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'}`}>
                                            {booking.status || booking.statusId}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900">
                                        {formatCurrency(booking.totalDeliveryFee || 0, booking.currency)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900">
                                        {/* Sum COD of items */}
                                        {formatCurrency(
                                            (booking.items || []).reduce((acc, item) => acc + (item.productPrice || 0), 0),
                                            booking.currency // Assuming COD matches booking currency for simplicity, or we can check item.codCurrency
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* View Details Modal */}
            {viewingBooking && (
                <TrackingTimeline
                    booking={viewingBooking}
                    onClose={() => setViewingBooking(null)}
                />
            )}
        </div>
    );
};
