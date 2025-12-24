
import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, WalletTransaction, Account, AccountType, AccountSubType, ParcelBooking, SystemSettings, DriverCommissionRule, Employee, CurrencyConfig } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { calculateDriverCommission, getApplicableCommissionRule } from '../../src/shared/utils/commissionCalculator';
import { useLanguage } from '../../src/shared/contexts/LanguageContext';
import { ImageUpload } from '../ui/ImageUpload';
import { SettlementReportModal } from '../ui/SettlementReportModal';
import { toast } from '../../src/shared/utils/toast';

interface Props {
    user: UserProfile;
}

// Helper type for the unified view
interface LedgerItem {
    id: string;
    date: string;
    description: string;
    type: 'FEE' | 'COD' | 'DEPOSIT' | 'WITHDRAWAL' | 'SETTLEMENT' | 'EARNING' | 'REFUND';
    amount: number;
    currency: string;
    status: string;
    reference?: string;
    isCredit: boolean; // true = adds to balance (Asset/Deposit), false = deducts (Liability/Withdrawal)
}

export const WalletDashboard: React.FC<Props> = ({ user }) => {
    const { t } = useLanguage();
    // Rounding helper for financial accuracy
    const round2 = (val: number) => Math.round((val + Number.EPSILON) * 100) / 100;

    // Data State
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [bankAccounts, setBankAccounts] = useState<Account[]>([]);
    const [settings, setSettings] = useState<SystemSettings>({});
    const [commissionRules, setCommissionRules] = useState<DriverCommissionRule[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);

    // UI State
    const [activeCurrency, setActiveCurrency] = useState<'USD' | 'KHR'>('USD');
    const [modalOpen, setModalOpen] = useState<'DEPOSIT' | 'WITHDRAWAL' | null>(null);
    const [loading, setLoading] = useState(false);
    const [viewTransaction, setViewTransaction] = useState<WalletTransaction | null>(null);

    // Form State
    const [amount, setAmount] = useState<number>(0);
    const [amountKHR, setAmountKHR] = useState<number>(0); // NEW: For multi-currency settlement
    // NEW: Cash Handover Amounts
    const [cashAmount, setCashAmount] = useState<number>(0);
    const [cashAmountKHR, setCashAmountKHR] = useState<number>(0);
    const [description, setDescription] = useState('');
    const [attachment, setAttachment] = useState('');

    // Initial Load
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Use getUserBookings to fetch only allowed data for the specific user
                const [myBookings, accs, sysSettings, commRules, allEmployees, allCurrencies] = await Promise.all([
                    firebaseService.getUserBookings(user),
                    firebaseService.getAccounts(),
                    firebaseService.getSettings(),
                    firebaseService.logisticsService.getDriverCommissionRules(),
                    firebaseService.getEmployees(),
                    firebaseService.getCurrencies()
                ]);

                setSettings(sysSettings);
                setCommissionRules(commRules);
                setEmployees(allEmployees);
                setBookings(myBookings); // Already filtered securely by service

                // Fetch Nostro Accounts (Company Assets: Cash & Bank)
                const banks = accs.filter(a =>
                    a.type === AccountType.ASSET &&
                    (a.subType === AccountSubType.CURRENT_ASSET || a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('cash')) &&
                    !a.isHeader
                );
                setBankAccounts(banks);

            } catch (e) {
                console.error("Failed to load wallet data", e);
            }
        };
        fetchData();
    }, [user]);

    // Real-time Balance & Transaction Listener
    useEffect(() => {
        if (!user.uid) return;

        const unsubscribeProfile = firebaseService.subscribeToUser(user.uid, (updatedUser: UserProfile) => {
            // Profile updates
        });

        const unsubscribeTxns = firebaseService.subscribeToWalletTransactions(user.uid, (txns: WalletTransaction[]) => {
            setTransactions(txns);
        });

        return () => {
            unsubscribeProfile();
            unsubscribeTxns();
        };
    }, [user.uid]);

    // --- UNIFIED LEDGER CALCULATION ---
    const unifiedLedger = useMemo(() => {
        const ledger: LedgerItem[] = [];

        // 1. Financial Transactions (Explicit)
        transactions.forEach(t => {
            let isCredit = false;

            // Logic for Wallet Direction:
            // DEPOSIT: Money IN to Wallet (Credit) - Customer topping up
            // EARNING: Money IN to Wallet (Credit) - Commission earned
            // REFUND: Money IN to Wallet (Credit)
            // SETTLEMENT: 
            //   - For DRIVERS: Offsets Cash Held liability (Credit) - Driver pays company
            //   - For CUSTOMERS: Money OUT (Debit) - Company pays customer payout
            if (t.type === 'DEPOSIT' || t.type === 'EARNING' || t.type === 'REFUND') {
                isCredit = true;
            }

            // SETTLEMENT depends on user role
            if (t.type === 'SETTLEMENT') {
                // Customers: Settlement means payout to them (money OUT = Debit)
                // Drivers: Settlement means they paid company (offsets debt = Credit)
                const isCustomer = user.role === 'customer' || user.linkedCustomerId;
                isCredit = !isCustomer; // false for customers, true for drivers
            }

            // WITHDRAWAL: Money OUT of Wallet (Debit)
            if (t.type === 'WITHDRAWAL') {
                isCredit = false;
            }

            ledger.push({
                id: t.id,
                date: t.date,
                description: t.description || t.type,
                type: t.type,
                amount: t.amount,
                currency: t.currency,
                status: t.status,
                reference: (t.id || '').slice(-6),
                isCredit
            });
        });

        // 2. Operational Transactions (Implicit from Bookings)

        const defaultRule = commissionRules.find(r => r.isDefault);
        const myEmployeeRecord = employees.find(e => e.linkedUserId === user.uid);
        const myZone = myEmployeeRecord?.zone;
        const activeRule = commissionRules.find(r => r.zoneName === myZone) || defaultRule || { type: 'PERCENTAGE', value: 70 };

        bookings.forEach(b => {
            const isSender = (user.linkedCustomerId && b.senderId === user.linkedCustomerId) || b.senderName === user.name;
            const bItems = b.items || [];

            // Check if user is a driver (booking-level or item-level)
            const isDriver = b.driverId === user.uid ||
                b.involvedDriverIds?.includes(user.uid) ||
                bItems.some(i => i.driverId === user.uid || i.collectorId === user.uid || i.delivererId === user.uid);

            // A. If User is Sender (Customer)
            if (isSender) {
                // 1. COD Collection (Credit to Customer Wallet)
                let hasKHR = false;
                bItems.forEach(item => {
                    if (item.status === 'DELIVERED') {
                        if (item.codCurrency === 'KHR') hasKHR = true;
                        ledger.push({
                            id: `cod-${item.id}`,
                            date: b.bookingDate,
                            description: `COD Collected: ${item.receiverName}`,
                            type: 'COD',
                            amount: item.productPrice || 0,
                            currency: item.codCurrency || 'USD',
                            status: 'COLLECTED',
                            reference: item.trackingCode || 'N/A',
                            isCredit: true
                        });
                    }
                });

                // 2. Service Fee Deduction (Debit from Customer Wallet)
                if (b.status !== 'CANCELLED') {
                    const itemsDelivered = bItems.filter(i => i.status === 'DELIVERED').length;
                    // Deduct fee if items are delivered or booking is completed
                    if (itemsDelivered > 0 || b.status === 'COMPLETED' || b.status === 'CONFIRMED') {
                        let feeAmount = b.totalDeliveryFee;
                        let feeCurrency = 'USD';
                        const itemCurrencies = new Set(bItems.map(i => i.codCurrency || 'USD'));
                        const isMixed = itemCurrencies.has('USD') && itemCurrencies.has('KHR');

                        if (isMixed) {
                            // Mixed Currency Logic: Split Fee based on DELIVERED items only
                            const khrItemsDelivered = bItems.filter(i => (i.codCurrency || 'USD') === 'KHR' && i.status === 'DELIVERED').length;
                            const usdItemsDelivered = bItems.filter(i => (i.codCurrency || 'USD') === 'USD' && i.status === 'DELIVERED').length;
                            const totalCount = bItems.length || 1;
                            const feePerItem = feeAmount / totalCount;
                            const RATE = 4000;

                            // 1. KHR Portion (Only for Delivered)
                            if (khrItemsDelivered > 0) {
                                const khrPortionFee = feePerItem * khrItemsDelivered;
                                let khrFinalAmount = khrPortionFee;
                                if (b.currency === 'USD') khrFinalAmount = khrPortionFee * RATE;

                                ledger.push({
                                    id: `fee-${b.id}-khr`,
                                    date: b.bookingDate,
                                    description: `Service Fee (KHR Portion): ${b.serviceTypeName}`,
                                    type: 'FEE',
                                    amount: khrFinalAmount,
                                    currency: 'KHR',
                                    status: 'APPLIED',
                                    reference: (b.id || '').slice(-6),
                                    isCredit: false
                                });
                            }

                            // 2. USD Portion (Only for Delivered)
                            if (usdItemsDelivered > 0) {
                                const usdPortionFee = feePerItem * usdItemsDelivered;
                                let usdFinalAmount = usdPortionFee;
                                if (b.currency === 'KHR') usdFinalAmount = usdPortionFee / RATE;

                                ledger.push({
                                    id: `fee-${b.id}-usd`,
                                    date: b.bookingDate,
                                    description: `Service Fee (USD Portion): ${b.serviceTypeName}`,
                                    type: 'FEE',
                                    amount: usdFinalAmount,
                                    currency: 'USD',
                                    status: 'APPLIED',
                                    reference: (b.id || '').slice(-6),
                                    isCredit: false
                                });
                            }

                        } else {
                            // Single Currency Logic: Pro-rate based on Delivered count
                            const itemsDeliveredCount = bItems.filter(i => i.status === 'DELIVERED').length;

                            if (itemsDeliveredCount > 0) {
                                const totalCount = bItems.length || 1;
                                const feePerItem = feeAmount / totalCount;
                                const totalDeduction = feePerItem * itemsDeliveredCount;

                                if (b.currency) {
                                    feeCurrency = b.currency;
                                } else if (hasKHR) {
                                    // Legacy fallback
                                    feeCurrency = 'KHR';
                                }

                                ledger.push({
                                    id: `fee-${b.id}`,
                                    date: b.bookingDate,
                                    description: `Service Fee: ${b.serviceTypeName}`,
                                    type: 'FEE',
                                    amount: totalDeduction,
                                    currency: feeCurrency,
                                    status: 'APPLIED',
                                    reference: (b.id || '').slice(-6),
                                    isCredit: false // Deducts from balance
                                });
                            }
                        }
                    }
                }
            }

            // B. If User is Driver
            if (isDriver) {
                // COMMISSIONS ARE NOW HANDLED VIA REAL TRANSACTIONS IN logisticsService.ts
                // No virtual commission entries needed - they are recorded as EARNING transactions
                // when item status becomes DELIVERED

                // Cash Held Liability (Debit from Driver Wallet)
                // Drivers owe this money to company until Settled.
                // Cash is collected by the DELIVERER, not the collector (picker)

                bItems.forEach(item => {
                    // Only show COD in deliverer's wallet (the person who collected cash from customer)
                    const isDeliveredByMe = item.delivererId === user.uid ||
                        (!item.delivererId && item.driverId === user.uid);

                    if (item.status === 'DELIVERED' && isDeliveredByMe) {
                        ledger.push({
                            id: `held-${item.id}`,
                            date: b.bookingDate,
                            description: `Cash Collected: ${item.receiverName}`,
                            type: 'COD',
                            amount: item.productPrice || 0,
                            currency: item.codCurrency || 'USD',
                            status: item.settlementStatus || 'HELD',
                            reference: item.trackingCode || 'N/A',
                            isCredit: false // Driver OWES this (Negative balance impact)
                        });
                    }
                });
            }

        });

        return ledger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, bookings, user, commissionRules, employees]);

    // Calculate Net Balance
    const calculatedBalance = useMemo(() => {
        let usd = 0;
        let khr = 0;

        unifiedLedger.forEach(item => {
            // Only include finalized statuses
            if (item.status === 'APPROVED' || item.status === 'APPLIED' || item.status === 'COLLECTED' || item.status === 'EARNED' || item.status === 'HELD' || item.status === 'SETTLED') {
                const val = item.amount;
                if (item.currency === 'KHR') {
                    if (item.isCredit) khr += val; else khr -= val;
                } else {
                    if (item.isCredit) usd += val; else usd -= val;
                }
            }
        });

        // Show raw balances per currency (no cross-currency offsetting)
        return { usd: round2(usd), khr: Math.round(khr) };
    }, [unifiedLedger]);


    // Balance Breakdown for Payout Logic (Customer Context)
    const balanceBreakdown = useMemo(() => {
        if (modalOpen !== 'WITHDRAWAL') return null;

        const currencyFilter = activeCurrency;
        let codTotal = 0;
        let feeTotal = 0;
        let paidOut = 0;
        let deposits = 0;

        const relatedItems: { bookingId: string, itemId: string }[] = [];

        unifiedLedger.forEach(item => {
            if (item.status === 'PENDING' || item.status === 'REJECTED') return;
            if (item.currency !== currencyFilter) return;

            if (item.type === 'COD' && item.isCredit) {
                codTotal += item.amount;
                const itemId = item.id.replace('cod-', '');
                const parentBooking = bookings.find(b => (b.items || []).some(i => i.id === itemId));
                if (parentBooking) {
                    relatedItems.push({ bookingId: parentBooking.id, itemId });
                }
            } else if (item.type === 'FEE') {
                feeTotal += item.amount;
            } else if (item.type === 'WITHDRAWAL') {
                paidOut += item.amount;
            } else if (item.type === 'DEPOSIT' || item.type === 'EARNING') {
                deposits += item.amount;
            } else if (item.type === 'SETTLEMENT') {
                // For customers, SETTLEMENT is money paid OUT to them
                paidOut += item.amount;
            }
        });

        const net = (codTotal + deposits) - feeTotal - paidOut;
        return { codTotal, feeTotal, paidOut, deposits, net, relatedItems };
    }, [unifiedLedger, modalOpen, activeCurrency, bookings]);

    const currentBalance = activeCurrency === 'USD' ? calculatedBalance.usd : calculatedBalance.khr;

    const defaultBankId = activeCurrency === 'KHR'
        ? (settings.defaultCustomerSettlementBankIdKHR || settings.defaultCustomerSettlementBankId)
        : (settings.defaultCustomerSettlementBankIdUSD || settings.defaultCustomerSettlementBankId);

    const defaultBank = bankAccounts.find(b => b.id === defaultBankId);

    useEffect(() => {
        if (modalOpen === 'WITHDRAWAL' && balanceBreakdown) {
            setAmount(parseFloat(balanceBreakdown.net.toFixed(2)));
            setAmountKHR(0);
        } else {
            setAmount(0);
            setAmountKHR(0);
            setCashAmount(0);
            setCashAmountKHR(0);
        }
    }, [modalOpen, balanceBreakdown, activeCurrency]);

    const handleTransaction = async () => {
        // Determine correct bank for the user role
        // Customer -> Customer Config
        // Driver -> Driver Config
        const isDriver = user.role === 'driver' || user.role === 'warehouse'; // Warehouse treated as internal
        let targetBankIdUSD = isDriver ? settings.defaultDriverSettlementBankIdUSD : settings.defaultCustomerSettlementBankIdUSD;
        let targetBankIdKHR = isDriver ? settings.defaultDriverSettlementBankIdKHR : settings.defaultCustomerSettlementBankIdKHR;

        // NEW: Cash Accounts
        let targetCashIdUSD = isDriver ? settings.defaultDriverCashAccountIdUSD : null;
        let targetCashIdKHR = isDriver ? settings.defaultDriverCashAccountIdKHR : null;

        // Fallback for legacy
        if (!targetBankIdUSD) targetBankIdUSD = settings.defaultSettlementBankAccountId;
        if (!targetBankIdKHR) targetBankIdKHR = settings.defaultSettlementBankAccountId; // Fallback to same if broken config

        // Validate Banks
        if (modalOpen === 'DEPOSIT') {
            if (amount > 0 && !targetBankIdUSD) return toast.error("System Error: No USD bank configured.");
            if (amountKHR > 0 && !targetBankIdKHR) return toast.error("System Error: No KHR bank configured.");
            if (cashAmount > 0 && !targetCashIdUSD) return toast.error("System Error: No USD Cash account configured. Please check Settings.");
            if (cashAmountKHR > 0 && !targetCashIdKHR) return toast.error("System Error: No KHR Cash account configured. Please check Settings.");
        }

        // Validate Withdrawal Limit
        if (modalOpen === 'WITHDRAWAL') {
            const maxAvail = balanceBreakdown?.net || 0;
            if (amount > maxAvail) {
                return toast.error(`Withdrawal amount cannot exceed available balance (${activeCurrency === 'USD' ? '$' : ''}${maxAvail.toLocaleString()}${activeCurrency === 'KHR' ? '៛' : ''})`);
            }
        }

        setLoading(true);
        try {
            if (modalOpen === 'DEPOSIT') {
                const timestamp = Date.now();
                const isDriverFlow = isDriver && (amount > 0 || amountKHR > 0 || cashAmount > 0 || cashAmountKHR > 0);

                if (isDriverFlow) {
                    // Pre-calculate unsettled items - ONLY items delivered by this driver
                    const allUnsettled = bookings.flatMap(b => (b.items || [])
                        .filter(i =>
                            i.status === 'DELIVERED' &&
                            i.driverSettlementStatus !== 'SETTLED' &&
                            // Only include items this driver delivered (they collected the cash)
                            (i.delivererId === user.uid || (!i.delivererId && i.driverId === user.uid))
                        )
                        .map(i => ({ bookingId: b.id, itemId: i.id, codCurrency: i.codCurrency || 'USD' }))
                    );

                    const usdItemsToSettle = allUnsettled.filter(i => (i.codCurrency === 'USD')).map(i => ({ bookingId: i.bookingId, itemId: i.itemId }));
                    const khrItemsToSettle = allUnsettled.filter(i => (i.codCurrency === 'KHR')).map(i => ({ bookingId: i.bookingId, itemId: i.itemId }));


                    // Masters
                    const masterUsdMethod: 'BANK' | 'CASH' | null = amount > 0 ? 'BANK' : (cashAmount > 0 ? 'CASH' : null);
                    const masterKhrMethod: 'BANK' | 'CASH' | null = amountKHR > 0 ? 'BANK' : (cashAmountKHR > 0 ? 'CASH' : null);

                    const requests = [];

                    // 1. Bank USD
                    if (amount > 0) {
                        requests.push(firebaseService.requestSettlement(
                            user.uid, user.name || 'Driver', amount, 'USD', targetBankIdUSD!, attachment,
                            (description || 'Settlement (Bank USD)'), masterUsdMethod === 'BANK' ? usdItemsToSettle : []
                        ));
                    }
                    // 2. Bank KHR
                    if (amountKHR > 0) {
                        requests.push(firebaseService.requestSettlement(
                            user.uid, user.name || 'Driver', amountKHR, 'KHR', targetBankIdKHR!, attachment,
                            (description || 'Settlement (Bank KHR)'), masterKhrMethod === 'BANK' ? khrItemsToSettle : []
                        ));
                    }
                    // 3. Cash USD
                    if (cashAmount > 0) {
                        requests.push(firebaseService.requestSettlement(
                            user.uid, user.name || 'Driver', cashAmount, 'USD', targetCashIdUSD!, '',
                            (description || 'Settlement (Cash USD)'), masterUsdMethod === 'CASH' ? usdItemsToSettle : []
                        ));
                    }
                    // 4. Cash KHR
                    if (cashAmountKHR > 0) {
                        requests.push(firebaseService.requestSettlement(
                            user.uid, user.name || 'Driver', cashAmountKHR, 'KHR', targetCashIdKHR!, '',
                            (description || 'Settlement (Cash KHR)'), masterKhrMethod === 'CASH' ? khrItemsToSettle : []
                        ));
                    }

                    if (requests.length > 0) await Promise.all(requests);
                } else {
                    // Legacy/Customer Flow
                    if (amount > 0) {
                        await firebaseService.requestWalletTopUp(
                            user.uid, amount, 'USD', targetBankIdUSD!, attachment,
                            (description || 'Deposit (USD)')
                        );
                    }
                    if (amountKHR > 0) {
                        await firebaseService.requestWalletTopUp(
                            user.uid, amountKHR, 'KHR', targetBankIdKHR!, attachment,
                            (description || 'Deposit (KHR)')
                        );
                    }
                }
                toast.success("Payment submitted! Please wait for approval.");
            } else {
                // WITHDRAWAL: Include related items so Finance can do Net Settlement
                // Only single currency withdrawal supported for now to keep Payout simple
                await firebaseService.requestWithdrawal(
                    user.uid,
                    user.name,
                    amount,
                    activeCurrency,
                    (activeCurrency === 'USD' ? targetBankIdUSD : targetBankIdKHR) || 'system-payout',
                    description || 'Net Payout Request',
                    balanceBreakdown?.relatedItems
                );
                toast.success("Payout request submitted for approval.");
            }

            // Refresh
            const updatedTxns = await firebaseService.getWalletTransactions(user.uid);
            setTransactions(updatedTxns);
            setModalOpen(null);
            setAmount(0);
            setAmountKHR(0);
            setCashAmount(0);
            setCashAmountKHR(0);
            setDescription('');
            setAttachment('');
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    }

    const displayLedger = unifiedLedger.filter(t => t.currency === activeCurrency);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">{user.name}'s {t('my_wallet')}</h2>
                <div className="flex space-x-2 bg-white p-1 rounded-lg border">
                    <button
                        onClick={() => setActiveCurrency('USD')}
                        className={`px-3 py-1 rounded text-sm font-bold transition-all ${activeCurrency === 'USD' ? 'bg-green-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        $ USD
                    </button>
                    <button
                        onClick={() => setActiveCurrency('KHR')}
                        className={`px-3 py-1 rounded text-sm font-bold transition-all ${activeCurrency === 'KHR' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        ៛ KHR
                    </button>
                </div>
            </div>

            {/* Balance Card */}
            <div className={`p-6 rounded-2xl text-white shadow-xl bg-gradient-to-br ${activeCurrency === 'USD' ? 'from-green-600 to-emerald-800' : 'from-blue-600 to-indigo-800'}`}>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-blue-100 text-sm font-medium opacity-80">{t('net_balance')}</p>
                        <h1 className="text-4xl font-bold mt-2">
                            {activeCurrency === 'USD' ? '$' : ''}
                            {calculatedBalance[activeCurrency === 'USD' ? 'usd' : 'khr'].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            {activeCurrency === 'KHR' ? ' ៛' : ''}
                        </h1>
                        <p className="text-xs text-white/60 mt-1">
                            {user.role === 'driver' ? 'Earnings - Cash Held + Settlements' : 'COD Collected - Service Fees'}
                        </p>
                    </div>
                    <div className="bg-white/20 p-2 rounded-lg">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    </div>
                </div>

                <div className="mt-8 flex gap-3">
                    <button
                        onClick={() => setModalOpen('DEPOSIT')}
                        className="flex-1 bg-white text-gray-900 py-2 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        {t('top_up')}
                    </button>
                    {user.role !== 'customer' && (
                        <button
                            onClick={() => setModalOpen('WITHDRAWAL')}
                            className="flex-1 bg-black/20 text-white py-2 rounded-xl font-bold text-sm hover:bg-black/30 transition-colors flex items-center justify-center gap-2 backdrop-blur-sm"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            {t('request_payout')}
                        </button>
                    )}
                </div>
            </div>

            {/* Detailed Statement */}
            <Card title={t('detailed_statement')}>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('date')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('description')}</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('transaction_type')}</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('amount')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {displayLedger.map((txn) => (
                                <tr key={txn.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{txn.date}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">
                                        <div className="font-medium">{txn.description}</div>
                                        {txn.status === 'PENDING' && <div className="text-xs text-orange-500 italic mt-0.5">{t('pending_approval')}</div>}
                                        {txn.status === 'SETTLED' && <div className="text-xs text-green-500 italic mt-0.5">Settled</div>}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${txn.type === 'FEE' ? 'bg-red-50 text-red-600 border border-red-100' :
                                            txn.type === 'COD' && txn.isCredit ? 'bg-green-50 text-green-600 border border-green-100' :
                                                txn.type === 'DEPOSIT' || txn.type === 'SETTLEMENT' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                                                    'bg-gray-50 text-gray-600 border border-gray-200'
                                            }`}>
                                            {txn.type}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-4 text-right text-sm font-bold ${txn.isCredit ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                        {txn.isCredit ? '+' : '-'} {txn.currency === 'USD' ? '$' : ''}{txn.amount.toLocaleString()}{txn.currency === 'KHR' ? '៛' : ''}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Withdrawal/Deposit Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">
                            {modalOpen === 'DEPOSIT' ? t('top_up') : t('request_payout')}
                        </h3>

                        {modalOpen === 'WITHDRAWAL' && balanceBreakdown && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4 space-y-2 text-sm">
                                <div className="flex justify-between text-green-700">
                                    <span>Total COD Collected</span>
                                    <span className="font-bold">+ {activeCurrency === 'USD' ? '$' : ''}{balanceBreakdown.codTotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-indigo-600">
                                    <span>Deposits/Credits</span>
                                    <span className="font-bold">+ {activeCurrency === 'USD' ? '$' : ''}{balanceBreakdown.deposits.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-red-600 border-b border-gray-200 pb-2">
                                    <span>Less: Service Fees</span>
                                    <span className="font-bold">- {activeCurrency === 'USD' ? '$' : ''}{balanceBreakdown.feeTotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between font-bold text-gray-900 pt-1 text-base">
                                    <span>Net Available Payout</span>
                                    <span>{activeCurrency === 'USD' ? '$' : ''}{balanceBreakdown.net.toLocaleString()}</span>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                {user.role === 'driver' && modalOpen === 'DEPOSIT' ? (
                                    // MULTI-CURRENCY INPUT FOR DRIVERS
                                    <div className="space-y-6">
                                        {/* Bank/Transfer Section */}
                                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 text-center">Method 1: Bank/Transfer</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">USD Amount ($)</label>
                                                    <input
                                                        type="number"
                                                        className="w-full border rounded-lg px-2 py-2 font-bold focus:ring-2 focus:ring-green-500 outline-none"
                                                        value={amount || ''}
                                                        onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">KHR Amount (៛)</label>
                                                    <input
                                                        type="number"
                                                        className="w-full border rounded-lg px-2 py-2 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                        value={amountKHR || ''}
                                                        onChange={e => setAmountKHR(parseFloat(e.target.value) || 0)}
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Cash Handover Section */}
                                        <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                                            <h4 className="text-xs font-bold text-indigo-500 uppercase mb-3 text-center">Method 2: Cash Handover</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-indigo-400 mb-1">USD Amount ($)</label>
                                                    <input
                                                        type="number"
                                                        className="w-full border border-indigo-200 rounded-lg px-2 py-2 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        value={cashAmount || ''}
                                                        onChange={e => setCashAmount(parseFloat(e.target.value) || 0)}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-indigo-400 mb-1">KHR Amount (៛)</label>
                                                    <input
                                                        type="number"
                                                        className="w-full border border-indigo-200 rounded-lg px-2 py-2 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        value={cashAmountKHR || ''}
                                                        onChange={e => setCashAmountKHR(parseFloat(e.target.value) || 0)}
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-indigo-400 mt-2 text-center italic">Use this for physical cash handovers at the office.</p>
                                        </div>
                                    </div>
                                ) : (
                                    // STANDARD SINGLE CURRENCY INPUT
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('amount')} ({activeCurrency})</label>
                                        <input
                                            type="number"
                                            className="w-full border rounded-lg px-3 py-2 text-lg font-bold"
                                            value={amount}
                                            onChange={e => setAmount(parseFloat(e.target.value))}
                                            placeholder="0.00"
                                            max={modalOpen === 'WITHDRAWAL' ? (balanceBreakdown?.net || 0) : undefined}
                                        />
                                    </div>
                                )}
                            </div>

                            {modalOpen === 'DEPOSIT' && (
                                <>
                                    {/* Bank Display - Logic to handle dual banks if needed, currently showing primary based on activeCurrency context or explicit selection */}
                                    {user.role === 'driver' ? (
                                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                                            <p className="text-xs text-blue-700 mb-2 uppercase font-bold text-center">Settlement Instructions</p>
                                            <div className="text-sm text-center space-y-2">
                                                {(amount > 0 || amountKHR > 0) && (
                                                    <div className="bg-white/50 p-2 rounded border border-blue-100">
                                                        <p className="font-bold text-xs text-blue-800 underline mb-1">Bank Transfer:</p>
                                                        {amount > 0 && <p>Transfer <b>${amount}</b> to Company USD Account.</p>}
                                                        {amountKHR > 0 && <p>Transfer <b>{amountKHR.toLocaleString()} ៛</b> to Company KHR Account.</p>}
                                                    </div>
                                                )}
                                                {(cashAmount > 0 || cashAmountKHR > 0) && (
                                                    <div className="bg-indigo-100/50 p-2 rounded border border-indigo-200">
                                                        <p className="font-bold text-xs text-indigo-800 underline mb-1">Cash Handover:</p>
                                                        {cashAmount > 0 && <p>Handover <b>${cashAmount}</b> cash to Accountant.</p>}
                                                        {cashAmountKHR > 0 && <p>Handover <b>{cashAmountKHR.toLocaleString()} ៛</b> cash to Accountant.</p>}
                                                    </div>
                                                )}
                                                {amount === 0 && amountKHR === 0 && cashAmount === 0 && cashAmountKHR === 0 && (
                                                    <p className="text-gray-500 italic">Enter amount to see transfer details</p>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        // Customer View
                                        defaultBank ? (
                                            <div className="flex flex-col items-center bg-blue-50 p-4 rounded-xl border border-blue-200">
                                                <p className="text-xs text-blue-700 mb-2 uppercase font-bold">{t('pay_to_company')}</p>
                                                {defaultBank.qrCode && <img src={defaultBank.qrCode} alt="QR" className="w-32 h-32 object-contain mb-2" />}
                                                <p className="font-bold">{defaultBank.name}</p>
                                                <p className="text-xs font-mono">{defaultBank.code}</p>
                                            </div>
                                        ) : <div className="text-red-500 text-sm">No company bank configured.</div>
                                    )}

                                    <ImageUpload value={attachment} onChange={setAttachment} label={t('proof_of_transfer')} />
                                </>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('description')}</label>
                                <input
                                    className="w-full border rounded-lg px-3 py-2 text-sm"
                                    placeholder={modalOpen === 'WITHDRAWAL' ? "Payout Request" : "Reference ID"}
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <Button variant="outline" onClick={() => setModalOpen(null)}>{t('cancel')}</Button>
                            <Button onClick={handleTransaction} isLoading={loading}>{t('submit_request')}</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
