
import React, { useState, useEffect, useMemo } from 'react';
import { ParcelBooking, ParcelItem } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { TrackingTimeline } from '../customer/TrackingTimeline';

interface TransitItem {
    bookingId: string;
    bookingRef: string;
    itemId: string;
    trackingCode: string;
    receiverName: string;
    destination: string;
    driverName: string;
    senderName: string;
    transitStartTime: number;
    daysInTransit: number;
    status: string;
}

export const InTransitAgingReport: React.FC = () => {
    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterDays, setFilterDays] = useState<number>(0); // 0 = All
    
    // Detail View State
    const [viewingBooking, setViewingBooking] = useState<ParcelBooking | null>(null);
    const [highlightItemId, setHighlightItemId] = useState<string | undefined>(undefined);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const data = await firebaseService.getParcelBookings();
                setBookings(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const reportData = useMemo(() => {
        const items: TransitItem[] = [];
        const now = Date.now();

        bookings.forEach(b => {
            // Skip if whole booking is done/cancelled
            if (b.status === 'COMPLETED' || b.status === 'CANCELLED') return;

            (b.items || []).forEach(item => {
                if (item.status === 'IN_TRANSIT') {
                    // Determine when it went into transit
                    let startTime = b.createdAt; // Default fallback
                    
                    if (item.modifications && item.modifications.length > 0) {
                        // Find the LATEST 'IN_TRANSIT' status change
                        const transitMod = [...item.modifications]
                            .reverse()
                            .find(m => m.field === 'Status' && m.newValue === 'IN_TRANSIT');
                        
                        if (transitMod) {
                            startTime = transitMod.timestamp;
                        }
                    }

                    const diffMs = now - startTime;
                    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                    items.push({
                        bookingId: b.id,
                        bookingRef: (b.id || '').slice(-6),
                        itemId: item.id,
                        trackingCode: item.trackingCode || 'N/A',
                        receiverName: item.receiverName,
                        destination: item.destinationAddress,
                        driverName: item.driverName || 'Unassigned',
                        senderName: b.senderName,
                        transitStartTime: startTime,
                        daysInTransit: days,
                        status: item.status
                    });
                }
            });
        });

        // Sort by oldest first (highest days)
        return items
            .filter(i => i.daysInTransit >= filterDays)
            .sort((a, b) => b.daysInTransit - a.daysInTransit);
    }, [bookings, filterDays]);

    const stats = useMemo(() => {
        return {
            total: reportData.length,
            critical: reportData.filter(i => i.daysInTransit > 3).length,
            warning: reportData.filter(i => i.daysInTransit > 1 && i.daysInTransit <= 3).length
        };
    }, [reportData]);

    const handleViewDetail = (bookingId: string, itemId: string) => {
        const booking = bookings.find(b => b.id === bookingId);
        if (booking) {
            setViewingBooking(booking);
            setHighlightItemId(itemId);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
                <div className="flex gap-2 items-center">
                    <label className="text-sm font-medium text-gray-700">Show Aging &gt;</label>
                    <select 
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        value={filterDays}
                        onChange={e => setFilterDays(Number(e.target.value))}
                    >
                        <option value={0}>All In-Transit</option>
                        <option value={1}>1 Day</option>
                        <option value={3}>3 Days (Critical)</option>
                        <option value={7}>7 Days</option>
                    </select>
                </div>
                <Button variant="outline" onClick={() => window.print()}>Print Report</Button>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <Card className="bg-blue-50 border-blue-200">
                    <div className="text-xs font-bold text-blue-800 uppercase">Total In-Transit</div>
                    <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
                </Card>
                <Card className="bg-orange-50 border-orange-200">
                    <div className="text-xs font-bold text-orange-800 uppercase">Delayed (&gt;1 Day)</div>
                    <div className="text-2xl font-bold text-orange-900">{stats.warning}</div>
                </Card>
                <Card className="bg-red-50 border-red-200">
                    <div className="text-xs font-bold text-red-800 uppercase">Critical (&gt;3 Days)</div>
                    <div className="text-2xl font-bold text-red-900">{stats.critical}</div>
                </Card>
            </div>

            <Card title="In-Transit Aging Details">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Aging</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Since</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Ref / Tracking</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Receiver / Dest</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Current Driver</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {loading ? (
                                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading data...</td></tr>
                            ) : reportData.length === 0 ? (
                                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No items matching criteria.</td></tr>
                            ) : (
                                reportData.map((item, idx) => {
                                    const isCritical = item.daysInTransit > 3;
                                    const isWarning = item.daysInTransit > 1;
                                    
                                    return (
                                        <tr key={`${item.bookingId}-${item.itemId}`} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded font-bold text-xs ${
                                                    isCritical ? 'bg-red-100 text-red-800' :
                                                    isWarning ? 'bg-orange-100 text-orange-800' :
                                                    'bg-green-100 text-green-800'
                                                }`}>
                                                    {item.daysInTransit} Days
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {new Date(item.transitStartTime).toLocaleDateString()}
                                                <div className="text-[10px] text-gray-400">
                                                    {new Date(item.transitStartTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-mono font-bold text-gray-900">{item.trackingCode}</div>
                                                <div className="text-xs text-gray-500">Booking #{item.bookingRef}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900">{item.receiverName}</div>
                                                <div className="text-xs text-gray-500 truncate max-w-xs" title={item.destination}>
                                                    {item.destination}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-indigo-600 font-medium">{item.driverName}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button 
                                                    onClick={() => handleViewDetail(item.bookingId, item.itemId)}
                                                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded border border-gray-300 transition-colors"
                                                >
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Detail Modal */}
            {viewingBooking && (
                <TrackingTimeline 
                    booking={viewingBooking} 
                    initialChatItemId={highlightItemId}
                    onClose={() => {
                        setViewingBooking(null);
                        setHighlightItemId(undefined);
                    }} 
                />
            )}
        </div>
    );
};
