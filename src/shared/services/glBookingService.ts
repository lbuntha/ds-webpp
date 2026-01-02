import { JournalEntry, JournalEntryLine, Account, ParcelBooking, DriverCommissionRule, Employee, SystemSettings, CurrencyConfig } from '../types';
import { calculateDriverCommission, getApplicableCommissionRule } from '../utils/commissionCalculator';

export interface GLBookingParams {
    transactionType: 'DEPOSIT' | 'WITHDRAWAL' | 'SETTLEMENT' | 'EARNING' | 'REFUND';
    userId: string;
    userName: string;
    userRole: 'customer' | 'driver';
    amount: number;
    currency: 'USD' | 'KHR';
    relatedItems?: { bookingId: string; itemId: string }[];
    bankAccountId: string;
    description?: string;
    branchId: string;
}

export interface GLPreviewResult {
    isValid: boolean;
    totalDebit: number;
    totalCredit: number;
    difference: number;
    lines: JournalEntryLine[];
    errors: string[];
    warnings: string[];
}

export interface AccountContext {
    accounts: Account[];
    settings: SystemSettings;
    employees: Employee[];
    commissionRules: DriverCommissionRule[];
    bookings: ParcelBooking[];
    currencies: CurrencyConfig[];
}

export class GLBookingService {

    private static round2(val: number) {
        return Math.round((val + Number.EPSILON) * 100) / 100;
    }

    /**
     * Preview GL Entry (No Save)
     */
    static async previewGLEntry(
        params: GLBookingParams,
        context: AccountContext
    ): Promise<GLPreviewResult> {
        const { accounts, settings, employees, commissionRules, bookings, currencies } = context;
        const lines: JournalEntryLine[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];

        // 1. Exchange Rate Lookup
        const currencyCode = params.currency.toUpperCase();
        let rate = 1;
        if (currencyCode !== 'USD') {
            const config = currencies.find(c => c.code === currencyCode);
            rate = config ? config.exchangeRate : 4000;
        }

        const safeAmount = Number(params.amount);
        const baseAmount = Number((safeAmount / rate).toFixed(2));

        // 2. Account Lookup Helper
        const getAccount = (id: string | undefined): Account | undefined => {
            if (!id) return undefined;
            return accounts.find(a => a.id === id);
        };

        const getAccountByCode = (code: string): Account | undefined => {
            return accounts.find(a => a.code === code);
        };

        // 3. Logic by Type
        if (params.transactionType === 'DEPOSIT') {
            // DEPOSIT: Bank (Dr) / Wallet Liab (Cr)
            const bankAcc = getAccount(params.bankAccountId);
            if (!bankAcc) errors.push(`Bank Account ${params.bankAccountId} not found`);

            const walletAccId = params.userRole === 'driver'
                ? (params.currency === 'USD' ? settings.driverWalletAccountUSD : settings.driverWalletAccountKHR)
                : (params.currency === 'USD' ? settings.customerWalletAccountUSD : settings.customerWalletAccountKHR);
            const walletAcc = getAccount(walletAccId) || getAccount(params.userRole === 'driver' ? settings.defaultDriverWalletAccountId : settings.defaultCustomerWalletAccountId);

            if (!walletAcc) errors.push(`${params.userRole} Wallet Liability Account not found`);

            if (bankAcc && walletAcc) {
                // Dr Bank
                lines.push({
                    accountId: bankAcc.id,
                    debit: baseAmount, credit: 0,
                    originalCurrency: params.currency, originalExchangeRate: rate,
                    originalDebit: safeAmount, originalCredit: 0,
                    description: `Deposit via ${bankAcc.name}`
                });
                // Cr Wallet
                lines.push({
                    accountId: walletAcc.id,
                    debit: 0, credit: baseAmount,
                    originalCurrency: params.currency, originalExchangeRate: rate,
                    originalDebit: 0, originalCredit: safeAmount,
                    description: `Wallet Credit (${params.userName})`
                });
            }

        } else if (params.transactionType === 'WITHDRAWAL') {
            // WITHDRAWAL: Wallet Liab (Dr) / Bank (Cr)
            const bankAcc = getAccount(params.bankAccountId);
            if (!bankAcc) errors.push(`Bank Account ${params.bankAccountId} not found`);

            const walletAccId = params.userRole === 'driver'
                ? (params.currency === 'USD' ? settings.driverWalletAccountUSD : settings.driverWalletAccountKHR)
                : (params.currency === 'USD' ? settings.customerWalletAccountUSD : settings.customerWalletAccountKHR);
            const walletAcc = getAccount(walletAccId) || getAccount(params.userRole === 'driver' ? settings.defaultDriverWalletAccountId : settings.defaultCustomerWalletAccountId);

            if (!walletAcc) errors.push(`${params.userRole} Wallet Liability Account not found`);

            if (bankAcc && walletAcc) {
                // Dr Wallet
                lines.push({
                    accountId: walletAcc.id,
                    debit: baseAmount, credit: 0,
                    originalCurrency: params.currency, originalExchangeRate: rate,
                    originalDebit: safeAmount, originalCredit: 0,
                    description: `Wallet Debit (${params.userName})`
                });
                // Cr Bank
                lines.push({
                    accountId: bankAcc.id,
                    debit: 0, credit: baseAmount,
                    originalCurrency: params.currency, originalExchangeRate: rate,
                    originalDebit: 0, originalCredit: safeAmount,
                    description: `Withdrawal via ${bankAcc.name}`
                });
            }

        } else if (params.transactionType === 'SETTLEMENT') {
            if (params.userRole === 'customer') {
                // Customer Settlement (Payout): Wallet Liab (Dr) / Bank (Cr)
                // Same logic as Withdrawal essentially
                const bankAcc = getAccount(params.bankAccountId);
                const walletAccId = params.currency === 'USD' ? settings.customerWalletAccountUSD : settings.customerWalletAccountKHR;
                const walletAcc = getAccount(walletAccId) || getAccount(settings.defaultCustomerWalletAccountId);

                if (!bankAcc) errors.push("Settlement Bank Account not found");
                if (!walletAcc) errors.push("Customer Wallet Account not found");

                if (bankAcc && walletAcc) {
                    lines.push({
                        accountId: walletAcc.id,
                        debit: baseAmount, credit: 0,
                        originalCurrency: params.currency, originalExchangeRate: rate,
                        originalDebit: safeAmount, originalCredit: 0,
                        description: `Payout to ${params.userName}`
                    });
                    lines.push({
                        accountId: bankAcc.id,
                        debit: 0, credit: baseAmount,
                        originalCurrency: params.currency, originalExchangeRate: rate,
                        originalDebit: 0, originalCredit: safeAmount,
                        description: `Settlement Payout`
                    });
                }

            } else {
                // --- DRIVER SETTLEMENT (Direct Fee Split) ---

                // 1. Validate Currency Matching (Strict Block)
                // We check the items being settled. If any are in mismatched currency, we block or warn. 
                // However, 'relatedItems' only gives ID. We need to look up bookings.

                // Fetch relevant items
                const settleItems: { bookingId: string, itemId: string, item: any, booking: ParcelBooking }[] = [];
                if (params.relatedItems) {
                    params.relatedItems.forEach(ri => {
                        const b = bookings.find(bk => bk.id === ri.bookingId);
                        const i = b?.items?.find(it => it.id === ri.itemId);
                        if (b && i) settleItems.push({ bookingId: ri.bookingId, itemId: ri.itemId, item: i, booking: b });
                    });
                }

                // Check for mismatched currency in debt
                // Debt currency is determined by codCurrency of the items
                const mismatchedItems = settleItems.filter(si => (si.item.codCurrency || 'USD') !== params.currency);
                if (mismatchedItems.length > 0) {
                    errors.push(`Strict Currency Matching Block: You are settling ${params.currency} but ${mismatchedItems.length} items are in ${mismatchedItems[0].item.codCurrency}. Please create separate requests.`);
                }

                if (errors.length === 0) {
                    // Proceed with GL Construction

                    // A. Dr Cash (Full Amount Paid)
                    const bankAcc = getAccount(params.bankAccountId);
                    if (bankAcc) {
                        lines.push({
                            accountId: bankAcc.id,
                            debit: baseAmount, credit: 0,
                            originalCurrency: params.currency, originalExchangeRate: rate,
                            originalDebit: safeAmount, originalCredit: 0,
                            description: `Settlement Received from ${params.userName}`
                        });
                    } else {
                        errors.push("Settlement Bank Account not found");
                    }

                    // Calculate Totals for Credits
                    let totalCodLiability = 0;
                    let totalGrossRevenue = 0; // Gross Fee
                    let totalCommExpense = 0;  // Gross Commission

                    const commissionByDriver: Record<string, number> = {}; // driverId -> amount

                    // Accounts
                    const custLiabAccId = params.currency === 'USD' ? settings.customerWalletAccountUSD : settings.customerWalletAccountKHR;
                    const custLiabAcc = getAccount(custLiabAccId) || getAccount(settings.defaultCustomerWalletAccountId);

                    const revAccId = params.currency === 'USD' ? settings.defaultRevenueAccountUSD : settings.defaultRevenueAccountKHR;
                    const revAcc = getAccount(revAccId) || getAccount(settings.defaultRevenueAccountId);

                    // Expense Account
                    const expAccId = params.currency === 'USD' ? settings.driverCommissionExpenseAccountUSD : settings.driverCommissionExpenseAccountKHR;
                    // Fallback to generic expense or assume configured
                    const expAcc = getAccount(expAccId) || accounts.find(a => a.type === 'Expense' && (a.code === '601001' || a.name.includes('Commission')));

                    if (!custLiabAcc) errors.push("Customer Wallet Account not found");
                    if (!revAcc) errors.push("Revenue Account not found");
                    if (!expAcc) warnings.push("Commission Expense Account not found (using Revenue offset if needed, but not ideal)");

                    // Lookup Standard Market Rate for Conversions (USD <-> KHR)
                    const khrConfig = currencies.find(c => c.code === 'KHR');
                    const marketRate = khrConfig ? khrConfig.exchangeRate : 4000;

                    const convertToSettlementCurrency = (val: number, fromCurr: string) => {
                        const toCurr = params.currency;
                        if (fromCurr === toCurr) return val;
                        if (fromCurr === 'USD' && toCurr === 'KHR') return val * marketRate;
                        if (fromCurr === 'KHR' && toCurr === 'USD') return val / marketRate;
                        return val; // Should not happen with current strict pairs
                    };

                    // Loop items to build split
                    settleItems.forEach(si => {
                        const { booking, item } = si;

                        // 1. Resolve Item Amounts to Settlement Currency
                        // Fix: Determine currency from item first, fall back to booking
                        const bookingCurrency = booking.currency || 'USD';
                        const itemFeeCurrency = item.deliveryFee !== undefined
                            ? (item.codCurrency || bookingCurrency)
                            : bookingCurrency;

                        // Robust Fee Logic
                        let itemFeeRaw = Number(item.deliveryFee) || 0;
                        const totalItems = booking.items?.length || 1;
                        if (itemFeeRaw === 0 && (booking.totalDeliveryFee || 0) > 0) {
                            // Fallback to pro-rated total if item fee is missing
                            itemFeeRaw = (booking.totalDeliveryFee || 0) / totalItems;
                            // Converting raw total (in booking curr) to item share implies booking currency
                            // But we stick to detected itemFeeCurrency logic? 
                            // If we fall back to booking total, we must use booking currency
                            if (item.deliveryFee === undefined) {
                                // Force booking currency if we used booking total
                                // (Logic handled by itemFeeCurrency default above, but strictly:)
                                // itemFeeCurrency = bookingCurrency; 
                            }
                        }

                        // Convert to Settlement Currency
                        const itemFee = this.round2(convertToSettlementCurrency(itemFeeRaw, itemFeeCurrency));

                        const itemCODRaw = Number(item.productPrice) || 0;
                        const itemCODCurrency = item.codCurrency || bookingCurrency;
                        const itemCOD = this.round2(convertToSettlementCurrency(itemCODRaw, itemCODCurrency));

                        // Commissions (Per Item Calculation)
                        // Use itemFee as basis. This works for Percentage (itemFee * %)
                        // works for Fixed (returns fixed amount in target currency)

                        // 1. Pickup Comm
                        const pDriverId = booking.driverId; // Pickup driver
                        const pDriverEmp = employees.find(e => e.linkedUserId === pDriverId);
                        // Pass 'itemFee' and 'params.currency' (settlement/target)
                        let pCommItem = calculateDriverCommission(pDriverEmp, booking, 'PICKUP', commissionRules, itemFee, params.currency, marketRate);

                        // Fix for Percentage Rule returning Source Currency vs Fixed returning Target
                        const pRule = getApplicableCommissionRule(pDriverEmp, 'PICKUP', commissionRules);
                        if (pRule?.type === 'PERCENTAGE') {
                            // Percentage result is in itemFeeCurrency (converted to current numbers? No calculated on converted fee)
                            // Actually calculateDriverCommission returns (basis * %). 
                            // Since 'basis' (itemFee) is already in Settlement Currency, the result is in Settlement Currency.
                            // So NO Valid conversion needed here if basis is correct.
                        }

                        // 2. Delivery Comm
                        const dDriverId = item.driverId || item.delivererId;
                        const dDriverEmp = employees.find(e => e.linkedUserId === dDriverId);
                        let dCommItem = calculateDriverCommission(dDriverEmp, booking, 'DELIVERY', commissionRules, itemFee, params.currency, marketRate);


                        if (pDriverId && pCommItem > 0) {
                            commissionByDriver[pDriverId] = (commissionByDriver[pDriverId] || 0) + pCommItem;
                        }
                        if (dDriverId && dCommItem > 0) {
                            commissionByDriver[dDriverId] = (commissionByDriver[dDriverId] || 0) + dCommItem;
                        }

                        // 4. Taxi Fee Logic (Paid by Driver)
                        // User Context: "taxiFee is not revenue to doorstep and driver. It is to third party. and the amount should deduct from customer."
                        // Implementation:
                        // 1. Deduct from Merchant/Customer Payout (customerNet)
                        // 2. Credit Driver (Reimbursement for paying the 3rd party taxi)
                        // 3. No impact on Company Revenue or Expense (Pass-through)

                        let taxiFeeVal = 0;
                        if (item.isTaxiDelivery && item.taxiFee && item.taxiFee > 0) {
                            const taxiFeeRaw = item.taxiFee;
                            const taxiFeeCurrency = item.taxiFeeCurrency || 'USD';
                            taxiFeeVal = this.round2(convertToSettlementCurrency(taxiFeeRaw, taxiFeeCurrency));


                            // Credit Driver (Reimbursement)
                            // User Request: "Do not book accounting entries for taxi fee".
                            // Logic: 
                            // 1. We Deduct from Customer Net (below).
                            // 2. We DO NOT add a Credit Line here.
                            // 3. This reduces Total Credits. 
                            // 4. Driver pays less Cash (Debit Side).
                            // 5. Result: Debits (Lower Cash) = Credits (Lower Payable). Balances perfectly without extra entries.
                        }


                        // 3. Gross Calculation
                        // Net Payable to Customer = COD - Gross Fee - Taxi Fee (Merchant Pays)
                        const customerNet = this.round2(itemCOD - itemFee - taxiFeeVal);

                        // Gross Revenue = Fee
                        const grossRev = itemFee;

                        // Expense = Commissions
                        const totalComm = this.round2(pCommItem + dCommItem);

                        // Aggregate
                        totalCodLiability += customerNet;
                        totalGrossRevenue += grossRev;
                        totalCommExpense += totalComm;

                        if (pDriverId && pCommItem > 0) {
                            commissionByDriver[pDriverId] = (commissionByDriver[pDriverId] || 0) + pCommItem;
                        }
                        if (dDriverId && dCommItem > 0) {
                            commissionByDriver[dDriverId] = (commissionByDriver[dDriverId] || 0) + dCommItem;
                        }

                    });

                    // B. Cr Customer Liability (COD - Fee)
                    if (custLiabAcc && totalCodLiability > 0) {
                        const baseVal = this.round2(totalCodLiability / rate);
                        lines.push({
                            accountId: custLiabAcc.id,
                            debit: 0, credit: baseVal,
                            originalCurrency: params.currency, originalExchangeRate: rate,
                            originalDebit: 0, originalCredit: totalCodLiability,
                            description: `COD Payable (Net)`
                        });
                    }

                    // C. Cr Revenue (Gross)
                    if (revAcc && totalGrossRevenue > 0) {
                        const baseVal = this.round2(totalGrossRevenue / rate);
                        lines.push({
                            accountId: revAcc.id,
                            debit: 0, credit: baseVal,
                            originalCurrency: params.currency, originalExchangeRate: rate,
                            originalDebit: 0, originalCredit: totalGrossRevenue,
                            description: `Service Revenue (Gross)`
                        });
                    }

                    // D. Dr Commission Expense
                    if (expAcc && totalCommExpense > 0) {
                        const baseVal = this.round2(totalCommExpense / rate);
                        lines.push({
                            accountId: expAcc.id,
                            debit: baseVal, credit: 0,
                            originalCurrency: params.currency, originalExchangeRate: rate,
                            originalDebit: totalCommExpense, originalCredit: 0,
                            description: `Commission Expense`
                        });
                    }

                    // E. Cr Driver Wallets (Commissions Payable)
                    Object.entries(commissionByDriver).forEach(([driverId, amount]) => {
                        const drEmp = employees.find(e => e.linkedUserId === driverId);
                        const drWalletId = drEmp?.walletAccountId || settings.defaultDriverWalletAccountId;
                        const drWallet = getAccount(drWalletId);

                        if (drWallet) {
                            const baseVal = this.round2(amount / rate);
                            lines.push({
                                accountId: drWallet.id,
                                debit: 0, credit: baseVal,
                                originalCurrency: params.currency, originalExchangeRate: rate,
                                originalDebit: 0, originalCredit: amount,
                                description: `Commission Credit`
                            });
                        } else {
                            errors.push(`Wallet Account for Driver ${driverId} not found`);
                        }
                    });

                    // F. Balancing (Shortage/Overpayment)
                    // Calculate Total Credits so far
                    const currentDebits = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
                    const currentCredits = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
                    const diffBase = this.round2(currentDebits - currentCredits);
                    const diffOrig = this.round2(diffBase * rate);

                    if (Math.abs(diffBase) > 0.01) {
                        // If Debits > Credits -> Surplus of Debit (Overpayment?) -> Credit Driver
                        // If Debits < Credits -> Surplus of Credit (Shortage?) -> Debit Driver

                        const settlerWalletId = params.userRole === 'driver'
                            ? (params.currency === 'USD' ? settings.driverWalletAccountUSD : settings.driverWalletAccountKHR)
                            : settings.defaultDriverWalletAccountId;
                        const settlerWallet = getAccount(settlerWalletId) || getAccount(settings.defaultDriverWalletAccountId);

                        if (settlerWallet) {
                            if (diffBase > 0) {
                                // Overpayment -> Credit Driver
                                // If no items were settled, this is just a Wallet Deposit/Credit
                                const desc = settleItems.length === 0 ? `Wallet Credit` : `Settlement Overpayment`;
                                lines.push({
                                    accountId: settlerWallet.id,
                                    debit: 0, credit: diffBase,
                                    originalCurrency: params.currency, originalExchangeRate: rate,
                                    originalDebit: 0, originalCredit: diffOrig,
                                    description: desc
                                });
                            } else {
                                // Shortage -> Debit Driver
                                const desc = settleItems.length === 0 ? `Wallet Debit` : `Settlement Shortage`;
                                lines.push({
                                    accountId: settlerWallet.id,
                                    debit: Math.abs(diffBase), credit: 0,
                                    originalCurrency: params.currency, originalExchangeRate: rate,
                                    originalDebit: Math.abs(diffOrig), originalCredit: 0,
                                    description: desc
                                });
                            }
                        } else {
                            errors.push("Settlement Driver Wallet Account not found");
                        }
                    }
                }
            }
        }

        // Final Validation
        const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
        const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
        const difference = this.round2(totalDebit - totalCredit);

        return {
            isValid: errors.length === 0 && Math.abs(difference) < 0.01,
            totalDebit,
            totalCredit,
            difference,
            lines,
            errors,
            warnings
        };
    }

    /**
     * Create and Save GL Entry
     */
    static async createGLEntry(
        params: GLBookingParams,
        context: AccountContext
    ): Promise<JournalEntry> {
        const preview = await this.previewGLEntry(params, context);

        if (!preview.isValid) {
            throw new Error(`GL Generation Failed: ${preview.errors.join(', ')}`);
        }

        const entry: JournalEntry = {
            id: `je-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            description: params.description || `${params.transactionType} - ${params.userName}`,
            reference: `REF-${Date.now().toString().slice(-6)}`,
            branchId: params.branchId,
            currency: params.currency,
            exchangeRate: 1, // Base lines handled exchange
            lines: preview.lines,
            status: 'POSTED',
            createdAt: Date.now()
        };

        return entry;
    }
}
