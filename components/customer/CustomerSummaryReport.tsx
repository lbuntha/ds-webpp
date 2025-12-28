import React, { useState, useEffect, useMemo } from 'react';
import { ParcelBooking, UserProfile, ParcelItem } from '../../src/shared/types';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useLanguage } from '../../src/shared/contexts/LanguageContext';

interface Props {
    user: UserProfile;
}

export const CustomerSummaryReport: React.FC<Props> = ({ user }) => {
    const { t } = useLanguage();
    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedBookings, setExpandedBookings] = useState<Set<string>>(new Set());

    // Date Filtering
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1); // Start of current month
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // Use secure fetch that respects Firestore rules
                const mine = await firebaseService.getUserBookings(user);
                setBookings(mine);
            } catch (e) {
                console.error("Failed to load bookings", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user]);

    const reportData = useMemo(() => {
        return bookings.filter(b => {
            // Filter based on booking Date string (YYYY-MM-DD)
            return b.bookingDate >= startDate && b.bookingDate <= endDate;
        });
    }, [bookings, startDate, endDate]);

    const stats = useMemo(() => {
        let deliveryFeesUSD = 0;
        let deliveryFeesKHR = 0;

        let codCollectedUSD = 0;
        let codCollectedKHR = 0;

        let codPendingUSD = 0;
        let codPendingKHR = 0;

        let totalOrders = reportData.length;
        let totalItems = 0;

        reportData.forEach(b => {
            if (b.status === 'CANCELLED') return;

            (b.items || []).forEach(item => {
                totalItems++;
                const amount = item.productPrice || 0;
                const fee = item.deliveryFee || 0;
                const isKHR = item.codCurrency === 'KHR';

                // Delivery fee by currency (only for delivered items)
                if (item.status === 'DELIVERED' && fee > 0) {
                    if (isKHR) deliveryFeesKHR += fee;
                    else deliveryFeesUSD += fee;
                }

                // COD logic
                if (amount > 0) {
                    if (item.status === 'DELIVERED') {
                        if (isKHR) codCollectedKHR += amount;
                        else codCollectedUSD += amount;
                    } else if (item.status !== 'RETURN_TO_SENDER') {
                        // Pending if not delivered, not returned
                        if (isKHR) codPendingKHR += amount;
                        else codPendingUSD += amount;
                    }
                }
            });
        });

        return { deliveryFeesUSD, deliveryFeesKHR, codCollectedUSD, codCollectedKHR, codPendingUSD, codPendingKHR, totalOrders, totalItems };
    }, [reportData]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    const formatDualCurrency = (usd: number, khr: number) => {
        if (usd === 0 && khr === 0) return '$0.00';
        const parts = [];
        if (usd > 0) parts.push(formatCurrency(usd));
        if (khr > 0) parts.push(`${khr.toLocaleString()} ៛`);
        return parts.join(' + ');
    };

    const toggleExpand = (id: string) => {
        setExpandedBookings(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Calculate booking-level fee split
    const getBookingFeeSplit = (items: ParcelItem[]) => {
        let usd = 0;
        let khr = 0;
        items.forEach(i => {
            const fee = i.deliveryFee || 0;
            if (i.codCurrency === 'KHR') khr += fee;
            else usd += fee;
        });
        return { usd, khr };
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExportCSV = () => {
        // Build CSV rows with item-level detail
        const rows: string[][] = [];

        // Header
        rows.push(['Date', 'Booking Ref', 'Receiver', 'Destination', 'Status', 'Delivery Fee', 'COD Amount', 'Currency']);

        reportData.forEach(b => {
            (b.items || []).forEach(item => {
                rows.push([
                    b.bookingDate,
                    `#${(b.id || '').slice(-6)}`,
                    item.receiverName || '-',
                    (item.destinationAddress || '-').replace(/,/g, ' '),  // Remove commas for CSV
                    item.status || 'PENDING',
                    (item.deliveryFee || 0).toString(),
                    (item.productPrice || 0).toString(),
                    item.codCurrency || 'USD'
                ]);
            });
        });

        // Convert to CSV string
        const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

        // Create download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `summary_report_${startDate}_${endDate}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">{t('summary_report')}</h2>
                    <p className="text-sm text-gray-500">{t('financial_overview')}</p>
                </div>
                <div className="flex items-end gap-2 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t('from_date')}</label>
                        <input
                            type="date"
                            className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t('to_date')}</label>
                        <input
                            type="date"
                            className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" onClick={handlePrint} className="h-[30px] text-xs px-3">
                        {t('print')}
                    </Button>
                    <Button variant="outline" onClick={handleExportCSV} className="h-[30px] text-xs px-3">
                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-red-50 border-red-100">
                    <div className="text-red-800 text-sm font-medium uppercase tracking-wide">{t('delivery_expenses')}</div>
                    <div className="text-3xl font-bold text-red-900 mt-1 truncate" title={formatDualCurrency(stats.deliveryFeesUSD, stats.deliveryFeesKHR)}>
                        {formatDualCurrency(stats.deliveryFeesUSD, stats.deliveryFeesKHR)}
                    </div>
                    <p className="text-xs text-red-600 mt-2">{t('total_spent_orders').replace('{0}', stats.totalOrders.toString())} </p>
                </Card>

                <Card className="bg-green-50 border-green-100">
                    <div className="text-green-800 text-sm font-medium uppercase tracking-wide">{t('cod_collected')}</div>
                    <div className="text-3xl font-bold text-green-900 mt-1 truncate" title={formatDualCurrency(stats.codCollectedUSD, stats.codCollectedKHR)}>
                        {formatDualCurrency(stats.codCollectedUSD, stats.codCollectedKHR)}
                    </div>
                    <p className="text-xs text-green-600 mt-2">{t('cash_collected_desc')}</p>
                </Card>

                <Card className="bg-blue-50 border-blue-100">
                    <div className="text-blue-800 text-sm font-medium uppercase tracking-wide">{t('cod_pending')}</div>
                    <div className="text-3xl font-bold text-blue-900 mt-1 truncate" title={formatDualCurrency(stats.codPendingUSD, stats.codPendingKHR)}>
                        {formatDualCurrency(stats.codPendingUSD, stats.codPendingKHR)}
                    </div>
                    <p className="text-xs text-blue-600 mt-2">{t('cod_pending_desc')}</p>
                </Card>
            </div>

            <Card title={t('transaction_details')}>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-gray-500 w-8"></th>
                                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('date')}</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('booking_ref')}</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('items')}</th>
                                <th className="px-4 py-3 text-center font-medium text-gray-500">{t('status')}</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-500">{t('delivery_fee')}</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-500">{t('cod_amount_table')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {reportData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                        {t('no_transactions_period')}
                                    </td>
                                </tr>
                            ) : (
                                reportData.map(b => {
                                    // Calculate COD for DELIVERED items
                                    let usd = 0;
                                    let khr = 0;
                                    (b.items || []).forEach(i => {
                                        if (i.status === 'DELIVERED') {
                                            const val = i.productPrice || 0;
                                            if (i.codCurrency === 'KHR') khr += val;
                                            else usd += val;
                                        }
                                    });

                                    const itemsCount = (b.items || []).length;
                                    const feeSplit = getBookingFeeSplit(b.items || []);
                                    const isExpanded = expandedBookings.has(b.id);

                                    return (
                                        <React.Fragment key={b.id}>
                                            <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(b.id)}>
                                                <td className="px-4 py-3">
                                                    <svg
                                                        className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">{b.bookingDate}</td>
                                                <td className="px-4 py-3 font-mono text-gray-900">#{(b.id || '').slice(-6)}</td>
                                                <td className="px-4 py-3 text-gray-600">{itemsCount} Items</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${b.status === 'COMPLETED' || ((b.items || []).every(i => i.status === 'DELIVERED')) ? 'bg-green-100 text-green-800' :
                                                        b.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                                            'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {b.status === 'PENDING' && (b.items || []).some(i => i.status === 'IN_TRANSIT') ? 'IN TRANSIT' : b.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-red-600 font-medium whitespace-nowrap">
                                                    {b.status === 'CANCELLED' ? '-' : formatDualCurrency(feeSplit.usd, feeSplit.khr)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap">
                                                    {(usd > 0 || khr > 0) ? formatDualCurrency(usd, khr) : '-'}
                                                </td>
                                            </tr>
                                            {/* Expandable Parcel Details */}
                                            {isExpanded && (b.items || []).length > 0 && (
                                                <tr>
                                                    <td colSpan={7} className="bg-gray-50 p-0">
                                                        <div className="px-6 py-3">
                                                            <table className="w-full text-xs">
                                                                <thead>
                                                                    <tr className="text-gray-500">
                                                                        <th className="text-left py-1 px-2">#</th>
                                                                        <th className="text-left py-1 px-2">Image</th>
                                                                        <th className="text-left py-1 px-2">Receiver</th>
                                                                        <th className="text-left py-1 px-2">Destination</th>
                                                                        <th className="text-center py-1 px-2">{t('status')}</th>
                                                                        <th className="text-right py-1 px-2">{t('fee')}</th>
                                                                        <th className="text-right py-1 px-2">COD</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {(b.items || []).map((item, idx) => (
                                                                        <tr key={item.id || idx} className="border-t border-gray-100">
                                                                            <td className="py-2 px-2 text-gray-400">{idx + 1}</td>
                                                                            <td className="py-2 px-2">
                                                                                {item.image ? (
                                                                                    <img
                                                                                        src={item.image}
                                                                                        alt="Parcel"
                                                                                        className="w-10 h-10 object-cover rounded border border-gray-200 cursor-pointer hover:opacity-80"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            window.open(item.image, '_blank');
                                                                                        }}
                                                                                    />
                                                                                ) : (
                                                                                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                                                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                                        </svg>
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                            <td className="py-2 px-2 font-medium text-gray-800">{item.receiverName || '-'}</td>
                                                                            <td className="py-2 px-2 text-gray-600 max-w-[200px] truncate" title={item.destinationAddress}>
                                                                                {item.destinationAddress || '-'}
                                                                            </td>
                                                                            <td className="py-2 px-2 text-center">
                                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${item.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                                                                                    item.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-700' :
                                                                                        item.status === 'AT_WAREHOUSE' ? 'bg-purple-100 text-purple-700' :
                                                                                            item.status === 'RETURN_TO_SENDER' ? 'bg-orange-100 text-orange-700' :
                                                                                                'bg-gray-100 text-gray-600'
                                                                                    }`}>
                                                                                    {item.status || 'PENDING'}
                                                                                </span>
                                                                            </td>
                                                                            <td className="py-2 px-2 text-right text-red-600">
                                                                                {item.codCurrency === 'KHR'
                                                                                    ? `${(item.deliveryFee || 0).toLocaleString()} ៛`
                                                                                    : formatCurrency(item.deliveryFee || 0)}
                                                                            </td>
                                                                            <td className="py-2 px-2 text-right font-medium">
                                                                                {item.productPrice
                                                                                    ? (item.codCurrency === 'KHR'
                                                                                        ? `${item.productPrice.toLocaleString()} ៛`
                                                                                        : formatCurrency(item.productPrice))
                                                                                    : '-'}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                            {reportData.length > 0 && (
                                <tr className="bg-gray-100 font-bold border-t-2 border-gray-200">
                                    <td colSpan={5} className="px-4 py-3 text-right text-gray-800">{t('total')}</td>
                                    <td className="px-4 py-3 text-right text-red-700 whitespace-nowrap">
                                        {formatDualCurrency(stats.deliveryFeesUSD, stats.deliveryFeesKHR)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-900 whitespace-nowrap">
                                        {formatDualCurrency(stats.codCollectedUSD + stats.codPendingUSD, stats.codCollectedKHR + stats.codPendingKHR)}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};
