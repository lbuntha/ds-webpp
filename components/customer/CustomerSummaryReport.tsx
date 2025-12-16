
import React, { useState, useEffect, useMemo } from 'react';
import { ParcelBooking, UserProfile } from '../../src/shared/types';
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
        let deliveryFees = 0;

        let codCollectedUSD = 0;
        let codCollectedKHR = 0;

        let codPendingUSD = 0;
        let codPendingKHR = 0;

        let totalOrders = reportData.length;
        let totalItems = 0;

        reportData.forEach(b => {
            // Don't count fees for cancelled orders
            if (b.status !== 'CANCELLED') {
                deliveryFees += b.totalDeliveryFee;
            }

            (b.items || []).forEach(item => {
                totalItems++;
                const amount = item.productPrice || 0;
                const isKHR = item.codCurrency === 'KHR';

                if (amount > 0) {
                    if (item.status === 'DELIVERED') {
                        if (isKHR) codCollectedKHR += amount;
                        else codCollectedUSD += amount;
                    } else if (item.status !== 'RETURN_TO_SENDER' && b.status !== 'CANCELLED') {
                        // Pending if not delivered, not returned, and booking not cancelled
                        if (isKHR) codPendingKHR += amount;
                        else codPendingUSD += amount;
                    }
                }
            });
        });

        return { deliveryFees, codCollectedUSD, codCollectedKHR, codPendingUSD, codPendingKHR, totalOrders, totalItems };
    }, [reportData]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    const formatDualCurrency = (usd: number, khr: number) => {
        if (usd === 0 && khr === 0) return '$0.00';
        const parts = [];
        if (usd > 0) parts.push(formatCurrency(usd));
        if (khr > 0) parts.push(`${khr.toLocaleString()} ៛`);
        return parts.join(' + ');
    };

    const handlePrint = () => {
        window.print();
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
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-red-50 border-red-100">
                    <div className="text-red-800 text-sm font-medium uppercase tracking-wide">{t('delivery_expenses')}</div>
                    <div className="text-3xl font-bold text-red-900 mt-1">
                        {formatCurrency(stats.deliveryFees)}
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
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                        {t('no_transactions_period')}
                                    </td>
                                </tr>
                            ) : (
                                reportData.map(b => {
                                    let usd = 0;
                                    let khr = 0;
                                    (b.items || []).forEach(i => {
                                        const val = i.productPrice || 0;
                                        if (i.codCurrency === 'KHR') khr += val;
                                        else usd += val;
                                    });

                                    const itemsCount = (b.items || []).length;

                                    return (
                                        <tr key={b.id} className="hover:bg-gray-50">
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
                                            <td className="px-4 py-3 text-right text-red-600 font-medium">
                                                {b.status === 'CANCELLED' ? '-' : formatCurrency(b.totalDeliveryFee)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-gray-900">
                                                {(usd > 0 || khr > 0) ? formatDualCurrency(usd, khr) : '-'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                            {reportData.length > 0 && (
                                <tr className="bg-gray-100 font-bold border-t-2 border-gray-200">
                                    <td colSpan={4} className="px-4 py-3 text-right text-gray-800">{t('total')}</td>
                                    <td className="px-4 py-3 text-right text-red-700">{formatCurrency(stats.deliveryFees)}</td>
                                    <td className="px-4 py-3 text-right text-gray-900">
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
