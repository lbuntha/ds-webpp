import React, { useState, useEffect, useMemo } from 'react';
import { WalletTransaction, ParcelBooking, Invoice, DriverCommissionRule, Employee, Account, JournalEntry, SystemSettings, CurrencyConfig, TaxRate, Customer, BankAccountDetails } from '../../src/shared/types';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { calculateDriverCommission, getApplicableCommissionRule } from '../../src/shared/utils/commissionCalculator';
import { Button } from './Button';

interface Props {
    transaction: WalletTransaction;
    onClose: () => void;
    onConfirm?: (note?: string) => void; // Optional: If used for approval, now accepts note
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
    originalCommission?: number;
    originalCommissionCurrency?: string;
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
    const [customerBankAccounts, setCustomerBankAccounts] = useState<BankAccountDetails[]>([]);
    const [approvalNote, setApprovalNote] = useState('');

    // Find the target bank account if available
    const bankAccount = useMemo(() => {
        if (!transaction.bankAccountId || !accounts) return null;
        // Try exact ID match first, then Fallback to Code match (if ID stored is actually a Code)
        return accounts.find(a => a.id === transaction.bankAccountId) ||
            accounts.find(a => a.code === transaction.bankAccountId);
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

                // Fetch Customer Bank Account by userId
                if (transaction.userId) {
                    try {
                        const customers = await firebaseService.getCustomers() as Customer[];

                        // Find ALL customers linked to this user
                        const matchingCustomers = customers.filter(c => c.linkedUserId === transaction.userId);

                        let banks: BankAccountDetails[] = [];

                        matchingCustomers.forEach((c) => {
                            const rawC = c as any;

                            // 1. Check Standard Array (if migrated)
                            if (c.bankAccounts && c.bankAccounts.length > 0) {
                                banks = [...banks, ...c.bankAccounts];
                            }

                            // 2. Check Specific 'bank_account' Map (USD/KHR keys)
                            if (rawC.bank_account) {
                                // USD Account
                                if (rawC.bank_account.usd) {
                                    const b = rawC.bank_account.usd;
                                    banks.push({
                                        bankName: b.bank_name ? `${b.bank_name} (USD)` : 'USD Account',
                                        accountNumber: b.account_number,
                                        accountName: c.name,
                                        qrCode: b.qr_code_url,
                                        id: 'usd-main'
                                    });
                                }
                                // KHR Account
                                if (rawC.bank_account.khr) {
                                    const b = rawC.bank_account.khr;
                                    banks.push({
                                        bankName: b.bank_name ? `${b.bank_name} (KHR)` : 'KHR Account',
                                        accountNumber: b.account_number,
                                        accountName: c.name,
                                        qrCode: b.qr_code_url,
                                        id: 'khr-main'
                                    });
                                }
                            }

                            // 3. Fallback: Legacy flat fields
                            if (banks.length === 0 && c.bankName && c.bankAccountNumber) {
                                banks.push({
                                    bankName: c.bankName,
                                    accountNumber: c.bankAccountNumber,
                                    accountName: c.name,
                                    id: 'legacy'
                                });
                            }
                        });

                        // Deduplicate by account number just in case
                        const uniqueBanks = banks.filter((v, i, a) => a.findIndex(t => t.accountNumber === v.accountNumber) === i);

                        if (uniqueBanks.length > 0) {
                            setCustomerBankAccounts(uniqueBanks);
                        }

                    } catch (e) {
                        // console.warn('Could not fetch customer bank account:', e);
                    }
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

                                // Determine Item Fee in TARGET currency directly
                                // Use the pre-stored fee for the target currency to avoid conversion issues
                                const totalItems = bItems.length > 0 ? bItems.length : 1;
                                const itemFee = targetCurrency === 'KHR'
                                    ? (parcelItem.deliveryFeeKHR ?? parcelItem.deliveryFee ?? ((booking.totalDeliveryFee || 0) / totalItems))
                                    : (parcelItem.deliveryFeeUSD ?? parcelItem.deliveryFee ?? ((booking.totalDeliveryFee || 0) / totalItems));
                                const itemFeeCurrency = targetCurrency; // Fee is now in target currency

                                // Helper for conversion
                                const convertToTarget = (amount: number, fromCurr: string) => {
                                    if (fromCurr === targetCurrency) return amount;
                                    if (fromCurr === 'USD' && targetCurrency === 'KHR') return amount * RATE;
                                    if (fromCurr === 'KHR' && targetCurrency === 'USD') return amount / RATE;
                                    return amount;
                                };

                                // Split attribution for preview (Who did what?)
                                const mods = parcelItem.modifications || [];
                                const pickupMod = mods.find(m => m.newValue === 'PICKED_UP');
                                const pickupDriverName = pickupMod?.userName || booking.driverName || 'Unknown';

                                const dlvMod = mods.find(m => m.newValue === 'DELIVERED' || m.newValue === 'RETURN_TO_SENDER');
                                const dlvDriverName = dlvMod?.userName || (parcelItem.status !== 'PENDING' ? parcelItem.driverName : 'Unknown');

                                // 1. Pickup Commission - itemFee is already in targetCurrency
                                const pRule = getApplicableCommissionRule(driverEmp, 'PICKUP', commissionRules);
                                let finalPickupComm = calculateDriverCommission(driverEmp, booking, 'PICKUP', commissionRules, itemFee, targetCurrency as 'USD' | 'KHR', RATE);
                                let pCommOriginal = finalPickupComm; // Same since fee is in target currency

                                // 2. Delivery Commission - itemFee is already in targetCurrency
                                const dRule = getApplicableCommissionRule(driverEmp, 'DELIVERY', commissionRules);
                                let finalDeliveryComm = calculateDriverCommission(driverEmp, booking, 'DELIVERY', commissionRules, itemFee, targetCurrency as 'USD' | 'KHR', RATE);
                                let dCommOriginal = finalDeliveryComm; // Same since fee is in target currency


                                finalPickupComm = Math.round((finalPickupComm + Number.EPSILON) * 100) / 100;
                                finalDeliveryComm = Math.round((finalDeliveryComm + Number.EPSILON) * 100) / 100;
                                pCommOriginal = Math.round((pCommOriginal + Number.EPSILON) * 100) / 100;
                                dCommOriginal = Math.round((dCommOriginal + Number.EPSILON) * 100) / 100;

                                // Add PICKUP commission line item (if > 0)
                                if (finalPickupComm > 0 && itemFeeCurrency === targetCurrency) {
                                    reportItems.push({
                                        id: `${parcelItem.id}-pickup`,
                                        date: booking.bookingDate,
                                        reference: parcelItem.trackingCode || 'N/A',
                                        description: `Pickup (by ${pickupDriverName})`,
                                        amount: 0,
                                        currency: parcelItem.codCurrency || 'USD',
                                        status: parcelItem.settlementStatus || 'UNSETTLED',
                                        commission: finalPickupComm,
                                        commissionCurrency: targetCurrency,
                                        originalCommission: pCommOriginal,
                                        originalCommissionCurrency: itemFeeCurrency,
                                        details: {
                                            sender: booking.senderName || 'Unknown Sender',
                                            receiver: parcelItem.receiverName || 'Unknown Receiver',
                                            type: 'PARCEL'
                                        }
                                    });
                                }

                                // Add DELIVERY commission line item (if > 0)
                                if (finalDeliveryComm > 0 && itemFeeCurrency === targetCurrency) {
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
                                        originalCommission: dCommOriginal,
                                        originalCommissionCurrency: itemFeeCurrency,
                                        details: {
                                            sender: booking.senderName || 'Unknown Sender',
                                            receiver: parcelItem.receiverName || 'Unknown Receiver',
                                            type: 'PARCEL'
                                        }
                                    });
                                }

                                // 3. Taxi Fee (Expense/Deduction)
                                // If this report is for CUSTOMER settlement, Taxi Fee is a deduction (negative).
                                // If this report is for DRIVER settlement (reimbursement), it's a CREDIT to driver (negative in shortage or positive in payout).
                                // This modal is generic. 
                                // Standard Logic: "Amount" column sums to the Transaction Total.
                                // If Transaction is Payout to Customer -> Amount is positive. Deduction is negative.
                                // If Transaction is Payout to Driver -> Amount is positive. Reimbursement adds to it.

                                // However, current usage seems to be consistent: 
                                // Taxi Fee reduces the Net Payable for Customer.
                                // Taxi Fee increases the Net Payable for Driver (if he paid it).
                                // Let's stick to the convention used in Customer Report: Reduction.
                                // And visually indicate it.

                                // DEBUG TAXI FEE
                                // console.log('DEBUG TXN CURRENCY', transaction.currency);
                                /* console.log('DEBUG TAXI', {
                                    id: parcelItem.id,
                                    fee: parcelItem.taxiFee,
                                    feeCurr: parcelItem.taxiFeeCurrency,
                                    targetCurr: targetCurrency
                                }); */

                                // Fixed Taxi Fee Logic for Driver & Mixed Currency
                                if ((parcelItem.taxiFee || 0) > 0) {
                                    const taxiFeeRaw = Number(parcelItem.taxiFee);
                                    // Default to target currency if not specified (legacy fix)
                                    const taxiFeeCurrency = parcelItem.taxiFeeCurrency || targetCurrency;
                                    const isFeeIncluded = taxiFeeCurrency === targetCurrency;

                                    if (isFeeIncluded) {
                                        const taxiFeeConverted = convertToTarget(taxiFeeRaw, taxiFeeCurrency);
                                        reportItems.push({
                                            id: `${parcelItem.id}-taxi`,
                                            date: booking.bookingDate,
                                            reference: parcelItem.trackingCode || 'N/A',
                                            description: `Taxi Fee (Paid by Driver)`,
                                            amount: -taxiFeeConverted,
                                            currency: targetCurrency,
                                            status: 'SETTLED',
                                            commission: 0,
                                            details: {
                                                sender: booking.senderName || 'Unknown Sender',
                                                receiver: parcelItem.receiverName || 'Unknown Receiver',
                                                type: 'PARCEL'
                                            }
                                        });
                                    } else {
                                        reportItems.push({
                                            id: `${parcelItem.id}-taxi-pending`,
                                            date: booking.bookingDate,
                                            reference: parcelItem.trackingCode || 'N/A',
                                            description: `Taxi Fee (Pending ${taxiFeeCurrency})`,
                                            amount: 0,
                                            currency: targetCurrency,
                                            status: 'PENDING',
                                            commission: 0,
                                            originalCommission: -taxiFeeRaw,
                                            originalCommissionCurrency: taxiFeeCurrency,
                                            details: {
                                                sender: booking.senderName || 'Unknown Sender',
                                                receiver: parcelItem.receiverName || 'Unknown Receiver',
                                                type: 'PARCEL'
                                            }
                                        });
                                    }
                                }
                                // Old Logic Disabled (wrapped in unreachable block to consume original braces)
                                if (false) {
                                    const taxiFeeRaw = parcelItem.taxiFee;
                                    const taxiFeeCurrency = parcelItem.taxiFeeCurrency || 'KHR';

                                    // For display in the main column, we might convert or show original.
                                    // If we are showing strict separation, we shouldn't convert value into the 'Amount' column if currencies differ.
                                    // BUT, this 'Amount' column sums up to the total transaction currency.
                                    // So we MUST convert to show the impact on THIS transaction.
                                    // UNLESS the transaction didn't include it (Strict Separation).
                                    // If Transaction didn't include it, we shouldn't list it here?
                                    // Actually, this modal shows details of a SPECIFIC transaction.
                                    // If we excluded Taxi Fee from the transaction (Scenario B), then it shouldn't be here!
                                    // Wait, if we show a transaction for $10 USD, and we excluded KHR, then this item should NOT appear in the USD Transaction detail.

                                    // Logic Check:
                                    // The 'transaction' object comes from the database.
                                    // If we saved the transaction without the fee, this loop (based on booking items) might erroneously re-add it visually?
                                    // No, 'transaction.relatedItems' drives the loop.
                                    // If we excluded the KHR fee from the 'itemsToSettle' list during creation, it won't be in 'relatedItems'??
                                    // 'relatedItems' usually lists the PARCEL IDs. It doesn't list components (Fee vs COD).
                                    // So if parcel X is in the list, the Modal tries to show breakdown of Parcel X.

                                    // CRITICAL FIX:
                                    // If 'Strict Separation' was used, the Calculation of 'transaction.amount' ignored the KHR fee.
                                    // So if we display the KHR fee converted here and subtract it, the 'Total' at the bottom won't match 'transaction.amount'.
                                    // We must detect if the fee was included.
                                    // How?
                                    // The 'transaction.currency' is the determining factor.
                                    // If txn.currency != taxiFee.currency, and we follow strict separation, then the fee was NOT included.

                                    const isFeeIncluded = taxiFeeCurrency === targetCurrency;

                                    if (isFeeIncluded) {
                                        const taxiFeeConverted = convertToTarget(taxiFeeRaw, taxiFeeCurrency);

                                        // Description
                                        let description = `Taxi Fee (Deduction)`;

                                        reportItems.push({
                                            id: `${parcelItem.id}-taxi`,
                                            date: booking.bookingDate,
                                            reference: parcelItem.trackingCode || 'N/A',
                                            description,
                                            amount: -taxiFeeConverted, // Negative logic (Deduction from payout)
                                            currency: targetCurrency,
                                            status: 'SETTLED',
                                            commission: 0,
                                            details: {
                                                sender: booking.senderName || 'Unknown Sender',
                                                receiver: parcelItem.receiverName || 'Unknown Receiver',
                                                type: 'PARCEL'
                                            }
                                        });
                                    } else {
                                        // Fee exists but was excluded due to currency mismatch (Strict Mode).
                                        // Optionally show it as a note or 0-amount item? 
                                        // User request: "Breakdown". 
                                        // If we show it effectively "Pending", it clarifies why it's not paid.

                                        reportItems.push({
                                            id: `${parcelItem.id}-taxi-pending`,
                                            date: booking.bookingDate,
                                            reference: parcelItem.trackingCode || 'N/A',
                                            description: `Taxi Fee (Pending ${taxiFeeCurrency})`,
                                            amount: 0, // Zero impact on THIS transaction
                                            currency: targetCurrency,
                                            status: 'PENDING',
                                            commission: 0,
                                            originalCommission: -taxiFeeRaw, // Hack to show value in breakdown
                                            originalCommissionCurrency: taxiFeeCurrency,
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
                }
                setItems(reportItems);
            } catch (e) {
                // console.error(e);
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
                    const isDriver = employees.some(e => e.linkedUserId === transaction.userId);

                    if (isDriver) {
                        if (rule4AccId) {
                            settlementBankId = rule4AccId;
                        } else {
                            // 1. Try Default Settlement Bank (Usually Bank)
                            settlementBankId = isUSD
                                ? (settings.defaultDriverSettlementBankIdUSD || settings.defaultDriverSettlementBankId)
                                : (settings.defaultDriverSettlementBankIdKHR || settings.defaultDriverSettlementBankId);

                            // 2. Fallback to Cash Account (If Bank not set, assume Cash settlement)
                            if (!settlementBankId) {
                                settlementBankId = isUSD
                                    ? settings.defaultDriverCashAccountIdUSD
                                    : settings.defaultDriverCashAccountIdKHR;
                            }
                        }
                    } else {
                        // Customer
                        settlementBankId = isUSD
                            ? (settings.defaultCustomerSettlementBankIdUSD || settings.defaultCustomerSettlementBankId)
                            : (settings.defaultCustomerSettlementBankIdKHR || settings.defaultCustomerSettlementBankId);

                        // Fallback: If Customer specific setting is missing, try generic Driver Cash Account
                        // (Often Cash on Hand is a single shared account 111100X)
                        if (!settlementBankId) {
                            settlementBankId = isUSD
                                ? settings.defaultDriverCashAccountIdUSD
                                : settings.defaultDriverCashAccountIdKHR;
                        }
                    }

                    console.log('DEBUG: Resolved Preview Bank ID:', settlementBankId, { isDriver, isUSD });
                    console.log('DEBUG: Settings Snap:', {
                        custUSD: settings.defaultCustomerSettlementBankIdUSD,
                        custKHR: settings.defaultCustomerSettlementBankIdKHR,
                        drvCashUSD: settings.defaultDriverCashAccountIdUSD,
                        drvCashKHR: settings.defaultDriverCashAccountIdKHR
                    });
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
                // console.error("Preview Generation Error", e);
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

    // Look up driver's zone from employees for commission rule display
    const driverEmployee = useMemo(() => {
        return employees.find(e => e.linkedUserId === transaction.userId);
    }, [employees, transaction.userId]);

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
                            {driverEmployee?.zone && (
                                <p className="text-xs text-purple-600 font-medium mt-1">
                                    <span className="bg-purple-100 px-2 py-0.5 rounded">Zone: {driverEmployee.zone}</span>
                                </p>
                            )}
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
                    {/* Proof of Transfer */}
                    {(() => {
                        const rawAttachments = transaction.attachments || [];
                        const legacyAttachment = transaction.attachment || '';

                        // Merge and cleanup
                        let allAttachments = [...rawAttachments];
                        if (legacyAttachment) {
                            // Handle comma-separated values in the legacy string field
                            const parts = legacyAttachment.split(',').map(s => s.trim()).filter(Boolean);
                            allAttachments = [...allAttachments, ...parts];
                        }

                        // Deduplicate
                        allAttachments = Array.from(new Set(allAttachments));

                        if (allAttachments.length === 0) return null;

                        return (
                            <div className="mb-6">
                                <p className="text-xs text-gray-500 uppercase font-bold mb-2">Proof of Transfer ({allAttachments.length})</p>
                                <div className={`grid ${allAttachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                                    {allAttachments.map((url, index) => (
                                        <div key={index} className="h-48 w-full bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden relative group">
                                            <img src={url} alt={`Transfer Proof ${index + 1}`} className="h-full object-contain cursor-pointer" onClick={() => window.open(url, '_blank')} />
                                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center pointer-events-none">
                                                <span className="opacity-0 group-hover:opacity-100 bg-white text-xs px-2 py-1 rounded shadow pointer-events-auto">View</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}



                    {bankAccount && (
                        <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <div className="flex items-start gap-4">
                                {/* QR Code */}
                                {bankAccount.qrCode && (
                                    <div className="flex-shrink-0">
                                        <img
                                            src={bankAccount.qrCode}
                                            alt="Payment QR Code"
                                            className="w-24 h-24 object-contain bg-white p-1 rounded-lg border border-gray-200"
                                        />
                                    </div>
                                )}
                                {/* Bank Details */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-2 bg-white rounded-full text-blue-600">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>
                                        </div>
                                        <p className="text-xs text-blue-800 font-bold uppercase">Settlement Account</p>
                                    </div>
                                    <p className="text-lg font-semibold text-gray-900">{bankAccount.name}</p>
                                    <p className="text-sm text-gray-600 font-mono">{bankAccount.code}</p>
                                    {bankAccount.bankAccountNumber && (
                                        <div className="mt-2 pt-2 border-t border-blue-200">
                                            <p className="text-xs text-gray-500">Account Number</p>
                                            <p className="text-base font-mono font-bold text-gray-900 tracking-wider">{bankAccount.bankAccountNumber}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Customer Bank Accounts (from customers collection) */}
                    {customerBankAccounts.length > 0 && (
                        <div className="mb-6 space-y-4">
                            {customerBankAccounts.map((acc, idx) => (
                                <div key={idx} className="bg-green-50 p-4 rounded-lg border border-green-200">
                                    <div className="flex items-start gap-4">
                                        {/* QR Code */}
                                        {acc.qrCode && (
                                            <div className="flex-shrink-0">
                                                <img
                                                    src={acc.qrCode}
                                                    alt="Customer QR Code"
                                                    className="w-24 h-24 object-contain bg-white p-1 rounded-lg border border-gray-200"
                                                />
                                            </div>
                                        )}
                                        {/* Bank Details */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="p-2 bg-white rounded-full text-green-600">
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                                </div>
                                                <p className="text-xs text-green-800 font-bold uppercase">Pay To Customer ({acc.bankName})</p>
                                            </div>
                                            <p className="text-lg font-semibold text-gray-900">{acc.bankName}</p>
                                            {acc.accountName && (
                                                <p className="text-sm text-gray-600">{acc.accountName}</p>
                                            )}
                                            <div className="mt-2 pt-2 border-t border-green-200">
                                                <p className="text-xs text-gray-500">Account Number</p>
                                                <p className="text-base font-mono font-bold text-gray-900 tracking-wider">{acc.accountNumber}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
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
                                                        {item.originalCommissionCurrency && item.originalCommissionCurrency !== (item.commissionCurrency || 'USD') ? (
                                                            <div>
                                                                {item.originalCommission?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.originalCommissionCurrency}
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                {item.commission?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.commissionCurrency || 'USD'}
                                                            </div>
                                                        )}
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
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col space-y-3">
                    {isApproving && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Approval Note (Optional)</label>
                            <textarea
                                value={approvalNote}
                                onChange={(e) => setApprovalNote(e.target.value)}
                                placeholder="Add a note for the customer (e.g., thank you message, discrepancy explanation)..."
                                className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                rows={2}
                            />
                        </div>
                    )}
                    <div className="flex justify-end space-x-3">
                        <Button variant="outline" onClick={onClose}>Close</Button>
                        {isApproving && onConfirm && (
                            <Button
                                onClick={() => onConfirm(approvalNote || undefined)}
                                className="bg-green-600 hover:bg-green-700"
                                disabled={hasErrors} // Prevent approval if missing config
                            >
                                Confirm Approval
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
