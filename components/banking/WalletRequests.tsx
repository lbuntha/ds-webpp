import React, { useState, useEffect } from 'react';
import { WalletTransaction, Account, JournalEntry, Invoice, ParcelBooking, ParcelServiceType, DriverCommissionRule, Employee, AccountType, AccountSubType, AppNotification, CurrencyConfig, TaxRate, Branch } from '../../src/shared/types';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SettlementReportModal } from '../ui/SettlementReportModal';
import { toast } from '../../src/shared/utils/toast';
import { calculateDriverCommission, getApplicableCommissionRule } from '../../src/shared/utils/commissionCalculator';

export const WalletRequests: React.FC = () => {
    const [requests, setRequests] = useState<WalletTransaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Rounding helper for financial accuracy
    const round2 = (val: number) => Math.round((val + Number.EPSILON) * 100) / 100;

    const [viewTransaction, setViewTransaction] = useState<WalletTransaction | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ type: 'APPROVE' | 'REJECT', txn: WalletTransaction } | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    // Data for JE creation context
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [services, setServices] = useState<ParcelServiceType[]>([]);
    const [settings, setSettings] = useState<any>({});
    const [currencies, setCurrencies] = useState<CurrencyConfig[]>([]);
    const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);

    // Commission Data
    const [commissionRules, setCommissionRules] = useState<DriverCommissionRule[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const [data, accData, bookingsData, servicesData, settingsData, rulesData, empData, currencyData, taxData, branchData] = await Promise.all([
                firebaseService.getPendingWalletTransactions(),
                firebaseService.getAccounts(),
                firebaseService.getParcelBookings(),
                firebaseService.getParcelServices(),
                firebaseService.getSettings(),
                firebaseService.logisticsService.getDriverCommissionRules(),
                firebaseService.getEmployees(),
                firebaseService.getCurrencies(),
                firebaseService.getTaxRates(),
                firebaseService.getBranches()
            ]);
            setRequests(data);
            setAccounts(accData);
            setBookings(bookingsData);
            setServices(servicesData);
            setSettings(settingsData);
            setCommissionRules(rulesData);
            setEmployees(empData);
            setCurrencies(currencyData);
            setTaxRates(taxData);
            setBranches(branchData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRequests();
    }, []);

    const initiateApprove = (txn: WalletTransaction) => {
        // Show preview for Settlements, Withdrawals, AND Deposits to verify accounting
        setViewTransaction(txn);
    };

    const confirmApprovalFromModal = () => {
        if (viewTransaction) {
            setConfirmAction({ type: 'APPROVE', txn: viewTransaction });
            setViewTransaction(null);
        }
    };

    const initiateReject = (txn: WalletTransaction) => {
        setConfirmAction({ type: 'REJECT', txn });
        setRejectReason('');
    };

    const executeApprove = async () => {
        if (!confirmAction || confirmAction.type !== 'APPROVE') return;
        const { txn } = confirmAction;

        setProcessingId(txn.id);
        try {
            const currentUser = await firebaseService.getCurrentUser();
            const branchId = branches.length > 0 ? branches[0].id : 'b1';

            // Fetch Profile
            const userProfile = await firebaseService.getDocument('users', txn.userId) as any;
            const isCustomerPayout = userProfile?.role === 'customer';
            const currencyCode = (txn.currency || 'USD').toUpperCase();
            const isUSD = currencyCode === 'USD';

            // --- RESOLVE BANK ACCOUNT ---
            let settlementBankId = txn.bankAccountId;
            // If txn bank is generic 'system', use appropriate bank based on user role
            if (!settlementBankId || settlementBankId === 'system' || settlementBankId === 'system-payout') {
                const rule4AccId = settings.transactionRules ? settings.transactionRules['4'] : null;
                if (isCustomerPayout) {
                    settlementBankId = isUSD
                        ? (settings.defaultCustomerSettlementBankIdUSD || settings.defaultCustomerSettlementBankId)
                        : (settings.defaultCustomerSettlementBankIdKHR || settings.defaultCustomerSettlementBankId);
                } else {
                    if (rule4AccId) {
                        settlementBankId = rule4AccId;
                    } else {
                        settlementBankId = isUSD
                            ? (settings.defaultDriverSettlementBankIdUSD || settings.defaultDriverSettlementBankId)
                            : (settings.defaultDriverSettlementBankIdKHR || settings.defaultDriverSettlementBankId);
                    }
                }
            }

            if (!settlementBankId) {
                throw new Error("Settlement Bank Account is not configured in Settings.");
            }

            // --- CALL CENTRALIZED SERVICE ---
            /* 
               We simply delegate to the service. 
               The service handles:
               - Exchange Rates (via context)
               - Account Lookups (via context)
               - Logic (Direct Fee Split, Currency Blocks)
               - Generation & Saving of Journal Entry
            */

            // Dynamic Import of Service (to avoid circular deps if any, though standard import is preferred)
            const { GLBookingService } = await import('../../src/shared/services/glBookingService');

            const entry = await GLBookingService.createGLEntry({
                transactionType: txn.type as any,
                userId: txn.userId,
                userName: txn.userName,
                userRole: isCustomerPayout ? 'customer' : 'driver',
                amount: txn.amount,
                currency: txn.currency as any,
                relatedItems: txn.relatedItems,
                bankAccountId: settlementBankId,
                description: txn.description,
                branchId: branchId
            }, {
                accounts,
                settings,
                employees,
                commissionRules,
                bookings,
                currencies
            });

            // 1. Save Journal Entry to Firestore
            await firebaseService.addTransaction(entry);

            // 2. Update Transaction Status & Link JE
            await firebaseService.approveWalletTransaction(txn.id, currentUser.uid, entry.id);

            // 3. Mark related items as SETTLED (for SETTLEMENT transactions)
            if (txn.type === 'SETTLEMENT' && txn.relatedItems && txn.relatedItems.length > 0) {
                // Determine settlement type: if description contains 'Settlement' it's a driver, else customer payout
                const isDriverSettlement = (txn.description || '').toLowerCase().includes('settlement') &&
                    !(txn.description || '').toLowerCase().includes('payout');
                const isTaxiReimbursement = (txn.description || '').toLowerCase().includes('taxi');

                if (isTaxiReimbursement) {
                    // Mark taxi fee as reimbursed on the parcel items
                    await firebaseService.markTaxiFeesAsReimbursed(txn.relatedItems);
                    // Also mark the TAXI_FEE wallet transaction as settled
                    // Pass userId for fallback matching on old transactions without relatedItems
                    await firebaseService.markTaxiFeeTransactionsAsSettled(txn.relatedItems, txn.userId);
                } else {
                    // Regular driver/customer settlement
                    await firebaseService.settleParcelItems(
                        txn.relatedItems,
                        isDriverSettlement ? 'driver' : 'customer',
                        txn.currency as 'USD' | 'KHR',
                        txn.id
                    );
                }
            }

            const notif: AppNotification = {
                id: `notif-wallet-${Date.now()}`,
                targetAudience: txn.userId,
                title: 'Wallet Request Approved',
                message: `Your ${(txn.type || '').toLowerCase()} request for ${txn.amount} ${txn.currency} has been approved.`,
                type: 'SUCCESS',
                read: false,
                createdAt: Date.now()
            };
            await firebaseService.sendNotification(notif);

            setConfirmAction(null);
            await loadRequests();
            toast.success("Transaction Approved & Posted to GL");
        } catch (e: any) {
            console.error(e);
            toast.error("Approval Failed: " + e.message);
        } finally {
            setProcessingId(null);
        }
    };

    const executeReject = async () => {
        if (!confirmAction || confirmAction.type !== 'REJECT') return;
        const { txn } = confirmAction;

        if (!rejectReason.trim()) {
            toast.warning("Please provide a reason for rejection.");
            return;
        }

        setProcessingId(txn.id);
        try {
            const currentUser = await firebaseService.getCurrentUser();
            const finalReason = `${rejectReason} (Rejected by ${currentUser?.name || 'Admin'})`;

            await firebaseService.rejectWalletTransaction(txn.id, finalReason);

            const notif: AppNotification = {
                id: `notif-wallet-rej-${Date.now()}`,
                targetAudience: txn.userId,
                title: 'Wallet Request Rejected',
                message: `Your ${(txn.type || '').toLowerCase()} request was rejected. Reason: ${rejectReason}`,
                type: 'ERROR',
                read: false,
                createdAt: Date.now()
            };
            await firebaseService.sendNotification(notif);

            setConfirmAction(null);
            await loadRequests();
        } catch (e: any) {
            toast.error("Rejection Failed: " + e.message);
        } finally {
            setProcessingId(null);
        }
    };

    const getBankName = (id: string) => {
        const acc = accounts.find(a => a.id === id);
        return acc ? `${acc.name} (${acc.code})` : 'Unknown Bank';
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900">Pending Wallet Requests</h3>
                <Button variant="outline" onClick={loadRequests} isLoading={loading} className="text-xs">Refresh</Button>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested Bank</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {requests.map(txn => (
                                <tr key={txn.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm text-gray-500">{txn.date}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{txn.userName}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${txn.type === 'DEPOSIT' ? 'bg-green-100 text-green-800' :
                                            txn.type === 'WITHDRAWAL' ? 'bg-red-100 text-red-800' : 'bg-purple-100 text-purple-800'
                                            }`}>
                                            {txn.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">
                                        {txn.amount.toLocaleString()} {txn.currency}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 font-mono text-xs">
                                        {txn.bankAccountId ? getBankName(txn.bankAccountId) : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                                        <button onClick={() => initiateReject(txn)} className="text-red-600 hover:text-red-900">Reject</button>
                                        <button onClick={() => initiateApprove(txn)} className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">Approve</button>
                                    </td>
                                </tr>
                            ))}
                            {requests.length === 0 && (
                                <tr><td colSpan={6} className="text-center py-8 text-gray-500">No pending requests.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {viewTransaction && (
                <SettlementReportModal
                    transaction={viewTransaction}
                    onClose={() => setViewTransaction(null)}
                    isApproving={true}
                    onConfirm={confirmApprovalFromModal}
                    bookings={bookings}
                    commissionRules={commissionRules}
                    employees={employees}
                    accounts={accounts}
                    settings={settings}
                    currencies={currencies}
                    taxRates={taxRates}
                />
            )}

            {confirmAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold mb-4">{confirmAction.type === 'APPROVE' ? 'Confirm Approval' : 'Reject Request'}</h3>
                        {confirmAction.type === 'REJECT' ? (
                            <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection" />
                        ) : (
                            <div className="text-sm text-gray-600 mb-4 space-y-2">
                                <p>Approve {confirmAction.txn.type} of {confirmAction.txn.amount} {confirmAction.txn.currency}?</p>
                                <p className="text-xs bg-yellow-50 p-2 rounded text-yellow-800 border border-yellow-100">
                                    <strong>Accounting Action:</strong>
                                    {confirmAction.txn.type === 'SETTLEMENT'
                                        ? " Creates Journal Entry for Cash Receipt, Revenue Recognition, Tax, and Customer Liability Adjustment."
                                        : " Creates Journal Entry for Cash Movement."}
                                </p>
                            </div>
                        )}
                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
                            <Button
                                onClick={confirmAction.type === 'APPROVE' ? executeApprove : executeReject}
                                isLoading={!!processingId}
                                className={confirmAction.type === 'APPROVE' ? 'bg-green-600' : 'bg-red-600'}
                            >
                                Confirm
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
