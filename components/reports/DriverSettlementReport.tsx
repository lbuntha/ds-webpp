import React, { useState, useEffect, useMemo } from 'react';
import { ParcelBooking, Employee, CurrencyConfig, Account, SystemSettings } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';

interface DriverSummary {
    id: string;        // Employee ID
    userId: string;    // Linked user ID
    name: string;
    phone: string;
    zone: string;
    totalCommissionUSD: number;
    totalCommissionKHR: number;
    totalCodCollectedUSD: number;
    totalCodCollectedKHR: number;
    totalFeeUSD: number;
    totalFeeKHR: number;
    netUSD: number;    // What driver owes company (COD collected - commission earned)
    netKHR: number;
    unsettledCount: number;
}

// Driver Settlement Report Component
// Shows pending (unsettled) parcels grouped by driver
export const DriverSettlementReport: React.FC = () => {
    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [currencies, setCurrencies] = useState<CurrencyConfig[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [bookingsData, empData, currenciesData, accountsData, settingsData] = await Promise.all([
                    firebaseService.getParcelBookings(),
                    firebaseService.getEmployees(),
                    firebaseService.getCurrencies(),
                    firebaseService.getAccounts(),
                    firebaseService.getSettings()
                ]);
                setBookings(bookingsData);
                setEmployees(empData);
                setCurrencies(currenciesData);
                setAccounts(accountsData);
                setSettings(settingsData);
            } catch (e) {
                toast.error("Failed to load data");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const driverSummaries = useMemo(() => {
        const summaryMap = new Map<string, DriverSummary>();

        // Initialize from employees (drivers)
        employees.forEach(emp => {
            if (!emp.linkedUserId) return;
            summaryMap.set(emp.linkedUserId, {
                id: emp.id,
                userId: emp.linkedUserId,
                name: emp.name,
                phone: emp.phone || '',
                zone: emp.zone || '',
                totalCommissionUSD: 0,
                totalCommissionKHR: 0,
                totalCodCollectedUSD: 0,
                totalCodCollectedKHR: 0,
                totalFeeUSD: 0,
                totalFeeKHR: 0,
                netUSD: 0,
                netKHR: 0,
                unsettledCount: 0
            });
        });

        bookings.forEach(b => {
            (b.items || []).forEach(item => {
                // Only look at delivered items that are NOT yet settled (driver side)
                if (item.status !== 'DELIVERED' && item.status !== 'RETURN_TO_SENDER') return;
                if (item.driverSettlementStatus === 'SETTLED') return;
                // Also check legacy field
                if (!item.driverSettlementStatus && item.settlementStatus === 'SETTLED') return;

                // Find the driver for this item - check delivererId first, then driverId
                const driverUserId = item.delivererId || item.driverId || b.driverId;
                if (!driverUserId) return;

                const summary = summaryMap.get(driverUserId);
                if (!summary) return;

                const cod = Number(item.productPrice) || 0;
                const isKHR = item.codCurrency === 'KHR';

                // COD collected by the driver
                if (isKHR) {
                    summary.totalCodCollectedKHR += cod;
                } else {
                    summary.totalCodCollectedUSD += cod;
                }

                // Delivery fee (earned by company, deducted from COD)
                if (item.deliveryFeeUSD !== undefined || item.deliveryFeeKHR !== undefined) {
                    if (isKHR) {
                        summary.totalFeeKHR += item.deliveryFeeKHR || 0;
                    } else {
                        summary.totalFeeUSD += item.deliveryFeeUSD || 0;
                    }
                } else {
                    const fee = Number(item.deliveryFee) || 0;
                    if (isKHR) {
                        summary.totalFeeKHR += fee;
                    } else {
                        summary.totalFeeUSD += fee;
                    }
                }

                // Driver Commission (driver earns this from the delivery fee)
                const pickupComm = Number(item.pickupCommission) || 0;
                const deliveryComm = Number(item.deliveryCommission) || 0;
                const totalComm = pickupComm + deliveryComm;
                if (isKHR) {
                    summary.totalCommissionKHR += totalComm;
                } else {
                    summary.totalCommissionUSD += totalComm;
                }

                summary.unsettledCount++;
            });
        });

        // Calculate Net: What driver owes back to company
        // Net = COD Collected - Commission Earned
        // (Company keeps COD minus commission; driver keeps the commission)
        summaryMap.forEach(s => {
            s.netUSD = s.totalCodCollectedUSD - s.totalCommissionUSD;
            s.netKHR = s.totalCodCollectedKHR - s.totalCommissionKHR;
        });

        return Array.from(summaryMap.values())
            .filter(s => s.unsettledCount > 0)
            .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.phone.includes(searchTerm))
            .sort((a, b) => b.unsettledCount - a.unsettledCount);
    }, [bookings, employees, searchTerm]);

    // --- Detail View ---
    const selectedDriverDetails = useMemo(() => {
        if (!selectedDriverId) return [];
        const details: any[] = [];
        const driver = driverSummaries.find(d => d.userId === selectedDriverId);
        if (!driver) return [];

        bookings.forEach(b => {
            (b.items || []).forEach(item => {
                if (item.status !== 'DELIVERED' && item.status !== 'RETURN_TO_SENDER') return;
                if (item.driverSettlementStatus === 'SETTLED') return;
                if (!item.driverSettlementStatus && item.settlementStatus === 'SETTLED') return;

                const driverUserId = item.delivererId || item.driverId || b.driverId;
                if (driverUserId !== selectedDriverId) return;

                const cod = Number(item.productPrice) || 0;
                const isKHR = item.codCurrency === 'KHR';
                let fee = 0;
                if (item.deliveryFeeUSD !== undefined || item.deliveryFeeKHR !== undefined) {
                    fee = isKHR ? (item.deliveryFeeKHR || 0) : (item.deliveryFeeUSD || 0);
                } else {
                    fee = Number(item.deliveryFee) || 0;
                }

                const pickupComm = Number(item.pickupCommission) || 0;
                const deliveryComm = Number(item.deliveryCommission) || 0;
                const commission = pickupComm + deliveryComm;

                details.push({
                    bookingId: b.id,
                    itemId: item.id,
                    trackingCode: item.trackingCode,
                    receiverName: item.receiverName,
                    receiverPhone: item.receiverPhone,
                    senderName: b.senderName,
                    deliveryDate: b.bookingDate,
                    image: item.image,
                    cod: cod,
                    codCurrency: item.codCurrency || 'USD',
                    fee: fee,
                    feeCurrency: item.codCurrency || 'USD',
                    commission: commission,
                    commissionCurrency: item.codCurrency || 'USD',
                    net: cod - commission, // What driver needs to hand back
                    status: item.status
                });
            });
        });
        return details;
    }, [bookings, selectedDriverId, driverSummaries]);

    const exportToExcel = () => {
        if (selectedDriverDetails.length === 0) {
            toast.error('No data to export');
            return;
        }

        const headers = ['Date', 'Booking Code', 'Tracking Code', 'Sender', 'Receiver', 'COD Amount', 'Currency', 'Fee', 'Commission', 'Net Owed'];
        const rows = selectedDriverDetails.map(d => [
            new Date(d.deliveryDate).toLocaleDateString(),
            (d.bookingId || '').slice(-6).toUpperCase(),
            d.trackingCode,
            d.senderName,
            d.receiverName,
            d.cod,
            d.codCurrency,
            d.fee,
            d.commission,
            d.net
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const driverName = driverSummaries.find(s => s.userId === selectedDriverId)?.name || 'driver';
        link.href = url;
        link.download = `driver_settlement_${driverName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Exported successfully!');
    };

    // --- DETAIL VIEW ---
    if (selectedDriverId) {
        const summary = driverSummaries.find(s => s.userId === selectedDriverId);
        return (
            <div className="space-y-6">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <Button variant="outline" onClick={() => setSelectedDriverId(null)}>← Back</Button>
                            <h2 className="text-xl font-bold">Driver Settlement: {summary?.name}</h2>
                            {summary?.zone && (
                                <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded font-bold">
                                    Zone: {summary.zone}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="bg-green-50 p-4">
                            <div>
                                <div className="text-xs font-bold text-green-800 uppercase">Net Owed to Company (USD)</div>
                                <div className="text-3xl font-bold text-green-900 mt-1">
                                    ${(summary?.netUSD || 0).toFixed(2)}
                                </div>
                                <div className="text-[10px] text-green-600 mt-1">
                                    COD: ${(summary?.totalCodCollectedUSD || 0).toFixed(2)} − Commission: ${(summary?.totalCommissionUSD || 0).toFixed(2)}
                                </div>
                            </div>
                        </Card>
                        <Card className="bg-blue-50 p-4">
                            <div>
                                <div className="text-xs font-bold text-blue-800 uppercase">Net Owed to Company (KHR)</div>
                                <div className="text-3xl font-bold text-blue-900 mt-1">
                                    {(summary?.netKHR || 0).toLocaleString()} ៛
                                </div>
                                <div className="text-[10px] text-blue-600 mt-1">
                                    COD: {(summary?.totalCodCollectedKHR || 0).toLocaleString()} ៛ − Commission: {(summary?.totalCommissionKHR || 0).toLocaleString()} ៛
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-900">Individual Parcel Items ({selectedDriverDetails.length})</h3>
                        <Button
                            variant="outline"
                            onClick={exportToExcel}
                            className="flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Export CSV
                        </Button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Tracking</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Sender</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Receiver</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-500">COD</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-500">Fee</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-500">Commission</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-500 font-bold">Net Owed</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {selectedDriverDetails.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-4 py-2">{new Date(item.deliveryDate).toLocaleDateString()}</td>
                                        <td className="px-4 py-2 font-mono font-bold text-indigo-600">{item.trackingCode || 'N/A'}</td>
                                        <td className="px-4 py-2 text-gray-700">{item.senderName}</td>
                                        <td className="px-4 py-2">
                                            <div className="font-medium text-gray-900">{item.receiverName}</div>
                                        </td>
                                        <td className="px-4 py-2">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.status === 'DELIVERED' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                                }`}>
                                                {item.status === 'RETURN_TO_SENDER' ? 'RTS' : item.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            {item.cod.toLocaleString()} {item.codCurrency}
                                        </td>
                                        <td className="px-4 py-2 text-right text-gray-500">
                                            {item.fee.toLocaleString()} {item.feeCurrency}
                                        </td>
                                        <td className="px-4 py-2 text-right text-green-600 font-medium">
                                            {item.commission.toLocaleString()} {item.commissionCurrency}
                                        </td>
                                        <td className="px-4 py-2 text-right font-bold text-indigo-700">
                                            {item.net.toLocaleString()} {item.codCurrency}
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

    // --- LIST VIEW ---
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Driver Pending Settlements</h2>
                <div className="w-64">
                    <Input placeholder="Search driver name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Zone</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Items</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net Owed (USD)</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net Owed (KHR)</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">Loading driver data...</td></tr>
                            ) : driverSummaries.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">No drivers with pending settlements found.</td></tr>
                            ) : driverSummaries.map(s => (
                                <tr key={s.userId} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-900">{s.name}</div>
                                        <div className="text-sm text-gray-500">{s.phone}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {s.zone ? (
                                            <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded font-bold">{s.zone}</span>
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center font-medium text-gray-700">{s.unsettledCount}</td>
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
                                        <Button variant="outline" onClick={() => setSelectedDriverId(s.userId)}>View Details</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};
