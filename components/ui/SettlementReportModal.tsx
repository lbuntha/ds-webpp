import React, { useState, useEffect, useMemo } from 'react';
import { WalletTransaction, ParcelBooking, Invoice, DriverCommissionRule, Employee, Account, JournalEntry, SystemSettings, CurrencyConfig, TaxRate } from '../../src/shared/types';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { calculateDriverCommission, getApplicableCommissionRule } from '../../src/shared/utils/commissionCalculator';
import { Button } from './Button';

interface Props {
    transaction: WalletTransaction;
    onClose: () => void;
    onConfirm?: () => void; // Optional: If used for approval
    isApproving?: boolean;
    // Context for calculating estimates
    bookings?: ParcelBooking[];
    commissionRules?: DriverCommissionRule[];
    employees?: Employee[];
    accounts?: Account[];
    settings?: SystemSettings;
    currencies?: CurrencyConfig[];
    taxRates?: TaxRate[];
}

interface ReportLineItem {
    id: string;
    date: string;
    reference: string;
    description: string;
    amount: number;
    currency: string;
    status: string;
    details?: {
        sender?: string;
        receiver?: string;
        type: 'PARCEL' | 'INVOICE' | 'DIRECT';
    };
    commission?: number; // Estimated commission for display
    commissionCurrency?: string;
}

interface PreviewLine {
    accountName: string;
    accountCode: string;
    debit: number;
    credit: number;
    description: string;
    isError?: boolean;
}

export const SettlementReportModal: React.FC<Props> = ({
    transaction, onClose, onConfirm, isApproving,
    bookings = [], commissionRules = [], employees = [], accounts = [],
    settings = {} as SystemSettings, currencies = [], taxRates = []
}) => {
    const [items, setItems] = useState<ReportLineItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null);

    // Find the target bank account if available
    const bankAccount = useMemo(() => {
        if (!transaction.bankAccountId || !accounts) return null;
        return accounts.find(a => a.id === transaction.bankAccountId);
    }, [transaction.bankAccountId, accounts]);

    const getAccountName = (id: string) => {
        const acc = accounts.find(a => a.id === id);
        return acc ? `${acc.code} - ${acc.name}` : id;
    };

    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            try {
                // Fetch Journal Entry if linked
                if (transaction.journalEntryId) {
                    const je = await firebaseService.getDocument('transactions', transaction.journalEntryId) as JournalEntry;
                    setJournalEntry(je);
                }

                if (!transaction.relatedItems || transaction.relatedItems.length === 0) {
                    // Handle Direct Deposit/Withdrawal without sub-items
                    setItems([{
                        id: transaction.id,
                        date: transaction.date,
                        reference: (transaction.id || '').slice(-6),
                        description: transaction.description || transaction.type,
                        amount: transaction.amount,
                        currency: transaction.currency,
                        status: transaction.status,
                        details: { type: 'DIRECT' }
                    }]);
                    setLoading(false);
                    return;
                }

                const firstItem = transaction.relatedItems[0];
                const reportItems: ReportLineItem[] = [];

                // 1. Handle Invoices (Customer Settlement)
                if (firstItem.itemId === 'invoice') {
                    const allInvoices = await firebaseService.getInvoices();
                    const relatedIds = transaction.relatedItems.map(i => i.bookingId);
                    const matchedInvoices = allInvoices.filter(inv => relatedIds.includes(inv.id));

                    matchedInvoices.forEach(inv => {
                        reportItems.push({
                            id: inv.id,
                            date: inv.date,
                            reference: inv.number,
                            description: `Invoice Payment`,
                            amount: inv.totalAmount - inv.amountPaid, // Assuming full remaining settlement
                            currency: inv.currency || 'USD',
                            status: inv.status,
                            details: {
                                receiver: inv.customerName,
                                type: 'INVOICE'
                            }
                        });
                    });
                }
                // 2. Handle Parcels (Driver Settlement)
                else {
                    // Use props if available (approving), else fetch
                    let allBookings = bookings;
                    if (allBookings.length === 0) {
                        allBookings = await firebaseService.getParcelBookings();
                    }

                    // Commission Logic - Calculate BOTH pickup and delivery commissions
                    const driverEmp = employees.find(e => e.linkedUserId === transaction.userId);

                    for (const rel of transaction.relatedItems) {
                        const booking = allBookings.find(b => b.id === rel.bookingId);
                        if (booking) {
                            const bItems = booking.items || [];
                            const parcelItem = bItems.find(i => i.id === rel.itemId);
                            if (parcelItem) {
                                const targetCurrency = transaction.currency || 'USD';
                                const RATE = 4000;

                                // Determine Item Fee & Currency
                                const totalItems = bItems.length > 0 ? bItems.length : 1;
                                const itemFee = parcelItem.deliveryFee ?? ((booking.totalDeliveryFee || 0) / totalItems);
                                const itemFeeCurrency = parcelItem.deliveryFee !== undefined
                                    ? (parcelItem.codCurrency || booking.currency || 'USD')
                                    : (booking.currency || 'USD');

                                // Helper for conversion
                                const convertToTarget = (amount: number, fromCurr: string) => {
                                    if (fromCurr === targetCurrency) return amount;
                                    if (fromCurr === 'USD' && targetCurrency === 'KHR') return amount * RATE;
                                    if (fromCurr === 'KHR' && targetCurrency === 'USD') return amount / RATE;
                                    return amount;
                                };

                                // 1. Pickup Commission
                                const pRule = getApplicableCommissionRule(driverEmp, 'PICKUP', commissionRules);
                                let finalPickupComm = calculateDriverCommission(driverEmp, booking, 'PICKUP', commissionRules, itemFee, targetCurrency, RATE);

                                // Conversion logic mismatch fix: Percentage returns in Source Currency, Fixed returns in Target
                                if (pRule?.type === 'PERCENTAGE') {
                                    finalPickupComm = convertToTarget(finalPickupComm, itemFeeCurrency);
                                }

                                // 2. Delivery Commission
                                const dRule = getApplicableCommissionRule(driverEmp, 'DELIVERY', commissionRules);
                                let finalDeliveryComm = calculateDriverCommission(driverEmp, booking, 'DELIVERY', commissionRules, itemFee, targetCurrency, RATE);

                                if (dRule?.type === 'PERCENTAGE') {
                                    finalDeliveryComm = convertToTarget(finalDeliveryComm, itemFeeCurrency);
                                }

                                // Split attribution for preview (Who did what?)
                                const mods = parcelItem.modifications || [];
                                const pickupMod = mods.find(m => m.newValue === 'PICKED_UP');
                                const pickupDriverName = pickupMod?.userName || booking.driverName || 'Unknown';

                                const dlvMod = mods.find(m => m.newValue === 'DELIVERED' || m.newValue === 'RETURN_TO_SENDER');
                                const dlvDriverName = dlvMod?.userName || (parcelItem.status !== 'PENDING' ? parcelItem.driverName : 'Unknown');

                                finalPickupComm = Math.round((finalPickupComm + Number.EPSILON) * 100) / 100;
                                finalDeliveryComm = Math.round((finalDeliveryComm + Number.EPSILON) * 100) / 100;

                                // Add PICKUP commission line item (if > 0)
                                // Amount is 0 because picker doesn't collect cash - only deliverer does
                                if (finalPickupComm > 0) {
                                    reportItems.push({
                                        id: `${parcelItem.id}-pickup`,
                                        date: booking.bookingDate,
                                        reference: parcelItem.trackingCode || 'N/A',
                                        description: `Pickup (by ${pickupDriverName})`,
                                        amount: 0, // Pickup doesn't collect cash
                                        currency: parcelItem.codCurrency || 'USD',
                                        status: parcelItem.settlementStatus || 'UNSETTLED',
                                        commission: finalPickupComm,
                                        commissionCurrency: targetCurrency,
                                        details: {
                                            sender: booking.senderName || 'Unknown Sender',
                                            receiver: parcelItem.receiverName || 'Unknown Receiver',
                                            type: 'PARCEL'
                                        }
                                    });
                                }

                                // Add DELIVERY commission line item (if > 0)
                                if (finalDeliveryComm > 0) {
                                    reportItems.push({
                                        id: `${parcelItem.id}-delivery`,
                                        date: booking.bookingDate,
                                        reference: parcelItem.trackingCode || 'N/A',
                                        description: `Delivery (by ${dlvDriverName})`,
                                        amount: parcelItem.productPrice || 0,
                                        currency: parcelItem.codCurrency || 'USD',
                                        status: parcelItem.settlementStatus || 'UNSETTLED',
                                        commission: finalDeliveryComm,
                                        commissionCurrency: targetCurrency,
                                        details: {
                                            sender: booking.senderName || 'Unknown Sender',
                                            receiver: parcelItem.receiverName || 'Unknown Receiver',
                                            type: 'PARCEL'
                                        }
                                    });
                                }

                                // 3. Taxi Fee (Cost Reimbursed/Paid)
                                // If driver paid taxi fee, it appears here vs his COD collection
                                // Logic: Driver Collected COD. Driver Paid Taxi Fee.
                                // Net = COD - Comm - Taxi Fee.
                                // This breakdown shows "Amount" (Transaction Value) and "Est Comm" (Deduction/Earning).
                                // Usually Taxi Fee is an expense for the Driver? 
                                // Actually, if Driver PAID the taxi fee, he needs CREDIT. 
                                // If Customer PAID via COD including taxi fee, it's revenue.
                                // Let's follow WalletReport logic: "Taxi Fee paid by Driver".
                                // In WalletReport: Debit Customer. Credit Driver?
                                // If Taxi Fee > 0, we show it as a negative amount? Or positive expense?
                                // The table columns are "Amount" and "Est Comm". 
                                // "Amount" usually means COD Collected.
                                // "Est Comm" means what company takes? Or what driver gets?
                                // In the Screenshot: Amount 10,000 KHR. Est Comm 2750 KHR.
                                // 10,000 is COD. 2750 is Comm. Net to Driver = 10,000 - 2750 = 7250.
                                // If Driver Paid Taxi Fee of 5000:
                                // He should get 5000 BACK.
                                // So we should show Taxi Fee as a CREDIT to Driver.
                                // In this table, maybe show as separate line item?
                                if (parcelItem.isTaxiDelivery && parcelItem.taxiFee && parcelItem.taxiFee > 0) {
                                    // Taxi Fee is usually reimbursed to driver if he paid it
                                    // So it reduces the "Shortage" (Amount he owes company)
                                    // OR it increases "Commission" (Earning)
                                    // Let's put it in Est Comm column? Or Amount?
                                    // Logic: Item Breakdown sums to "Total Amount" (COD).
                                    // Est Comm sums to total deduction.
                                    // If we add Taxi Fee to Est Comm, it increases deduction? No.
                                    // Driver KEEPS Taxi Fee.
                                    // If Driver Paid it, he needs to KEEP that amount from COD.
                                    // So it's similar to Commission (Driver Retention).
                                    // Let's add it as a line item with "Amount: 0" (unless specific collection) and "Est Comm: <TaxiFee>"
                                    // This way it adds to Total Commission (Driver Retention).

                                    const taxiFeeRaw = parcelItem.taxiFee;
                                    const taxiFeeCurrency = parcelItem.taxiFeeCurrency || 'USD';
                                    const taxiFeeConverted = convertToTarget(taxiFeeRaw, taxiFeeCurrency);

                                    reportItems.push({
                                        id: `${parcelItem.id}-taxi`,
                                        date: booking.bookingDate,
                                        reference: parcelItem.trackingCode || 'N/A',
                                        description: `Taxi Fee (Paid by Driver)`,
                                        amount: 0,
                                        currency: taxiFeeCurrency,
                                        status: 'REIMBURSED',
                                        commission: taxiFeeConverted, // Driver keeps this
                                        commissionCurrency: targetCurrency,
                                        details: {
                                            sender: booking.senderName || 'Unknown Sender',
                                            receiver: parcelItem.receiverName || 'Unknown Receiver',
                                            type: 'PARCEL'
                                        }
                                    });
                                }
                            }
                        }
                    }
                }
                setItems(reportItems);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [transaction, bookings]); // Depend on bookings prop to refresh if passed

    // --- PREVIEW GENERATOR ---
    const [previewResult, setPreviewResult] = useState<any>(null); // Type: GLPreviewResult
    const [previewLoading, setPreviewLoading] = useState(false);

    useEffect(() => {
        // Must have settings and accounts to preview
        if (!isApproving || journalEntry || !settings || accounts.length === 0) return;

        const generatePreview = async () => {
            setPreviewLoading(true);
            try {
                // Determine Context data
                const context = { accounts, settings, employees, commissionRules, bookings, currencies };
                const branchId = 'b1'; // Default branch

                // Resolve Bank Account (Reusing logic for preview accuracy)
                const currencyCode = (transaction.currency || 'USD').toUpperCase();
                const isUSD = currencyCode === 'USD';
                let settlementBankId = transaction.bankAccountId;
                const rule4AccId = settings.transactionRules ? settings.transactionRules['4'] : null;

                // Simple resolution just for the preview call
                // Note: The service might error if bank ID is missing, which is fine (shows in errors)
                if (!settlementBankId || settlementBankId === 'system' || settlementBankId === 'system-payout') {
                    // Check user role from somewhere? We don't have user profile here easily unless we fetch or infer.
                    // We can infer from transaction type or passed props?
                    // Transaction doesn't explicit have role. But we can guess.
                    // If Transaction Type is WITHDRAWAL -> Likely Customer Payout? 
                    // Actually, Driver Withdrawal exists too? Unlikely in this system context (Drivers settle/Deposit).

                    // Best effort guess or fetch? 
                    // To avoid async fetch inside this effect which might be heavy, lets try to reuse knowns.
                    // But actually, WalletRequests passed 'employees' list. If userId is in employees, likely driver.

                    const isDriver = employees.some(e => e.linkedUserId === transaction.userId);

                    if (isDriver) {
                        if (rule4AccId) {
                            settlementBankId = rule4AccId;
                        } else {
                            settlementBankId = isUSD
                                ? (settings.defaultDriverSettlementBankIdUSD || settings.defaultDriverSettlementBankId)
                                : (settings.defaultDriverSettlementBankIdKHR || settings.defaultDriverSettlementBankId);
                        }
                    } else {
                        // Customer
                        settlementBankId = isUSD
                            ? (settings.defaultCustomerSettlementBankIdUSD || settings.defaultCustomerSettlementBankId)
                            : (settings.defaultCustomerSettlementBankIdKHR || settings.defaultCustomerSettlementBankId);
                    }
                }

                // Import Service dynamically to ensure clean load
                const { GLBookingService } = await import('../../src/shared/services/glBookingService');

                const params = {
                    transactionType: transaction.type as any,
                    userId: transaction.userId,
                    userName: transaction.userName,
                    userRole: (employees.some(e => e.linkedUserId === transaction.userId) ? 'driver' : 'customer') as any,
                    amount: transaction.amount,
                    currency: transaction.currency as any,
                    relatedItems: transaction.relatedItems,
                    bankAccountId: settlementBankId || '', // Service checks this
                    description: transaction.description,
                    branchId
                };

                const result = await GLBookingService.previewGLEntry(params, context);
                setPreviewResult(result);

            } catch (e) {
                console.error("Preview Generation Error", e);
            } finally {
                setPreviewLoading(false);
            }
        };

        generatePreview();
    }, [isApproving, journalEntry, transaction, settings, accounts, currencies, employees, bookings, commissionRules]);

    // Adapt the result for the view
    const previewJournalEntry = previewResult?.lines?.map((l: any) => ({
        accountName: getAccountName(l.accountId),
        accountCode: '', // getAccountName handles code+name combo string
        debit: l.debit,
        credit: l.credit,
        description: l.description,
        isError: false
    })) || [];

    // Add specific errors if any
    if (previewResult?.errors?.length > 0) {
        previewResult.errors.forEach((err: string) => {
            previewJournalEntry.push({
                accountName: 'CONFIGURATION ERROR',
                accountCode: 'ERR',
                debit: 0,
                credit: 0,
                description: err,
                isError: true
            });
        });
    }


    const totalAmount = useMemo(() => items.reduce((sum, i) => sum + i.amount, 0), [items]);
    const totalCommission = useMemo(() => items.reduce((sum, i) => sum + (i.commission || 0), 0), [items]);

    const handlePrint = () => {
        const printContent = document.getElementById('settlement-report-content');
        if (printContent) {
            const original = document.body.innerHTML;
            document.body.innerHTML = printContent.innerHTML;
            window.print();
            document.body.innerHTML = original;
            window.location.reload(); // Reload to restore state listeners
        }
    };

    const hasErrors = previewJournalEntry?.some(l => l.isError);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900 bg-opacity-75 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Transaction Detail</h3>
                        <p className="text-xs text-gray-500 font-mono">Ref: {transaction.id}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handlePrint} className="text-xs">
                            Print / PDF
                        </Button>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div id="settlement-report-content" className="flex-1 overflow-y-auto p-6">

                    <div className="mb-6 flex justify-between items-start border-b border-gray-100 pb-6">
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-bold">User</p>
                            <p className="text-lg font-bold text-gray-900">{transaction.userName}</p>
                            <p className="text-sm text-gray-600">ID: {transaction.userId}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-500 uppercase font-bold">Total {transaction.type}</p>
                            <p className="text-2xl font-bold text-green-700">
                                {transaction.amount.toLocaleString()} {transaction.currency}
                            </p>
                            <p className="text-xs text-gray-500">
                                {new Date(transaction.date).toLocaleDateString()}
                            </p>
                        </div>
                    </div>

                    {/* Proof of Transfer */}
                    {transaction.attachment && (
                        <div className="mb-6">
                            <p className="text-xs text-gray-500 uppercase font-bold mb-2">Proof of Transfer</p>
                            <div className="h-48 w-full bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
                                <img src={transaction.attachment} alt="Transfer Proof" className="h-full object-contain" />
                            </div>
                        </div>
                    )}

                    {bankAccount && (
                        <div className="mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center gap-3">
                            <div className="p-2 bg-white rounded-full text-blue-600">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>
                            </div>
                            <div>
                                <p className="text-xs text-blue-800 font-bold uppercase">Settlement Account</p>
                                <p className="text-sm text-gray-900">{bankAccount.name}</p>
                                <p className="text-xs text-gray-600 font-mono">{bankAccount.code}</p>
                            </div>
                        </div>
                    )}

                    {/* Item Breakdown (Only if related items exist) */}
                    {items.length > 0 ? (
                        <div className="mb-2">
                            <h4 className="text-sm font-bold text-gray-800 mb-2">Item Breakdown</h4>
                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Item / Ref</th>
                                            <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Context</th>
                                            <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 uppercase">Amount</th>
                                            {transaction.type === 'SETTLEMENT' && items.some(i => i.details?.type === 'PARCEL') && (
                                                <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 uppercase">Est. Comm</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {items.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-3 py-2">
                                                    <div className="font-medium text-gray-900">{item.description}</div>
                                                    <div className="text-xs text-gray-500 font-mono">{item.reference}</div>
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-600">
                                                    {item.details?.type === 'PARCEL' && (
                                                        <>
                                                            <div>Sender: {item.details.sender}</div>
                                                            <div>To: {item.details.receiver}</div>
                                                        </>
                                                    )}
                                                    {item.details?.type === 'INVOICE' && (
                                                        <div>Customer: {item.details.receiver}</div>
                                                    )}
                                                    {item.details?.type === 'DIRECT' && (
                                                        <div>Direct Transfer</div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right font-medium text-gray-900">
                                                    {item.amount.toLocaleString()} {item.currency}
                                                </td>
                                                {transaction.type === 'SETTLEMENT' && item.commission !== undefined && (
                                                    <td className="px-3 py-2 text-right text-xs text-green-600 font-medium">
                                                        {item.commission.toFixed(2)} {item.commissionCurrency || 'USD'}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                        {items.length > 0 && (
                                            <tr className="bg-gray-100 font-bold border-t-2 border-gray-200">
                                                <td colSpan={2} className="px-3 py-2 text-right">Totals (Ref)</td>
                                                <td className="px-3 py-2 text-right">{totalAmount.toLocaleString()}</td>
                                                {transaction.type === 'SETTLEMENT' && items.some(i => i.commission) && (
                                                    <td className="px-3 py-2 text-right text-green-700">{totalCommission.toFixed(2)} {items[0]?.commissionCurrency || 'USD'}</td>
                                                )}
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-gray-500 italic mb-4">No breakdown available for this transaction.</div>
                    )}

                    {/* Existing Accounting Journal Entry Section (Post-Approval) */}
                    {journalEntry ? (
                        <div className="mt-8 border-t border-gray-200 pt-6">
                            <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center">
                                <svg className="w-4 h-4 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 01-2-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                Accounting Impact (Journal Entry: {journalEntry.reference})
                            </h4>
                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200 text-xs">
                                    <thead className="bg-indigo-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-bold text-indigo-900">Account</th>
                                            <th className="px-3 py-2 text-left font-bold text-indigo-900">Description</th>
                                            <th className="px-3 py-2 text-right font-bold text-indigo-900">Debit (Base)</th>
                                            <th className="px-3 py-2 text-right font-bold text-indigo-900">Credit (Base)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {journalEntry.lines.map((line, idx) => (
                                            <tr key={idx}>
                                                <td className="px-3 py-2 text-gray-800 font-medium">{getAccountName(line.accountId)}</td>
                                                <td className="px-3 py-2 text-gray-500">{line.description || '-'}</td>
                                                <td className="px-3 py-2 text-right text-gray-700">{line.debit > 0 ? line.debit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : ''}</td>
                                                <td className="px-3 py-2 text-right text-gray-700">{line.credit > 0 ? line.credit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : ''}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : isApproving && previewJournalEntry ? (
                        // PREVIEW SECTION (Pre-Approval)
                        <div className="mt-8 border-t border-gray-200 pt-6">
                            <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center">
                                <svg className="w-4 h-4 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 01-2-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                Pending Accounting Entry (Preview)
                            </h4>

                            {hasErrors && (
                                <div className="mb-3 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-center">
                                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                    <span><strong>Missing Configuration:</strong> Some accounts are not mapped in Settings &gt; General. This transaction cannot be posted correctly until fixed.</span>
                                </div>
                            )}

                            <div className="text-xs text-gray-500 mb-2">The following Journal Entry will be created automatically upon approval. Amounts in Base USD.</div>
                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200 text-xs">
                                    <thead className="bg-yellow-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-bold text-yellow-900">Account</th>
                                            <th className="px-3 py-2 text-left font-bold text-yellow-900">Description</th>
                                            <th className="px-3 py-2 text-right font-bold text-yellow-900">Debit (Base)</th>
                                            <th className="px-3 py-2 text-right font-bold text-yellow-900">Credit (Base)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {previewJournalEntry.map((line, idx) => (
                                            <tr key={idx} className={line.isError ? 'bg-red-50' : ''}>
                                                <td className={`px-3 py-2 font-medium ${line.isError ? 'text-red-600 font-bold' : 'text-gray-800'}`}>
                                                    {line.accountCode} - {line.accountName}
                                                </td>
                                                <td className="px-3 py-2 text-gray-500">{line.description || '-'}</td>
                                                <td className="px-3 py-2 text-right text-gray-700">
                                                    {/* Ensure safe display of numbers, default to 0.00 if 0 or NaN handling in model logic */}
                                                    {line.debit > 0 ? line.debit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : ''}
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-700">
                                                    {line.credit > 0 ? line.credit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : ''}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Actions */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
                    <Button variant="outline" onClick={onClose}>Close</Button>
                    {isApproving && onConfirm && (
                        <Button
                            onClick={onConfirm}
                            className="bg-green-600 hover:bg-green-700"
                            disabled={hasErrors} // Prevent approval if missing config
                        >
                            Confirm Approval
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
