import React, { useState, useEffect, useMemo } from 'react';
import { ParcelBooking, Customer, UserProfile, WalletTransaction, SystemSettings } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';
import { roundKHR } from '../../src/shared/utils/currencyUtils';

interface SettledItem {
    bookingId: string;
    itemId: string;
    trackingCode: string;
    customerName: string;
    customerPhone: string;
    receiverName: string;
    receiverPhone: string;
    deliveryDate: string;
    codAmount: number;
    codCurrency: 'USD' | 'KHR';
    fee: number;
    feeCurrency: 'USD' | 'KHR';
    netPayout: number;
}

export const SettledParcelsReport: React.FC = () => {
    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [walletTxns, setWalletTxns] = useState<WalletTransaction[]>([]);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'USD' | 'KHR'>('ALL');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [bookingsData, customersData, usersData, txnsData, settingsData] = await Promise.all([
                    firebaseService.getParcelBookings(),
                    firebaseService.getCustomers(),
                    firebaseService.getUsers(),
                    firebaseService.walletService.getAllWalletTransactions(),
                    firebaseService.getSettings()
                ]);
                setBookings(bookingsData);
                setCustomers(customersData);
                setUsers(usersData);
                setWalletTxns(txnsData);
                setSettings(settingsData);
            } catch (e) {
                console.error(e);
                toast.error("Failed to load data");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Get customer name helper - prioritize linked user data over legacy customer fields
    const getCustomerName = (senderId: string | undefined, senderName: string): string => {
        if (senderId) {
            const customer = customers.find(c => c.id === senderId);
            if (customer?.linkedUserId) {
                const user = users.find(u => u.uid === customer.linkedUserId);
                if (user) return user.name;
            }
            // Fallback to legacy customer.name if exists
            if (customer?.name) return customer.name;
        }
        return senderName || 'Unknown';
    };

    const getCustomerPhone = (senderId: string | undefined, senderPhone: string): string => {
        if (senderId) {
            const customer = customers.find(c => c.id === senderId);
            if (customer?.linkedUserId) {
                const user = users.find(u => u.uid === customer.linkedUserId);
                if (user?.phone) return user.phone;
            }
            // Fallback to legacy customer.phone if exists
            if (customer?.phone) return customer.phone;
        }
        return senderPhone || '';
    };

    // Build settled items list
    const settledItems = useMemo(() => {
        const items: SettledItem[] = [];

        bookings.forEach(b => {
            (b.items || []).forEach(item => {
                if (item.customerSettlementStatus === 'SETTLED') {
                    const codAmount = Number(item.productPrice) || 0;
                    const codCurrency = (item.codCurrency || 'USD') as 'USD' | 'KHR';

                    // Fee should be in the same currency as COD
                    // Get fee per item (split equally among items in same booking)
                    const bookingFee = Number(b.totalDeliveryFee) || 0;
                    const itemCount = b.items?.length || 1;
                    let fee = bookingFee / itemCount;
                    let feeCurrency = codCurrency; // Fee matches COD currency

                    // Get exchange rate from settings (default 4100)
                    const exchangeRate = settings?.commissionExchangeRate || 4100;

                    // If booking fee was in different currency, convert it
                    if (codCurrency === 'KHR' && (b.currency === 'USD' || !b.currency)) {
                        // Convert USD fee to KHR using settings rate
                        fee = fee * exchangeRate;
                    } else if (codCurrency === 'USD' && b.currency === 'KHR') {
                        // Convert KHR fee to USD using settings rate
                        fee = fee / exchangeRate;
                    }

                    // Calculate net in same currency
                    let netPayout = codAmount - fee;

                    // Apply KHR rounding if applicable
                    if (codCurrency === 'KHR') {
                        fee = roundKHR(fee);
                        // Rounding codAmount too if it's KHR to be safe, though usually it's entered as round
                        const roundedCod = roundKHR(codAmount);
                        netPayout = roundedCod - fee;
                    }

                    items.push({
                        bookingId: b.id,
                        itemId: item.id,
                        trackingCode: item.trackingCode || item.id.slice(-6).toUpperCase(),
                        customerName: getCustomerName(b.senderId, b.senderName),
                        customerPhone: getCustomerPhone(b.senderId, b.senderPhone),
                        receiverName: item.receiverName,
                        receiverPhone: item.receiverPhone || '',
                        deliveryDate: b.bookingDate,
                        codAmount,
                        codCurrency,
                        fee,
                        feeCurrency,
                        netPayout
                    });
                }
            });
        });

        // Sort by date descending
        items.sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate));

        return items;
    }, [bookings, customers, users, settings]);

    // Filter items
    const filteredItems = useMemo(() => {
        return settledItems.filter(item => {
            // Search filter
            const searchLower = searchTerm.toLowerCase();
            const matchSearch = !searchTerm ||
                item.trackingCode.toLowerCase().includes(searchLower) ||
                item.customerName.toLowerCase().includes(searchLower) ||
                item.receiverName.toLowerCase().includes(searchLower) ||
                item.customerPhone.includes(searchTerm);

            // Date filter
            const matchDateFrom = !dateFrom || item.deliveryDate >= dateFrom;
            const matchDateTo = !dateTo || item.deliveryDate <= dateTo;

            // Currency filter
            const matchCurrency = currencyFilter === 'ALL' || item.codCurrency === currencyFilter;

            return matchSearch && matchDateFrom && matchDateTo && matchCurrency;
        });
    }, [settledItems, searchTerm, dateFrom, dateTo, currencyFilter]);

    // Totals
    const totals = useMemo(() => {
        let totalCodUSD = 0;
        let totalCodKHR = 0;
        let totalFeeUSD = 0;
        let totalFeeKHR = 0;

        filteredItems.forEach(item => {
            if (item.codCurrency === 'USD') {
                totalCodUSD += item.codAmount;
            } else {
                totalCodKHR += item.codAmount;
            }
            if (item.feeCurrency === 'USD') {
                totalFeeUSD += item.fee;
            } else {
                totalFeeKHR += item.fee;
            }
        });

        return {
            totalCodUSD,
            totalCodKHR,
            totalFeeUSD,
            totalFeeKHR,
            netUSD: totalCodUSD - totalFeeUSD,
            netKHR: totalCodKHR - totalFeeKHR,
            count: filteredItems.length
        };
    }, [filteredItems]);

    // Export to CSV
    const exportToCSV = () => {
        const headers = ['Date', 'Tracking Code', 'Customer', 'Customer Phone', 'Receiver', 'COD Amount', 'COD Currency', 'Fee', 'Fee Currency', 'Net Payout'];
        const rows = filteredItems.map(item => [
            item.deliveryDate,
            item.trackingCode,
            item.customerName,
            item.customerPhone,
            item.receiverName,
            item.codAmount.toString(),
            item.codCurrency,
            item.fee.toString(),
            item.feeCurrency,
            item.netPayout.toString()
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `settled_parcels_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        toast.success('Exported successfully!');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Settled Parcels Report</h1>
                    <p className="text-sm text-gray-500 mt-1">View all parcels that have been settled and paid out</p>
                </div>
                <Button onClick={exportToCSV} variant="secondary" className="text-sm">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export CSV
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase font-bold">Total Items</div>
                    <div className="text-2xl font-black text-gray-900 mt-1">{totals.count}</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase font-bold">Total COD</div>
                    <div className="text-lg font-bold text-green-600 mt-1">${totals.totalCodUSD.toFixed(2)}</div>
                    {totals.totalCodKHR > 0 && <div className="text-sm text-blue-600">{roundKHR(totals.totalCodKHR).toLocaleString()} ៛</div>}
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase font-bold">Total Fees</div>
                    <div className="text-lg font-bold text-amber-600 mt-1">${totals.totalFeeUSD.toFixed(2)}</div>
                    {totals.totalFeeKHR > 0 && <div className="text-sm text-amber-500">{roundKHR(totals.totalFeeKHR).toLocaleString()} ៛</div>}
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase font-bold">Net Payouts</div>
                    <div className="text-lg font-bold text-indigo-600 mt-1">${totals.netUSD.toFixed(2)}</div>
                    {totals.netKHR !== 0 && <div className="text-sm text-indigo-500">{roundKHR(totals.netKHR).toLocaleString()} ៛</div>}
                </div>
            </div>

            {/* Filters */}
            <Card>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Search</label>
                        <Input
                            placeholder="Tracking code, customer, receiver..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">From Date</label>
                        <input
                            type="date"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">To Date</label>
                        <input
                            type="date"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Currency</label>
                        <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            value={currencyFilter}
                            onChange={e => setCurrencyFilter(e.target.value as any)}
                        >
                            <option value="ALL">All Currencies</option>
                            <option value="USD">USD Only</option>
                            <option value="KHR">KHR Only</option>
                        </select>
                    </div>
                </div>
            </Card>

            {/* Table */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tracking</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receiver</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">COD Amount</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Fee</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Payout</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                                        No settled parcels found.
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item, idx) => (
                                    <tr key={`${item.bookingId}-${item.itemId}`} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm text-gray-900">{item.deliveryDate}</td>
                                        <td className="px-4 py-3 text-sm font-mono text-indigo-600">{item.trackingCode}</td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-medium text-gray-900">{item.customerName}</div>
                                            <div className="text-xs text-gray-500">{item.customerPhone}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm text-gray-900">{item.receiverName}</div>
                                            <div className="text-xs text-gray-500">{item.receiverPhone}</div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-medium">
                                            <span className={item.codCurrency === 'USD' ? 'text-green-600' : 'text-blue-600'}>
                                                {item.codCurrency === 'USD' ? '$' : ''}{item.codAmount.toLocaleString()}{item.codCurrency === 'KHR' ? ' ៛' : ''}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right text-amber-600">
                                            {item.feeCurrency === 'USD' ? `$${item.fee.toFixed(2)}` : `${roundKHR(item.fee).toLocaleString()} ៛`}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                                            {item.codCurrency === 'USD' ? `$${item.netPayout.toFixed(2)}` : `${roundKHR(item.netPayout).toLocaleString()} ៛`}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};
