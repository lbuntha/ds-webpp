import React, { useState, useEffect, useMemo } from 'react';
import { ParcelBooking, UserProfile, ParcelItem, Account, Branch, AccountType, AccountSubType, WalletTransaction, SystemSettings, AppNotification, CurrencyConfig, ParcelServiceType, Employee, DriverCommissionRule } from '../../src/shared/types';
import { firebaseService } from '../../src/shared/services/firebaseService';
// import { calculateDeliveryFee } from '../../src/shared/utils/feeCalculator'; // Removed per request
import { createBilingualNotification, formatDeliveredMessage, formatReturnedMessage, formatCodUpdatedByDriverMessage } from '../../src/shared/utils/notificationService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { ImageUpload } from '../ui/ImageUpload';
import { useLanguage } from '../../src/shared/contexts/LanguageContext';
import { ChatModal } from '../ui/ChatModal';
import { SettlementReportModal } from '../ui/SettlementReportModal';
import { toast } from '../../src/shared/utils/toast';

// Imported Components
import { DriverJobCard } from './DriverJobCard';
import { DriverDeliveryCard } from './DriverDeliveryCard';
import { DriverPickupProcessor } from './DriverPickupProcessor';
import { ActionConfirmationModal, TransferModal } from './DriverActionModals';

interface Props {
    user: UserProfile;
}

export const DriverDashboard: React.FC<Props> = ({ user }) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'MY_PICKUPS' | 'MY_PARCELS' | 'WAREHOUSE' | 'AVAILABLE' | 'SETTLEMENT'>('MY_PICKUPS');
    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [services, setServices] = useState<ParcelServiceType[]>([]);
    const [loading, setLoading] = useState(true);

    // States
    const [isFleetDriver, setIsFleetDriver] = useState<boolean>(false);
    const [isDeactivated, setIsDeactivated] = useState<boolean>(false);

    // Processing Job (Digitization)
    const [processingJob, setProcessingJob] = useState<ParcelBooking | null>(null);

    // Modals
    const [actionModal, setActionModal] = useState<{ isOpen: boolean; bookingId: string; itemId: string; action: 'TRANSIT' | 'DELIVER' | 'RETURN' | 'OUT_FOR_DELIVERY' } | null>(null);
    const [transferModal, setTransferModal] = useState<{ isOpen: boolean; bookingId: string; itemId: string } | null>(null);
    const [confirmJob, setConfirmJob] = useState<ParcelBooking | null>(null);
    const [zoomImage, setZoomImage] = useState<string | null>(null);
    const [activeChat, setActiveChat] = useState<{ itemId: string, itemName: string, customerName: string, bookingId?: string, customerUid?: string } | null>(null);
    const [viewHistoryTxn, setViewHistoryTxn] = useState<WalletTransaction | null>(null);

    // Settlement
    const [isSettling, setIsSettling] = useState(false);

    // Multi-Currency Inputs (Bank)
    const [payAmountBankUSD, setPayAmountBankUSD] = useState<number | ''>('');
    const [payAmountBankKHR, setPayAmountBankKHR] = useState<number | ''>('');
    // Multi-Currency Inputs (Cash)
    const [payAmountCashUSD, setPayAmountCashUSD] = useState<number | ''>('');
    const [payAmountCashKHR, setPayAmountCashKHR] = useState<number | ''>('');

    const [settleProof, setSettleProof] = useState('');
    const [settlementReason, setSettlementReason] = useState('');
    const [companyBanks, setCompanyBanks] = useState<Account[]>([]);
    const [settings, setSettings] = useState<SystemSettings>({});
    const [settlementHistory, setSettlementHistory] = useState<WalletTransaction[]>([]);
    const [currencies, setCurrencies] = useState<CurrencyConfig[]>([]);
    const [commissionRules, setCommissionRules] = useState<DriverCommissionRule[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const loadJobs = async () => {
        setLoading(true);
        try {
            // Use getDriverJobs instead of getParcelBookings to satisfy security rules
            const [myJobs, allBranches, allEmployees, allAccounts, walletTxns, sysSettings, allCurrencies, allServices, allRules] = await Promise.all([
                firebaseService.getDriverJobs(user.uid),
                firebaseService.getBranches(),
                firebaseService.getEmployees(),
                firebaseService.getAccounts(),
                firebaseService.getWalletTransactions(user.uid),
                firebaseService.getSettings(),
                firebaseService.getCurrencies(),
                firebaseService.getParcelServices(),
                firebaseService.logisticsService.getDriverCommissionRules()
            ]);

            setSettings(sysSettings);
            setServices(allServices);
            setCurrencies(allCurrencies);
            setCommissionRules(allRules);
            setEmployees(allEmployees);

            const myEmployeeRecord = allEmployees.find(e => e.linkedUserId === user.uid && e.isDriver);

            if (myEmployeeRecord) {
                setIsFleetDriver(true);
                if (myEmployeeRecord.status === 'INACTIVE') {
                    setIsDeactivated(true);
                } else {
                    setBookings(myJobs); // Use filtered jobs
                    setBranches(allBranches);
                    setSettlementHistory(walletTxns.filter(t => t.type === 'SETTLEMENT').sort((a, b) => b.id.localeCompare(a.id)));

                    // Fetch Company Banks (Nostro) from COA
                    const banks = allAccounts.filter(a =>
                        a.type === AccountType.ASSET &&
                        (a.subType === AccountSubType.CURRENT_ASSET || (a.name || '').toLowerCase().includes('bank') || (a.name || '').toLowerCase().includes('cash')) &&
                        !a.isHeader
                    );
                    setCompanyBanks(banks);
                }
            } else {
                setIsFleetDriver(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadJobs();
    }, [user]);

    // Derived Data - show pending jobs (including locked ones, so drivers can see status)
    const availablePickups = bookings.filter(b => !b.driverId && b.status === 'PENDING');
    const myPickups = bookings.filter(b => {
        // Must be assigned to this driver at booking level OR involved
        const isMyBooking = b.driverId === user.uid || b.involvedDriverIds?.includes(user.uid);
        if (!isMyBooking || b.status === 'CANCELLED') return false;

        // Check if any items are pending pickup
        const hasPendingItems = (b.items || []).some(i =>
            (i.status === 'PENDING' || i.status === 'AT_WAREHOUSE') &&
            // Item is either unassigned (new CONFIRMED booking) OR assigned to this driver
            (!i.driverId || i.driverId === user.uid || i.collectorId === user.uid)
        );

        return hasPendingItems;
    });

    const myActiveJobs = bookings.map(b => ({
        ...b,
        activeItems: (b.items || []).filter(i =>
            (i.driverId === user.uid || i.delivererId === user.uid) &&
            (i.status === 'PICKED_UP' || i.status === 'AT_WAREHOUSE' || i.status === 'OUT_FOR_DELIVERY' || (i.status === 'IN_TRANSIT' && !i.targetBranchId))
        )
    })).filter(b => b.activeItems.length > 0);

    const pendingHubHandover = bookings.flatMap(b => (b.items || []).map(i => ({ ...i, bookingId: b.id, senderName: b.senderName })))
        .filter(i => i.driverId === user.uid && i.status === 'IN_TRANSIT' && i.targetBranchId);

    // Flatten items with sender context for settlement calculation
    const unsettledItems = bookings.flatMap(b => (b.items || []).map(i => ({ ...i, bookingId: b.id, sender: b.senderName }))).filter(i =>
        i.driverId === user.uid && i.status === 'DELIVERED' && (!i.driverSettlementStatus || i.driverSettlementStatus === 'UNSETTLED')
    );

    // Separate tracking for COD Collection and Taxi Reimbursement
    const settlementBreakdown = useMemo(() => {
        let codUsd = 0, codKhr = 0;
        let taxiUsd = 0, taxiKhr = 0;

        unsettledItems.forEach(i => {
            // COD collected (driver owes this)
            const amt = Number(i.productPrice) || 0;
            if (amt > 0) {
                if (i.codCurrency === 'KHR') codKhr += amt; else codUsd += amt;
            }

            // Taxi fee reimbursement (company owes driver)
            if (i.isTaxiDelivery && i.taxiFee && i.taxiFee > 0) {
                if (i.taxiFeeCurrency === 'KHR') taxiKhr += i.taxiFee;
                else taxiUsd += i.taxiFee;
            }
        });

        return {
            cod: { usd: codUsd, khr: codKhr },
            taxi: { usd: taxiUsd, khr: taxiKhr },
            // Net (for backward compatibility)
            net: { usd: codUsd - taxiUsd, khr: codKhr - taxiKhr }
        };
    }, [unsettledItems]);

    // Backward compatibility alias
    const cashInHand = settlementBreakdown.net;

    // Determine Default Settlement Banks
    const defaultBankUSD = companyBanks.find(b => b.id === (settings.defaultDriverSettlementBankIdUSD || settings.defaultDriverSettlementBankId));
    const defaultBankKHR = companyBanks.find(b => b.id === (settings.defaultDriverSettlementBankIdKHR || settings.defaultDriverSettlementBankId));

    // --- SETTLEMENT CALCULATION LOGIC ---
    const settlementCalc = useMemo(() => {
        // Find dynamic rate from collection, fallback to 4100
        const khrCurrency = currencies.find(c => c.code === 'KHR');
        const exchangeRate = khrCurrency ? khrCurrency.exchangeRate : 4000;

        const debtUSD = cashInHand.usd;
        const debtKHR = cashInHand.khr;

        // Total Debt in Base USD for comparison
        const totalDebtBase = debtUSD + (debtKHR / exchangeRate);

        // User Inputs
        const bankUSD = Number(payAmountBankUSD) || 0;
        const bankKHR = Number(payAmountBankKHR) || 0;
        const cashUSD = Number(payAmountCashUSD) || 0;
        const cashKHR = Number(payAmountCashKHR) || 0;

        // Total Provided in Base USD
        const totalProvidedBase = bankUSD + cashUSD + ((bankKHR + cashKHR) / exchangeRate);

        const difference = totalProvidedBase - totalDebtBase;
        const isBalanced = Math.abs(difference) < 0.05; // 5 cent buffer for rounding

        // Credit Balance = Company owes driver (negative debt)
        const isCreditBalance = totalDebtBase < -0.01;

        return {
            totalDebtBase,
            totalProvidedBase,
            difference,
            isBalanced,
            isCreditBalance,
            bankUSD,
            bankKHR,
            cashUSD,
            cashKHR,
            exchangeRate
        };
    }, [cashInHand, payAmountBankUSD, payAmountBankKHR, payAmountCashUSD, payAmountCashKHR, currencies]);

    // Handlers
    const handleParcelAction = async (bookingId: string, itemId: string, action: 'TRANSIT' | 'DELIVER' | 'RETURN' | 'TRANSFER' | 'OUT_FOR_DELIVERY', branchId?: string, proof?: string, updatedCOD?: { amount: number, currency: 'USD' | 'KHR' }, taxiData?: { isTaxiDelivery: boolean, taxiFee: number, taxiFeeCurrency: 'USD' | 'KHR' }) => {
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking) return;

        const updatedItems = (booking.items || []).map(item => {
            if (item.id === itemId) {
                if (action === 'TRANSIT') return { ...item, status: 'IN_TRANSIT' as const };
                if (action === 'DELIVER') {
                    const newItem: any = {
                        ...item,
                        status: 'DELIVERED' as const,
                        settlementStatus: 'UNSETTLED' as const,
                        proofOfDelivery: proof,
                        delivererId: user.uid,
                        delivererName: user.name,
                        targetBranchId: null // Clear to indicate Out for Delivery
                    };

                    // Handle taxi delivery
                    if (taxiData?.isTaxiDelivery) {
                        newItem.isTaxiDelivery = true;
                        newItem.taxiFee = taxiData.taxiFee;
                        newItem.taxiFeeCurrency = taxiData.taxiFeeCurrency;
                        // REMOVED: newItem.productPrice = 0; -> We now assume Driver is responsible for COD or it was collected via Taxi but accounted to Driver
                    }

                    if (updatedCOD) {
                        newItem.productPrice = updatedCOD.amount;
                        newItem.codCurrency = updatedCOD.currency;
                    }
                    return newItem;
                }
                if (action === 'TRANSFER') return { ...item, status: 'IN_TRANSIT' as const, targetBranchId: branchId, driverId: user.uid, driverName: user.name };
                if (action === 'OUT_FOR_DELIVERY') return { ...item, status: 'OUT_FOR_DELIVERY' as const };
                if (action === 'RETURN') return { ...item, status: 'RETURN_TO_SENDER' as const };
            }
            return item;
        });

        const allDone = updatedItems.every(i => i.status === 'DELIVERED' || i.status === 'RETURN_TO_SENDER');
        const bookingStatus = allDone ? 'COMPLETED' : booking.status;

        // FEE RECALCULATION START - REFACTORED
        // User Request: "just swap the fee by currency, no calculation"
        let finalBooking = { ...booking, items: updatedItems, status: bookingStatus };

        if (action === 'DELIVER' && updatedCOD) {
            const targetItem = updatedItems.find(i => i.id === itemId);
            if (targetItem) {
                const newCurrency = updatedCOD.currency;

                // Assign the correct pre-calculated fee based on the new COD currency
                const newFee = newCurrency === 'KHR'
                    ? (targetItem.deliveryFeeKHR || targetItem.deliveryFee || 0)
                    : (targetItem.deliveryFeeUSD || targetItem.deliveryFee || 0);

                // Update the item's delivery fee
                finalBooking.items = finalBooking.items.map(i =>
                    i.id === itemId
                        ? { ...i, deliveryFee: newFee, codCurrency: newCurrency }
                        : i
                );

                // Recalculate total fee
                finalBooking.totalDeliveryFee = finalBooking.items.reduce(
                    (sum, item) => sum + (item.deliveryFee || 0), 0
                );
                finalBooking.currency = newCurrency;
            }
        }
        // FEE RECALCULATION END

        try {
            await firebaseService.saveParcelBooking(finalBooking);
        } catch (e) {
            toast.error("Failed to update status. Please try again.");
        }

        // NOTIFICATION TRIGGER: If action is DELIVER, notify Customer (Bilingual)
        if (action === 'DELIVER' && booking.senderId) {
            const custUid = await firebaseService.getUserUidByCustomerId(booking.senderId);
            if (custUid) {
                const receiverName = booking.items.find(i => i.id === itemId)?.receiverName || '';
                const notif = createBilingualNotification(
                    'PARCEL_DELIVERED',
                    custUid,
                    formatDeliveredMessage(receiverName),
                    { type: 'BOOKING', bookingId: booking.id }
                );
                notif.type = 'SUCCESS';
                await firebaseService.sendNotification(notif);
            }
        }

        // NOTIFICATION TRIGGER: If action is RETURN, notify Customer (Bilingual)
        if (action === 'RETURN' && booking.senderId) {
            const custUid = await firebaseService.getUserUidByCustomerId(booking.senderId);
            if (custUid) {
                const receiverName = booking.items.find(i => i.id === itemId)?.receiverName || '';
                const notif = createBilingualNotification(
                    'PARCEL_RETURNED',
                    custUid,
                    formatReturnedMessage(receiverName),
                    { type: 'BOOKING', bookingId: booking.id }
                );
                notif.type = 'WARNING';
                await firebaseService.sendNotification(notif);
            }
        }



        loadJobs();
    };


    const handleCodUpdate = async (bookingId: string, itemId: string, amount: number, currency: 'USD' | 'KHR') => {
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking) return;

        // Update the specific item with new COD - use pre-stored fees (no recalculation needed)
        const updatedItems = (booking.items || []).map(i => {
            if (i.id !== itemId) return i;

            // Use pre-stored fee for the selected currency
            const deliveryFee = currency === 'KHR'
                ? (i.deliveryFeeKHR || i.deliveryFee || 0)
                : (i.deliveryFeeUSD || i.deliveryFee || 0);

            return {
                ...i,
                productPrice: amount,
                codCurrency: currency,
                deliveryFee
            };
        });

        // Aggregate total fee from all items
        const totalFee = updatedItems.reduce((sum, item) => sum + (item.deliveryFee || 0), 0);

        await firebaseService.saveParcelBooking({
            ...booking,
            items: updatedItems,
            totalDeliveryFee: totalFee
        });

        // NOTIFICATION: Notify customer when driver updates COD amount (Bilingual)
        if (booking.senderId) {
            const custUid = await firebaseService.getUserUidByCustomerId(booking.senderId);
            if (custUid) {
                const item = updatedItems.find(i => i.id === itemId);
                const formattedAmount = currency === 'KHR' ? `${amount.toLocaleString()}៛` : `$${amount.toFixed(2)}`;
                const notif = createBilingualNotification(
                    'COD_UPDATED_BY_DRIVER',
                    custUid,
                    formatCodUpdatedByDriverMessage(item?.receiverName || '', formattedAmount),
                    { type: 'BOOKING', bookingId: booking.id }
                );
                await firebaseService.sendNotification(notif);
            }
        }

        loadJobs();
    };

    const handleSettlement = async () => {
        if (unsettledItems.length === 0) return;

        // Note: Flexible settlement now allows any amount (shortage or overpayment)
        // The difference is tracked in the driver's wallet balance

        const { bankUSD, bankKHR, cashUSD, cashKHR } = settlementCalc;

        // --- STRICT CURRENCY VALIDATION ---
        const totalPaidUSD = bankUSD + cashUSD;
        const totalPaidKHR = bankKHR + cashKHR;
        // Use GROSS COD amounts for validation (not net after taxi offset)
        const codUSD = settlementBreakdown.cod.usd;
        const codKHR = settlementBreakdown.cod.khr;

        // Block paying USD if no USD COD (prevents clearing KHR debt with USD)
        if (totalPaidUSD > 0 && codUSD <= 0.01) {
            return toast.error("Strict Currency Rule: You cannot settle in USD because you only owe KHR. Please pay in KHR.");
        }

        // Block paying KHR if no KHR COD
        if (totalPaidKHR > 0 && codKHR <= 100) { // 100 Riel buffer
            return toast.error("Strict Currency Rule: You cannot settle in KHR because you only owe USD. Please pay in USD.");
        }

        // Ensure Asset Accounts are Configured
        if (bankUSD > 0 && !defaultBankUSD) return toast.error("System Error: No default USD settlement bank configured.");
        if (bankKHR > 0 && !defaultBankKHR) return toast.error("System Error: No default KHR settlement bank configured.");

        const defaultCashUSDId = settings.defaultDriverCashAccountIdUSD;
        const defaultCashKHRId = settings.defaultDriverCashAccountIdKHR;

        if (cashUSD > 0 && !defaultCashUSDId) return toast.error("System Error: No default USD cash account configured.");
        if (cashKHR > 0 && !defaultCashKHRId) return toast.error("System Error: No default KHR cash account configured.");

        const needsProof = bankUSD > 0 || bankKHR > 0;
        if (needsProof && !settleProof) {
            toast.warning("Please upload proof of transfer for bank portions.");
            return;
        }

        setIsSaving(true);
        try {
            // Prepare items lists split by currency
            // Prepare items lists split by currency
            const usdItemsToSettle = unsettledItems
                .filter(i => (i.codCurrency || 'USD').toUpperCase() === 'USD')
                .map(i => ({ bookingId: i.bookingId, itemId: i.id }));

            const khrItemsToSettle = unsettledItems
                .filter(i => (i.codCurrency || 'USD').toUpperCase() === 'KHR')
                .map(i => ({ bookingId: i.bookingId, itemId: i.id }));

            // For each currency, we pick ONE "Master" transaction to carry the items
            // Master USD: Bank if exists, else Cash
            const masterUsdMethod: 'BANK' | 'CASH' | null = bankUSD > 0 ? 'BANK' : (cashUSD > 0 ? 'CASH' : null);
            // Master KHR: Bank if exists, else Cash
            const masterKhrMethod: 'BANK' | 'CASH' | null = bankKHR > 0 ? 'BANK' : (cashKHR > 0 ? 'CASH' : null);

            const requestsToMake = [];

            // 1. Bank USD
            if (bankUSD > 0) {
                requestsToMake.push(
                    firebaseService.requestSettlement(
                        user.uid, user.name, bankUSD, 'USD', defaultBankUSD!.id, settleProof || '',
                        `Settlement (Bank USD)`, masterUsdMethod === 'BANK' ? usdItemsToSettle : []
                    )
                );
            }
            // 2. Bank KHR
            if (bankKHR > 0) {
                requestsToMake.push(
                    firebaseService.requestSettlement(
                        user.uid, user.name, bankKHR, 'KHR', defaultBankKHR!.id, settleProof || '',
                        `Settlement (Bank KHR)`, masterKhrMethod === 'BANK' ? khrItemsToSettle : []
                    )
                );
            }

            // 3. Cash USD
            if (cashUSD > 0) {
                requestsToMake.push(
                    firebaseService.requestSettlement(
                        user.uid, user.name, cashUSD, 'USD', defaultCashUSDId!, '',
                        `Settlement (Cash USD)`, masterUsdMethod === 'CASH' ? usdItemsToSettle : []
                    )
                );
            }
            // 4. Cash KHR
            if (cashKHR > 0) {
                requestsToMake.push(
                    firebaseService.requestSettlement(
                        user.uid, user.name, cashKHR, 'KHR', defaultCashKHRId!, '',
                        `Settlement (Cash KHR)`, masterKhrMethod === 'CASH' ? khrItemsToSettle : []
                    )
                );
            }

            // 5. TAXI FEE REIMBURSEMENT (Separate Accounting Entries)
            // Always create taxi fee transactions when taxi amounts exist
            const taxiUsdItems = unsettledItems.filter(i => i.isTaxiDelivery && (i.taxiFeeCurrency || 'USD') !== 'KHR');
            const taxiKhrItems = unsettledItems.filter(i => i.isTaxiDelivery && i.taxiFeeCurrency === 'KHR');

            if (settlementBreakdown.taxi.usd > 0) {
                requestsToMake.push(
                    firebaseService.requestSettlement(
                        user.uid, user.name, settlementBreakdown.taxi.usd, 'USD',
                        defaultBankUSD?.id || 'system', '',
                        'Taxi Fee Reimbursement (USD)',
                        taxiUsdItems.map(i => ({ bookingId: i.bookingId, itemId: i.id }))
                    )
                );
            }
            if (settlementBreakdown.taxi.khr > 0) {
                requestsToMake.push(
                    firebaseService.requestSettlement(
                        user.uid, user.name, settlementBreakdown.taxi.khr, 'KHR',
                        defaultBankKHR?.id || 'system', '',
                        'Taxi Fee Reimbursement (KHR)',
                        taxiKhrItems.map(i => ({ bookingId: i.bookingId, itemId: i.id }))
                    )
                );
            }

            if (requestsToMake.length > 0) {
                await Promise.all(requestsToMake);
                const codCount = (bankUSD > 0 ? 1 : 0) + (bankKHR > 0 ? 1 : 0) + (cashUSD > 0 ? 1 : 0) + (cashKHR > 0 ? 1 : 0);
                const taxiCount = (settlementBreakdown.taxi.usd > 0 ? 1 : 0) + (settlementBreakdown.taxi.khr > 0 ? 1 : 0);
                toast.success(`Settlement requested! (${codCount} COD + ${taxiCount} Taxi = ${requestsToMake.length} transactions)`);
                setIsSettling(false);
                setSettleProof('');
                setPayAmountBankUSD('');
                setPayAmountBankKHR('');
                setPayAmountCashUSD('');
                setPayAmountCashKHR('');
                setSettlementReason('');
                loadJobs();
            } else {
                // Edge case: No COD payment and no taxi - nothing to do
                toast.info("No amounts to settle.");
                setIsSettling(false);
                loadJobs();
            }

        } catch (e) { toast.error("Failed to submit settlement request."); } finally { setIsSaving(false); }
    };

    const handleAcceptJob = async () => {
        if (!confirmJob) return;

        // Check if job is already locked by another driver
        if (confirmJob.lockedByDriverId && confirmJob.lockedByDriverId !== user.uid) {
            toast.error(`This job is already taken by ${confirmJob.lockedByDriverName || 'another driver'}.`);
            setConfirmJob(null);
            await loadJobs();
            return;
        }

        try {
            // Lock and accept the job
            const acceptedJob: ParcelBooking = {
                ...confirmJob,
                driverId: user.uid,
                driverName: user.name,
                status: 'CONFIRMED',
                statusId: 'ps-pickup',
                lockedByDriverId: user.uid,
                lockedByDriverName: user.name,
                lockedAt: Date.now()
            };
            await firebaseService.saveParcelBooking(acceptedJob);
            await loadJobs();
            setConfirmJob(null);
            setActiveTab('MY_PICKUPS');
            toast.success("Job accepted!");
        } catch (e) {
            console.error(e);
            toast.error("Failed to accept job. Please try again.");
        }
    };

    const handleUnlockJob = async (job: ParcelBooking) => {
        // Only the driver who locked can unlock
        if (job.lockedByDriverId !== user.uid) {
            toast.error("You can only release jobs you have accepted.");
            return;
        }

        try {
            const unlockedJob: ParcelBooking = {
                ...job,
                driverId: undefined,
                driverName: undefined,
                status: 'PENDING',
                statusId: 'ps-pending',
                lockedByDriverId: undefined,
                lockedByDriverName: undefined,
                lockedAt: undefined
            };
            await firebaseService.saveParcelBooking(unlockedJob);
            await loadJobs();
            toast.success("Job released. Other drivers can now accept it.");
        } catch (e) {
            console.error(e);
            toast.error("Failed to release job.");
        }
    };

    const openChat = async (bookingId: string, item: ParcelItem) => {
        let custUid = undefined;
        const booking = bookings.find(b => b.id === bookingId);
        if (booking?.senderId) {
            custUid = await firebaseService.getUserUidByCustomerId(booking.senderId);
        }
        setActiveChat({ itemId: item.id, bookingId, itemName: item.receiverName, customerName: booking?.senderName || 'Customer', customerUid: custUid });
    };

    const getStatusLabel = (status: string) => {
        // @ts-ignore
        const label = t(`status_${status}`);
        return label === `status_${status}` ? status : label;
    };

    const renderStatusBadge = (status: string) => {
        const label = getStatusLabel(status);
        switch (status) {
            case 'PENDING': return <span className="text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded text-xs font-bold">{label}</span>;
            case 'OUT_FOR_DELIVERY': return <span className="text-purple-600 bg-purple-100 px-2 py-0.5 rounded text-xs font-bold">{label}</span>;
            case 'APPROVED': return <span className="text-green-600 bg-green-100 px-2 py-0.5 rounded text-xs font-bold">{label}</span>;
            case 'REJECTED': return <span className="text-red-600 bg-red-100 px-2 py-0.5 rounded text-xs font-bold">{label}</span>;
            default: return <span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded text-xs font-bold">{label}</span>;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-500">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin mb-4"></div>
                <p>Loading Dashboard...</p>
            </div>
        );
    }

    if (!isFleetDriver) {
        return (
            <div className="text-center py-10 bg-white rounded-xl shadow-sm border border-gray-200 m-4">
                <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">Access Restricted</h3>
                <p className="text-gray-500 mt-2 px-6 text-sm">
                    Your account is created, but it is not linked to an active <strong>Driver Profile</strong> in the system.
                </p>
                <p className="text-gray-400 mt-4 text-xs">Please contact the administrator to add you to the Fleet.</p>
            </div>
        );
    }

    if (isDeactivated) {
        return (
            <div className="text-center py-10 bg-red-50 text-red-800 rounded-xl m-4 border border-red-200">
                <h3 className="font-bold text-lg">Account Deactivated</h3>
                <p className="text-sm mt-2">Please contact support.</p>
            </div>
        );
    }

    if (processingJob) {
        return (
            <DriverPickupProcessor
                job={processingJob}
                user={user}
                services={services}
                onSave={async (updatedJob) => {
                    // Background save, update local state only
                    await firebaseService.saveParcelBooking(updatedJob);
                    setProcessingJob(updatedJob);
                }}
                onFinish={async () => {
                    // Done with batch, close and reload dashboard
                    setProcessingJob(null);
                    await loadJobs();
                }}
                onCancel={() => {
                    // Cancel without reload if nothing changed, or reload if safer
                    setProcessingJob(null);
                    loadJobs();
                }}
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
                <h2 className="text-lg font-bold text-gray-800">Driver Dashboard</h2>
                <Button variant="outline" onClick={loadJobs} isLoading={loading} className="py-1 px-3 h-8 text-xs">
                    {t('refresh')}
                </Button>
            </div>
            {/* Tabs */}
            <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                {[
                    { id: 'MY_PICKUPS', label: `Pickups (${myPickups.length})` },
                    { id: 'MY_PARCELS', label: `Deliveries (${myActiveJobs.reduce((s, j) => s + j.activeItems.length, 0)})` },
                    { id: 'WAREHOUSE', label: `Hub (${pendingHubHandover.length})` },
                    { id: 'AVAILABLE', label: `New (${availablePickups.length})` },
                    { id: 'SETTLEMENT', label: 'Wallet' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap ${activeTab === tab.id ? 'bg-red-50 text-red-700' : 'text-gray-500'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'AVAILABLE' && (
                <div className="space-y-4 animate-fade-in-up">
                    {availablePickups.map(job => (
                        <DriverJobCard
                            key={job.id}
                            job={job}
                            type="AVAILABLE"
                            onAction={setConfirmJob}
                            currentDriverId={user.uid}
                        />
                    ))}
                    {availablePickups.length === 0 && <p className="text-center text-gray-400 py-10">No new jobs available.</p>}
                </div>
            )}

            {activeTab === 'MY_PICKUPS' && (
                <div className="space-y-4 animate-fade-in-up">
                    {myPickups.map(job => (
                        <DriverJobCard
                            key={job.id}
                            job={job}
                            type="PICKUP"
                            currentDriverId={user.uid}
                            onAction={setProcessingJob}
                            onUnlock={handleUnlockJob}
                            onMapClick={(addr) => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, '_blank')}
                            onChatClick={(j) => openChat(j.id, (j.items || [])[0])}
                        />
                    ))}
                    {myPickups.length === 0 && <p className="text-center text-gray-400 py-10">No pending pickups.</p>}
                </div>
            )}

            {activeTab === 'MY_PARCELS' && (
                <div className="space-y-4 animate-fade-in-up">
                    {myActiveJobs.map(job => (
                        <DriverDeliveryCard
                            key={job.id}
                            job={job}
                            currentDriverId={user.uid}
                            onZoomImage={setZoomImage}
                            onUpdateCod={handleCodUpdate}
                            onChatClick={(bid, item) => openChat(bid, item)}
                            hasBranches={branches.length > 0}
                            onAction={(bid, itemId, action) => {
                                if (action === 'TRANSFER') setTransferModal({ isOpen: true, bookingId: bid, itemId });
                                else setActionModal({ isOpen: true, bookingId: bid, itemId, action });
                            }}
                        />
                    ))}
                    {myActiveJobs.length === 0 && <p className="text-center text-gray-400 py-10">No active parcels to deliver.</p>}
                </div>
            )}

            {activeTab === 'WAREHOUSE' && (
                <div className="space-y-4 animate-fade-in-up">
                    {pendingHubHandover.length > 0 ? (
                        pendingHubHandover.map((item, idx) => (
                            <div key={idx} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm opacity-80 flex items-center gap-3">
                                <img src={item.image} className="w-12 h-12 rounded-lg object-cover bg-gray-100" alt="Parcel" />
                                <div className="flex-1">
                                    <div className="flex justify-between">
                                        <h4 className="font-bold text-sm text-gray-800">{item.receiverName}</h4>
                                        <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-bold uppercase animate-pulse">Confirming...</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">To: {branches.find(b => b.id === item.targetBranchId)?.name || 'Hub'}</p>
                                </div>
                            </div>
                        ))
                    ) : <div className="text-center py-10 text-gray-500">No items waiting for hub confirmation.</div>}
                </div>
            )}

            {/* --- SETTLEMENT --- */}
            {activeTab === 'SETTLEMENT' && (
                <div className="space-y-6 animate-fade-in-up">
                    {/* Split Display: COD vs Taxi */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* COD Collection Card */}
                        <div className="rounded-xl p-4 bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-lg">
                            <h3 className="text-xs font-medium text-white/80 uppercase tracking-wide mb-1">💰 COD Collection</h3>
                            <p className="text-[10px] text-white/60 mb-3">You owe this to the company</p>
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-white/80">USD:</span>
                                    <span className="text-xl font-bold">${settlementBreakdown.cod.usd.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-white/80">KHR:</span>
                                    <span className="text-xl font-bold">{settlementBreakdown.cod.khr.toLocaleString()} ៛</span>
                                </div>
                            </div>
                        </div>

                        {/* Taxi Reimbursement Card */}
                        <div className="rounded-xl p-4 bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg">
                            <h3 className="text-xs font-medium text-white/80 uppercase tracking-wide mb-1">🚕 Taxi Reimbursement</h3>
                            <p className="text-[10px] text-white/60 mb-3">Company owes you this</p>
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-white/80">USD:</span>
                                    <span className="text-xl font-bold">${settlementBreakdown.taxi.usd.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-white/80">KHR:</span>
                                    <span className="text-xl font-bold">{settlementBreakdown.taxi.khr.toLocaleString()} ៛</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Net Summary */}
                    <div className={`rounded-xl p-4 border-2 ${cashInHand.usd >= 0 && cashInHand.khr >= 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs font-bold text-gray-600 uppercase">Net Settlement</p>
                                <p className="text-[10px] text-gray-500">
                                    {cashInHand.usd >= 0 && cashInHand.khr >= 0 ? 'Amount you pay to company' : 'Amount company pays you'}
                                </p>
                            </div>
                            <div className="text-right">
                                <span className={`text-2xl font-bold ${cashInHand.usd >= 0 && cashInHand.khr >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                                    ${Math.abs(cashInHand.usd).toFixed(2)}
                                </span>
                                {Math.abs(cashInHand.khr) > 0 && (
                                    <span className="text-sm text-gray-600 ml-2">+ {Math.abs(cashInHand.khr).toLocaleString()} ៛</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <button onClick={() => setIsSettling(true)} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-indigo-700 transition-colors">
                        {t('request_settlement')}
                    </button>

                    <div className="space-y-3">
                        <h4 className="text-sm font-bold text-gray-800">{t('settlement_history')}</h4>
                        {settlementHistory.length > 0 ? (
                            settlementHistory.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => setViewHistoryTxn(t)}
                                    className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors"
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs text-gray-500">{t.date}</span>
                                        {renderStatusBadge(t.status)}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-900">{t.description || 'Settlement'}</span>
                                        <span className="text-sm font-bold text-gray-900">
                                            {t.amount.toLocaleString()} {t.currency}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-indigo-500 mt-1">Tap to view details</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-400 text-xs py-4">No settlement history.</p>
                        )}
                    </div>
                </div>
            )}

            {/* --- MODALS --- */}

            {viewHistoryTxn && (
                <SettlementReportModal
                    transaction={viewHistoryTxn}
                    onClose={() => setViewHistoryTxn(null)}
                    accounts={companyBanks}
                    employees={employees}
                    commissionRules={commissionRules}
                    bookings={bookings}
                />
            )}

            <ActionConfirmationModal
                isOpen={!!actionModal}
                action={actionModal?.action || 'DELIVER'}
                initialCodAmount={bookings.find(b => b.id === actionModal?.bookingId)?.items?.find(i => i.id === actionModal?.itemId)?.productPrice || 0}
                initialCodCurrency={bookings.find(b => b.id === actionModal?.bookingId)?.items?.find(i => i.id === actionModal?.itemId)?.codCurrency || 'USD'}
                onCancel={() => setActionModal(null)}
                onConfirm={(proof, cod, taxiData) => {
                    if (actionModal) handleParcelAction(actionModal.bookingId, actionModal.itemId, actionModal.action, undefined, proof, cod, taxiData);
                    setActionModal(null);
                }}
            />

            <TransferModal
                isOpen={!!transferModal}
                branches={branches}
                onCancel={() => setTransferModal(null)}
                onConfirm={(branchId) => {
                    if (transferModal) handleParcelAction(transferModal.bookingId, transferModal.itemId, 'TRANSFER', branchId);
                    setTransferModal(null);
                }}
            />

            {confirmJob && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-sm">
                        <h3 className="font-bold text-lg mb-2">{t('accept_job')}?</h3>
                        <p className="text-gray-600 mb-4 text-sm">{confirmJob.pickupAddress}</p>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setConfirmJob(null)} className="flex-1">{t('cancel')}</Button>
                            <Button onClick={handleAcceptJob} className="flex-1">{t('confirm')}</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settlement Request Form */}
            {isSettling && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[95vh] overflow-y-auto">
                        <h3 className="font-bold text-lg mb-4">{t('request_settlement')}</h3>

                        <div className="space-y-4">

                            {/* COD Collection Section */}
                            <div className="p-4 rounded-xl border-2 border-red-200 bg-red-50">
                                <div className="flex justify-between items-center mb-3">
                                    <div>
                                        <h4 className="text-sm font-bold text-red-800">💰 COD Collection</h4>
                                        <p className="text-[10px] text-red-600">You owe this to company</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-gray-500">Outstanding</p>
                                        <p className="text-sm font-bold text-red-700">
                                            ${settlementBreakdown.cod.usd.toFixed(2)} / {settlementBreakdown.cod.khr.toLocaleString()} ៛
                                        </p>
                                    </div>
                                </div>

                                {/* Bank Transfer */}
                                <p className="text-[10px] font-bold text-red-500 uppercase mb-2">🏦 Bank Transfer</p>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className="block text-[10px] text-red-500 mb-1">USD</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full border border-red-200 rounded-lg px-3 py-2 font-bold text-gray-900 focus:ring-2 focus:ring-red-400 outline-none bg-white"
                                            placeholder="0.00"
                                            value={payAmountBankUSD}
                                            onChange={e => setPayAmountBankUSD(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-red-500 mb-1">KHR</label>
                                        <input
                                            type="number"
                                            className="w-full border border-red-200 rounded-lg px-3 py-2 font-bold text-gray-900 focus:ring-2 focus:ring-red-400 outline-none bg-white"
                                            placeholder="0"
                                            value={payAmountBankKHR}
                                            onChange={e => setPayAmountBankKHR(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>

                                {/* Cash Handover */}
                                <p className="text-[10px] font-bold text-red-500 uppercase mb-2">💵 Cash Handover</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] text-red-500 mb-1">USD</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full border border-red-200 rounded-lg px-3 py-2 font-bold text-gray-900 focus:ring-2 focus:ring-red-400 outline-none bg-white"
                                            placeholder="0.00"
                                            value={payAmountCashUSD}
                                            onChange={e => setPayAmountCashUSD(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-red-500 mb-1">KHR</label>
                                        <input
                                            type="number"
                                            className="w-full border border-red-200 rounded-lg px-3 py-2 font-bold text-gray-900 focus:ring-2 focus:ring-red-400 outline-none bg-white"
                                            placeholder="0"
                                            value={payAmountCashKHR}
                                            onChange={e => setPayAmountCashKHR(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Taxi Reimbursement Section - Only show if taxi fees exist */}
                            {(settlementBreakdown.taxi.usd > 0 || settlementBreakdown.taxi.khr > 0) && (
                                <div className="p-4 rounded-xl border-2 border-green-200 bg-green-50">
                                    <div className="flex justify-between items-center mb-3">
                                        <div>
                                            <h4 className="text-sm font-bold text-green-800">🚕 Taxi Reimbursement</h4>
                                            <p className="text-[10px] text-green-600">Company owes you this</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-gray-500">To Receive</p>
                                            <p className="text-sm font-bold text-green-700">
                                                {settlementBreakdown.taxi.usd > 0 && `$${settlementBreakdown.taxi.usd.toFixed(2)}`}
                                                {settlementBreakdown.taxi.usd > 0 && settlementBreakdown.taxi.khr > 0 && ' / '}
                                                {settlementBreakdown.taxi.khr > 0 && `${settlementBreakdown.taxi.khr.toLocaleString()} ៛`}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-green-600 italic mb-2">
                                        This amount will be automatically credited to your wallet or offset against COD.
                                    </p>
                                </div>
                            )}

                            {/* Net Summary */}
                            <div className="p-3 rounded-lg bg-gray-100 border border-gray-200">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-xs font-bold text-gray-600">Net Settlement</p>
                                        <p className="text-[10px] text-gray-500">
                                            (COD - Taxi = {settlementCalc.difference >= 0 ? 'You pay' : 'You receive'})
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-lg font-bold ${settlementCalc.totalDebtBase >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            ${Math.abs(settlementCalc.totalDebtBase).toFixed(2)}
                                        </p>
                                        <p className="text-[10px] text-gray-500">Rate: 1 USD = {settlementCalc.exchangeRate.toLocaleString()} KHR</p>
                                    </div>
                                </div>
                            </div>

                            {/* Balance Check */}
                            <div className={`p-3 rounded-lg border flex justify-between items-center ${settlementCalc.isBalanced ? 'bg-green-50 border-green-200' :
                                settlementCalc.difference < 0 ? 'bg-orange-50 border-orange-200' :
                                    'bg-blue-50 border-blue-200'
                                }`}>
                                <div>
                                    <p className="text-xs text-gray-500">Total Value Provided (Est.)</p>
                                    <p className="font-bold text-gray-900">
                                        ${settlementCalc.totalProvidedBase.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500">Difference</p>
                                    <p className={`font-bold ${settlementCalc.isBalanced ? 'text-green-600' :
                                        settlementCalc.difference < 0 ? 'text-orange-600' :
                                            'text-blue-600'
                                        }`}>
                                        {settlementCalc.isBalanced ? '✓ Exact Match' :
                                            settlementCalc.difference < 0 ? `Shortage: ${settlementCalc.difference.toFixed(2)}` :
                                                `Overpayment: +${settlementCalc.difference.toFixed(2)}`}
                                    </p>
                                    <p className="text-[9px] text-gray-400 mt-0.5">
                                        {settlementCalc.isBalanced ? '' :
                                            settlementCalc.difference < 0 ? 'Remaining will be debt' :
                                                'Excess will be credit'}
                                    </p>
                                </div>
                            </div>

                            {/* Banking Info Display */}
                            {(settlementCalc.bankUSD > 0 || settlementCalc.bankKHR > 0) && (
                                <div className="mt-2 space-y-2">
                                    {settlementCalc.bankUSD > 0 && defaultBankUSD && (
                                        <div className="flex items-center gap-3 p-2 bg-blue-50 border border-blue-100 rounded-lg">
                                            {defaultBankUSD.qrCode && <img src={defaultBankUSD.qrCode} className="w-10 h-10 object-contain bg-white rounded" alt="QR" />}
                                            <div className="flex-1">
                                                <p className="text-xs text-blue-800 font-bold">Transfer USD to: {defaultBankUSD.name}</p>
                                                <p className="text-[10px] text-gray-500 font-mono">{defaultBankUSD.code}</p>
                                            </div>
                                        </div>
                                    )}
                                    {settlementCalc.bankKHR > 0 && defaultBankKHR && (
                                        <div className="flex items-center gap-3 p-2 bg-orange-50 border border-orange-100 rounded-lg">
                                            {defaultBankKHR.qrCode && <img src={defaultBankKHR.qrCode} className="w-10 h-10 object-contain bg-white rounded" alt="QR" />}
                                            <div className="flex-1">
                                                <p className="text-xs text-orange-800 font-bold">Transfer KHR to: {defaultBankKHR.name}</p>
                                                <p className="text-[10px] text-gray-500 font-mono">{defaultBankKHR.code}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {(settlementCalc.bankUSD > 0 || settlementCalc.bankKHR > 0) && (
                                <ImageUpload label={t('proof_of_transfer')} value={settleProof} onChange={setSettleProof} />
                            )}

                            {/* Reason field for shortage/overpayment */}
                            {!settlementCalc.isBalanced && (
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Reason (optional)</label>
                                    <textarea
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                        rows={2}
                                        placeholder={settlementCalc.difference < 0 ? 'Why are you settling less than owed?' : 'Why are you settling more than owed?'}
                                        value={settlementReason}
                                        onChange={e => setSettlementReason(e.target.value)}
                                    />
                                </div>
                            )}

                            <div className="flex gap-2 pt-2 border-t border-gray-100 mt-2">
                                <button
                                    onClick={() => setIsSettling(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50"
                                >
                                    {t('cancel')}
                                </button>
                                <Button
                                    onClick={handleSettlement}
                                    isLoading={isSaving}
                                    disabled={
                                        (!settlementCalc.isCreditBalance && settlementCalc.totalProvidedBase <= 0) ||
                                        ((settlementCalc.bankUSD > 0 || settlementCalc.bankKHR > 0) && !settleProof)
                                    }
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                                >
                                    {t('submit_request')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeChat && (
                <ChatModal
                    itemId={activeChat.itemId}
                    bookingId={activeChat.bookingId}
                    itemName={activeChat.itemName}
                    currentUser={user}
                    recipientName={activeChat.customerName}
                    recipientId={activeChat.customerUid}
                    onClose={() => setActiveChat(null)}
                />
            )}

            {zoomImage && (
                <div className="fixed inset-0 z-[60] bg-black bg-opacity-90 flex items-center justify-center p-4" onClick={() => setZoomImage(null)}>
                    <img src={zoomImage} alt="Zoom" className="max-w-full max-h-full rounded-lg" />
                </div>
            )}
        </div>
    );
};
