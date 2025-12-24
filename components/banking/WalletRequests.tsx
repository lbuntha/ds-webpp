
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

            const jeId = `je-wtxn-${Date.now()}`;

            // --- 1. GET DYNAMIC EXCHANGE RATE ---
            const currencyCode = (txn.currency || 'USD').toUpperCase();
            const isUSD = currencyCode === 'USD';

            let rate = 1;
            if (!isUSD) {
                const currencyConfig = currencies.find(c => c.code === currencyCode);
                // Robust check for rate
                if (currencyConfig && currencyConfig.exchangeRate > 0) {
                    rate = currencyConfig.exchangeRate;
                } else {
                    rate = 4100; // Safe fallback for KHR
                }
            }

            const safeAmount = Number(txn.amount);
            if (isNaN(safeAmount) || safeAmount <= 0) {
                throw new Error(`Invalid transaction amount: ${txn.amount}`);
            }

            const branchId = branches.length > 0 ? branches[0].id : 'b1';

            // --- 2. DETERMINE ACCOUNTS (PRIORITIZE MAPPED RULES) ---

            // Rule 4: Settle to Company
            const rule4AccId = settings.transactionRules ? settings.transactionRules['4'] : null;

            let settlementBankId = txn.bankAccountId;

            // If txn bank is generic 'system', try to use rule map or fallback settings
            if (!settlementBankId || settlementBankId === 'system' || settlementBankId === 'system-payout') {
                if (rule4AccId) {
                    settlementBankId = rule4AccId;
                } else {
                    settlementBankId = isUSD
                        ? (settings.defaultDriverSettlementBankIdUSD || settings.defaultDriverSettlementBankId)
                        : (settings.defaultDriverSettlementBankIdKHR || settings.defaultDriverSettlementBankId);
                }
            }

            if (!settlementBankId) {
                throw new Error(`Master Settlement Account for ${txn.currency} is not configured (Rule 4 or Settings).`);
            }

            // Verify bank account exists
            const bankAcc = accounts.find(a => a.id === settlementBankId);
            if (!bankAcc) throw new Error(`Bank Account ID ${settlementBankId} not found in Chart of Accounts.`);

            // Determine Wallet Liability Account based on currency settings
            // Rule 5: Settle to Customer (Wallet Liability)
            const rule5AccId = settings.transactionRules ? settings.transactionRules['5'] : null;

            let defaultDriverAccId = isUSD
                ? (settings.driverWalletAccountUSD || settings.defaultDriverWalletAccountId)
                : (settings.driverWalletAccountKHR || settings.defaultDriverWalletAccountId);

            let defaultCustAccId = rule5AccId
                ? rule5AccId
                : (isUSD ? (settings.customerWalletAccountUSD || settings.defaultCustomerWalletAccountId) : (settings.customerWalletAccountKHR || settings.defaultCustomerWalletAccountId));

            // Fallback to User Profile override if exists (Legacy support)
            const userProfile = await firebaseService.getDocument('users', txn.userId) as any;
            if (userProfile && userProfile.walletAccountId) {
                if (userProfile.role === 'driver') defaultDriverAccId = userProfile.walletAccountId;
                if (userProfile.role === 'customer') defaultCustAccId = userProfile.walletAccountId;
            }

            // Final Fallback to hardcoded codes if completely missing
            if (!defaultCustAccId) defaultCustAccId = accounts.find(a => a.code === (isUSD ? '3200002' : '3200001'))?.id;
            if (!defaultDriverAccId) defaultDriverAccId = accounts.find(a => a.code === (isUSD ? '3210102' : '3210101'))?.id;

            // Rule 13: VAT Output
            const rule13AccId = settings.transactionRules ? settings.transactionRules['13'] : null;
            const defaultTaxAccId = rule13AccId || accounts.find(a => a.code === (isUSD ? '3333002' : '3333001'))?.id;

            // Rule 10: Commission Expense
            const rule10AccId = settings.transactionRules ? settings.transactionRules['10'] : null;

            let jeLines: any[] = [];

            // Calculate Base Amount safely
            const baseAmountRaw = safeAmount / rate;
            const baseAmount = Number(baseAmountRaw.toFixed(2)); // Round to 2 decimals

            if (isNaN(baseAmount)) {
                throw new Error("Calculated base amount is NaN. Check exchange rate.");
            }

            // --- 3. BUILD ACCOUNTING ENTRIES ---

            if (txn.type === 'WITHDRAWAL') {
                if (!defaultCustAccId) throw new Error("Customer Wallet Liability account is not configured.");

                jeLines.push({
                    accountId: defaultCustAccId,
                    debit: baseAmount,
                    credit: 0,
                    originalCurrency: txn.currency,
                    originalExchangeRate: rate,
                    originalDebit: safeAmount,
                    originalCredit: 0,
                    description: `Payout to ${txn.userName}`
                });

                jeLines.push({
                    accountId: settlementBankId,
                    debit: 0,
                    credit: baseAmount,
                    originalCurrency: txn.currency,
                    originalExchangeRate: rate,
                    originalDebit: 0,
                    originalCredit: safeAmount,
                    description: `Withdrawal via ${txn.currency}`
                });

            }
            else if (txn.type === 'SETTLEMENT') {
                if (!defaultCustAccId) throw new Error("Customer Wallet Liability account is missing.");

                let totalRevenueUSD = 0;
                let totalTaxUSD = 0;
                let totalCommissionUSD = 0;
                let totalProductPriceUSD = 0;

                const revenueByAccount: Record<string, number> = {};
                const taxByAccount: Record<string, number> = {};
                const commissionByAccount: Record<string, number> = {};

                const driverEmp = employees.find(e => e.linkedUserId === txn.userId);
                const driverZone = driverEmp?.zone;
                const defaultRule = commissionRules.find(r => r.isDefault);
                const rule = commissionRules.find(r => r.zoneName === driverZone) || defaultRule || { type: 'PERCENTAGE', value: 70 };

                // --- GLOBAL REVENUE & TAX ACCOUNTS ---
                const globalRevAccId = isUSD
                    ? (settings.defaultRevenueAccountUSD || settings.defaultRevenueAccountId)
                    : (settings.defaultRevenueAccountKHR || settings.defaultRevenueAccountId);

                const globalTaxAccId = isUSD
                    ? (settings.defaultTaxAccountUSD || settings.defaultTaxAccountId)
                    : (settings.defaultTaxAccountKHR || settings.defaultTaxAccountId);

                // Check Customer Tax Status
                const isCustomerTaxable = userProfile?.isTaxable === true;

                if (txn.relatedItems && txn.relatedItems.length > 0) {
                    txn.relatedItems.forEach(rel => {
                        const booking = bookings.find(b => b.id === rel.bookingId);
                        if (booking) {
                            const totalItems = (booking.items && booking.items.length > 0) ? booking.items.length : 1;
                            const bookingFeeRaw = booking.totalDeliveryFee || 0;

                            // Determine item's native currency and rate
                            const item = booking.items?.find(i => i.id === rel.itemId);
                            const itemPrice = Number(item?.productPrice) || 0;
                            const isItemKHR = item?.codCurrency === 'KHR';

                            // Rate for this item
                            let itemRate = 1;
                            if (isItemKHR) {
                                const cConfig = currencies.find(c => c.code === 'KHR');
                                itemRate = cConfig ? cConfig.exchangeRate : 4000;
                            }
                            const bookingPriceUSD = round2(itemPrice / itemRate);
                            totalProductPriceUSD = round2(totalProductPriceUSD + bookingPriceUSD);

                            // Booking-wide Fee/Tax Conversion
                            const isBookingKHR = booking.currency === 'KHR';
                            let bookingRate = 1;
                            if (isBookingKHR) {
                                const cConfig = currencies.find(c => c.code === 'KHR');
                                bookingRate = cConfig ? cConfig.exchangeRate : 4000;
                            }

                            const bookingFeeBase = bookingFeeRaw / bookingRate;
                            const bookingTaxRaw = isCustomerTaxable ? (booking.taxAmount || 0) : 0;
                            const bookingTaxBase = bookingTaxRaw / bookingRate;
                            const bookingRevenueBase = bookingFeeBase - bookingTaxBase;

                            // 4. Commission Calculation
                            const pRule = getApplicableCommissionRule(driverEmp, 'PICKUP', commissionRules);

                            const pickupCommTotal = round2(calculateDriverCommission(driverEmp, booking, 'PICKUP', commissionRules));
                            const deliveryCommTotal = round2(calculateDriverCommission(driverEmp, booking, 'DELIVERY', commissionRules));

                            // Pro-rate Delivery
                            const deliveryCommItem = round2(deliveryCommTotal / totalItems);

                            // Pickup (Per Item if Fixed, Pro-rated if Percentage)
                            let pickupCommItem = 0;
                            if (pRule?.type === 'FIXED_AMOUNT') {
                                pickupCommItem = pickupCommTotal;
                            } else {
                                pickupCommItem = round2(pickupCommTotal / totalItems);
                            }

                            // Attribution Logic
                            const mods = item?.modifications || [];
                            const pickupMod = mods.find(m => m.newValue === 'PICKED_UP');
                            const pickupDriverUid = pickupMod?.userId || booking.driverId;

                            // Track who gets what
                            const dlvDriverUid = txn.userId; // The settling driver

                            // Find accounts
                            const getWalletAcc = (uid: string) => {
                                const emp = employees.find(e => e.linkedUserId === uid);
                                if (emp?.walletAccountId) return emp.walletAccountId;
                                // Fallback to fetching it or using default
                                return defaultDriverAccId;
                            };

                            const pAcc = getWalletAcc(pickupDriverUid || '');
                            const dAcc = getWalletAcc(dlvDriverUid);

                            if (pAcc) {
                                commissionByAccount[pAcc] = round2((commissionByAccount[pAcc] || 0) + pickupCommItem);
                            }
                            if (dAcc) {
                                commissionByAccount[dAcc] = round2((commissionByAccount[dAcc] || 0) + deliveryCommItem);
                            }

                            totalCommissionUSD = round2(totalCommissionUSD + pickupCommItem + deliveryCommItem);

                            // REVENUE ACCUMULATION
                            if (globalRevAccId) {
                                const itemRev = round2(bookingRevenueBase / totalItems);
                                revenueByAccount[globalRevAccId] = round2((revenueByAccount[globalRevAccId] || 0) + itemRev);
                                totalRevenueUSD = round2(totalRevenueUSD + itemRev);
                            }

                            // TAX ACCUMULATION
                            if (bookingTaxBase > 0 && globalTaxAccId) {
                                const itemTax = round2(bookingTaxBase / totalItems);
                                taxByAccount[globalTaxAccId] = round2((taxByAccount[globalTaxAccId] || 0) + itemTax);
                                totalTaxUSD = round2(totalTaxUSD + itemTax);
                            }
                        }
                    });
                }

                // --- PRE-CALCULATION For Settlement/Payout ---
                const commBase = Number(totalCommissionUSD.toFixed(2));

                // Determine Expense Account (Shared logic)
                let expAccId = rule10AccId;
                if (!expAccId) {
                    expAccId = isUSD ? settings.driverCommissionExpenseAccountUSD : settings.driverCommissionExpenseAccountKHR;
                }
                let expAcc = null;
                if (expAccId) {
                    expAcc = accounts.find(a => a.id === expAccId);
                } else {
                    const targetCode = isUSD ? '6501002' : '6501001';
                    expAcc = accounts.find(a => a.code === targetCode || a.name.includes('Commission'));
                }

                // Helper to find driver wallet
                const getWalletAcc = (uid: string) => {
                    const emp = employees.find(e => e.linkedUserId === uid);
                    if (emp?.walletAccountId) return emp.walletAccountId;
                    return defaultDriverAccId;
                };

                // --- BALANCING / PAYOUT LOGIC ---
                if (userProfile?.role === 'customer') {
                    // --- CUSTOMER PAYOUT (Money OUT) ---

                    // A. REVENUE & TAX (Credit)
                    if (globalRevAccId) {
                        jeLines.push({
                            accountId: globalRevAccId, debit: 0, credit: totalRevenueUSD,
                            originalCurrency: 'USD', originalExchangeRate: 1, originalDebit: 0, originalCredit: totalRevenueUSD,
                            description: 'Delivery Income'
                        });
                    }
                    if (globalTaxAccId) {
                        jeLines.push({
                            accountId: globalTaxAccId, debit: 0, credit: totalTaxUSD,
                            originalCurrency: 'USD', originalExchangeRate: 1, originalDebit: 0, originalCredit: totalTaxUSD,
                            description: 'Tax Payable'
                        });
                    }

                    // B. CASH PAYOUT (Credit Bank)
                    jeLines.push({
                        accountId: settlementBankId,
                        debit: 0,
                        credit: baseAmount,
                        originalCurrency: txn.currency,
                        originalExchangeRate: rate,
                        originalDebit: 0,
                        originalCredit: safeAmount,
                        description: `Payout to ${txn.userName}`
                    });

                    // C. DRIVER OFFSET (Debit Driver for Gross COD)
                    const driversToDebit: Record<string, number> = {};
                    if (txn.relatedItems) {
                        txn.relatedItems.forEach(rel => {
                            const booking = bookings.find(b => b.id === rel.bookingId);
                            const item = booking?.items?.find(i => i.id === rel.itemId);
                            if (item) {
                                const collectorId = booking?.driverId || item.driverId;
                                const itemCOD = Number(item.productPrice) || 0;
                                let itemCODUSD = itemCOD;
                                if (item.codCurrency === 'KHR') {
                                    itemCODUSD = itemCOD / 4100;
                                }

                                const wAcc = getWalletAcc(collectorId || '');
                                if (wAcc) {
                                    driversToDebit[wAcc] = (driversToDebit[wAcc] || 0) + itemCODUSD;
                                }
                            }
                        });
                    }

                    Object.entries(driversToDebit).forEach(([accId, amount]) => {
                        jeLines.push({
                            accountId: accId, debit: amount, credit: 0,
                            originalCurrency: 'USD', originalExchangeRate: 1, originalDebit: amount, originalCredit: 0,
                            description: 'COD Collection Receivable'
                        });
                    });

                    // D. COMMISSION EXPENSE (Debit) & PAYABLE (Credit)
                    if (expAcc && totalCommissionUSD > 0) {
                        const isExpKHR = expAcc.currency === 'KHR';
                        const expAmountNative = Number((isExpKHR ? (commBase * rate) : commBase).toFixed(2));
                        const expCurrency = isExpKHR ? 'KHR' : 'USD';
                        const expRate = isExpKHR ? rate : 1;

                        jeLines.push({
                            accountId: expAcc.id, debit: commBase, credit: 0,
                            originalCurrency: expCurrency, originalExchangeRate: expRate, originalDebit: expAmountNative, originalCredit: 0,
                            description: 'Driver Commissions'
                        });

                        Object.entries(commissionByAccount).forEach(([accId, amount]) => {
                            if (amount > 0) {
                                jeLines.push({
                                    accountId: accId, debit: 0, credit: amount,
                                    originalCurrency: 'USD', originalExchangeRate: 1, originalDebit: 0, originalCredit: amount,
                                    description: 'Commission Earning'
                                });
                            }
                        });
                    }

                    // E. BALANCING (Customer Wallet Pass-Through)
                    jeLines.push({
                        accountId: defaultCustAccId, debit: 0, credit: baseAmount,
                        originalCurrency: 'USD', originalExchangeRate: 1, originalDebit: 0, originalCredit: safeAmount,
                        description: 'Net COD Liability'
                    });
                    jeLines.push({
                        accountId: defaultCustAccId, debit: baseAmount, credit: 0,
                        originalCurrency: 'USD', originalExchangeRate: 1, originalDebit: safeAmount, originalCredit: 0,
                        description: 'Payout Clearance'
                    });

                } else {
                    // --- DRIVER SETTLEMENT LOGIC (Money IN - STANDARD) ---
                    jeLines.push({
                        accountId: settlementBankId,
                        debit: baseAmount,
                        credit: 0,
                        originalCurrency: txn.currency,
                        originalExchangeRate: rate,
                        originalDebit: safeAmount,
                        originalCredit: 0,
                        description: `Settlement: ${txn.description || 'Payment'}`
                    });

                    if (txn.relatedItems && txn.relatedItems.length > 0) {
                        // a) Revenue
                        Object.entries(revenueByAccount).forEach(([accId, amountUSD]) => {
                            if (amountUSD > 0) {
                                jeLines.push({
                                    accountId: accId, debit: 0, credit: Number(amountUSD.toFixed(2)),
                                    originalCurrency: 'USD', originalExchangeRate: 1, originalDebit: 0, originalCredit: Number(amountUSD.toFixed(2)),
                                    description: 'Delivery Income'
                                });
                            }
                        });

                        // b) Tax
                        Object.entries(taxByAccount).forEach(([accId, amountUSD]) => {
                            if (amountUSD > 0) {
                                jeLines.push({
                                    accountId: accId, debit: 0, credit: Number(amountUSD.toFixed(2)),
                                    originalCurrency: 'USD', originalExchangeRate: 1, originalDebit: 0, originalCredit: Number(amountUSD.toFixed(2)),
                                    description: 'Tax Payable'
                                });
                            }
                        });

                        // c) Customer Wallet (Liability)
                        const netCustomerLiabilityBase = Number(totalProductPriceUSD.toFixed(2));
                        if (netCustomerLiabilityBase > 0) {
                            jeLines.push({
                                accountId: defaultCustAccId, debit: 0, credit: netCustomerLiabilityBase,
                                originalCurrency: 'USD', originalExchangeRate: 1, originalDebit: 0, originalCredit: netCustomerLiabilityBase,
                                description: 'Net COD Payable'
                            });
                        }

                        // d) Balance with Driver Wallet
                        const totalCreditsBase = round2(totalRevenueUSD + totalTaxUSD + totalProductPriceUSD);
                        const balancingAmountBase = round2(totalCreditsBase - baseAmount);
                        if (Math.abs(balancingAmountBase) > 0.001) {
                            jeLines.push({
                                accountId: defaultDriverAccId,
                                debit: balancingAmountBase > 0 ? balancingAmountBase : 0,
                                credit: balancingAmountBase < 0 ? Math.abs(balancingAmountBase) : 0,
                                originalCurrency: 'USD',
                                originalExchangeRate: 1,
                                originalDebit: balancingAmountBase > 0 ? balancingAmountBase : 0,
                                originalCredit: balancingAmountBase < 0 ? Math.abs(balancingAmountBase) : 0,
                                description: balancingAmountBase > 0 ? 'Settlement Offset (Partial)' : 'Settlement Overpayment'
                            });
                        }
                    } else {
                        // CONTRIBUTOR TRANSACTION
                        jeLines.push({
                            accountId: defaultDriverAccId,
                            debit: 0,
                            credit: baseAmount,
                            originalCurrency: txn.currency,
                            originalExchangeRate: rate,
                            originalDebit: 0,
                            originalCredit: safeAmount,
                            description: 'Wallet Credit (Settlement Partial)'
                        });
                    }

                    // 5. Driver Commission (Using shared variables)
                    if (totalCommissionUSD > 0 && expAcc) {
                        const isExpKHR = expAcc.currency === 'KHR';
                        const expAmountNative = Number((isExpKHR ? (commBase * rate) : commBase).toFixed(2));
                        const expCurrency = isExpKHR ? 'KHR' : 'USD';
                        const expRate = isExpKHR ? rate : 1;

                        jeLines.push({
                            accountId: expAcc.id,
                            debit: commBase,
                            credit: 0,
                            originalCurrency: expCurrency,
                            originalExchangeRate: expRate,
                            originalDebit: expAmountNative,
                            originalCredit: 0,
                            description: `Driver Commissions Expense (Total)`
                        });

                        Object.entries(commissionByAccount).forEach(([accId, amountUSD]) => {
                            if (amountUSD > 0) {
                                jeLines.push({
                                    accountId: accId,
                                    debit: 0,
                                    credit: amountUSD,
                                    originalCurrency: 'USD',
                                    originalExchangeRate: 1,
                                    originalDebit: 0,
                                    originalCredit: amountUSD,
                                    description: `Commission Payable`
                                });
                            }
                        });
                    }
                }
            }
            else if (txn.type === 'DEPOSIT') {
                const isDriverTxn = userProfile?.role === 'driver';
                const targetWalletAccId = isDriverTxn ? defaultDriverAccId : defaultCustAccId;

                if (!targetWalletAccId) throw new Error(`${isDriverTxn ? 'Driver' : 'Customer'} Wallet Account is not configured in Settings.`);

                jeLines.push({
                    accountId: settlementBankId,
                    debit: baseAmount,
                    credit: 0,
                    originalCurrency: txn.currency,
                    originalExchangeRate: rate,
                    originalDebit: safeAmount,
                    originalCredit: 0,
                    description: `Deposit via ${bankAcc?.name || 'Bank'}`
                });

                jeLines.push({
                    accountId: targetWalletAccId,
                    debit: 0,
                    credit: baseAmount,
                    originalCurrency: txn.currency,
                    originalExchangeRate: rate,
                    originalDebit: 0,
                    originalCredit: safeAmount,
                    description: 'Wallet Credit'
                });
            }

            // Final Line Sanitization
            const finalJeLines = jeLines.map(l => ({
                ...l,
                debit: Number(l.debit) || 0,
                credit: Number(l.credit) || 0,
                originalDebit: Number(l.originalDebit) || 0,
                originalCredit: Number(l.originalCredit) || 0
            })).filter(l => l.debit > 0.001 || l.credit > 0.001);

            if (finalJeLines.length === 0) {
                throw new Error(`Accounting Logic Error: Transaction amount is ${safeAmount} but Journal Entry lines are empty/zero.`);
            }

            const entry: JournalEntry = {
                id: jeId,
                date: new Date().toISOString().split('T')[0],
                description: `${txn.type}: ${txn.userName}`,
                reference: `WTX-${(txn.id || '').slice(-6)}`,
                branchId,
                currency: txn.currency,
                exchangeRate: rate,
                originalTotal: safeAmount,
                createdAt: Date.now(),
                lines: finalJeLines
            };
            await firebaseService.addTransaction(entry);

            const linkedJeId = finalJeLines.length > 0 ? jeId : undefined;
            await firebaseService.approveWalletTransaction(txn.id, currentUser?.uid || 'system', linkedJeId);

            if (txn.relatedItems && txn.relatedItems.length > 0) {
                const parcelItems = txn.relatedItems.filter(i => i.itemId !== 'invoice');
                if (parcelItems.length > 0) {
                    await firebaseService.settleParcelItems(parcelItems);
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
        } catch (e: any) {
            console.error(e);
            toast.error("Transaction Failed: " + e.message);
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
