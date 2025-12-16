
import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, WalletTransaction, ParcelBooking, DriverCommissionRule, Employee } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { firebaseService } from '../../services/firebaseService';

interface UserBalance {
    uid: string;
    name: string;
    role: string;
    balanceUSD: number;
    balanceKHR: number;
    phone?: string;
}

export const WalletBalanceReport: React.FC = () => {
    const [balances, setBalances] = useState<UserBalance[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterRole, setFilterRole] = useState<'ALL' | 'customer' | 'driver'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [users, bookings, txns, rules, employees] = await Promise.all([
                    firebaseService.getUsers(),
                    firebaseService.getParcelBookings(),
                    firebaseService.walletService.getAllWalletTransactions(),
                    firebaseService.logisticsService.getDriverCommissionRules(),
                    firebaseService.getEmployees()
                ]);

                const calculatedBalances = calculateAllBalances(users, bookings, txns, rules, employees);
                setBalances(calculatedBalances);
            } catch (e) {
                console.error("Failed to load report data", e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const calculateAllBalances = (
        users: UserProfile[],
        bookings: ParcelBooking[],
        txns: WalletTransaction[],
        rules: DriverCommissionRule[],
        employees: Employee[]
    ): UserBalance[] => {
        const balanceMap: Record<string, { usd: number, khr: number }> = {};

        // Initialize Map
        users.forEach(u => {
            if (u.role === 'customer' || u.role === 'driver') {
                balanceMap[u.uid] = { usd: 0, khr: 0 };
            }
        });

        // 1. Process Wallet Transactions (Approved Only)
        // DEPOSIT/EARNING/REFUND/SETTLEMENT = Credit (+), WITHDRAWAL = Debit (-)
        txns.forEach(t => {
            if (t.status === 'APPROVED' && balanceMap[t.userId]) {
                const isCredit = ['DEPOSIT', 'EARNING', 'REFUND', 'SETTLEMENT'].includes(t.type);
                const val = t.amount;
                if (t.currency === 'KHR') {
                    balanceMap[t.userId].khr += isCredit ? val : -val;
                } else {
                    balanceMap[t.userId].usd += isCredit ? val : -val;
                }
            }
        });

        // 2. Process Bookings (Operational)
        const defaultRule = rules.find(r => r.isDefault) || { type: 'PERCENTAGE', value: 70 };

        bookings.forEach(b => {
            if (b.status === 'CANCELLED') return;
            const bItems = b.items || [];

            // A. Customer Logic (Sender)
            const senderUid = b.senderId ? users.find(u => u.linkedCustomerId === b.senderId)?.uid : users.find(u => u.name === b.senderName)?.uid;

            if (senderUid && balanceMap[senderUid]) {
                // Credit: COD Collected (If delivered)
                bItems.forEach(item => {
                    if (item.status === 'DELIVERED') {
                        const amount = item.productPrice || 0;
                        if (item.codCurrency === 'KHR') balanceMap[senderUid].khr += amount;
                        else balanceMap[senderUid].usd += amount;
                    }
                });

                // Debit: Delivery Fees (If delivered or confirmed)
                // Convert fee to matching currency if needed for display logic, but standard is USD
                // Here we deduct fee in USD unless user operates purely in KHR (complex, stick to USD for fee)
                const itemsDelivered = bItems.filter(i => i.status === 'DELIVERED').length;
                if (itemsDelivered > 0 || b.status === 'COMPLETED' || b.status === 'CONFIRMED') {
                    // Check if majority of COD is KHR to decide deduction currency (Optional logic)
                    // For simplicity, deduct fee in USD as stored
                    balanceMap[senderUid].usd -= b.totalDeliveryFee;
                }
            }

            // B. Driver Logic
            if (b.driverId && balanceMap[b.driverId]) {
                const driverEmp = employees.find(e => e.linkedUserId === b.driverId);
                const zoneRule = rules.find(r => r.zoneName === driverEmp?.zone) || defaultRule;

                // Credit: Commission Earned
                const totalItems = bItems.length;
                const processedItems = bItems.filter(i => i.status === 'DELIVERED' || i.status === 'RETURN_TO_SENDER').length;

                if (totalItems > 0 && processedItems > 0) {
                    let totalComm = 0;
                    if (zoneRule.type === 'FIXED_AMOUNT') totalComm = zoneRule.value;
                    else totalComm = b.totalDeliveryFee * (zoneRule.value / 100);

                    // Pro-rate
                    const earned = totalComm * (processedItems / totalItems);
                    balanceMap[b.driverId].usd += earned;
                }

                // Debit: Cash Held (Driver owes company)
                bItems.forEach(item => {
                    if (item.status === 'DELIVERED') {
                        const amount = item.productPrice || 0;
                        // Driver DEBT is negative balance
                        if (item.codCurrency === 'KHR') balanceMap[b.driverId].khr -= amount;
                        else balanceMap[b.driverId].usd -= amount;
                    }
                });
            }
        });

        return users
            .filter(u => (u.role === 'customer' || u.role === 'driver') && balanceMap[u.uid])
            .map(u => ({
                uid: u.uid,
                name: u.name,
                role: u.role,
                phone: u.phone,
                balanceUSD: balanceMap[u.uid].usd,
                balanceKHR: balanceMap[u.uid].khr
            }))
            .sort((a, b) => b.balanceUSD - a.balanceUSD);
    };

    const filteredData = useMemo(() => {
        return balances.filter(b => {
            const matchesRole = filterRole === 'ALL' || b.role === filterRole;
            const matchesSearch = (b.name || '').toLowerCase().includes(searchTerm.toLowerCase());
            // Filter out near-zero balances to reduce noise? Optional.
            return matchesRole && matchesSearch;
        });
    }, [balances, filterRole, searchTerm]);

    const totals = useMemo(() => {
        return filteredData.reduce((acc, curr) => ({
            usd: acc.usd + curr.balanceUSD,
            khr: acc.khr + curr.balanceKHR
        }), { usd: 0, khr: 0 });
    }, [filteredData]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
                <div className="flex gap-2">
                    <Button variant={filterRole === 'ALL' ? 'primary' : 'outline'} onClick={() => setFilterRole('ALL')}>All</Button>
                    <Button variant={filterRole === 'customer' ? 'primary' : 'outline'} onClick={() => setFilterRole('customer')}>Customers</Button>
                    <Button variant={filterRole === 'driver' ? 'primary' : 'outline'} onClick={() => setFilterRole('driver')}>Drivers</Button>
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Search name..."
                        className="border rounded-lg px-3 py-2 text-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <Button variant="outline" onClick={() => window.print()}>Print</Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-indigo-50 border-indigo-200">
                    <div className="text-sm font-bold text-indigo-800 uppercase">Total Net Liability (USD)</div>
                    <div className="text-2xl font-bold text-indigo-900 mt-1">
                        ${totals.usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-indigo-600 mt-1">
                        {totals.usd > 0 ? "Company owes Users" : "Users owe Company"}
                    </p>
                </Card>
                <Card className="bg-teal-50 border-teal-200">
                    <div className="text-sm font-bold text-teal-800 uppercase">Total Net Liability (KHR)</div>
                    <div className="text-2xl font-bold text-teal-900 mt-1">
                        {totals.khr.toLocaleString()} ៛
                    </div>
                </Card>
            </div>

            <Card title={`Wallet Balances (${filteredData.length})`}>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">User</th>
                                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Role</th>
                                <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase">Balance (USD)</th>
                                <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase">Balance (KHR)</th>
                                <th className="px-6 py-3 text-center font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">Calculating balances...</td></tr>
                            ) : filteredData.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">No records found.</td></tr>
                            ) : (
                                filteredData.map(user => {
                                    // Status Logic: 
                                    // Customer > 0 = Company Owes Customer
                                    // Driver < 0 = Driver Owes Company (Held Cash)
                                    let statusColor = 'text-gray-500 bg-gray-100';
                                    let statusText = 'Balanced';

                                    if (user.balanceUSD > 0.01 || user.balanceKHR > 100) {
                                        statusColor = 'text-green-700 bg-green-100';
                                        statusText = 'Company Owes User';
                                    } else if (user.balanceUSD < -0.01 || user.balanceKHR < -100) {
                                        statusColor = 'text-red-700 bg-red-100';
                                        statusText = 'User Owes Company';
                                    }

                                    return (
                                        <tr key={user.uid} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">{user.name}</div>
                                                <div className="text-xs text-gray-500">{user.phone || '-'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${user.role === 'driver' ? 'bg-orange-100 text-orange-800' : 'bg-teal-100 text-teal-800'}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 text-right font-bold ${user.balanceUSD < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                ${user.balanceUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className={`px-6 py-4 text-right font-bold ${user.balanceKHR < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                                {user.balanceKHR.toLocaleString()} ៛
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${statusColor}`}>
                                                    {statusText}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};
