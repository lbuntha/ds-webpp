import React, { useState, useEffect, useMemo } from 'react';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    orderBy,
    setDoc
} from 'firebase/firestore';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { db } from '../../src/config/firebase';
import { FeeReceivable, Account, SystemSettings } from '../../src/shared/types';
import { toast } from '../../src/shared/utils/toast';
import { ImageUpload } from '../ui/ImageUpload';

// Simple currency formatter
const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency === 'KHR' ? 'KHR' : 'USD',
        minimumFractionDigits: currency === 'KHR' ? 0 : 2,
    }).format(amount);
};

// UI Grouping interface
interface CustomerReceivableSummary {
    customerId: string;
    customerName: string;
    unpaidUSD: number;
    unpaidKHR: number;
    records: FeeReceivable[];
}

const CustomerCollectionForm: React.FC = () => {
    const [summaries, setSummaries] = useState<CustomerReceivableSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSummary, setSelectedSummary] = useState<CustomerReceivableSummary | null>(null);
    const [processing, setProcessing] = useState(false);

    // Partial Payment State
    const [paymentCurrencies] = useState<Array<'USD' | 'KHR'>>(['USD', 'KHR']);
    const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'KHR'>('USD');
    const [paymentAmount, setPaymentAmount] = useState<string>('');
    const [proofImage, setProofImage] = useState<string>('');

    // Bank Account Selection State
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');

    useEffect(() => {
        fetchReceivables();
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const [accs, sets] = await Promise.all([
                firebaseService.getAccounts(),
                firebaseService.getSettings()
            ]);
            // Filter for Asset accounts (Bank/Cash)
            setAccounts(accs.filter(a => a.type === 'Asset'));
            setSettings(sets);
        } catch (e) {
            console.error("Failed to load configs", e);
        }
    };

    const fetchReceivables = async () => {
        setLoading(true);
        try {
            // 1. Fetch all UNPAID or PARTIAL fee receivables
            const q = query(
                collection(db, 'fee_receivables'),
                where('status', 'in', ['UNPAID', 'PARTIAL'])
            );
            const snap = await getDocs(q);
            const records = snap.docs.map(d => d.data() as FeeReceivable);

            // 2. Group by Customer
            const grouped = records.reduce((acc, rec) => {
                const key = rec.customerId || rec.userId; // Fallback to userId if customerId is missing
                if (!acc[key]) {
                    acc[key] = {
                        customerId: key,
                        customerName: rec.customerName || 'Unknown Customer',
                        unpaidUSD: 0,
                        unpaidKHR: 0,
                        records: []
                    };
                }

                const remaining = rec.totalAmount - (rec.paidAmount || 0);
                if (rec.currency === 'USD') {
                    acc[key].unpaidUSD += remaining;
                } else {
                    acc[key].unpaidKHR += remaining;
                }
                acc[key].records.push(rec);
                return acc;
            }, {} as Record<string, CustomerReceivableSummary>);

            // Convert to array and sort by customer name
            const summariesArray = Object.values(grouped).sort((a, b) => a.customerName.localeCompare(b.customerName));

            setSummaries(summariesArray);

            // Update selected summary if one is currently selected
            if (selectedSummary) {
                const updated = summariesArray.find(s => s.customerId === selectedSummary.customerId);
                setSelectedSummary(updated || null);
                if (updated) {
                    // Reset payment amount to max available in current currency
                    const maxAmt = selectedCurrency === 'USD' ? updated.unpaidUSD : updated.unpaidKHR;
                    setPaymentAmount(maxAmt > 0 ? maxAmt.toString() : '');
                }
            }

        } catch (e: any) {
            toast.error("Failed to fetch receivables: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCurrencySelect = (currency: 'USD' | 'KHR') => {
        setSelectedCurrency(currency);
        if (selectedSummary) {
            const maxAmt = currency === 'USD' ? selectedSummary.unpaidUSD : selectedSummary.unpaidKHR;
            setPaymentAmount(maxAmt > 0 ? maxAmt.toString() : '');
        }

        if (settings) {
            const defaultBankId = currency === 'USD'
                ? (settings.defaultCustomerSettlementBankIdUSD || settings.defaultSettlementBankAccountId || '')
                : (settings.defaultCustomerSettlementBankIdKHR || settings.defaultSettlementBankAccountId || '');
            if (defaultBankId) setSelectedBankAccountId(defaultBankId);
        }
    };

    const handleRecordCollection = async () => {
        if (!selectedSummary) return;

        if (!selectedBankAccountId) {
            toast.error("Please select a deposit account.");
            return;
        }

        const amountToPay = parseFloat(paymentAmount);

        if (isNaN(amountToPay) || amountToPay <= 0) {
            toast.error("Please enter a valid payment amount.");
            return;
        }

        const maxAllowed = selectedCurrency === 'USD' ? selectedSummary.unpaidUSD : selectedSummary.unpaidKHR;
        if (amountToPay > maxAllowed + 0.01) { // 0.01 tolerance for floating point
            toast.error(`Amount cannot exceed the total ${selectedCurrency} owed (${formatCurrency(maxAllowed, selectedCurrency)})`);
            return;
        }

        setProcessing(true);
        try {
            // Upload proof image if exists
            let uploadedAttachmentUrl: string | undefined = undefined;
            if (proofImage && proofImage.startsWith('data:')) {
                uploadedAttachmentUrl = await firebaseService.walletService.uploadAttachment(proofImage);
            } else if (proofImage) {
                uploadedAttachmentUrl = proofImage;
            }

            // 1. Create the overarching DEPOSIT transaction in the wallet
            // We use the userId from the first record (assuming all records for a customer share a userId for their wallet)
            const targetUserId = selectedSummary.records[0]?.userId;
            if (!targetUserId) throw new Error("Could not identify user wallet ID.");

            const txnId = `wtxn-${Date.now()}-${Math.floor(Math.random() * 100)}`;
            const txn = {
                id: txnId,
                userId: targetUserId,
                amount: amountToPay,
                currency: selectedCurrency,
                type: 'DEPOSIT',
                status: 'APPROVED',
                date: new Date().toISOString().split('T')[0],
                description: `Fee Collection (Multi-Record)`,
                bankAccountId: selectedBankAccountId,
                attachment: uploadedAttachmentUrl,
                relatedItems: [] as any[] // Will populate below
            };

            // 2. Distribute the payment across the specific FeeReceivable records
            let remainingPayment = amountToPay;

            // Filter records by selected currency and sort by oldest first
            const applicableRecords = selectedSummary.records
                .filter(r => r.currency === selectedCurrency)
                .sort((a, b) => a.createdAt - b.createdAt);

            const updatePromises = [];

            for (const rec of applicableRecords) {
                if (remainingPayment <= 0.001) break; // Done distributing (with float tolerance)

                const owedOnRecord = rec.totalAmount - (rec.paidAmount || 0);
                if (owedOnRecord <= 0) continue;

                // How much of this record can we pay off?
                const paymentForRecord = Math.min(owedOnRecord, remainingPayment);
                remainingPayment -= paymentForRecord;

                // Prepare the update for this FeeReceivable
                const newPaidAmount = (rec.paidAmount || 0) + paymentForRecord;
                const newStatus = (rec.totalAmount - newPaidAmount) < 0.01 ? 'PAID' : 'PARTIAL'; // 0.01 tolerance

                const clearingTxnIds = rec.clearingTxnIds || [];
                if (!clearingTxnIds.includes(txnId)) clearingTxnIds.push(txnId);

                const recordUpdate = {
                    paidAmount: newPaidAmount,
                    status: newStatus,
                    clearingTxnIds: clearingTxnIds,
                    clearedAt: newStatus === 'PAID' ? Date.now() : rec.clearedAt
                };

                // Add to promises
                updatePromises.push(updateDoc(doc(db, 'fee_receivables', rec.id), recordUpdate));

                // Link this specific item to the wallet transaction for audit
                txn.relatedItems.push({
                    bookingId: rec.bookingId,
                    itemId: rec.itemId
                });
            }

            // Save the wallet transaction
            await firebaseService.walletService.saveDocument('wallet_transactions', txn);

            // Execute all FeeReceivable updates concurrently
            await Promise.all(updatePromises);

            // Post Journal Entry
            try {
                const { GLBookingService } = await import('../../src/shared/services/glBookingService');
                const [accounts, settings, currencies] = await Promise.all([
                    firebaseService.getAccounts(),
                    firebaseService.getSettings(),
                    firebaseService.getCurrencies()
                ]);

                const entry = await GLBookingService.createGLEntry({
                    transactionType: 'DEPOSIT',
                    userId: targetUserId,
                    userName: selectedSummary.customerName,
                    userRole: 'customer',
                    amount: amountToPay,
                    currency: selectedCurrency,
                    relatedItems: txn.relatedItems,
                    bankAccountId: selectedBankAccountId,
                    description: `Fee Collection: ${selectedSummary.customerName}`,
                    branchId: 'b1' // Default system branch
                }, {
                    accounts,
                    settings,
                    currencies,
                    employees: [],
                    commissionRules: [],
                    bookings: []
                });
                await firebaseService.addTransaction(entry);
                // Link JE back to the wallet transaction
                await firebaseService.approveWalletTransaction(txn.id, 'system-admin', entry.id);
            } catch (jeErr: any) {
                console.error("Failed to post journal entry for fee collection:", jeErr);
                toast.error("Collection processed, but Journal Entry failed: " + jeErr.message);
            }

            toast.success(`Successfully collected ${formatCurrency(amountToPay, selectedCurrency)}`);
            setProofImage('');
            fetchReceivables(); // Will auto-refresh the UI and selected state
        } catch (e: any) {
            toast.error("Failed to record collection: " + e.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-800">Manage Fee Collections</h1>
            <p className="text-gray-600 mb-8 max-w-3xl">
                Manage and collect delivery fees from customers who opted for "Pay Gross" settlements.
                This form specifically tracks isolated delivery fee debts, independent of other wallet activities.
            </p>

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* List of Receivables Summary */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unpaid Fees (USD)</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unpaid Fees (KHR)</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {summaries.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                                            No outstanding fee collections found.
                                        </td>
                                    </tr>
                                ) : (
                                    summaries.map((s) => (
                                        <tr key={s.customerId} className={selectedSummary?.customerId === s.customerId ? "bg-blue-50" : "hover:bg-gray-50"}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{s.customerName}</div>
                                                <div className="text-xs text-gray-500">{s.records.length} outstanding item(s)</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-red-600">
                                                {s.unpaidUSD > 0 ? formatCurrency(s.unpaidUSD, 'USD') : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-red-600">
                                                {s.unpaidKHR > 0 ? formatCurrency(s.unpaidKHR, 'KHR') : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                                <button
                                                    onClick={() => {
                                                        setSelectedSummary(s);
                                                        // Auto-select currency that has a balance
                                                        const defaultCurr = s.unpaidUSD > 0 ? 'USD' : 'KHR';
                                                        setSelectedCurrency(defaultCurr);
                                                        setPaymentAmount(defaultCurr === 'USD' ? s.unpaidUSD.toString() : s.unpaidKHR.toString());

                                                        // Auto-select bank account based on currency
                                                        if (settings) {
                                                            const defaultBankId = defaultCurr === 'USD'
                                                                ? (settings.defaultCustomerSettlementBankIdUSD || settings.defaultSettlementBankAccountId || '')
                                                                : (settings.defaultCustomerSettlementBankIdKHR || settings.defaultSettlementBankAccountId || '');
                                                            if (defaultBankId) setSelectedBankAccountId(defaultBankId);
                                                        }
                                                    }}
                                                    className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors"
                                                >
                                                    Select
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Collection Details & Payment Panel */}
                    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 self-start sticky top-6">
                        <h2 className="text-lg font-bold mb-4 text-gray-800">Process Collection</h2>

                        {selectedSummary ? (
                            <div className="space-y-6">
                                {/* Header */}
                                <div>
                                    <div className="text-sm font-bold text-gray-900">{selectedSummary.customerName}</div>
                                    <div className="flex gap-4 mt-2">
                                        <div className="px-3 py-1.5 bg-red-50 text-red-700 rounded-md text-sm font-medium border border-red-100">
                                            USD Owed: {formatCurrency(selectedSummary.unpaidUSD, 'USD')}
                                        </div>
                                        <div className="px-3 py-1.5 bg-red-50 text-red-700 rounded-md text-sm font-medium border border-red-100">
                                            KHR Owed: {formatCurrency(selectedSummary.unpaidKHR, 'KHR')}
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Form */}
                                <div className="space-y-4 pt-4 border-t border-gray-100">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Deposit To Account</label>
                                        <select
                                            value={selectedBankAccountId}
                                            onChange={(e) => setSelectedBankAccountId(e.target.value)}
                                            className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border bg-white mb-4"
                                        >
                                            <option value="" disabled>Select an account</option>
                                            {accounts.map(acc => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.code} - {acc.name} {acc.currency ? `(${acc.currency})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Currency to Collect</label>
                                        <div className="flex gap-2">
                                            <button
                                                className={`flex-1 py-2 text-sm font-medium rounded-md border transition-colors ${selectedCurrency === 'USD' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                                                onClick={() => handleCurrencySelect('USD')}
                                                disabled={selectedSummary.unpaidUSD <= 0}
                                            >
                                                USD
                                            </button>
                                            <button
                                                className={`flex-1 py-2 text-sm font-medium rounded-md border transition-colors ${selectedCurrency === 'KHR' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                                                onClick={() => handleCurrencySelect('KHR')}
                                                disabled={selectedSummary.unpaidKHR <= 0}
                                            >
                                                KHR
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount Collected</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <span className="text-gray-500 sm:text-sm">{selectedCurrency === 'USD' ? '$' : '៛'}</span>
                                            </div>
                                            <input
                                                type="number"
                                                step={selectedCurrency === 'USD' ? "0.01" : "100"}
                                                value={paymentAmount}
                                                onChange={(e) => setPaymentAmount(e.target.value)}
                                                className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
                                                placeholder="0.00"
                                            />
                                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                                <span className="text-gray-500 sm:text-sm">{selectedCurrency}</span>
                                            </div>
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500">
                                            Enter partial amount or leave maxed to clear full balance.
                                        </p>
                                    </div>

                                    {/* Image Upload */}
                                    <div className="pt-2">
                                        <ImageUpload value={proofImage} onChange={setProofImage} label="Reference / Receipt (Optional)" />
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="space-y-3 pt-4">
                                    <button
                                        onClick={handleRecordCollection}
                                        disabled={processing || !paymentAmount || parseFloat(paymentAmount) <= 0}
                                        className="w-full py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex justify-center items-center"
                                    >
                                        {processing ? (
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        ) : (
                                            `Record ${selectedCurrency} Collection`
                                        )}
                                    </button>

                                    <button
                                        onClick={() => setSelectedSummary(null)}
                                        disabled={processing}
                                        className="w-full py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <p className="text-sm font-medium text-gray-600">Select a customer</p>
                                <p className="text-xs mt-1">Choose an entry from the list to process partial or full collections.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerCollectionForm;

