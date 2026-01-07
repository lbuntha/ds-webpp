import React, { useState, useEffect, useMemo } from 'react';
import { CustomerCashbackRule, ParcelBooking, Customer, UserProfile, Account, SystemSettings } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';

interface CustomerCashbackSummary {
    customerId: string;
    customerName: string;
    rule: CustomerCashbackRule;
    parcelCount: number;
    deliveryFeesUSD: number;
    deliveryFeesKHR: number;
    cashbackUSD: number;
    cashbackKHR: number;
    isEligible: boolean;
    alreadyRedeemed: boolean;
}

export const CashbackReport: React.FC = () => {
    const [rules, setRules] = useState<CustomerCashbackRule[]>([]);
    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Month selector
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // Confirmation modal
    const [confirmation, setConfirmation] = useState<{
        summary: CustomerCashbackSummary;
        currency: 'USD' | 'KHR';
        amount: number;
    } | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [rulesData, bookingsData, customersData, usersData, accountsData, settingsData] = await Promise.all([
                    firebaseService.getCustomerCashbackRules(),
                    firebaseService.getParcelBookings(),
                    firebaseService.getCustomers(),
                    firebaseService.getUsers(),
                    firebaseService.getAccounts(),
                    firebaseService.getSettings()
                ]);
                setRules(rulesData);
                setBookings(bookingsData);
                setCustomers(customersData);
                setUsers(usersData);
                setAccounts(accountsData);
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

    // Calculate cashback eligibility per customer
    const cashbackSummaries = useMemo(() => {
        const summaries: CustomerCashbackSummary[] = [];
        const [year, month] = selectedMonth.split('-').map(Number);
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59);

        rules.forEach(rule => {
            // Check if rule is active for selected month
            const ruleStart = new Date(rule.startDate);
            const ruleEnd = new Date(rule.endDate);
            if (ruleStart > monthEnd || ruleEnd < monthStart || !rule.isActive) return;

            let parcelCount = 0;
            let deliveryFeesUSD = 0;
            let deliveryFeesKHR = 0;

            // Count delivered parcels for this customer in selected month
            bookings.forEach(b => {
                if (b.senderId !== rule.customerId) return;

                (b.items || []).forEach(item => {
                    if (item.status !== 'DELIVERED') return;

                    // Check if delivery is in selected month
                    const deliveryDate = new Date(b.bookingDate);
                    if (deliveryDate < monthStart || deliveryDate > monthEnd) return;

                    parcelCount++;

                    // Sum fees by COD currency
                    const isKHR = item.codCurrency === 'KHR';
                    if (item.deliveryFeeUSD !== undefined || item.deliveryFeeKHR !== undefined) {
                        if (isKHR) {
                            deliveryFeesKHR += item.deliveryFeeKHR || 0;
                        } else {
                            deliveryFeesUSD += item.deliveryFeeUSD || 0;
                        }
                    } else {
                        // Legacy fallback
                        const fee = Number(item.deliveryFee) || 0;
                        if (isKHR) {
                            deliveryFeesKHR += fee;
                        } else {
                            deliveryFeesUSD += fee;
                        }
                    }
                });
            });

            const isEligible = parcelCount >= rule.minParcelsPerMonth;
            const cashbackUSD = isEligible ? deliveryFeesUSD * (rule.cashbackPercent / 100) : 0;
            const cashbackKHR = isEligible ? deliveryFeesKHR * (rule.cashbackPercent / 100) : 0;

            summaries.push({
                customerId: rule.customerId,
                customerName: rule.customerName,
                rule,
                parcelCount,
                deliveryFeesUSD,
                deliveryFeesKHR,
                cashbackUSD,
                cashbackKHR,
                isEligible,
                alreadyRedeemed: false // TODO: Check wallet transactions for existing cashback
            });
        });

        return summaries.sort((a, b) => b.parcelCount - a.parcelCount);
    }, [rules, bookings, selectedMonth]);

    const initiateRedeem = (summary: CustomerCashbackSummary, currency: 'USD' | 'KHR') => {
        const amount = currency === 'USD' ? summary.cashbackUSD : summary.cashbackKHR;
        if (amount <= 0) {
            toast.warning(`No ${currency} cashback to redeem`);
            return;
        }
        setConfirmation({ summary, currency, amount });
    };

    const executeRedeem = async () => {
        if (!confirmation) return;
        const { summary, currency, amount } = confirmation;

        setProcessing(true);
        try {
            const linkedUser = users.find(u => u.linkedCustomerId === summary.customerId);
            if (!linkedUser) {
                toast.error("Customer not linked to a user account. Cannot process cashback.");
                return;
            }

            const description = `Cashback ${summary.rule.cashbackPercent}% for ${selectedMonth} (${summary.parcelCount} parcels)`;

            await firebaseService.processWalletTransaction(
                linkedUser.uid,
                Number(currency === 'USD' ? amount.toFixed(2) : amount.toFixed(0)),
                currency,
                'CASHBACK',
                'system',
                description
            );

            toast.success(`Cashback of ${currency === 'USD' ? '$' + amount.toFixed(2) : amount.toLocaleString() + ' ៛'} credited!`);
            setConfirmation(null);

        } catch (e: any) {
            console.error(e);
            toast.error("Failed to process cashback: " + e.message);
        } finally {
            setProcessing(false);
        }
    };

    // Month options (last 12 months)
    const monthOptions = useMemo(() => {
        const options: string[] = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        return options;
    }, []);

    const formatMonth = (m: string) => {
        const [year, month] = m.split('-');
        return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Confirmation Modal */}
            {confirmation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-emerald-900">Confirm Cashback Redemption</h3>
                            <button onClick={() => setConfirmation(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="text-center">
                                <div className="text-sm text-gray-500 uppercase font-bold tracking-wide mb-1">Cashback Amount</div>
                                <div className="text-4xl font-black text-emerald-600">
                                    {confirmation.currency === 'USD'
                                        ? ('$' + confirmation.amount.toFixed(2))
                                        : (confirmation.amount.toLocaleString() + ' ៛')}
                                </div>
                                <div className="text-sm text-gray-500 mt-2">
                                    To: <span className="font-bold text-gray-900">{confirmation.summary.customerName}</span>
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                    {confirmation.summary.rule.cashbackPercent}% of {confirmation.currency} delivery fees for {formatMonth(selectedMonth)}
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <div className="text-xs font-bold text-gray-500 uppercase mb-3 border-b border-gray-200 pb-2">
                                    Proposed Accounting Entries (GL Preview)
                                </div>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-gray-500 text-xs">
                                            <th className="text-left pb-1">Account</th>
                                            <th className="text-right pb-1">Dr</th>
                                            <th className="text-right pb-1">Cr</th>
                                        </tr>
                                    </thead>
                                    <tbody className="font-mono text-gray-700">
                                        <tr>
                                            <td className="py-1">6600 - Marketing/Promotions Expense</td>
                                            <td className="text-right py-1">
                                                {confirmation.currency === 'USD'
                                                    ? confirmation.amount.toFixed(2)
                                                    : confirmation.amount.toLocaleString()}
                                            </td>
                                            <td className="text-right py-1 text-gray-300">-</td>
                                        </tr>
                                        <tr>
                                            <td className="py-1">3200 - Accounts Payable (Customer Wallet)</td>
                                            <td className="text-right py-1 text-gray-300">-</td>
                                            <td className="text-right py-1">
                                                {confirmation.currency === 'USD'
                                                    ? confirmation.amount.toFixed(2)
                                                    : confirmation.amount.toLocaleString()}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    className="flex-1 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                                    onClick={() => setConfirmation(null)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg"
                                    onClick={executeRedeem}
                                    isLoading={processing}
                                >
                                    Confirm & Credit
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Cashback Eligibility Report</h1>
                    <p className="text-sm text-gray-500">Review and process customer cashback based on parcel volume</p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">Month:</label>
                    <select
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-emerald-500 text-sm"
                    >
                        {monthOptions.map(m => (
                            <option key={m} value={m}>{formatMonth(m)}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-emerald-50 p-4">
                    <div className="text-xs font-bold text-emerald-800 uppercase">Eligible Customers</div>
                    <div className="text-3xl font-bold text-emerald-900 mt-1">
                        {cashbackSummaries.filter(s => s.isEligible).length}
                    </div>
                </Card>
                <Card className="bg-blue-50 p-4">
                    <div className="text-xs font-bold text-blue-800 uppercase">Total Rules</div>
                    <div className="text-3xl font-bold text-blue-900 mt-1">{rules.length}</div>
                </Card>
                <Card className="bg-green-50 p-4">
                    <div className="text-xs font-bold text-green-800 uppercase">Pending USD</div>
                    <div className="text-3xl font-bold text-green-900 mt-1">
                        ${cashbackSummaries.filter(s => s.isEligible && !s.alreadyRedeemed).reduce((sum, s) => sum + s.cashbackUSD, 0).toFixed(2)}
                    </div>
                </Card>
                <Card className="bg-indigo-50 p-4">
                    <div className="text-xs font-bold text-indigo-800 uppercase">Pending KHR</div>
                    <div className="text-3xl font-bold text-indigo-900 mt-1">
                        {cashbackSummaries.filter(s => s.isEligible && !s.alreadyRedeemed).reduce((sum, s) => sum + s.cashbackKHR, 0).toLocaleString()} ៛
                    </div>
                </Card>
            </div>

            {/* Table */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-gray-500">Customer</th>
                                <th className="px-4 py-3 text-center font-medium text-gray-500">Rule</th>
                                <th className="px-4 py-3 text-center font-medium text-gray-500">Parcels</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-500">Fees USD</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-500">Fees KHR</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-500">Cashback USD</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-500">Cashback KHR</th>
                                <th className="px-4 py-3 text-center font-medium text-gray-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {cashbackSummaries.map(s => (
                                <tr key={s.customerId} className={`hover:bg-gray-50 ${s.isEligible ? '' : 'opacity-50'}`}>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-900">{s.customerName}</div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                            ≥{s.rule.minParcelsPerMonth} → {s.rule.cashbackPercent}%
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`font-bold ${s.isEligible ? 'text-emerald-600' : 'text-gray-500'}`}>
                                            {s.parcelCount}
                                        </span>
                                        {!s.isEligible && (
                                            <span className="text-xs text-red-500 ml-1">
                                                ({s.rule.minParcelsPerMonth - s.parcelCount} short)
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">${s.deliveryFeesUSD.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right">{s.deliveryFeesKHR.toLocaleString()} ៛</td>
                                    <td className="px-4 py-3 text-right font-bold text-green-700">
                                        {s.isEligible ? '$' + s.cashbackUSD.toFixed(2) : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-indigo-700">
                                        {s.isEligible ? s.cashbackKHR.toLocaleString() + ' ៛' : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {s.isEligible && !s.alreadyRedeemed ? (
                                            <div className="flex gap-1 justify-center">
                                                {s.cashbackUSD > 0 && (
                                                    <Button
                                                        className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1"
                                                        onClick={() => initiateRedeem(s, 'USD')}
                                                    >
                                                        Pay USD
                                                    </Button>
                                                )}
                                                {s.cashbackKHR > 0 && (
                                                    <Button
                                                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-2 py-1"
                                                        onClick={() => initiateRedeem(s, 'KHR')}
                                                    >
                                                        Pay KHR
                                                    </Button>
                                                )}
                                            </div>
                                        ) : s.alreadyRedeemed ? (
                                            <span className="text-xs text-gray-400">Redeemed</span>
                                        ) : (
                                            <span className="text-xs text-gray-400">Not eligible</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {cashbackSummaries.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                        No cashback rules configured or no data for selected month.
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
