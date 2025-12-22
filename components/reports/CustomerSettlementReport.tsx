
import React, { useState, useEffect, useMemo } from 'react';
import { ParcelBooking, ParcelItem, Customer, UserProfile, CurrencyConfig } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { firebaseService } from '../../services/firebaseService';
import { toast } from '../../src/shared/utils/toast';

interface CustomerSummary {
    id: string;
    name: string;
    phone: string;
    totalCodUSD: number;
    totalCodKHR: number;
    totalFeeUSD: number;
    totalFeeKHR: number;
    netUSD: number;
    netKHR: number;
    unsettledCount: number;
}

export const CustomerSettlementReport: React.FC = () => {
    console.log('✅ CustomerSettlementReport component initialized');

    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [currencies, setCurrencies] = useState<CurrencyConfig[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [bookingsData, customersData, usersData, currenciesData] = await Promise.all([
                    firebaseService.getParcelBookings(),
                    firebaseService.getCustomers(),
                    firebaseService.getUsers(),
                    firebaseService.getCurrencies()
                ]);
                setBookings(bookingsData);
                setCustomers(customersData);
                setUsers(usersData);
                setCurrencies(currenciesData);
            } catch (e) {
                console.error(e);
                toast.error("Failed to load data");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const customerSummaries = useMemo(() => {
        const summaryMap = new Map<string, CustomerSummary>();

        // Initialize from customers list
        customers.forEach(c => {
            summaryMap.set(c.id, {
                id: c.id,
                name: c.name,
                phone: c.phone || '',
                totalCodUSD: 0,
                totalCodKHR: 0,
                totalFeeUSD: 0,
                totalFeeKHR: 0,
                netUSD: 0,
                netKHR: 0,
                unsettledCount: 0
            });
        });

        bookings.forEach(b => {
            if (!b.senderId) return;
            const summary = summaryMap.get(b.senderId);
            if (!summary) return;

            (b.items || []).forEach(item => {
                if (item.status === 'DELIVERED' && item.settlementStatus !== 'SETTLED') {
                    const cod = Number(item.productPrice) || 0;
                    const fee = (Number(b.totalDeliveryFee) || 0) / (b.items?.length || 1);

                    if (item.codCurrency === 'KHR') {
                        summary.totalCodKHR += cod;
                    } else {
                        summary.totalCodUSD += cod;
                    }

                    if (b.currency === 'KHR') {
                        summary.totalFeeKHR += fee;
                    } else {
                        summary.totalFeeUSD += fee;
                    }

                    summary.unsettledCount++;
                }
            });
        });

        // Calculate Net
        summaryMap.forEach(s => {
            s.netUSD = s.totalCodUSD - s.totalFeeUSD;
            s.netKHR = s.totalCodKHR - s.totalFeeKHR;
        });

        return Array.from(summaryMap.values())
            .filter(s => s.unsettledCount > 0)
            .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.phone.includes(searchTerm))
            .sort((a, b) => b.unsettledCount - a.unsettledCount);
    }, [bookings, customers, searchTerm]);

    const selectedCustomerDetails = useMemo(() => {
        if (!selectedCustomerId) return [];
        const details: any[] = [];
        bookings.forEach(b => {
            if (b.senderId !== selectedCustomerId) return;
            (b.items || []).forEach(item => {
                if (item.status === 'DELIVERED' && item.settlementStatus !== 'SETTLED') {
                    const fee = (Number(b.totalDeliveryFee) || 0) / (b.items?.length || 1);
                    details.push({
                        bookingId: b.id,
                        itemId: item.id,
                        trackingCode: item.trackingCode,
                        receiverName: item.receiverName,
                        deliveryDate: b.createdAt,
                        cod: item.productPrice,
                        codCurrency: item.codCurrency || 'USD',
                        fee: fee,
                        feeCurrency: b.currency || 'USD',
                        net: (item.codCurrency === b.currency) ? (item.productPrice - fee) : null
                    });
                }
            });
        });
        return details;
    }, [bookings, selectedCustomerId]);

    const handleSettle = async (summary: CustomerSummary) => {
        if (!confirm(`Initiate payout for ${summary.name}? \n\nUSD Net: ${summary.netUSD.toFixed(2)}\nKHR Net: ${summary.netKHR.toFixed(0)}`)) return;

        setProcessing(true);
        try {
            // Find linked user for this customer to detect wallet account
            const linkedUser = users.find(u => u.linkedCustomerId === summary.id);
            if (!linkedUser) {
                toast.error("This customer is not linked to any User account. Cannot process payout.");
                return;
            }

            const itemsToSettle = selectedCustomerDetails.map(d => ({
                bookingId: d.bookingId,
                itemId: d.itemId
            }));

            // Process USD if any
            if (Math.abs(summary.netUSD) > 0.01) {
                await firebaseService.requestWithdrawal(
                    linkedUser.uid,
                    linkedUser.name,
                    Number(summary.netUSD.toFixed(2)),
                    'USD',
                    'system', // Default system bank for withdrawals
                    `Settle COD for ${itemsToSettle.length} parcels (Finance Initiated)`,
                    itemsToSettle
                );
            }

            // Process KHR if any
            if (Math.abs(summary.netKHR) > 0.1) {
                await firebaseService.requestWithdrawal(
                    linkedUser.uid,
                    linkedUser.name,
                    Number(summary.netKHR.toFixed(0)),
                    'KHR',
                    'system',
                    `Settle COD for ${itemsToSettle.length} parcels (Finance Initiated)`,
                    itemsToSettle
                );
            }

            toast.success("Payout request created successfully!");
            setSelectedCustomerId(null);
            // Reload bookings to reflect potential locally (though they are pending in firebase until approved)
            // For now, let the user manually refresh or wait for snapshot if implemented
            const updatedBookings = await firebaseService.getParcelBookings();
            setBookings(updatedBookings);

        } catch (e: any) {
            console.error(e);
            toast.error("Failed to initiate payout: " + e.message);
        } finally {
            setProcessing(false);
        }
    };

    if (selectedCustomerId) {
        const summary = customerSummaries.find(s => s.id === selectedCustomerId);
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="outline" onClick={() => setSelectedCustomerId(null)}>← Back</Button>
                    <h2 className="text-xl font-bold">Settlement Details: {summary?.name}</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-green-50">
                        <div className="text-xs font-bold text-green-800 uppercase">Wait to Pay (USD)</div>
                        <div className="text-2xl font-bold text-green-900">${summary?.netUSD.toFixed(2)}</div>
                        <div className="text-[10px] text-green-600">COD: ${summary?.totalCodUSD.toFixed(2)} | Fees: ${summary?.totalFeeUSD.toFixed(2)}</div>
                    </Card>
                    <Card className="bg-blue-50">
                        <div className="text-xs font-bold text-blue-800 uppercase">Wait to Pay (KHR)</div>
                        <div className="text-2xl font-bold text-blue-900">{summary?.netKHR.toLocaleString()} ៛</div>
                        <div className="text-[10px] text-blue-600">COD: {summary?.totalCodKHR.toLocaleString()} | Fees: {summary?.totalFeeKHR.toLocaleString()}</div>
                    </Card>
                    <Card className="flex flex-col justify-center items-center">
                        <Button
                            className="w-full h-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                            onClick={() => summary && handleSettle(summary)}
                            isLoading={processing}
                        >
                            Process All Payouts
                        </Button>
                    </Card>
                </div>

                <Card title="Individual Parcel Items">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Tracking Code</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Receiver</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-500">COD</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-500">Delivery Fee</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-500 font-bold">Net Payout</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {selectedCustomerDetails.map((d, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="px-4 py-2">{new Date(d.deliveryDate).toLocaleDateString()}</td>
                                        <td className="px-4 py-2 font-mono font-bold text-indigo-600">{d.trackingCode}</td>
                                        <td className="px-4 py-2">{d.receiverName}</td>
                                        <td className="px-4 py-2 text-right">{d.cod.toLocaleString()} {d.codCurrency}</td>
                                        <td className="px-4 py-2 text-right">{d.fee.toLocaleString()} {d.feeCurrency}</td>
                                        <td className="px-4 py-2 text-right font-bold text-green-700">
                                            {d.net !== null ? `${d.net.toLocaleString()} ${d.codCurrency}` : 'Split Currency'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Customer Settlement Report</h2>
                <div className="w-64">
                    <Input
                        placeholder="Search customer name or phone..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Parcels</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net Owed (USD)</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net Owed (KHR)</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">Loading customer data...</td></tr>
                            ) : customerSummaries.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No customers with pending settlements found.</td></tr>
                            ) : (
                                customerSummaries.map(s => (
                                    <tr key={s.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{s.name}</div>
                                            <div className="text-sm text-gray-500">{s.phone}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center font-medium text-gray-700">
                                            {s.unsettledCount}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`font-bold ${s.netUSD > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                                ${s.netUSD.toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`font-bold ${s.netKHR > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                                {s.netKHR.toLocaleString()} ៛
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button variant="outline" onClick={() => setSelectedCustomerId(s.id)}>
                                                View & Settle
                                            </Button>
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
