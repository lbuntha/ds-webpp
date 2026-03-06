import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Employee, WalletTransaction, UserProfile, AccountSubType, AccountType, Account, SystemSettings } from '../../src/shared/types';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';

export const DriverCommissionReport: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // Data
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [earnings, setEarnings] = useState<WalletTransaction[]>([]);
    const [bankAccounts, setBankAccounts] = useState<Account[]>([]);
    const [settings, setSettings] = useState<SystemSettings>({});

    // Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedDrivers, setExpandedDrivers] = useState<Set<string>>(new Set());

    // Settle Modal State
    const [selectedDriver, setSelectedDriver] = useState<{
        employeeId: string;
        userId: string;
        name: string;
        usdTotal: number;
        khrTotal: number;
        transactions: WalletTransaction[];
    } | null>(null);

    const [bankUsdId, setBankUsdId] = useState<string>('');
    const [bankKhrId, setBankKhrId] = useState<string>('');
    const [settleProof, setSettleProof] = useState<string>('');

    const loadData = async () => {
        setLoading(true);
        try {
            const [allEmployees, allUsers, allTxns, allAccounts, allSettings] = await Promise.all([
                firebaseService.getEmployees(),
                firebaseService.getUsers(),
                firebaseService.getAllWalletTransactions(),
                firebaseService.getAccounts(),
                firebaseService.getSettings()
            ]);

            setEmployees(allEmployees.filter(e => e.isDriver && e.linkedUserId));
            setUsers(allUsers);

            // Filter only unsettled earnings
            const unsettledEarnings = allTxns.filter(t => t.type === 'EARNING' && !t.isSettled);
            setEarnings(unsettledEarnings);

            // Banks
            const banks = allAccounts.filter(a =>
                a.type === AccountType.ASSET &&
                (a.subType === AccountSubType.CURRENT_ASSET || (a.name || '').toLowerCase().includes('bank') || (a.name || '').toLowerCase().includes('cash')) &&
                !a.isHeader
            );
            setBankAccounts(banks);
            setSettings(allSettings);

            if (allSettings.defaultDriverSettlementBankIdUSD) setBankUsdId(allSettings.defaultDriverSettlementBankIdUSD);
            if (allSettings.defaultDriverSettlementBankIdKHR) setBankKhrId(allSettings.defaultDriverSettlementBankIdKHR);

        } catch (e) {
            console.error("Failed to load driver commissions:", e);
            toast.error("Failed to load data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Group earnings by driver (user ID)
    const groupedCommissions = useMemo(() => {
        const grouped = new Map<string, {
            employeeId: string;
            userId: string;
            name: string;
            usdTotal: number;
            khrTotal: number;
            transactions: WalletTransaction[];
        }>();

        // Initialize drivers even if they have $0
        employees.forEach(emp => {
            if (emp.linkedUserId) {
                grouped.set(emp.linkedUserId, {
                    employeeId: emp.id,
                    userId: emp.linkedUserId,
                    name: emp.name,
                    usdTotal: 0,
                    khrTotal: 0,
                    transactions: []
                });
            }
        });

        // Add up earnings
        earnings.forEach(txn => {
            const driverGroup = grouped.get(txn.userId);
            if (driverGroup) {
                if (txn.currency === 'USD') driverGroup.usdTotal += txn.amount;
                if (txn.currency === 'KHR') driverGroup.khrTotal += txn.amount;
                driverGroup.transactions.push(txn);
            } else {
                // Earning for a user not flagged as a driver employee anymore? Still show them.
                const user = users.find(u => u.uid === txn.userId);
                grouped.set(txn.userId, {
                    employeeId: '',
                    userId: txn.userId,
                    name: user ? user.name : 'Unknown User',
                    usdTotal: txn.currency === 'USD' ? txn.amount : 0,
                    khrTotal: txn.currency === 'KHR' ? txn.amount : 0,
                    transactions: [txn]
                });
            }
        });

        let result = Array.from(grouped.values())
            .filter(g => g.usdTotal > 0 || g.khrTotal > 0) // Only show drivers with actual pending commissions
            .sort((a, b) => b.usdTotal - a.usdTotal);

        if (searchQuery.trim()) {
            const lowerSearch = searchQuery.toLowerCase();
            result = result.filter(g => g.name.toLowerCase().includes(lowerSearch));
        }

        return result;
    }, [earnings, employees, users, searchQuery]);

    const toggleExpand = (userId: string) => {
        setExpandedDrivers(prev => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    };

    const handleSettle = async () => {
        if (!selectedDriver) return;

        const hasUSD = selectedDriver.usdTotal > 0;
        const hasKHR = selectedDriver.khrTotal > 0;

        if (hasUSD && !bankUsdId) return toast.error("Please select a bank account to payout USD.");
        if (hasKHR && !bankKhrId) return toast.error("Please select a bank account to payout KHR.");

        setIsProcessing(true);
        try {
            // 1. Mark existing EARNING transactions as settled
            const { doc, updateDoc } = await import('firebase/firestore');
            const { db } = await import('../../src/shared/services/firebaseInstance');

            const updatePromises = selectedDriver.transactions.map(txn =>
                updateDoc(doc(db, 'wallet_transactions', txn.id), { isSettled: true, settledAt: Date.now() })
            );
            await Promise.all(updatePromises);

            // 2. Create the Payout Transactions (WITHDRAWAL) to reduce the wallet balance
            if (hasUSD) {
                await firebaseService.requestWithdrawal(
                    selectedDriver.userId,
                    selectedDriver.name,
                    selectedDriver.usdTotal,
                    'USD',
                    bankUsdId,
                    'Commission Payout Settlement',
                    [] // No related booking items needed just for the ledger entry
                );
            }

            if (hasKHR) {
                await firebaseService.requestWithdrawal(
                    selectedDriver.userId,
                    selectedDriver.name,
                    selectedDriver.khrTotal,
                    'KHR',
                    bankKhrId,
                    'Commission Payout Settlement',
                    []
                );
            }

            toast.success(`Successfully recorded payout for ${selectedDriver.name}.`);
            setSelectedDriver(null);
            setSettleProof('');
            loadData(); // Refresh the grid
        } catch (e) {
            console.error(e);
            toast.error("Failed to settle commissions. See console for details.");
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500 animate-pulse">Scanning driver wallets...</div>;
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto p-4 lg:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Driver Commissions</h1>
                    <p className="text-gray-500">Extract and clear unsettled delivery commissions for fleet drivers.</p>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Input
                            placeholder="Search driver name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button variant="secondary" onClick={loadData}>
                        <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </Button>
                </div>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Driver</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending Tasks</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-900 uppercase tracking-wider">Unsettled USD</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-900 uppercase tracking-wider">Unsettled KHR</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {groupedCommissions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        No unsettled commissions found.
                                    </td>
                                </tr>
                            ) : (
                                groupedCommissions.map(group => (
                                    <React.Fragment key={group.userId}>
                                        <tr className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{group.name}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    {group.transactions.length} tasks
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-green-600">
                                                {group.usdTotal > 0 ? `$${group.usdTotal.toFixed(2)}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-blue-600">
                                                {group.khrTotal > 0 ? `${group.khrTotal.toLocaleString()} ៛` : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium border-l border-gray-100">
                                                <div className="flex gap-2 justify-end">
                                                    <Button
                                                        variant="secondary"
                                                        onClick={() => toggleExpand(group.userId)}
                                                    >
                                                        {expandedDrivers.has(group.userId) ? 'Hide Details' : 'View Details'}
                                                    </Button>
                                                    <Button
                                                        variant="primary"
                                                        onClick={() => setSelectedDriver(group)}
                                                    >
                                                        Payout
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedDrivers.has(group.userId) && (
                                            <tr key={`expanded-${group.userId}`} className="bg-gray-50 border-t border-gray-100">
                                                <td colSpan={5} className="p-4">
                                                    <div className="rounded-lg bg-white border border-gray-200 overflow-hidden shadow-sm">
                                                        <table className="min-w-full divide-y divide-gray-200">
                                                            <thead className="bg-gray-50">
                                                                <tr>
                                                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                                                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Reference</th>
                                                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                                                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-200">
                                                                {group.transactions.map((txn, idx) => (
                                                                    <tr key={txn.id || idx} className="hover:bg-gray-50">
                                                                        <td className="px-4 py-2 text-sm text-gray-600 whitespace-nowrap">
                                                                            {new Date(txn.date).toLocaleString()}
                                                                        </td>
                                                                        <td className="px-4 py-2 text-sm text-gray-600">
                                                                            {txn.description || '-'}
                                                                        </td>
                                                                        <td className="px-4 py-2 text-sm text-gray-600">
                                                                            {txn.description}
                                                                        </td>
                                                                        <td className="px-4 py-2 text-sm font-medium text-right whitespace-nowrap">
                                                                            <span className={txn.currency === 'USD' ? 'text-green-600' : 'text-blue-600'}>
                                                                                {txn.currency === 'USD' ? `$${txn.amount.toFixed(2)}` : `${txn.amount.toLocaleString()} ៛`}
                                                                            </span>
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
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Settlement Modal */}
            {
                selectedDriver && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-gray-900">Settle Commission Earned</h3>
                                <button onClick={() => setSelectedDriver(null)} className="text-gray-400 hover:text-gray-600">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="bg-gray-50 border rounded-xl p-4 mb-6 text-center">
                                <p className="text-sm text-gray-500 mb-1">Paying out to <strong>{selectedDriver.name}</strong></p>

                                {selectedDriver.usdTotal > 0 && (
                                    <p className="text-2xl font-black text-green-600">${selectedDriver.usdTotal.toFixed(2)}</p>
                                )}
                                {selectedDriver.usdTotal > 0 && selectedDriver.khrTotal > 0 && <p className="text-gray-300 font-bold">+</p>}
                                {selectedDriver.khrTotal > 0 && (
                                    <p className="text-2xl font-black text-blue-600">{selectedDriver.khrTotal.toLocaleString()} ៛</p>
                                )}

                                <p className="text-xs text-gray-400 mt-2">({selectedDriver.transactions.length} tasks cleared)</p>
                            </div>

                            <div className="space-y-4">
                                {selectedDriver.usdTotal > 0 && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Withdraw USD From Account</label>
                                        <select
                                            className="w-full border-gray-300 rounded-lg shadow-sm focus:border-black focus:ring-black sm:text-sm"
                                            value={bankUsdId}
                                            onChange={(e) => setBankUsdId(e.target.value)}
                                        >
                                            <option value="">-- Select GL Account --</option>
                                            {bankAccounts.filter(b => b.currency !== 'KHR').map(b => (
                                                <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {selectedDriver.khrTotal > 0 && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Withdraw KHR From Account</label>
                                        <select
                                            className="w-full border-gray-300 rounded-lg shadow-sm focus:border-black focus:ring-black sm:text-sm"
                                            value={bankKhrId}
                                            onChange={(e) => setBankKhrId(e.target.value)}
                                        >
                                            <option value="">-- Select GL Account --</option>
                                            {bankAccounts.filter(b => b.currency !== 'USD').map(b => (
                                                <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Commented out proof upload as it's not strictly required, but usually good practice */}
                                {/* <div className="pt-2">
                                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Proof of Payout (Optional)</label>
                                <ImageUpload value={settleProof} onChange={setSettleProof} />
                            </div> */}

                                <p className="text-xs text-gray-500 mb-4 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                    This action will record a <strong>Wallet Withdrawal</strong> to reduce the driver's available balance and mark these specific earning tasks as successfully paid out.
                                </p>

                                <div className="flex justify-end gap-3 pt-4 border-t">
                                    <Button variant="secondary" onClick={() => setSelectedDriver(null)} disabled={isProcessing}>
                                        Cancel
                                    </Button>
                                    <Button variant="primary" onClick={handleSettle} disabled={isProcessing || (selectedDriver.usdTotal > 0 && !bankUsdId) || (selectedDriver.khrTotal > 0 && !bankKhrId)}>
                                        {isProcessing ? 'Processing Payout...' : 'Confirm Payout'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
